import { desc, eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** GET /api/me/disputes — YOUR dispute cases only: every dispute on an
 *  order where the caller is buyer or seller. Exactly the authorization
 *  rule the per-order dispute API enforces (parties only — see
 *  /api/orders/[id]/dispute); platform review uses /api/admin/disputes.
 *  Reuses the existing dispute model verbatim — no parallel schema. */
export async function GET() {
  return guarded(async () => {
    const user = await requireUser();

    const myOrders = await db
      .select()
      .from(tables.orders)
      .where(or(eq(tables.orders.buyerId, user.id), eq(tables.orders.sellerId, user.id)))
      .all();
    if (myOrders.length === 0) return { disputes: [] };
    const orderById = new Map(myOrders.map((o) => [o.id, o]));

    const names = new Map(
      (await db.select().from(tables.profiles).all()).map((p) => [p.userId, p.displayName] as const)
    );

    const mine = (await db
      .select()
      .from(tables.disputes)
      .orderBy(desc(tables.disputes.createdAt))
      .all())
      // authorization: only disputes on MY orders ever leave this endpoint
      .filter((d) => orderById.has(d.orderId));

    return {
      disputes: mine.map((d) => {
        const o = orderById.get(d.orderId)!;
        const myRole = o.buyerId === user.id ? ("buyer" as const) : ("seller" as const);
        return {
          id: d.id,
          kind: d.kind, // problem | return — existing vocabulary
          reason: d.reason,
          status: d.status, // existing lifecycle, labeled client-side via DISPUTE_STATUS_LABEL
          openedByMe: d.openedById === user.id,
          createdAt: d.createdAt.toISOString(),
          resolvedAt: d.resolvedAt ? d.resolvedAt.toISOString() : null,
          resolutionNote: d.resolutionNote,
          evidenceCount: (() => {
            try {
              return (JSON.parse(d.evidence) as unknown[]).length;
            } catch {
              return 0;
            }
          })(),
          order: {
            id: o.id,
            title: o.title,
            amount: o.price * o.qty,
            myRole,
            with: names.get(myRole === "buyer" ? o.sellerId : o.buyerId) ?? "—",
          },
        };
      }),
    };
  });
}
