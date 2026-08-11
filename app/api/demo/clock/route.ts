import { NextRequest } from "next/server";
import { eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError, isDemoMode , requireQaOperator } from "@/lib/server/auth";
import { qaIds } from "@/lib/server/qa";

export const dynamic = "force-dynamic";

/**
 * POST /api/demo/clock { advanceMs, scope? } — Test-Center time
 * simulation. "Advancing time" ages LIVE records by the given amount —
 * bookings' start times, orders' protection windows, opportunity
 * deadlines, and project deadlines — so deadline, overdue, reminder,
 * and expiry logic can be tested without waiting.
 *
 *   scope omitted → the CALLER'S own records (unchanged behavior)
 *   scope "qa"    → the QA test personas' records (the QA Lab's
 *                   scenarios), never anyone else's
 *
 * TEST-CENTER ONLY: never touches the real clock, production 404s.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return guarded(() => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    const user = requireQaOperator();
    const ms = Math.min(30 * 86400_000, Math.max(0, Number(body.advanceMs) || 0));
    if (!ms) throw new ApiError(400, "advanceMs required (max 30 days)");

    const subjects: string[] =
      String(body.scope) === "qa"
        ? (() => {
            const ids = qaIds();
            return [ids.customer, ids.creator, ids.business];
          })()
        : [user.id];

    let touched = 0;
    for (const id of subjects) {
      for (const b of db.select().from(tables.bookings).where(or(eq(tables.bookings.clientId, id), eq(tables.bookings.providerId, id))).all()) {
        if (["pending", "accepted", "confirmed"].includes(b.status)) {
          db.update(tables.bookings).set({ startsAt: new Date(b.startsAt.getTime() - ms) }).where(eq(tables.bookings.id, b.id)).run();
          touched++;
        }
      }
      for (const o of db.select().from(tables.orders).where(or(eq(tables.orders.buyerId, id), eq(tables.orders.sellerId, id))).all()) {
        if (o.protectionEndsAt) {
          db.update(tables.orders).set({ protectionEndsAt: new Date(o.protectionEndsAt.getTime() - ms) }).where(eq(tables.orders.id, o.id)).run();
          touched++;
        }
      }
      for (const opp of db.select().from(tables.opportunities).where(eq(tables.opportunities.posterId, id)).all()) {
        if (opp.applyBy) {
          db.update(tables.opportunities).set({ applyBy: new Date(opp.applyBy.getTime() - ms) }).where(eq(tables.opportunities.id, opp.id)).run();
          touched++;
        }
      }
      // project deadlines age too — overdue states become testable
      for (const p of db.select().from(tables.projects).where(or(eq(tables.projects.clientId, id), eq(tables.projects.creatorId, id))).all()) {
        if (p.deadline && !["completed", "reviewed", "cancelled"].includes(p.state)) {
          db.update(tables.projects).set({ deadline: new Date(p.deadline.getTime() - ms) }).where(eq(tables.projects.id, p.id)).run();
          touched++;
        }
      }
    }
    return {
      ok: true,
      advancedMs: ms,
      recordsAged: touched,
      scope: String(body.scope) === "qa" ? "qa" : "self",
      note: "Reload the relevant pages — lazy evaluators (booking phases, order completion, deadlines) now see the elapsed time.",
    };
  });
}
