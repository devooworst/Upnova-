import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { and, eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import {
  findCommunity,
  requireActiveMember,
  blockedEitherWay,
  maskedLabelFor,
} from "@/lib/server/communities";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

const id = () => randomBytes(12).toString("hex");

/** POST — request an identity reveal with the author of a masked post or
 *  reply. The client sends the CONTENT id, never a userId — the server
 *  resolves the account internally, so the API can't be used to look up
 *  who wrote something.
 *
 *  Never automatic, never one-sided: the other person gets
 *  "«masked label» would like to reveal identities with you" and decides.
 *  "Don't ask again" makes future requests from this person silently
 *  undeliverable — no signal a harasser can farm. */
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const user = requireUser();
    const body = await req.json().catch(() => ({}));
    const communityRef = String(body.communityId || "");
    const c = findCommunity(communityRef);
    if (!c) throw new ApiError(404, "Community not found");
    const myMembership = requireActiveMember(c.id, user.id);

    // resolve the masked author from the content id
    let authorId: string | null = null;
    let authorIdentity = "";
    if (body.postId) {
      const p = db
        .select()
        .from(tables.communityPosts)
        .where(and(eq(tables.communityPosts.id, String(body.postId)), eq(tables.communityPosts.communityId, c.id)))
        .get();
      if (!p) throw new ApiError(404, "Post not found");
      authorId = p.authorId;
      authorIdentity = p.identity;
    } else if (body.commentId) {
      const cm = db.select().from(tables.communityComments).where(eq(tables.communityComments.id, String(body.commentId))).get();
      if (!cm) throw new ApiError(404, "Reply not found");
      authorId = cm.authorId;
      authorIdentity = cm.identity;
    } else throw new ApiError(400, "Which post or reply?");

    if (authorId === user.id) throw new ApiError(400, "That's you");
    if (authorIdentity === "real")
      throw new ApiError(400, "That member already posts with their profile identity — just view their profile");

    // blocked in either direction: no new requests, no block-state leak
    if (blockedEitherWay(user.id, authorId!)) throw new ApiError(403, "You can't send a reveal request to this member");

    const existing = db
      .select()
      .from(tables.identityReveals)
      .where(
        or(
          and(eq(tables.identityReveals.requesterId, user.id), eq(tables.identityReveals.targetId, authorId!)),
          and(eq(tables.identityReveals.requesterId, authorId!), eq(tables.identityReveals.targetId, user.id))
        )
      )
      .all();

    if (existing.some((r) => r.status === "accepted")) throw new ApiError(409, "You've already revealed identities with this member");
    if (existing.some((r) => r.status === "pending")) throw new ApiError(409, "A reveal request between you is already waiting for an answer");

    // "Don't ask again" — swallow silently so declining can't be probed
    const hardNo = existing.find((r) => r.status === "never" && r.requesterId === user.id);
    if (hardNo) return { ok: true };

    // my label as the target will see it: my current identity in this community
    const myLabel = maskedLabelFor(c.id, user.id, myMembership.lastIdentity || "real");
    const theirLabel = maskedLabelFor(c.id, authorId!, authorIdentity);

    const softDecline = existing.find((r) => r.requesterId === user.id && r.status === "declined");
    let revealId: string;
    if (softDecline) {
      revealId = softDecline.id;
      db.update(tables.identityReveals)
        .set({ status: "pending", requesterLabel: myLabel, targetLabel: theirLabel, communityId: c.id, respondedAt: null })
        .where(eq(tables.identityReveals.id, softDecline.id))
        .run();
    } else {
      revealId = id();
      db.insert(tables.identityReveals)
        .values({
          id: revealId,
          requesterId: user.id,
          targetId: authorId!,
          communityId: c.id,
          requesterLabel: myLabel,
          targetLabel: theirLabel,
          status: "pending",
        })
        .run();
    }

    notify({
      userId: authorId!,
      actorId: null, // never leak the requester's account through the notification
      type: "community",
      title: `${myLabel} would like to reveal identities with you`,
      body: `From ${c.name} — accepting shows you each other's profiles, privately. The community keeps seeing your masked identities.`,
      href: `/communities?tab=reveals`,
    });

    return { ok: true, id: revealId };
  });
}
