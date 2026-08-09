import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { postTrustMap } from "@/lib/server/trust";

export const dynamic = "force-dynamic";

/** GET /api/posts/[id] — ONE post at its permanent URL. Public: shared
 *  links land here and work for guests; interaction still needs an
 *  account. The post remains the canonical record — never a copy. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const viewer = getSessionUser();
    const row = db
      .select({ post: tables.posts, user: tables.users, profile: tables.profiles })
      .from(tables.posts)
      .innerJoin(tables.users, eq(tables.posts.authorId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .where(eq(tables.posts.id, params.id))
      .get();
    if (!row || row.user.status !== "active") throw new ApiError(404, "Post not found");
    const { post, user, profile } = row;

    const likes = db.select().from(tables.likes).where(eq(tables.likes.postId, post.id)).all();
    const comments = db.select().from(tables.comments).where(eq(tables.comments.postId, post.id)).all();
    const trust = postTrustMap([post], viewer?.id).get(post.id);

    return {
      post: {
        id: post.id,
        body: post.body,
        imageUrl: post.imageUrl,
        kind: post.kind,
        category: post.category,
        subcategory: post.subcategory,
        createdAt: post.createdAt.toISOString(),
        author: publicUser(user, profile),
        likes: likes.length,
        comments: comments.length,
        likedByMe: viewer ? likes.some((l) => l.userId === viewer.id) : false,
        isMine: viewer?.id === post.authorId,
        trust,
        refType: post.refType,
        refId: post.refId,
      },
    };
  });
}
