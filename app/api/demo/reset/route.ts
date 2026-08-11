import { NextRequest } from "next/server";
import { and, eq, or, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError, isDemoMode , requireQaOperator } from "@/lib/server/auth";
import { isSeedUser } from "@/lib/server/demo";

export const dynamic = "force-dynamic";

/**
 * POST /api/demo/reset { kind } — Test Center scenario reset.
 * Deletes ONLY the caller's own test transactions of that kind where
 * the counterpart is a seed demo account (bookings + their payments,
 * orders + their events + payments, or applications). Conversations
 * and messages are kept as history; auth, verification, plan, and
 * every other account fact are untouched. Demo deployments only, and
 * only while the caller is in Demo Mode (the developer context).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return guarded(() => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    const user = requireQaOperator();
    const me = db.select().from(tables.users).where(eq(tables.users.id, user.id)).get()!;
    if (me.testerMode === "simulation")
      throw new ApiError(403, "Scenario reset is a Demo Mode tool — switch modes in the top-left first");
    const kind = String(body.kind || "");

    if (kind === "booking") {
      const rows = db
        .select()
        .from(tables.bookings)
        .where(or(eq(tables.bookings.clientId, user.id), eq(tables.bookings.providerId, user.id)))
        .all()
        .filter((b) => isSeedUser(b.clientId === user.id ? b.providerId : b.clientId));
      for (const b of rows) {
        db.delete(tables.payments).where(eq(tables.payments.bookingId, b.id)).run();
        db.delete(tables.bookings).where(eq(tables.bookings.id, b.id)).run();
      }
      return { reset: rows.length };
    }
    if (kind === "purchase") {
      const rows = db
        .select()
        .from(tables.orders)
        .where(or(eq(tables.orders.buyerId, user.id), eq(tables.orders.sellerId, user.id)))
        .all()
        .filter((o) => isSeedUser(o.buyerId === user.id ? o.sellerId : o.buyerId));
      const ids = rows.map((o) => o.id);
      if (ids.length) {
        db.delete(tables.orderEvents).where(inArray(tables.orderEvents.orderId, ids)).run();
        for (const o of rows) {
          db.delete(tables.payments).where(eq(tables.payments.orderId, o.id)).run();
          db.delete(tables.orders).where(eq(tables.orders.id, o.id)).run();
        }
      }
      return { reset: rows.length };
    }
    if (kind === "application") {
      const rows = db
        .select({ app: tables.applications, opp: tables.opportunities })
        .from(tables.applications)
        .innerJoin(tables.opportunities, eq(tables.applications.opportunityId, tables.opportunities.id))
        .where(and(eq(tables.applications.applicantId, user.id)))
        .all()
        .filter((r) => isSeedUser(r.opp.posterId));
      for (const r of rows) db.delete(tables.applications).where(eq(tables.applications.id, r.app.id)).run();
      return { reset: rows.length };
    }
    throw new ApiError(400, "kind must be booking | purchase | application");
  });
}
