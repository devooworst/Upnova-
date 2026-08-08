import { NextRequest } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { FeedScope, inScope, verifiedCampusMap, viewerContext } from "@/lib/server/feed";
import { buildTaste, ranker, type Scorable } from "@/lib/server/recsys";
import { parseConfig } from "@/lib/servicePolicies";
import { ctaFor } from "@/lib/server/cta";

export const dynamic = "force-dynamic";

/**
 * GET /api/feed?tab=for-you|following|trending&scope=for-you|5mi|25mi|city|county|state|country|global|school
 * Tab picks the ranking, scope picks the geography — orthogonal by design.
 * (The Opportunities feed tab is served by /api/opportunities.)
 */
export async function GET(req: NextRequest) {
  return guarded(() => {
    const user = requireUser();
    const tab = req.nextUrl.searchParams.get("tab") || "for-you";
    const scope = (req.nextUrl.searchParams.get("scope") || "for-you") as FeedScope;

    const ctx = viewerContext(user.id, user.profile);

    const rows = db
      .select({ post: tables.posts, user: tables.users, profile: tables.profiles })
      .from(tables.posts)
      .innerJoin(tables.users, eq(tables.posts.authorId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .orderBy(desc(tables.posts.createdAt))
      .limit(300)
      .all()
      .filter((r) => r.user.status === "active");

    const postIds = rows.map((r) => r.post.id);
    const authorIds = Array.from(new Set(rows.map((r) => r.post.authorId)));

    const likeRows = postIds.length
      ? db.select().from(tables.likes).where(inArray(tables.likes.postId, postIds)).all()
      : [];
    const commentRows = postIds.length
      ? db.select().from(tables.comments).where(inArray(tables.comments.postId, postIds)).all()
      : [];
    const communityRows = authorIds.length
      ? db
          .select()
          .from(tables.communityMembers)
          .where(inArray(tables.communityMembers.userId, authorIds))
          .all()
      : [];
    const campusMap = verifiedCampusMap(authorIds);

    const likesByPost = new Map<string, number>();
    const likedByMe = new Set<string>();
    for (const l of likeRows) {
      likesByPost.set(l.postId, (likesByPost.get(l.postId) ?? 0) + 1);
      if (l.userId === user.id) likedByMe.add(l.postId);
    }
    const commentsByPost = new Map<string, number>();
    for (const c of commentRows) commentsByPost.set(c.postId, (commentsByPost.get(c.postId) ?? 0) + 1);
    const communitiesByUser = new Map<string, Set<string>>();
    for (const m of communityRows) {
      if (!communitiesByUser.has(m.userId)) communitiesByUser.set(m.userId, new Set());
      communitiesByUser.get(m.userId)!.add(m.communityId);
    }

    // ---- the recommendation engine ranks; the route only maps shapes ----
    const taste = buildTaste(user.id, user.profile);

    const parseTags = (s: string) => {
      try {
        return JSON.parse(s) as string[];
      } catch {
        return [];
      }
    };

    const scoped = rows.filter((r) => inScope(scope, ctx, r.profile, campusMap.get(r.post.authorId)));
    const mapped = scoped.map((r) => {
      const likes = likesByPost.get(r.post.id) ?? 0;
      const commentsCount = commentsByPost.get(r.post.id) ?? 0;
      const scorable: Scorable = {
        id: r.post.id,
        type: "post",
        authorId: r.post.authorId,
        category: r.post.category,
        tags: [...parseTags(r.profile.skills), ...parseTags(r.profile.interests), r.post.category].filter(Boolean),
        lat: r.profile.lat,
        lng: r.profile.lng,
        locationOk: r.profile.locationVisibility !== "hidden",
        sameCity: !!user.profile.city && r.profile.city === user.profile.city,
        createdAt: r.post.createdAt,
        engagement: likes + 2 * commentsCount,
        authorCommunityIds: communitiesByUser.get(r.post.authorId) ?? new Set(),
      };
      const item = {
        id: r.post.id,
        body: r.post.body,
        imageUrl: r.post.imageUrl,
        kind: r.post.kind,
        category: r.post.category,
        subcategory: r.post.subcategory,
        createdAt: r.post.createdAt.toISOString(),
        author: publicUser(r.user, r.profile),
        likes,
        comments: commentsCount,
        likedByMe: likedByMe.has(r.post.id),
        isMine: r.post.authorId === user.id,
      };
      return { item, scorable };
    });

    let items: (typeof mapped)[number]["item"][];
    let reasons: Record<string, string[]> = {};
    if (tab === "following") {
      // chronological — you asked for these people, don't reorder them.
      // hides still apply.
      items = mapped
        .filter(({ scorable, item }) => !taste.hiddenTargets.has(scorable.id) && (taste.followingIds.has(item.author.id) || item.isMine))
        .map(({ item }) => item);
    } else if (tab === "trending") {
      items = mapped
        .filter(({ scorable }) => !taste.hiddenTargets.has(scorable.id))
        .sort((a, b) => b.scorable.engagement - a.scorable.engagement)
        .map(({ item }) => item);
    } else {
      const ranked = ranker.rank(mapped.map(({ item, scorable }) => ({ item, scorable })), taste);
      items = ranked.map((r) => r.item);
      for (const r of ranked.slice(0, 20)) reasons[r.item.id] = r.reasons;
    }

    // ---- promoted slot: labeled, separate, NEVER part of organic ranking ----
    let promoted: object | null = null;
    if (tab === "for-you") {
      const promo = db
        .select({ service: tables.services, profile: tables.profiles, u: tables.users })
        .from(tables.services)
        .innerJoin(tables.users, eq(tables.services.ownerId, tables.users.id))
        .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
        .all()
        .find((r) => r.service.promoted && r.service.active && !r.service.paused && r.service.ownerId !== user.id);
      if (promo && !taste.hiddenTargets.has(promo.service.id)) {
        promoted = {
          id: promo.service.id,
          title: promo.service.title,
          description: promo.service.description,
          price: promo.service.price,
          cta: ctaFor(promo.service),
          owner: publicUser(promo.u, promo.profile),
        };
      }
    }

    return { items: items.slice(0, 60), reasons, promoted };
  });
}
