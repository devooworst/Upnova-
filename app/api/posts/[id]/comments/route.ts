import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { asc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { notify } from "@/lib/server/notify";
import { recordInteraction } from "@/lib/server/recsys";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    requireUser();
    const rows = db
      .select({ comment: tables.comments, user: tables.users, profile: tables.profiles })
      .from(tables.comments)
      .innerJoin(tables.users, eq(tables.comments.authorId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .where(eq(tables.comments.postId, params.id))
      .orderBy(asc(tables.comments.createdAt))
      .all();
    return {
      comments: rows.map((r) => ({
        id: r.comment.id,
        body: r.comment.body,
        createdAt: r.comment.createdAt.toISOString(),
        author: publicUser(r.user, r.profile),
      })),
    };
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const post = db.select().from(tables.posts).where(eq(tables.posts.id, params.id)).get();
    if (!post) throw new ApiError(404, "Post not found");
    const text = String(body.body || "").trim();
    if (!text) throw new ApiError(400, "Comment is required");

    const id = randomBytes(12).toString("hex");
    db.insert(tables.comments).values({ id, postId: post.id, authorId: user.id, body: text }).run();
    recordInteraction(user.id, "post", post.id, "comment");
    notify({
      userId: post.authorId,
      actorId: user.id,
      type: "like",
      title: `${user.profile.displayName} commented on your post`,
      body: text.slice(0, 80),
      href: `/?post=${post.id}`,
    });
    return { id };
  });
}
