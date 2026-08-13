import { and, eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/summary — REAL performance-over-time metrics
 * computed from the caller's actual records (payments, bookings,
 * projects, follows). This is the Analytics side of the split:
 * Activity answers "what's happening right now"; this answers
 * "how am I performing over time". Nothing here is sampled or
 * fabricated — metrics we don't track (like profile views) are
 * simply not returned.
 */
export async function GET() {
  return guarded(async () => {
    const user = await requireUser();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

    // money released TO me (earnings) — the historical trend
    const paymentsIn = (await db
      .select()
      .from(tables.payments)
      .where(eq(tables.payments.payeeId, user.id))
      .all())
      .filter((p) => p.status === "released");
    const dollars = (cents: number) => Math.round(cents / 100);
    const revenueThisMonth = dollars(paymentsIn.filter((p) => p.createdAt.getTime() >= monthStart).reduce((n, p) => n + p.amountCents, 0));
    const revenueLastMonth = dollars(
      paymentsIn
        .filter((p) => p.createdAt.getTime() >= lastMonthStart && p.createdAt.getTime() < monthStart)
        .reduce((n, p) => n + p.amountCents, 0)
    );
    const revenueAllTime = dollars(paymentsIn.reduce((n, p) => n + p.amountCents, 0));
    const avgValue = paymentsIn.length ? dollars(paymentsIn.reduce((n, p) => n + p.amountCents, 0) / paymentsIn.length) : 0;

    // repeat clients — payers with 2+ payments to me (held or released)
    const allIn = await db.select().from(tables.payments).where(eq(tables.payments.payeeId, user.id)).all();
    const byPayer = new Map<string, number>();
    for (const p of allIn) byPayer.set(p.payerId, (byPayer.get(p.payerId) ?? 0) + 1);
    const clients = byPayer.size;
    const repeatClients = Array.from(byPayer.values()).filter((n) => n >= 2).length;

    // delivery track record — completed engagements
    const completedBookings = (
      await db
        .select()
        .from(tables.bookings)
        .where(and(eq(tables.bookings.providerId, user.id), eq(tables.bookings.status, "completed")))
        .all()
    ).length;
    const completedProjects = (
      await db.select().from(tables.projects).where(eq(tables.projects.creatorId, user.id)).all()
    ).filter((p) => ["completed", "reviewed"].includes(p.state)).length;

    // audience growth — real follower count (+ this month's new follows)
    const followers = await db.select().from(tables.follows).where(eq(tables.follows.followingId, user.id)).all();
    const followersNewThisMonth = followers.filter((f) => f.createdAt.getTime() >= monthStart).length;

    return {
      revenue: {
        thisMonth: revenueThisMonth,
        lastMonth: revenueLastMonth,
        delta: revenueThisMonth - revenueLastMonth,
        allTime: revenueAllTime,
      },
      avgValue,
      clients,
      repeatClients,
      completedEngagements: completedBookings + completedProjects,
      followers: followers.length,
      followersNewThisMonth,
    };
  });
}
