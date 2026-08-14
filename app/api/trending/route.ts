import { eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { getSessionUser, guarded } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  GET /api/trending — the compact "Trending Now" rail on Discover.   */
/*                                                                     */
/*  Trending is a DISCOVERY mechanism (that's why it lives here, not   */
/*  in Home): what's currently popular across Mavyn, every type mixed, */
/*  each item an entry point to its detail page. Popularity is only    */
/*  ever computed from REAL engagement records — likes/comments for    */
/*  posts, follows for creators, bookings for services, licenses for   */
/*  works, RSVPs for events, applications for opportunities. Nothing   */
/*  with zero engagement is called "trending"; a section with no       */
/*  qualifying items simply contributes nothing.                       */
/*                                                                     */
/*  Public (guests explore too). Visibility mirrors each type's own    */
/*  list API: active/open records, active owners, blocks respected.    */
/* ------------------------------------------------------------------ */

interface TrendItem {
  key: string;
  type: "people" | "services" | "opportunities" | "events" | "works" | "posts";
  href: string;
  title: string;
  meta: string;
  image?: string | null;
  avatar?: string | null;
}

const POST_WINDOW_MS = 14 * 86_400_000;
const plural = (n: number, w: string, ws?: string) => `${n} ${n === 1 ? w : ws ?? w + "s"}`;
const PER_TYPE = 3;
const CAP = 12;

export async function GET() {
  return guarded(async () => {
    const viewer = await getSessionUser();

    /* blocks: invisible in BOTH directions, like everywhere else */
    const blockedPair = new Set<string>();
    if (viewer) {
      for (const b of await db.select().from(tables.blocks).all()) {
        if (b.blockerId === viewer.id) blockedPair.add(b.blockedId);
        if (b.blockedId === viewer.id) blockedPair.add(b.blockerId);
      }
    }

    /* ---------------- POSTS: likes + 2·comments, recent window ---------------- */
    const cutoff = Date.now() - POST_WINDOW_MS;
    const postRows = (await db
      .select({ post: tables.posts, profile: tables.profiles, u: tables.users })
      .from(tables.posts)
      .innerJoin(tables.users, eq(tables.posts.authorId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.posts.authorId))
      .all())
      .filter((r) => r.u.status === "active" && !blockedPair.has(r.post.authorId) && r.post.createdAt.getTime() > cutoff);
    const postIds = postRows.map((r) => r.post.id);
    const likeRows = postIds.length ? await db.select().from(tables.likes).where(inArray(tables.likes.postId, postIds)).all() : [];
    const commentRows = postIds.length ? await db.select({ postId: tables.comments.postId }).from(tables.comments).where(inArray(tables.comments.postId, postIds)).all() : [];
    const likeCounts = new Map<string, number>();
    const commentCounts = new Map<string, number>();
    for (const l of likeRows) likeCounts.set(l.postId, (likeCounts.get(l.postId) ?? 0) + 1);
    for (const c of commentRows) commentCounts.set(c.postId, (commentCounts.get(c.postId) ?? 0) + 1);
    // rank by likes + 2·comments; DISPLAY only the real counts
    const engagement = new Map<string, number>();
    likeCounts.forEach((n, id) => engagement.set(id, n + 2 * (commentCounts.get(id) ?? 0)));
    commentCounts.forEach((n, id) => { if (!engagement.has(id)) engagement.set(id, 2 * n); });
    const posts: TrendItem[] = postRows
      .map((r) => ({ r, score: engagement.get(r.post.id) ?? 0 }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.r.post.createdAt.getTime() - a.r.post.createdAt.getTime())
      .slice(0, PER_TYPE)
      .map(({ r }) => {
        const lk = likeCounts.get(r.post.id) ?? 0;
        const cm = commentCounts.get(r.post.id) ?? 0;
        return {
          key: `f${r.post.id}`, type: "posts" as const, href: `/posts/${r.post.id}`,
          title: (r.post.body || "").split("\n")[0] || "Post",
          meta: `${r.profile.displayName} · ${plural(lk, "like")}${cm ? ` · ${plural(cm, "reply", "replies")}` : ""}`,
          image: r.post.imageUrl,
        };
      });

    /* ---------------- CREATORS: most followed ---------------- */
    const followCounts = new Map<string, number>();
    for (const f of await db.select().from(tables.follows).all())
      followCounts.set(f.followingId, (followCounts.get(f.followingId) ?? 0) + 1);
    const people: TrendItem[] = (await db
      .select({ u: tables.users, profile: tables.profiles })
      .from(tables.users)
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .all())
      .filter((r) => r.u.status === "active" && r.profile.visibility === "public" && !blockedPair.has(r.u.id) && (followCounts.get(r.u.id) ?? 0) > 0)
      .sort((a, b) => (followCounts.get(b.u.id) ?? 0) - (followCounts.get(a.u.id) ?? 0))
      .slice(0, PER_TYPE)
      .map((r) => ({
        key: `u${r.u.id}`, type: "people" as const, href: `/creator/${r.u.handle}`,
        title: r.profile.displayName,
        meta: plural(followCounts.get(r.u.id) ?? 0, "follower"),
        avatar: r.profile.avatarUrl,
      }));

    /* ---------------- SERVICES: most booked ---------------- */
    const bookingCounts = new Map<string, number>();
    for (const b of await db.select({ serviceId: tables.bookings.serviceId }).from(tables.bookings).all())
      if (b.serviceId) bookingCounts.set(b.serviceId, (bookingCounts.get(b.serviceId) ?? 0) + 1);
    const services: TrendItem[] = (await db
      .select({ service: tables.services, profile: tables.profiles, u: tables.users })
      .from(tables.services)
      .innerJoin(tables.users, eq(tables.services.ownerId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.services.ownerId))
      .all())
      .filter((r) => r.service.active && !r.service.paused && r.service.visibility === "public" && r.u.status === "active" && !blockedPair.has(r.service.ownerId) && (bookingCounts.get(r.service.id) ?? 0) > 0)
      .sort((a, b) => (bookingCounts.get(b.service.id) ?? 0) - (bookingCounts.get(a.service.id) ?? 0))
      .slice(0, PER_TYPE)
      .map((r) => ({
        key: `s${r.service.id}`, type: "services" as const, href: `/services/${r.service.id}`,
        title: r.service.title,
        meta: `${plural(bookingCounts.get(r.service.id) ?? 0, "booking")} · ${r.profile.displayName}`,
        image: (() => { try { return (JSON.parse(r.service.media) as string[])[0] ?? null; } catch { return null; } })(),
      }));

    /* ---------------- WORKS: most licensed ---------------- */
    const licenseCounts = new Map<string, number>();
    for (const l of await db.select({ workId: tables.licenses.workId }).from(tables.licenses).all())
      if (l.workId) licenseCounts.set(l.workId, (licenseCounts.get(l.workId) ?? 0) + 1);
    const works: TrendItem[] = (await db
      .select({ work: tables.works, profile: tables.profiles, u: tables.users })
      .from(tables.works)
      .innerJoin(tables.users, eq(tables.works.creatorId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.works.creatorId))
      .all())
      .filter((r) => r.work.status === "active" && r.u.status === "active" && !blockedPair.has(r.work.creatorId) && (licenseCounts.get(r.work.id) ?? 0) > 0)
      .sort((a, b) => (licenseCounts.get(b.work.id) ?? 0) - (licenseCounts.get(a.work.id) ?? 0))
      .slice(0, PER_TYPE)
      .map((r) => ({
        key: `w${r.work.id}`, type: "works" as const, href: `/works/${r.work.id}`,
        title: r.work.title,
        meta: `${licenseCounts.get(r.work.id)} licensed · ${r.profile.displayName}`,
        image: r.work.coverUrl,
      }));

    /* ---------------- EVENTS: most RSVPs, upcoming, world-visible ---------------- */
    const rsvpCounts = new Map<string, number>();
    for (const r of await db.select({ eventId: tables.eventRsvps.eventId }).from(tables.eventRsvps).all())
      rsvpCounts.set(r.eventId, (rsvpCounts.get(r.eventId) ?? 0) + 1);
    const now = Date.now();
    const events: TrendItem[] = (await db
      .select({ event: tables.events, u: tables.users })
      .from(tables.events)
      .innerJoin(tables.users, eq(tables.events.hostId, tables.users.id))
      .all())
      .filter((r) => (!r.event.campusId || r.event.publicVisibility) && r.event.status === "active" && r.u.status === "active" && r.event.startsAt.getTime() > now - 6 * 3_600_000 && (rsvpCounts.get(r.event.id) ?? 0) > 0)
      .sort((a, b) => (rsvpCounts.get(b.event.id) ?? 0) - (rsvpCounts.get(a.event.id) ?? 0))
      .slice(0, PER_TYPE)
      .map((r) => ({
        key: `e${r.event.id}`, type: "events" as const, href: `/events/${r.event.slug}`,
        title: r.event.title,
        meta: `${rsvpCounts.get(r.event.id)} going · ${r.event.startsAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        image: r.event.imageUrl,
      }));

    /* ---------------- OPPORTUNITIES: most applications, open ---------------- */
    const appCounts = new Map<string, number>();
    for (const a of await db.select({ opportunityId: tables.applications.opportunityId }).from(tables.applications).all())
      appCounts.set(a.opportunityId, (appCounts.get(a.opportunityId) ?? 0) + 1);
    const opportunities: TrendItem[] = (await db
      .select({ opp: tables.opportunities, u: tables.users })
      .from(tables.opportunities)
      .innerJoin(tables.users, eq(tables.opportunities.posterId, tables.users.id))
      .all())
      .filter((r) => r.opp.status === "open" && r.u.status === "active" && !blockedPair.has(r.opp.posterId) && (appCounts.get(r.opp.id) ?? 0) > 0)
      .sort((a, b) => (appCounts.get(b.opp.id) ?? 0) - (appCounts.get(a.opp.id) ?? 0))
      .slice(0, PER_TYPE)
      .map((r) => ({
        key: `o${r.opp.id}`, type: "opportunities" as const, href: `/opportunities/${r.opp.id}`,
        title: r.opp.title,
        meta: `${appCounts.get(r.opp.id)} applied${r.opp.budget != null ? ` · $${r.opp.budget}` : ""}`,
      }));

    /* interleave the types so the rail is MIXED, cap it compact */
    const groups = [posts, people, services, works, events, opportunities];
    const items: TrendItem[] = [];
    const idx = groups.map(() => 0);
    let moved = true;
    while (moved && items.length < CAP) {
      moved = false;
      for (let g = 0; g < groups.length && items.length < CAP; g++) {
        if (idx[g] < groups[g].length) {
          items.push(groups[g][idx[g]++]);
          moved = true;
        }
      }
    }
    return { items };
  });
}
