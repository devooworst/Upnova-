import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import {
  findCommunity,
  getMembership,
  refreshMembership,
  requireActiveMember,
  isMod,
  memberIsMuted,
  validateIdentityChoice,
  assertAnonAllowance,
  ensureAnonCode,
  buildAuthorCtx,
  maskAuthor,
  maskedLabelFor,
  viewerBlockSet,
  buildRefCard,
  parseRefUrl,
  resolveRef,
} from "@/lib/server/communities";
import { campusVerification, unrestrictedTester, demoCampusId } from "@/lib/server/campus";
import { notify } from "@/lib/server/notify";
import { seedRespondsInCommunity } from "@/lib/server/demo";

export const dynamic = "force-dynamic";

const id = () => randomBytes(12).toString("hex");

/** GET — community discussion. Members see everything; guests get a
 *  limited slice of PUBLIC communities only. Authors are masked here,
 *  server-side — masked posts carry no userId anywhere in the payload. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const c = findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");
    const viewer = getSessionUser();
    let membership = viewer ? getMembership(c.id, viewer.id) : null;
    if (membership) membership = refreshMembership(c, membership);
    const activeMember = !!membership && membership.status === "active";

    if (!activeMember && c.access !== "public")
      throw new ApiError(403, "This community's discussions are members-only");
    // campus rooms live inside the verified campus environment — existing
    // active members (e.g. alumni who joined as students) keep access
    if (c.campusId && !activeMember) {
      const vc = viewer ? campusVerification(viewer.id) : null;
      const demoBypass = !!viewer && unrestrictedTester(viewer.id); // DEMO MODE
      if (!demoBypass && (!vc || vc.campusId !== c.campusId))
        throw new ApiError(403, "This is a campus community — verify your school in Your Campus to view it");
    }
    if (!activeMember && c.price > 0)
      throw new ApiError(
        403,
        membership?.status === "inactive"
          ? "Your membership expired — renew it to regain access. Your posts and history are intact."
          : `Member content — join for $${c.price} ${c.billingPeriod === "custom" ? `per ${c.customPeriodDays} days` : c.billingPeriod} to see the discussion`
      );

    // demo: seed members reply to fresh protagonist posts (lazy, on read)
    if (viewer) seedRespondsInCommunity(c.id);

    const q = (req.nextUrl.searchParams.get("q") || "").toLowerCase().trim();
    let rows = db
      .select()
      .from(tables.communityPosts)
      .where(eq(tables.communityPosts.communityId, c.id))
      .orderBy(desc(tables.communityPosts.createdAt))
      .all()
      .filter((p) => !p.removedAt || p.authorId === viewer?.id || isMod(membership));
    if (q) rows = rows.filter((p) => !p.removedAt && p.body.toLowerCase().includes(q));

    // block filter — you don't see content from people you blocked
    const blocked = viewerBlockSet(viewer?.id ?? null);
    rows = rows.filter((p) => !blocked.has(p.authorId));

    rows.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.getTime() - a.createdAt.getTime());
    if (!activeMember) rows = rows.filter((p) => !p.removedAt).slice(0, 8); // guest/non-member slice

    const postIds = rows.map((p) => p.id);
    const reactions = postIds.length
      ? db.select().from(tables.communityReactions).where(inArray(tables.communityReactions.postId, postIds)).all()
      : [];
    const comments = postIds.length
      ? db.select({ postId: tables.communityComments.postId, removedAt: tables.communityComments.removedAt }).from(tables.communityComments).where(inArray(tables.communityComments.postId, postIds)).all()
      : [];

    const ctx = buildAuthorCtx(rows.map((p) => p.authorId), c.id, viewer?.id ?? null);

    return {
      guest: !viewer,
      member: activeMember,
      posts: rows.map((p) => ({
        id: p.id,
        author: maskAuthor(p.authorId, p.identity, ctx),
        identity: p.identity,
        body: p.removedAt ? "" : p.body,
        removed: !!p.removedAt,
        removedReason: p.removedAt ? p.removedReason || "Removed" : null,
        ref: p.removedAt ? null : buildRefCard(p.refType, p.refId),
        pinned: !!p.pinned,
        locked: !!p.locked,
        reactions: reactions.filter((r) => r.postId === p.id).length,
        viewerReacted: !!viewer && reactions.some((r) => r.postId === p.id && r.userId === viewer.id),
        comments: comments.filter((x) => x.postId === p.id && !x.removedAt).length,
        createdAt: p.createdAt,
        canModerate: isMod(membership),
      })),
    };
  });
}

/** POST — write in the community under a chosen identity. The identity
 *  selector is validated against the community's allowed modes; anonymous
 *  writing is rate-limited; the choice is remembered as the default. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = requireUser();
    const c = findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");
    const membership = requireActiveMember(c.id, user.id);
    if (memberIsMuted(membership)) throw new ApiError(403, "You're temporarily muted in this community");
    if (c.whoCanPost === "mods" && !isMod(membership))
      throw new ApiError(403, "Only moderators can post in this community");

    const body = await req.json().catch(() => ({}));
    const text = String(body.body || "").trim();
    if (text.length < 2) throw new ApiError(400, "Say something first");
    if (text.length > 4000) throw new ApiError(400, "Posts max out at 4,000 characters");

    const { identity } = validateIdentityChoice(c, membership, String(body.identity || membership.lastIdentity || "real"), body.alias);
    if (identity === "anonymous") {
      assertAnonAllowance(user.id);
      ensureAnonCode(c.id, user.id);
    }

    // optional attached UpNova link → typed ref card (source preserved)
    let refType: string | null = null;
    let refId: string | null = null;
    if (body.refUrl) {
      const parsed = parseRefUrl(String(body.refUrl));
      if (!parsed || !resolveRef(parsed.refType, parsed.refId))
        throw new ApiError(400, "That link doesn't point to an UpNova service, opportunity, product, work, event, or campus listing");
      refType = parsed.refType;
      refId = parsed.refId;
    }

    const postId = id();
    db.insert(tables.communityPosts)
      .values({ id: postId, communityId: c.id, authorId: user.id, identity, body: text, refType, refId })
      .run();
    db.update(tables.communityMembers)
      .set({ lastIdentity: identity })
      .where(and(eq(tables.communityMembers.communityId, c.id), eq(tables.communityMembers.userId, user.id)))
      .run();

    // mentions — only active members get pinged; a masked author is
    // announced by their masked label, never their account
    const label = maskedLabelFor(c.id, user.id, identity);
    const handles = Array.from(new Set((text.match(/@([a-zA-Z0-9_]+)/g) || []).map((h) => h.slice(1))));
    for (const h of handles.slice(0, 8)) {
      const target = db.select().from(tables.users).where(eq(tables.users.handle, h)).get();
      if (!target || target.id === user.id) continue;
      const tm = getMembership(c.id, target.id);
      if (!tm || tm.status !== "active") continue;
      notify({
        userId: target.id,
        actorId: identity === "real" ? user.id : null, // masked actor never leaks
        type: "community",
        title: `${label} mentioned you — ${c.name}`,
        body: text.slice(0, 120),
        href: `/communities/${c.slug}?post=${postId}`,
      });
    }

    return { ok: true, id: postId };
  });
}
