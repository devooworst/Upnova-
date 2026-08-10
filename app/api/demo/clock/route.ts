import { NextRequest } from "next/server";
import { eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError, isDemoMode } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/demo/clock { advanceMs } — Test-Center time simulation.
 * "Advancing time" ages the CALLER'S OWN live records by the given
 * amount (bookings, orders' protection windows, posted opportunity
 * deadlines) so deadline/reminder/expiry logic can be tested without
 * waiting. TEST-CENTER ONLY: never touches the real clock, never
 * touches other people's records, production 404s.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return guarded(() => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    const user = requireUser();
    const ms = Math.min(30 * 86400_000, Math.max(0, Number(body.advanceMs) || 0));
    if (!ms) throw new ApiError(400, "advanceMs required (max 30 days)");

    let touched = 0;
    for (const b of db.select().from(tables.bookings).where(or(eq(tables.bookings.clientId, user.id), eq(tables.bookings.providerId, user.id))).all()) {
      if (["pending", "accepted", "confirmed"].includes(b.status)) {
        db.update(tables.bookings).set({ startsAt: new Date(b.startsAt.getTime() - ms) }).where(eq(tables.bookings.id, b.id)).run();
        touched++;
      }
    }
    for (const o of db.select().from(tables.orders).where(or(eq(tables.orders.buyerId, user.id), eq(tables.orders.sellerId, user.id))).all()) {
      if (o.protectionEndsAt) {
        db.update(tables.orders).set({ protectionEndsAt: new Date(o.protectionEndsAt.getTime() - ms) }).where(eq(tables.orders.id, o.id)).run();
        touched++;
      }
    }
    for (const opp of db.select().from(tables.opportunities).where(eq(tables.opportunities.posterId, user.id)).all()) {
      if (opp.applyBy) {
        db.update(tables.opportunities).set({ applyBy: new Date(opp.applyBy.getTime() - ms) }).where(eq(tables.opportunities.id, opp.id)).run();
        touched++;
      }
    }
    return { ok: true, advancedMs: ms, recordsAged: touched, note: "Reload the relevant pages — lazy evaluators (booking phases, order completion, deadlines) now see the elapsed time." };
  });
}
