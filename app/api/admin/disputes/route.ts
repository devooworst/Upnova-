import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireAdmin, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import { logOrderEvent, orderTimeline } from "@/lib/server/orderEvents";

export const dynamic = "force-dynamic";

/** GET — the dispute review queue: BOTH sides' evidence, the private
 *  seller shipment record (incl. serial — platform review only), the
 *  order timeline, and INTERNAL risk context (prior dispute counts).
 *  Risk context informs the human; it never decides. */
export async function GET() {
  return guarded(() => {
    requireAdmin();
    const names = new Map(db.select().from(tables.profiles).all().map((p) => [p.userId, p.displayName]));
    const all = db.select().from(tables.disputes).orderBy(desc(tables.disputes.createdAt)).all();
    return {
      disputes: all.map((d) => {
        const o = db.select().from(tables.orders).where(eq(tables.orders.id, d.orderId)).get();
        const buyerPrior = all.filter((x) => x.id !== d.id && x.openedById === d.openedById).length;
        const sellerPrior = o
          ? all.filter((x) => {
              const xo = db.select().from(tables.orders).where(eq(tables.orders.id, x.orderId)).get();
              return x.id !== d.id && xo?.sellerId === o.sellerId;
            }).length
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
          timeline: o ? orderTimeline(o.id) : [],
          // INTERNAL risk context — advisory for the reviewer, never public,
          // never an automatic verdict
          risk: { buyerPriorDisputes: buyerPrior, sellerPriorDisputes: sellerPrior },
        };
      }),
    };
  });
}

/** PATCH { disputeId, resolution: refund_buyer | release_seller, note } —
 *  the human decision. Applies funds, closes the case, notifies BOTH
 *  parties with the reasoning. Never automatic. */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    requireAdmin();
    const d = db.select().from(tables.disputes).where(eq(tables.disputes.id, String(body.disputeId))).get();
    if (!d) throw new ApiError(404, "Dispute not found");
    if (["resolved_refund", "resolved_release", "withdrawn"].includes(d.status))
      throw new ApiError(409, "Already resolved");
    const resolution = String(body.resolution);
    if (!["refund_buyer", "release_seller"].includes(resolution)) throw new ApiError(400, "Pick a resolution");
    const o = db.select().from(tables.orders).where(eq(tables.orders.id, d.orderId)).get();
    if (!o) throw new ApiError(404, "Order missing");
    const note = String(body.note || "").slice(0, 500);

    if (resolution === "refund_buyer") {
      db.update(tables.payments)
        .set({ status: "refunded" })
        .where(and(eq(tables.payments.orderId, o.id), eq(tables.payments.status, "held")))
        .run();
      db.update(tables.orders).set({ status: "cancelled" }).where(eq(tables.orders.id, o.id)).run();
      db.update(tables.disputes)
        .set({ status: "resolved_refund", resolvedAt: new Date(), resolutionNote: note || "Resolved for the buyer after evidence review" })
        .where(eq(tables.disputes.id, d.id))
        .run();
      logOrderEvent(o.id, null, "resolved", `Platform review → refund to buyer.${note ? ` ${note}` : ""}`);
    } else {
      db.update(tables.payments)
        .set({ status: "released" })
        .where(and(eq(tables.payments.orderId, o.id), eq(tables.payments.status, "held")))
        .run();
      db.update(tables.orders).set({ status: "completed" }).where(eq(tables.orders.id, o.id)).run();
      db.update(tables.disputes)
        .set({ status: "resolved_release", resolvedAt: new Date(), resolutionNote: note || "Resolved for the seller after evidence review" })
        .where(eq(tables.disputes.id, d.id))
        .run();
      logOrderEvent(o.id, null, "resolved", `Platform review → release to seller.${note ? ` ${note}` : ""}`);
    }
    for (const uid of [o.buyerId, o.sellerId])
      notify({
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
