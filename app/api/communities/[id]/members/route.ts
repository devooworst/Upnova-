import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { findCommunity, getMembership, isMod, logMod, requireActiveMember, activeMemberCount } from "@/lib/server/communities";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

/** GET — the member roster. Moderators only: in communities that allow
 *  alias/anonymous participation, a public member list would let anyone
 *  correlate "who's in here" with masked posts, so membership stays a
 *  moderation surface (regular members see counts, not names). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    const c = await findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");
    const me = await requireActiveMember(c!.id, user.id);
    if (!isMod(me)) throw new ApiError(403, "Member management is a moderator tool");

    const rows = await db
      .select({ m: tables.communityMembers, u: tables.users, p: tables.profiles })
      .from(tables.communityMembers)
      .innerJoin(tables.users, eq(tables.communityMembers.userId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .where(eq(tables.communityMembers.communityId, c!.id))
      .all();

    return {
      members: rows.map((r) => ({
        userId: r.u.id,
        handle: r.u.handle,
        displayName: r.p.displayName,
        avatarUrl: r.p.avatarUrl,
        role: r.m.role,
        status: r.m.status,
        mutedUntil: r.m.mutedUntil,
        joinedAt: r.m.joinedAt,
        // aliases/anon codes deliberately NOT included — moderation does not
        // need to browse identity mappings; reveals go through the audited
        // reveal-author flow tied to reports
      })),
    };
  });
}

/** POST — moderation actions on a member: approve | decline | remove |
 *  ban | mute | unmute | promote | demote. Every action lands in the
 *  append-only mod log. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    const c = await findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");
    const me = await requireActiveMember(c!.id, user.id);
    if (!isMod(me)) throw new ApiError(403, "Moderator tools need a moderator role");

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const targetId = String(body.userId || "");
    const target = getMembership(c!.id, targetId);
    if (!target) throw new ApiError(404, "That user isn't part of this community");
    if (targetId === user.id) throw new ApiError(400, "You can't moderate yourself");
    if ((await target)!.role === "owner") throw new ApiError(403, "The owner can't be moderated");
    if ((await target)!.role === "moderator" && me.role !== "owner")
      throw new ApiError(403, "Only the owner can moderate moderators");

    const where = and(eq(tables.communityMembers.communityId, c!.id), eq(tables.communityMembers.userId, targetId));
    const set = async (patch: Record<string, unknown>) => await db.update(tables.communityMembers).set(patch).where(where).run();

    switch (action) {
      case "approve": {
        if ((await target)!.status !== "pending") throw new ApiError(409, "No pending request from that user");
        if (c!.price > 0) {
          // paid + approval: approval unlocks the PAYMENT step — membership
          // activates when they complete it
          await set({ status: "approved_unpaid" });
          await notify({ userId: targetId, actorId: user.id, type: "community", title: `Approved — ${c!.name}`, body: `Complete your $${c!.price} ${c!.billingPeriod} membership to join.`, href: `/communities/${c!.slug}` });
        } else {
          if (c!.capacity != null && await activeMemberCount(c!.id) >= c!.capacity) throw new ApiError(409, "The community is at capacity — raise it or free a spot first");
          await set({ status: "active", joinedAt: new Date() });
          await notify({ userId: targetId, actorId: user.id, type: "community", title: `Welcome to ${c!.name}`, body: "Your join request was approved", href: `/communities/${c!.slug}` });
        }
        break;
      }
      case "decline": {
        if ((await target)!.status !== "pending") throw new ApiError(409, "No pending request from that user");
        await db.delete(tables.communityMembers).where(where).run();
        break;
      }
      case "remove": {
        await db.delete(tables.communityMembers).where(where).run();
        break;
      }
      case "ban": {
        await set({ status: "banned" });
        break;
      }
      case "mute": {
        const days = Math.min(30, Math.max(1, Number(body.days) || 1));
        await set({ mutedUntil: new Date(Date.now() + days * 86_400_000) });
        break;
      }
      case "unmute": {
        await set({ mutedUntil: null });
        break;
      }
      case "promote": {
        if (me.role !== "owner") throw new ApiError(403, "Only the owner appoints moderators");
        await set({ role: "moderator" });
        await notify({ userId: targetId, actorId: user.id, type: "community", title: `${c!.name}`, body: "You're now a moderator", href: `/communities/${c!.slug}` });
        break;
      }
      case "demote": {
        if (me.role !== "owner") throw new ApiError(403, "Only the owner appoints moderators");
        await set({ role: "member" });
        break;
      }
      default:
        throw new ApiError(400, "Unknown action");
    }

    await logMod({ communityId: c!.id, actorId: user.id, action: action === "mute" ? `mute_${body.days || 1}d` : action, targetType: "member", targetId, note: String(body.note || "") });
    return { ok: true };
  });
}
