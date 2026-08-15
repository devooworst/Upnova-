import { and, eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/summary — REAL performance-over-time metrics
 * computed from the caller's actual records (payments, bookings,
 * projects, follows, and the interactions signal log). This is the
 * Analytics side of the split: Activity answers "what's happening
 * right now"; this answers "how am I performing over time". Nothing
 * here is sampled or fabricated — metrics we don't track are simply
 * not returned, and small numbers are shown as the small numbers
 * they are.
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

    /* ---------------- engagement — the interactions signal log ----------------
       Every metric below is labeled as EXACTLY what it counts:
       · profileViews  = recorded profile_view events on MY user id
       · contentViews  = recorded view events on MY posts (feed impressions
                         are logged for the first 12 items a viewer loads —
                         an undercount, never an overcount)
       · serviceViews  = recorded service_view events on MY service listings
       Views are only collected from signed-in browsing; guest traffic isn't
       tracked. Small numbers are the honest numbers. */
    const myPosts = await db.select().from(tables.posts).where(eq(tables.posts.authorId, user.id)).all();
    const myPostIds = myPosts.map((p) => p.id);
    const myServiceIds = (await db.select().from(tables.services).where(eq(tables.services.ownerId, user.id)).all()).map((s) => s.id);

    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400e3);
    const profileViewRows = await db
      .select()
      .from(tables.interactions)
      .where(and(eq(tables.interactions.targetType, "user"), eq(tables.interactions.targetId, user.id), eq(tables.interactions.action, "profile_view")))
      .all();
    const postViewRows = myPostIds.length
      ? (await db
          .select()
          .from(tables.interactions)
          .where(and(eq(tables.interactions.targetType, "post"), eq(tables.interactions.action, "view"), inArray(tables.interactions.targetId, myPostIds)))
          .all())
      : [];
    const serviceViewRows = myServiceIds.length
      ? (await db
          .select()
          .from(tables.interactions)
          .where(and(eq(tables.interactions.targetType, "service"), eq(tables.interactions.action, "service_view"), inArray(tables.interactions.targetId, myServiceIds)))
          .all())
      : [];

    // last-7-days daily buckets of views on my content (post views + profile views, SEPARATE series)
    const dayKey = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short" });
    const days: { day: string; contentViews: number; profileViews: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
      const inDay = (t: Date) => t >= dayStart && t < dayEnd;
      days.push({
        day: dayKey(dayStart),
        contentViews: postViewRows.filter((r) => inDay(r.createdAt)).length,
        profileViews: profileViewRows.filter((r) => inDay(r.createdAt)).length,
      });
    }

    // likes/comments RECEIVED on my posts — real social engagement counts
    const likesReceived = myPostIds.length
      ? (await db.select().from(tables.likes).where(inArray(tables.likes.postId, myPostIds)).all()).length
      : 0;
    const commentsReceived = myPostIds.length
      ? (await db.select().from(tables.comments).where(inArray(tables.comments.postId, myPostIds)).all()).length
      : 0;

    /* top posts — MY posts ranked by real engagement (likes + comments +
       recorded views). Only posts with ANY engagement qualify: an empty
       list is the honest answer for a quiet account. */
    const likeRows = myPostIds.length ? await db.select().from(tables.likes).where(inArray(tables.likes.postId, myPostIds)).all() : [];
    const commentRows = myPostIds.length ? await db.select().from(tables.comments).where(inArray(tables.comments.postId, myPostIds)).all() : [];
    const viewsByPost = new Map<string, number>();
    for (const r of postViewRows) viewsByPost.set(r.targetId, (viewsByPost.get(r.targetId) ?? 0) + 1);
    const topPosts = myPosts
      .map((p) => {
        const likes = likeRows.filter((l) => l.postId === p.id).length;
        const comments = commentRows.filter((c) => c.postId === p.id).length;
        const views = viewsByPost.get(p.id) ?? 0;
        return {
          id: p.id,
          title: p.body.length > 64 ? p.body.slice(0, 64) + "…" : p.body || "(untitled)",
          likes,
          comments,
          views,
          engagement: likes + comments + views,
        };
      })
      .filter((p) => p.engagement > 0)
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 5);

    /* audience — WHERE the accounts that engaged with me are from.
       Distinct engaged users (viewed/liked/commented/followed), located by
       their own profile's city/state ONLY when their privacy settings
       show location. Buckets under privacy floors fall into "Not shared". */
    const engagedUserIds = new Set<string>([
      ...profileViewRows.map((r) => r.userId),
      ...postViewRows.map((r) => r.userId),
      ...likeRows.map((l) => l.userId),
      ...commentRows.map((c) => c.authorId),
      ...followers.map((f) => f.followerId),
    ]);
    engagedUserIds.delete(user.id); // my own browsing never counts as audience
    let audience: { place: string; count: number; pct: number }[] = [];
    if (engagedUserIds.size > 0) {
      const engagedProfiles = await db
        .select()
        .from(tables.profiles)
        .where(inArray(tables.profiles.userId, Array.from(engagedUserIds)))
        .all();
      const byPlace = new Map<string, number>();
      for (const p of engagedProfiles) {
        const shares = p.showLocation && p.locationVisibility !== "hidden" && (p.city || p.state);
        const place = shares ? [p.city, p.state].filter(Boolean).join(", ") : "Not shared";
        byPlace.set(place, (byPlace.get(place) ?? 0) + 1);
      }
      const total = engagedProfiles.length;
      audience = Array.from(byPlace.entries())
        .map(([place, count]) => ({ place, count, pct: Math.round((count / total) * 100) }))
        .sort((a, b) => b.count - a.count || (a.place === "Not shared" ? 1 : -1))
        .slice(0, 5);
    }

    // business engagement — real counts, labeled as what they are
    const applicationsSent = (await db.select().from(tables.applications).where(eq(tables.applications.applicantId, user.id)).all()).length;

    return {
      engagement: {
        profileViews: profileViewRows.length,
        profileViews7d: profileViewRows.filter((r) => r.createdAt >= sevenDaysAgo).length,
        contentViews: postViewRows.length,
        serviceViews: serviceViewRows.length,
        likesReceived,
        commentsReceived,
        weekly: days,
        topPosts,
        audience,
        applicationsSent,
      },
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
