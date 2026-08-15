import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import { conversationBetween } from "@/lib/server/oppFlow";
import { seedSellerFulfills } from "@/lib/server/demo";
import { createPayment, refundPayment } from "@/lib/server/paymentProvider";
import type { OrderTracking } from "@/lib/products";
import { protectionRules } from "@/lib/protection";
import { logOrderEvent } from "@/lib/server/orderEvents";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/orders/[id] { action, ... } — the order lifecycle, with every
 * transition role-checked and sequence-checked server-side:
 *   placed → (buyer pays) secured → (seller) preparing → shipped
 *   → delivered → (buyer confirms) completed → payout released.
 * Funds stay HELD from payment until completion. Cancels before shipping
 * refund in full. "Report a problem" files into human moderation.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const o = await db.select().from(tables.orders).where(eq(tables.orders.id, params.id)).get();
    if (!o) throw new ApiError(404, "Order not found");
    const isBuyer = o.buyerId === user.id;
    const isSeller = o.sellerId === user.id;
    if (!isBuyer && !isSeller) throw new ApiError(403, "Not your order");

    const other = isBuyer ? o.sellerId : o.buyerId;
    const action = String(body.action);
    const set = async (patch: Partial<typeof tables.orders.$inferInsert>) =>
      await db.update(tables.orders).set(patch).where(eq(tables.orders.id, o.id)).run();
    const sys = async (convId: string, text: string) => {
      await db.insert(tables.messages)
        .values({ id: randomBytes(12).toString("hex"), conversationId: convId, senderId: user.id, body: text, kind: "system" })
        .run();
      await db.update(tables.conversations).set({ updatedAt: new Date() }).where(eq(tables.conversations.id, convId)).run();
    };

    if (action === "pay") {
      if (!isBuyer) throw new ApiError(403, "Only the buyer pays");
      if (o.status !== "placed") throw new ApiError(409, `Cannot pay from ${o.status}`);
      // transaction authentication — the buyer approves a SPECIFIC amount
      const subtotal = o.price * o.qty;
      const totalCents = Math.round(subtotal * 105);
      if (body.expectedTotal != null && Math.round(Number(body.expectedTotal) * 100) !== totalCents)
        throw new ApiError(409, `The total changed — it is now $${(totalCents / 100).toFixed(2)}. Review before paying.`);

      // stock check at pay time, not just at order time
      const product = o.productId
        ? await db.select().from(tables.products).where(eq(tables.products.id, o.productId)).get()
        : null;
      if (product && product.quantity - product.sold < o.qty) throw new ApiError(409, "Sold out while you were checking out");

      const paymentId = randomBytes(12).toString("hex");
      const charge = await createPayment({
        paymentId,
        amountCents: subtotal * 100,
        feeCents: Math.round(subtotal * 5),
        payerId: o.buyerId,
        payeeId: o.sellerId,
        description: `Mavyn order — ${o.title}`,
      });
      await db.insert(tables.payments)
        .values({
          id: paymentId,
          orderId: o.id,
          payerId: o.buyerId,
          payeeId: o.sellerId,
          amountCents: subtotal * 100,
          feeCents: Math.round(subtotal * 5),
          status: charge.settled ? "held" : "pending",
          provider: charge.provider,
          providerRef: charge.providerRef,
        })
        .run();
      if (product) {
        await db.update(tables.products)
          .set({
            sold: product.sold + o.qty,
            status: product.quantity - (product.sold + o.qty) < 1 ? "sold_out" : product.status,
          })
          .where(eq(tables.products.id, product.id))
          .run();
      }
      const convId = o.conversationId ?? (await conversationBetween(o.buyerId, o.sellerId));
      await set({ status: "secured", conversationId: convId });
      await logOrderEvent(o.id, user.id, "paid", `$${((subtotal * 105) / 100).toFixed(2)} secured (incl. fee) — held until completion`);
      await sys(convId, `Order placed — ${o.title}${o.variant ? ` (${o.variant})` : ""} ×${o.qty}. Payment secured: $${((subtotal * 105) / 100).toFixed(2)}. Funds are held until the order completes.`);
      await notify({
        userId: other,
        actorId: user.id,
        type: "order",
        title: `New order — ${o.title}`,
        body: `$${subtotal} secured · ${o.fulfillment === "pickup" ? "local pickup — arrange the meetup in Messages" : o.fulfillment}`,
        href: "/orders",
        category: "payments",
      });
      // demo: seed sellers prepare + ship immediately with mock tracking
      await seedSellerFulfills(o.id);
      const fresh = (await db.select().from(tables.orders).where(eq(tables.orders.id, o.id)).get())!;
      return { status: fresh.status, conversationId: convId };
    }

    if (action === "preparing") {
      if (!isSeller) throw new ApiError(403, "Only the seller updates fulfillment");
      if (o.status !== "secured") throw new ApiError(409, `Cannot start preparing from ${o.status}`);
      await set({ status: "preparing" });
      await notify({ userId: other, actorId: user.id, type: "order", title: `Seller is preparing your order`, body: o.title, href: "/orders", priority: "normal" });
      return { status: "preparing" };
    }

    if (action === "ship") {
      if (!isSeller) throw new ApiError(403, "Only the seller ships");
      if (!["secured", "preparing"].includes(o.status)) throw new ApiError(409, `Cannot ship from ${o.status}`);
      const tracking: OrderTracking = {
        carrier: String(body.carrier || "").slice(0, 30) || undefined,
        code: String(body.code || "").slice(0, 40) || undefined,
        eta: body.eta ? new Date(body.eta).toISOString() : undefined,
      };
      // pre-shipment evidence — PRIVATE (serial never public; weight is
      // context, never proof of contents). Required for high-value orders.
      const rules = protectionRules(o.price * o.qty);
      const photos = Array.isArray(body.evidencePhotos)
        ? body.evidencePhotos.filter((p: unknown) => typeof p === "string" && (p as string).startsWith("data:image/") && (p as string).length < 500_000).slice(0, 3)
        : [];
      const evidence = {
        serial: String(body.serial || "").slice(0, 60) || undefined,
        weightLb: body.weightLb ? Math.max(0, Number(body.weightLb) || 0) : undefined,
        note: String(body.evidenceNote || "").slice(0, 300) || undefined,
        photos,
      };
      if (rules.sellerEvidenceRequired && !evidence.serial && photos.length === 0)
        throw new ApiError(400, `High-value order ($${o.price * o.qty}) — record the serial number or a photo of the actual item before shipping. It protects YOU in a dispute.`);
      await set({ status: "shipped", tracking: JSON.stringify(tracking), sellerEvidence: JSON.stringify(evidence) });
      await logOrderEvent(o.id, user.id, "shipped", `${tracking.carrier ?? ""} ${tracking.code ?? ""}${evidence.serial ? " · serial recorded (private)" : ""}${photos.length ? ` · ${photos.length} pre-ship photo(s)` : ""}${evidence.weightLb ? ` · ${evidence.weightLb} lb (weight is context, not proof of contents)` : ""}`.trim());
      if (o.conversationId)
        await sys(o.conversationId, `${o.title} shipped${tracking.carrier ? ` via ${tracking.carrier}` : ""}${tracking.code ? ` · tracking ${tracking.code}` : ""}${tracking.eta ? ` · estimated ${new Date(tracking.eta).toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : ""}.`);
      await notify({ userId: other, actorId: user.id, type: "order", title: `Shipped — ${o.title}`, body: tracking.eta ? `Estimated delivery ${new Date(tracking.eta).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "", href: "/orders" });
      return { status: "shipped" };
    }

    if (action === "handoff") {
      // pickup/delivery/digital: seller marks it handed over
      if (!isSeller) throw new ApiError(403, "Only the seller confirms handoff");
      if (!["secured", "preparing"].includes(o.status)) throw new ApiError(409, `Cannot hand off from ${o.status}`);
      const hRules = protectionRules(o.price * o.qty);
      await set({ status: "delivered", protectionEndsAt: new Date(Date.now() + hRules.protectionHours * 3600_000) });
      await logOrderEvent(o.id, user.id, "delivered", "Seller marked handed off");
      await logOrderEvent(o.id, null, "protection_started", `${hRules.protectionHours}h buyer-protection window`);
      await notify({ userId: other, actorId: user.id, type: "order", title: `Handed off — ${o.title}`, body: `Confirm receipt anytime — otherwise the order completes when the ${hRules.protectionHours}h protection window ends.`, href: "/orders" });
      return { status: "delivered" };
    }

    if (action === "confirm_received") {
      if (!isBuyer) throw new ApiError(403, "Only the buyer confirms receipt");
      if (!["shipped", "delivered"].includes(o.status)) throw new ApiError(409, `Cannot confirm from ${o.status}`);
      const openCase = (await db
        .select()
        .from(tables.disputes)
        .where(eq(tables.disputes.orderId, o.id))
        .all())
        .some((d) => ["open", "under_review", "return_authorized", "return_in_transit"].includes(d.status));
      if (openCase) throw new ApiError(409, "There's an open case on this order — resolve or withdraw it first");
      await set({ status: "completed" });
      await logOrderEvent(o.id, user.id, "completed", "Buyer confirmed receipt — funds released");
      await db.update(tables.payments)
        .set({ status: "released" })
        .where(and(eq(tables.payments.orderId, o.id), eq(tables.payments.status, "held")))
        .run();
      if (o.conversationId) await sys(o.conversationId, `Order completed — $${o.price * o.qty} released to the seller.`);
      await notify({ userId: other, actorId: user.id, type: "order", title: `Order completed — $${o.price * o.qty} released`, body: o.title, href: "/orders", category: "payments" });
      return { status: "completed" };
    }

    if (action === "cancel") {
      // either side, before shipping only — after that it's a dispute lane
      if (!["placed", "secured", "preparing"].includes(o.status))
        throw new ApiError(409, "Shipped orders can't be cancelled — use Report a problem instead");
      const hadPayment = ["secured", "preparing"].includes(o.status);
      if (hadPayment) {
        const held = await db.select().from(tables.payments)
          .where(and(eq(tables.payments.orderId, o.id), eq(tables.payments.status, "held")))
          .get();
        if (held) await refundPayment(held); // provider-side; state guard below stays
      }
      await db.update(tables.payments)
        .set({ status: "refunded" })
        .where(and(eq(tables.payments.orderId, o.id), eq(tables.payments.status, "held")))
        .run();
      if (hadPayment && o.productId) {
        const product = await db.select().from(tables.products).where(eq(tables.products.id, o.productId)).get();
        if (product)
          await db.update(tables.products)
            .set({ sold: Math.max(0, product.sold - o.qty), status: product.status === "sold_out" ? "active" : product.status })
            .where(eq(tables.products.id, product.id))
            .run();
      }
      await set({ status: "cancelled" });
      await logOrderEvent(o.id, user.id, "cancelled", hadPayment ? "Refunded in full" : "");
      if (o.conversationId) await sys(o.conversationId, `Order cancelled — ${o.title}.${hadPayment ? " Payment refunded in full." : ""}`);
      await notify({ userId: other, actorId: user.id, type: "order", title: `Order cancelled — ${o.title}`, body: hadPayment ? "Payment refunded in full" : "", href: "/orders" });
      return { status: "cancelled" };
    }

    throw new ApiError(400, "Unknown action");
  });
}
