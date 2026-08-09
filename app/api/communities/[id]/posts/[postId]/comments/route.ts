import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { and, asc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import {
  findCommunity,
  getMembership,
  requireActiveMember,
  isMod,
  memberIsMuted,
  logMod,
  validateIdentityChoice,
  assertAnonAllowance,
  ensureAnonCode,
  buildAuthorCtx,
  maskAuthor,
  maskedLabelFor,
  viewerBlockSet,
} from "@/lib/server/communities";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

const id = () => randomBytes(12).toString("hex");

/** GET — a post's thread, authors masked. Same visibility rules as the
 *  post list: members always; guests only in public communities. */
export async function GET(_req: NextRequest, { params }: { params: { id: string; postId: string } }) {
  return guarded(() => {
    const c = findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");
    const viewer = getSessionUser();
    const membership = viewer ? getMembership(c.id, viewer.id) : null;
    const activeMember = !!membership && membership.status === "active";
    if (!activeMember && c.access !== "public") throw new ApiError(403, "Members only");

    const post = db
      .select()
      .from(tables.communityPosts)
      .where(and(eq(tables.communityPosts.id, params.postId), eq(tables.communityPosts.communityId, c.id)))
      .get();
    if (!post) throw new ApiError(404, "Post not found");

    const blocked = viewerBlockSet(viewer?.id ?? null);
    const rows = db
      .select()
      .from(tables.communityComments)
      .where(eq(tables.communityComments.postId, post.id))
      .orderBy(asc(tables.communityComments.createdAt))
      .all()
      .filter((cm) => !blocked.has(cm.authorId));

    const ctx = buildAuthorCtx(rows.map((r) => r.authorId), c.id, viewer?.id ?? null);
    return {
      comments: rows.map((cm) => ({
        id: cm.id,
        author: maskAuthor(cm.authorId, cm.identity, ctx),
        identity: cm.identity,
        body: cm.removedAt ? "" : cm.body,
        removed: !!cm.removedAt,
        createdAt: cm.createdAt,
      })),
    };
  });
}

/** POST — reply in the thread under a chosen identity (same rules and
 *  rate limits as posts). Locked threads only accept moderator replies. */
export async function POST(req: NextRequest, { params }: { params: { id: string; postId: string } }) {
  return guarded(async () => {
    const user = requireUser();
    const c = findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");
    const membership = requireActiveMember(c.id, user.id);
    if (memberIsMuted(membership)) throw new ApiError(403, "You're temporarily muted in this community");

    const post = db
      .select()
      .from(tables.communityPosts)
      .where(and(eq(tables.communityPosts.id, params.postId), eq(tables.communityPosts.communityId, c.id)))
      .get();
    if (!post || post.removedAt) throw new ApiError(404, "Post not found");
    if (post.locked && !isMod(membership)) throw new ApiError(403, "This discussion is locked");

    const body = await req.json().catch(() => ({}));
    const text = String(body.body || "").trim();
    if (!text) throw new ApiError(400, "Say something first");
    if (text.length > 2000) throw new ApiError(400, "Replies max out at 2,000 characters");

    const { identity } = validateIdentityChoice(c, membership, String(body.identity || membership.lastIdentity || "real"), body.alias);
    if (identity === "anonymous") {
      assertAnonAllowance(user.id);
      ensureAnonCode(c.id, user.id);
    }

    const commentId = id();
    db.insert(tables.communityComments)
      .values({ id: commentId, postId: post.id, authorId: user.id, identity, body: text })
      .run();
    db.update(tables.communityMembers)
      .set({ lastIdentity: identity })
      .where(and(eq(tables.communityMembers.communityId, c.id), eq(tables.communityMembers.userId, user.id)))
      .run();

    // tell the post author — masked replier announced by masked label only
    if (post.authorId !== user.id) {
      const label = maskedLabelFor(c.id, user.id, identity);
      notify({
        userId: post.authorId,
        actorId: identity === "real" ? user.id : null,
        type: "community",
        title: `${label} replied — ${c.name}`,
        body: text.slice(0, 120),
        href: `/communities/${c.slug}?post=${post.id}`,
      });
    }

    return { ok: true, id: commentId };
  });
}

/** DELETE — remove a reply (author or moderator). ?commentId= */
export async function DELETE(req: NextRequest, { params }: { params: { id: string; postId: string } }) {
  return guarded(() => {
    const user = requireUser();
    const c = findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");
    const membership = requireActiveMember(c.id, user.id);
    const commentId = new URL(req.url).searchParams.get("commentId") || "";
    const cm = db
      .select()
      .from(tables.communityComments)
      .where(and(eq(tables.communityComments.id, commentId), eq(tables.communityComments.postId, params.postId)))
      .get();
    if (!cm) throw new ApiError(404, "Reply not found");
    const own = cm.authorId === user.id;
    if (!own && !isMod(membership)) throw new ApiError(403, "You can remove your own replies; moderators can remove others");
    db.update(tables.communityComments)
      .set({ removedAt: new Date(), removedById: user.id })
      .where(eq(tables.communityComments.id, cm.id))
      .run();
    if (!own) {
      logMod({ communityId: c.id, actorId: user.id, action: "remove_comment", targetType: "comment", targetId: cm.id });
    }
    return { ok: true };
  });
}
