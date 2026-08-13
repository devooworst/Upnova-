import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import { recordInteraction } from "@/lib/server/recsys";

export const dynamic = "force-dynamic";

/** POST /api/posts/[id]/like — toggle. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    const post = await db.select().from(tables.posts).where(eq(tables.posts.id, params.id)).get();
    if (!post) throw new ApiError(404, "Post not found");

    const existing = await db
      .select()
      .from(tables.likes)
      .where(and(eq(tables.likes.postId, post.id), eq(tables.likes.userId, user.id)))
      .get();

    if (existing) {
      await db.delete(tables.likes)
        .where(and(eq(tables.likes.postId, post.id), eq(tables.likes.userId, user.id)))
        .run();
      await recordInteraction(user.id, "post", post.id, "unlike");
      return { liked: false };
    }

    await db.insert(tables.likes).values({ postId: post.id, userId: user.id }).run();
    await recordInteraction(user.id, "post", post.id, "like");
    await notify({
      userId: post.authorId,
      actorId: user.id,
      type: "like",
      title: `${user.profile.displayName} liked your post`,
      body: post.body.slice(0, 80),
      href: `/?post=${post.id}`,
    });
    return { liked: true };
  });
}
