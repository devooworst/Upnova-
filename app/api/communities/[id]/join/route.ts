import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { findCommunity, getMembership, isMod } from "@/lib/server/communities";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

/** POST — join / request to join / accept an invitation, per the
 *  community's access setting. Campus-linked communities require verified
 *  campus status at that school. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const user = requireUser();
    const c = findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");

    if (c.campusId) {
      const v = db
        .select()
        .from(tables.campusVerifications)
        .where(and(eq(tables.campusVerifications.userId, user.id), eq(tables.campusVerifications.status, "verified")))
        .get();
      if (!v || v.campusId !== c.campusId)
        throw new ApiError(403, "This is a campus community — verify your school in Your Campus first");
    }

    const existing = getMembership(c.id, user.id);
    if (existing) {
      if (existing.status === "banned") throw new ApiError(403, "You've been removed from this community");
      if (existing.status === "active") throw new ApiError(409, "You're already a member");
      if (existing.status === "pending") throw new ApiError(409, "Your join request is waiting for approval");
      if (existing.status === "invited") {
        db.update(tables.communityMembers)
          .set({ status: "active", joinedAt: new Date() })
          .where(and(eq(tables.communityMembers.communityId, c.id), eq(tables.communityMembers.userId, user.id)))
          .run();
        return { ok: true, status: "active" };
      }
    }

    if (c.access === "invite") throw new ApiError(403, "This community is invite-only — ask a member for an invitation");

    const needsApproval = c.access === "private" || c.joinApproval;
    db.insert(tables.communityMembers)
      .values({ communityId: c.id, userId: user.id, status: needsApproval ? "pending" : "active" })
      .run();

    if (needsApproval) {
      // tell the mods someone is waiting
      const mods = db
        .select()
        .from(tables.communityMembers)
        .where(eq(tables.communityMembers.communityId, c.id))
        .all()
        .filter((m) => isMod(m));
      for (const m of mods)
        notify({
          userId: m.userId,
          actorId: user.id,
          type: "community",
          title: `Join request — ${c.name}`,
          body: `@${user.handle} asked to join`,
          href: `/communities/${c.slug}?tab=members`,
        });
      return { ok: true, status: "pending" };
    }
    return { ok: true, status: "active" };
  });
}

/** DELETE — leave the community. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const user = requireUser();
    const c = findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");
    const m = getMembership(c.id, user.id);
    if (!m || m.status === "banned") throw new ApiError(404, "You're not a member");
    if (m.role === "owner") throw new ApiError(400, "Owners can't leave their own community — appoint a new owner first");
    db.delete(tables.communityMembers)
      .where(and(eq(tables.communityMembers.communityId, c.id), eq(tables.communityMembers.userId, user.id)))
      .run();
    return { ok: true };
  });
}
