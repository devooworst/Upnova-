import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { findCommunity, requireActiveMember, isMod, logMod } from "@/lib/server/communities";

export const dynamic = "force-dynamic";

/** POST — post-level actions: react (toggle) for members; pin/unpin,
 *  lock/unlock for moderators. Mod actions land in the mod log. */
export async function POST(req: NextRequest, { params }: { params: { id: string; postId: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    const c = findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");
    const m = await requireActiveMember((await c)!.id, user.id);
    const post = await db
      .select()
      .from(tables.communityPosts)
      .where(and(eq(tables.communityPosts.id, params.postId), eq(tables.communityPosts.communityId, (await c)!.id)))
      .get();
    if (!post) throw new ApiError(404, "Post not found");

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "react") {
      if (post!.removedAt) throw new ApiError(409, "That post was removed");
      const existing = await db
        .select()
        .from(tables.communityReactions)
        .where(and(eq(tables.communityReactions.postId, post!.id), eq(tables.communityReactions.userId, user.id)))
        .get();
      if (existing)
        await db.delete(tables.communityReactions)
          .where(and(eq(tables.communityReactions.postId, post!.id), eq(tables.communityReactions.userId, user.id)))
          .run();
      else await db.insert(tables.communityReactions).values({ postId: post!.id, userId: user.id }).run();
      return { ok: true, reacted: !existing };
    }

    if (["pin", "unpin", "lock", "unlock"].includes(action)) {
      if (!isMod(m)) throw new ApiError(403, "That's a moderator tool");
      const patch =
        action === "pin" ? { pinned: true } : action === "unpin" ? { pinned: false } : action === "lock" ? { locked: true } : { locked: false };
      await db.update(tables.communityPosts).set(patch).where(eq(tables.communityPosts.id, post!.id)).run();
      await logMod({ communityId: (await c)!.id, actorId: user.id, action, targetType: "post", targetId: post!.id });
      return { ok: true };
    }

    throw new ApiError(400, "Unknown action");
  });
}

/** DELETE — remove a post. The author can remove their own; moderators
 *  remove with a reason that shows in place of the content. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string; postId: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    const c = findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");
    const m = await requireActiveMember((await c)!.id, user.id);
    const post = db
      .select()
      .from(tables.communityPosts)
      .where(and(eq(tables.communityPosts.id, params.postId), eq(tables.communityPosts.communityId, (await c)!.id)))
      .get();
    if (!post) throw new ApiError(404, "Post not found");
    if ((await post!)!.removedAt) throw new ApiError(409, "Already removed");

    const own = (await post!)!.authorId === user.id;
    if (!own && !isMod(m)) throw new ApiError(403, "You can remove your own posts; moderators can remove others");

    const reason = own ? "Removed by author" : String(new URL(req.url).searchParams.get("reason") || "Removed by a moderator");
    await db.update(tables.communityPosts)
      .set({ removedAt: new Date(), removedById: user.id, removedReason: reason })
      .where(eq(tables.communityPosts.id, (await post!)!.id))
      .run();
    if (!own) await logMod({ communityId: (await c)!.id, actorId: user.id, action: "remove_post", targetType: "post", targetId: (await post!)!.id, note: reason });
    return { ok: true };
  });
}
