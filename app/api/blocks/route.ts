import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { findCommunity, maskedLabelFor } from "@/lib/server/communities";

export const dynamic = "force-dynamic";

const id = () => randomBytes(12).toString("hex");

/** GET — my block list. Entries created from masked content show the
 *  masked label that was blocked — the list never de-anonymizes anyone. */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const rows = db
      .select()
      .from(tables.blocks)
      .where(eq(tables.blocks.blockerId, user.id))
      .orderBy(desc(tables.blocks.createdAt))
      .all();
    return {
      blocks: rows.map((b) => ({ id: b.id, label: b.viaLabel || "Blocked member", createdAt: b.createdAt })),
    };
  });
}

/** POST — block someone. Either directly ({ userId } for a profile you can
 *  see) or via masked content ({ communityId, postId | commentId }) — the
 *  server resolves the account internally so blocking an anonymous poster
 *  never reveals who they are. Blocking hides their community content from
 *  you and stops reveal requests in both directions. */
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const user = requireUser();
    const body = await req.json().catch(() => ({}));

    let targetId: string | null = null;
    let viaLabel = "";

    if (body.userId) {
      const target = db.select().from(tables.users).where(eq(tables.users.id, String(body.userId))).get();
      if (!target) throw new ApiError(404, "User not found");
      targetId = target.id;
      viaLabel = `@${target.handle}`;
    } else if (body.postId || body.commentId) {
      const c = findCommunity(String(body.communityId || ""));
      if (!c) throw new ApiError(404, "Community not found");
      if (body.postId) {
        const p = db
          .select()
          .from(tables.communityPosts)
          .where(and(eq(tables.communityPosts.id, String(body.postId)), eq(tables.communityPosts.communityId, c.id)))
          .get();
        if (!p) throw new ApiError(404, "Post not found");
        targetId = p.authorId;
        viaLabel = `${maskedLabelFor(c.id, p.authorId, p.identity)} — ${c.name}`;
      } else {
        const cm = db.select().from(tables.communityComments).where(eq(tables.communityComments.id, String(body.commentId))).get();
        if (!cm) throw new ApiError(404, "Reply not found");
        targetId = cm.authorId;
        viaLabel = `${maskedLabelFor(c.id, cm.authorId, cm.identity)} — ${c.name}`;
      }
    } else throw new ApiError(400, "Who do you want to block?");

    if (targetId === user.id) throw new ApiError(400, "You can't block yourself");

    const existing = db
      .select()
      .from(tables.blocks)
      .where(and(eq(tables.blocks.blockerId, user.id), eq(tables.blocks.blockedId, targetId!)))
      .get();
    if (existing) throw new ApiError(409, "Already blocked");

    db.insert(tables.blocks).values({ id: id(), blockerId: user.id, blockedId: targetId!, viaLabel }).run();

    // blocking also withdraws any pending reveal request between you
    const pending = db
      .select()
      .from(tables.identityReveals)
      .where(eq(tables.identityReveals.status, "pending"))
      .all()
      .filter(
        (r) =>
          (r.requesterId === user.id && r.targetId === targetId) ||
          (r.requesterId === targetId && r.targetId === user.id)
      );
    for (const r of pending)
      db.update(tables.identityReveals).set({ status: "declined", respondedAt: new Date() }).where(eq(tables.identityReveals.id, r.id)).run();

    return { ok: true };
  });
}

/** DELETE — unblock. ?id= is the block record id (not a user id). */
export async function DELETE(req: NextRequest) {
  return guarded(() => {
    const user = requireUser();
    const blockId = new URL(req.url).searchParams.get("id") || "";
    const b = db.select().from(tables.blocks).where(eq(tables.blocks.id, blockId)).get();
    if (!b || b.blockerId !== user.id) throw new ApiError(404, "Block not found");
    db.delete(tables.blocks).where(eq(tables.blocks.id, b.id)).run();
    return { ok: true };
  });
}
