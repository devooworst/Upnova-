import { desc, eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";
import { seedAcceptsReveal } from "@/lib/server/demo";

export const dynamic = "force-dynamic";

/** GET — my reveal requests and private connections.
 *  Incoming pending requests show only the requester's MASKED label.
 *  Accepted reveals (both directions) show the real profile — that's the
 *  entire point of accepting — plus follow state for the connect step. */
export async function GET() {
  return guarded(async () => {
    const user = await requireUser();

    // demo: seed accounts answer pending reveal requests (lazy, on read)
    await seedAcceptsReveal(user.id);

    const rows = await db
      .select()
      .from(tables.identityReveals)
      .where(or(eq(tables.identityReveals.requesterId, user.id), eq(tables.identityReveals.targetId, user.id)))
      .orderBy(desc(tables.identityReveals.createdAt))
      .all();

    const communityNames = new Map(
      (await db.select({ id: tables.communities.id, name: tables.communities.name, slug: tables.communities.slug }).from(tables.communities).all()).map((c) => [c.id, c])
    );

    const iFollow = new Set(
      (await db.select({ id: tables.follows.followingId }).from(tables.follows).where(eq(tables.follows.followerId, user.id)).all()).map((r) => r.id)
    );
    const followMe = new Set(
      (await db.select({ id: tables.follows.followerId }).from(tables.follows).where(eq(tables.follows.followingId, user.id)).all()).map((r) => r.id)
    );

    const profileOf = (userId: string) =>
      db
        .select({ u: tables.users, p: tables.profiles })
        .from(tables.users)
        .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
        .where(eq(tables.users.id, userId))
        .get();

    const incoming = rows
      .filter((r) => r.targetId === user.id && r.status === "pending")
      .map((r) => ({
        id: r.id,
        from: r.requesterLabel || "A community member", // masked — no account info
        community: r.communityId ? communityNames.get(r.communityId)?.name ?? null : null,
        createdAt: r.createdAt,
      }));

    const outgoing = rows
      .filter((r) => r.requesterId === user.id && r.status === "pending")
      .map((r) => ({
        id: r.id,
        to: r.targetLabel || "A community member",
        community: r.communityId ? communityNames.get(r.communityId)?.name ?? null : null,
        createdAt: r.createdAt,
      }));

    const connections = (await Promise.all(rows
      .filter((r) => r.status === "accepted")
      .map(async (r) => {
        const otherId = r.requesterId === user.id ? r.targetId : r.requesterId;
        const other = await profileOf(otherId);
        if (!other) return null;
        return {
          revealId: r.id,
          userId: other.u.id,
          handle: other.u.handle,
          displayName: other.p.displayName,
          avatarUrl: other.p.avatarUrl,
          verified: !!other.p.verified,
          community: r.communityId ? communityNames.get(r.communityId)?.name ?? null : null,
          revealedAt: r.respondedAt,
          youFollow: iFollow.has(otherId),
          followsYou: followMe.has(otherId),
          connected: iFollow.has(otherId) && followMe.has(otherId), // mutual follow = connection
        };
      })))
      .filter(Boolean);

    return { incoming, outgoing, connections };
  });
}
