import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import {
  findCommunity,
  getMembership,
  refreshMembership,
  isMod,
  communityCounts,
  serializeCommunity,
} from "@/lib/server/communities";
import { COMMUNITY_CATEGORIES } from "@/lib/communityIdentity";

export const dynamic = "force-dynamic";

/** GET — community detail (id or slug). Private/invite communities show
 *  their card to everyone (visible, restricted) but content stays inside. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const c = await findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");
    const viewer = await getSessionUser();
    let membership = viewer ? await getMembership(c.id, viewer.id) : null;
    if (membership) membership = await refreshMembership(c, membership); // lazy paid-membership lifecycle

    const counts = (await communityCounts([c.id])).get(c.id);
    let pendingJoins: number | undefined;
    if (isMod(membership)) {
      pendingJoins = (
        await db
          .select({ s: tables.communityMembers.status })
          .from(tables.communityMembers)
          .where(and(eq(tables.communityMembers.communityId, c.id), eq(tables.communityMembers.status, "pending")))
          .all()
      ).length;
    }
    return { community: serializeCommunity(c, { membership, counts, pendingJoins }), guest: !viewer };
  });
}

/** PATCH — owner edits settings. Identity modes can be tightened or opened;
 *  existing posts keep the identity they were written under. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    const c = await findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");
    const m = getMembership(c!.id, user.id);
    if (!m || (await m)!.role !== "owner") throw new ApiError(403, "Only the community owner can change settings");

    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim().length >= 3) patch.name = body.name.trim().slice(0, 60);
    if (typeof body.description === "string") patch.description = body.description.trim().slice(0, 500);
    if (["public", "private", "invite"].includes(body.access)) patch.access = body.access;
    if (COMMUNITY_CATEGORIES.includes(body.category)) patch.category = body.category;
    if (Array.isArray(body.rules))
      patch.rules = JSON.stringify(body.rules.map((r: unknown) => String(r).trim()).filter(Boolean).slice(0, 10));
    if (typeof body.joinApproval === "boolean") patch.joinApproval = body.joinApproval;
    if (["members", "mods"].includes(body.whoCanPost)) patch.whoCanPost = body.whoCanPost;
    if (["members", "mods"].includes(body.whoCanInvite)) patch.whoCanInvite = body.whoCanInvite;
    if (typeof body.coverUrl === "string") patch.coverUrl = body.coverUrl.slice(0, 400) || null;
    // membership economics — price changes apply to FUTURE payments only;
    // paid-through dates already purchased are always honored
    if (body.capacity !== undefined) {
      const cap = body.capacity === null || body.capacity === "" ? null : Math.round(Number(body.capacity));
      if (cap != null && (isNaN(cap) || cap < 1 || cap > 1_000_000)) throw new ApiError(400, "That capacity doesn't look right");
      patch.capacity = cap;
    }
    if (body.price !== undefined) {
      const price = Math.round(Number(body.price));
      if (isNaN(price) || price < 0 || price > 100_000) throw new ApiError(400, "That price doesn't look right");
      patch.price = price;
    }
    if (["weekly", "monthly", "yearly", "custom"].includes(body.billingPeriod)) patch.billingPeriod = body.billingPeriod;
    if (body.customPeriodDays !== undefined) {
      const days = Math.round(Number(body.customPeriodDays));
      if (isNaN(days) || days < 1 || days > 3650) throw new ApiError(400, "Custom period is in days (1–3650)");
      patch.customPeriodDays = days;
    }
    if (typeof body.paused === "boolean") patch.paused = body.paused;
    if (body.graceDays !== undefined) {
      const g = Math.round(Number(body.graceDays));
      if (isNaN(g) || g < 0 || g > 30) throw new ApiError(400, "Grace period is 0–30 days");
      patch.graceDays = g;
    }
    if (Array.isArray(body.identityModes)) {
      const modes = body.identityModes.filter((x: string) => ["real", "alias", "anonymous"].includes(x));
      if (!modes.length) throw new ApiError(400, "Allow at least one identity mode");
      patch.identityModes = JSON.stringify(modes);
    }
    if (!Object.keys(patch).length) throw new ApiError(400, "Nothing to update");

    await db.update(tables.communities).set(patch).where(eq(tables.communities.id, c!.id)).run();
    return { ok: true };
  });
}
