import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireAdmin, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import { logOrderEvent, orderTimeline } from "@/lib/server/orderEvents";
import { refundPayment } from "@/lib/server/paymentProvider";

export const dynamic = "force-dynamic";

/** GET — the dispute review queue: BOTH sides' evidence, the private
 *  seller shipment record (incl. serial — platform review only), the
 *  order timeline, and INTERNAL risk context (prior dispute counts).
 *  Risk context informs the human; it never decides. */
export async function GET() {
  return guarded(async () => {
    await requireAdmin();
    const names = new Map((await db.select().from(tables.profiles).all()).map((p) => [p.userId, p.displayName]));
    const all = await db.select().from(tables.disputes).orderBy(desc(tables.disputes.createdAt)).all();
    return {
      disputes: await Promise.all(all.map(async (d) => {
        const o = await db.select().from(tables.orders).where(eq(tables.orders.id, d.orderId)).get();
        const buyerPrior = all.filter((x) => x.id !== d.id && x.openedById === d.openedById).length;
        // one bulk load instead of a per-row async predicate
        const allOrders = await db.select().from(tables.orders).all();
        const orderById = new Map(allOrders.map((x) => [x.id, x]));
        const sellerPrior = o
          ? all.filter((x) => x.id !== d.id && orderById.get(x.orderId)?.sellerId === o.sellerId).length
          : 0;
        return {
          id: d.id,
          kind: d.kind,
          reason: d.reason,
          status: d.status,
          createdAt: d.createdAt.toISOString(),
          resolutionNote: d.resolutionNote,
          order: o
            ? {
                id: o.id,
                title: o.title,
                amount: o.price * o.qty,
                status: o.status,
                buyer: names.get(o.buyerId) ?? "—",
                seller: names.get(o.sellerId) ?? "—",
                tracking: (() => { try { return JSON.parse(o.tracking); } catch { return {}; } })(),
                sellerEvidence: (() => { try { return JSON.parse(o.sellerEvidence); } catch { return {}; } })(),
              }
            : null,
          evidence: (() => { try { return JSON.parse(d.evidence); } catch { return []; } })().map(
            (e: { by: string; at: string; note: string; photos: string[] }) => ({ ...e, by: names.get(e.by) ?? "—" })
          ),
          timeline: o ? await orderTimeline(o.id) : [],
          // INTERNAL risk context — advisory for the reviewer, never public,
          // never an automatic verdict
          risk: { buyerPriorDisputes: buyerPrior, sellerPriorDisputes: sellerPrior },
        };
      })),
    };
  });
}

/** PATCH { disputeId, resolution: refund_buyer | release_seller, note } —
 *  the human decision. Applies funds, closes the case, notifies BOTH
 *  parties with the reasoning. Never automatic. */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  return guarded(async () => {
    await requireAdmin();
    const d = await db.select().from(tables.disputes).where(eq(tables.disputes.id, String(body.disputeId))).get();
    if (!d) throw new ApiError(404, "Dispute not found");
    if (["resolved_refund", "resolved_release", "withdrawn"].includes(d.status))
      throw new ApiError(409, "Already resolved");
    const resolution = String(body.resolution);
    if (!["refund_buyer", "release_seller"].includes(resolution)) throw new ApiError(400, "Pick a resolution");
    const o = await db.select().from(tables.orders).where(eq(tables.orders.id, d.orderId)).get();
    if (!o) throw new ApiError(404, "Order missing");
    const note = String(body.note || "").slice(0, 500);

    if (resolution === "refund_buyer") {
      // provider-side refund first (admin authorization already enforced
      // above via requireAdmin; the held-status guard stays the second layer)
      const held = await db.select().from(tables.payments)
        .where(and(eq(tables.payments.orderId, o.id), eq(tables.payments.status, "held")))
        .get();
      if (held) await refundPayment(held);
      await db.update(tables.payments)
        .set({ status: "refunded" })
        .where(and(eq(tables.payments.orderId, o.id), eq(tables.payments.status, "held")))
        .run();
      await db.update(tables.orders).set({ status: "cancelled" }).where(eq(tables.orders.id, o.id)).run();
      await db.update(tables.disputes)
        .set({ status: "resolved_refund", resolvedAt: new Date(), resolutionNote: note || "Resolved for the buyer after evidence review" })
        .where(eq(tables.disputes.id, d.id))
        .run();
      await logOrderEvent(o.id, null, "resolved", `Platform review → refund to buyer.${note ? ` ${note}` : ""}`);
    } else {
      await db.update(tables.payments)
        .set({ status: "released" })
        .where(and(eq(tables.payments.orderId, o.id), eq(tables.payments.status, "held")))
        .run();
      await db.update(tables.orders).set({ status: "completed" }).where(eq(tables.orders.id, o.id)).run();
      await db.update(tables.disputes)
        .set({ status: "resolved_release", resolvedAt: new Date(), resolutionNote: note || "Resolved for the seller after evidence review" })
        .where(eq(tables.disputes.id, d.id))
        .run();
      await logOrderEvent(o.id, null, "resolved", `Platform review → release to seller.${note ? ` ${note}` : ""}`);
    }
    for (const uid of [o.buyerId, o.sellerId])
      await notify({
        userId: uid,
        type: "order",
        title: `Case resolved — ${o.title}`,
        body: `${resolution === "refund_buyer" ? "Refunded to the buyer" : "Funds released to the seller"} after evidence review.${note ? ` "${note}"` : ""}`,
        href: "/orders",
        priority: "high",
      });
    return { status: resolution === "refund_buyer" ? "resolved_refund" : "resolved_release" };
  });
}
