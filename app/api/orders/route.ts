import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { and, desc, eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { notify } from "@/lib/server/notify";
import { parseVariants, parseFulfillment, type OrderTracking } from "@/lib/products";
import { protectionRules } from "@/lib/protection";
import { logOrderEvent } from "@/lib/server/orderEvents";

export const dynamic = "force-dynamic";

/** GET /api/orders — my purchases and my sales, with live states. */
export async function GET() {
  return guarded(async () => {
    const user = await requireUser();
    const rows = await db
      .select()
      .from(tables.orders)
      .where(or(eq(tables.orders.buyerId, user.id), eq(tables.orders.sellerId, user.id)))
      .orderBy(desc(tables.orders.createdAt))
      .all();

    // open disputes freeze everything — fetch once for the lazy transitions
    const allDisputes = await db.select().from(tables.disputes).all();
    const hasOpenDispute = (orderId: string) =>
      allDisputes.some((d) => d.orderId === orderId && ["open", "under_review", "return_authorized", "return_in_transit"].includes(d.status));

    for (const o of rows) {
      // carrier confirms delivery (demo: ETA passed) → the buyer-protection
      // window STARTS. No eternal manual confirmation required.
      if (o.status === "shipped") {
        try {
          const t = JSON.parse(o.tracking) as OrderTracking;
          if (t.eta && new Date(t.eta).getTime() < Date.now()) {
            const rules = protectionRules(o.price * o.qty);
            const ends = new Date(Date.now() + rules.protectionHours * 3600_000);
            await db.update(tables.orders).set({ status: "delivered", protectionEndsAt: ends }).where(eq(tables.orders.id, o.id)).run();
            o.status = "delivered";
            o.protectionEndsAt = ends;
            await logOrderEvent(o.id, null, "delivered", "Carrier confirmed delivery");
            await logOrderEvent(o.id, null, "protection_started", `${rules.protectionHours}h buyer-protection window`);
            await notify({
              userId: o.buyerId,
              actorId: o.sellerId,
              type: "order",
              title: `Delivered — ${o.title}`,
              body: `Everything good? Confirm anytime — otherwise the order completes automatically when your ${rules.protectionHours}h protection window ends. Problems? Report them before then.`,
              href: "/orders",
            });
          }
        } catch {}
      }
      // protection window over + no open case → auto-complete, release funds
      if (o.status === "delivered" && o.protectionEndsAt && o.protectionEndsAt.getTime() < Date.now() && !hasOpenDispute(o.id)) {
        await db.update(tables.orders).set({ status: "completed" }).where(eq(tables.orders.id, o.id)).run();
        await db.update(tables.payments)
          .set({ status: "released" })
          .where(and(eq(tables.payments.orderId, o.id), eq(tables.payments.status, "held")))
          .run();
        o.status = "completed";
        await logOrderEvent(o.id, null, "completed", "Protection window ended with no reported problem — funds released");
        await notify({ userId: o.sellerId, actorId: o.buyerId, type: "payment", title: `Order completed — $${o.price * o.qty} released`, body: `${o.title} · protection window ended with no reported problems`, href: "/orders", category: "payments" });
      }
    }

    const payments = (await db.select().from(tables.payments).all()).filter((p) => p.orderId);
    return {
      orders: await Promise.all(rows.map(async (o) => {
        const otherId = o.buyerId === user.id ? o.sellerId : o.buyerId;
        const otherUser = (await db.select().from(tables.users).where(eq(tables.users.id, otherId)).get())!;
        const otherProfile = (await db.select().from(tables.profiles).where(eq(tables.profiles.userId, otherId)).get())!;
        const payment = payments.find((p) => p.orderId === o.id);
        return {
          id: o.id,
          productId: o.productId,
          title: o.title,
          price: o.price,
          qty: o.qty,
          variant: o.variant,
          fulfillment: o.fulfillment,
          note: o.note,
          status: o.status,
          tracking: (() => { try { return JSON.parse(o.tracking); } catch { return {}; } })(),
          protectionEndsAt: o.protectionEndsAt?.toISOString() ?? null,
          protection: protectionRules(o.price * o.qty),
          dispute: (() => {
            const d = allDisputes.filter((x) => x.orderId === o.id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
            return d ? { id: d.id, kind: d.kind, reason: d.reason, status: d.status, openedByMe: d.openedById === user.id } : null;
          })(),
          // serial and shipment evidence stay PRIVATE: full detail via the
          // timeline endpoint with role-based masking, never in list payloads
          hasSellerEvidence: o.sellerEvidence !== "{}",
          paymentStatus: payment?.status ?? null,
          conversationId: o.conversationId,
          myRole: o.buyerId === user.id ? "buyer" : "seller",
          with: publicUser(otherUser, otherProfile),
          createdAt: o.createdAt.toISOString(),
        };
      })),
    };
  });
}

/** POST /api/orders — place an order (Mavyn checkout products only). */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const product = await db.select().from(tables.products).where(eq(tables.products.id, String(body.productId))).get();
    if (!product || product.status === "archived") throw new ApiError(404, "Product not found");
    if (product.sellerId === user.id) throw new ApiError(400, "You can't buy your own listing");
    if (product.externalUrl)
      throw new ApiError(409, "This product is sold on the seller's website — Mavyn checkout doesn't apply");

    const qty = Math.min(10, Math.max(1, Math.round(Number(body.qty) || 1)));
    const available = product.quantity - product.sold;
    if (product.status === "sold_out" || available < qty)
      throw new ApiError(409, available < 1 ? "Sold out" : `Only ${available} left`);

    // variants: buyer's picks must be real options — server-checked
    const groups = parseVariants(product.variants);
    const picks: string[] = [];
    for (const g of groups) {
      const pick = String((body.variants ?? {})[g.name] ?? "");
      if (!g.options.includes(pick)) throw new ApiError(400, `Pick a ${g.name}`);
      picks.push(`${g.name}: ${pick}`);
    }

    const offered = parseFulfillment(product.fulfillment);
    const fulfillment = offered.includes(body.fulfillment) ? body.fulfillment : offered[0];

    const id = randomBytes(12).toString("hex");
    await db.insert(tables.orders)
      .values({
        id,
        productId: product.id,
        buyerId: user.id,
        sellerId: product.sellerId,
        title: product.title,
        price: product.price,
        qty,
        variant: picks.join(" · "),
        fulfillment,
        // pickup: NO addresses stored — exact location is arranged in the
        // conversation after confirmation, on purpose
        note: String(body.note || "").slice(0, 300),
      })
      .run();
    await logOrderEvent(id, user.id, "created", `${product.title}${picks.length ? ` (${picks.join(" · ")})` : ""} ×${qty} · listing price $${product.price}`);

    return { id, status: "placed", total: product.price * qty };
  });
}
