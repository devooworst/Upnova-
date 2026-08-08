import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { getSessionUser, guarded, ApiError } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** GET /api/users/[handle]/posts — a creator's public work feed. */
export async function GET(_req: NextRequest, { params }: { params: { handle: string } }) {
  return guarded(() => {
    const viewer = getSessionUser();
    const user = db.select().from(tables.users).where(eq(tables.users.handle, params.handle)).get();
    if (!user || user.status !== "active") throw new ApiError(404, "User not found");

    const posts = db
      .select()
      .from(tables.posts)
      .where(eq(tables.posts.authorId, user.id))
      .orderBy(desc(tables.posts.createdAt))
      .limit(60)
      .all();

    const ids = posts.map((p) => p.id);
    const likes = ids.length ? db.select().from(tables.likes).all().filter((l) => ids.includes(l.postId)) : [];
    const comments = ids.length ? db.select().from(tables.comments).all().filter((c) => ids.includes(c.postId)) : [];

    return {
      posts: posts.map((p) => ({
        id: p.id,
        body: p.body,
        imageUrl: p.imageUrl,
        kind: p.kind,
        category: p.category,
        subcategory: p.subcategory,
        createdAt: p.createdAt.toISOString(),
        likes: likes.filter((l) => l.postId === p.id).length,
        comments: comments.filter((c) => c.postId === p.id).length,
        likedByMe: viewer ? likes.some((l) => l.postId === p.id && l.userId === viewer.id) : false,
      })),
    };
  });
}
