import { NextRequest } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import {
  FeedScope,
  inScope,
  scorePost,
  verifiedCampusMap,
  viewerContext,
} from "@/lib/server/feed";

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

    let items = rows
      .filter((r) => inScope(scope, ctx, r.profile, campusMap.get(r.post.authorId)))
      .map((r) => {
        const likes = likesByPost.get(r.post.id) ?? 0;
        const commentsCount = commentsByPost.get(r.post.id) ?? 0;
        return {
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
          score: scorePost(
            r.post,
            r.profile,
            communitiesByUser.get(r.post.authorId) ?? new Set(),
            likes,
            commentsCount,
            ctx
          ),
        };
      });

    if (tab === "following") {
      items = items.filter((i) => ctx.followingIds.has(i.author.id) || i.isMine);
      // chronological for Following — you asked for these people, don't reorder them
    } else if (tab === "trending") {
      items.sort((a, b) => b.likes + 2 * b.comments - (a.likes + 2 * a.comments));
    } else {
      items.sort((a, b) => b.score - a.score);
    }

    return { items: items.slice(0, 60).map(({ score, ...rest }) => rest) };
  });
}
