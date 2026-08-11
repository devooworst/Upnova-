import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { findCommunity, getMembership, isMod, requireActiveMember } from "@/lib/server/communities";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

/** POST — invite a user by handle. Who can invite is a community setting. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = requireUser();
    const c = findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");
    const m = requireActiveMember(c.id, user.id);
    if (c.whoCanInvite === "mods" && !isMod(m))
      throw new ApiError(403, "Only moderators can invite members in this community");

    const body = await req.json().catch(() => ({}));
    const handle = String(body.handle || "").trim().replace(/^@/, "");
    if (!handle) throw new ApiError(400, "Who do you want to invite? Enter their handle");

    const target = db.select().from(tables.users).where(eq(tables.users.handle, handle)).get();
    if (!target) throw new ApiError(404, `No one on Mavyn has the handle @${handle}`);
    if (target.id === user.id) throw new ApiError(400, "You're already here");

    const existing = getMembership(c.id, target.id);
    if (existing) {
      if (existing.status === "active") throw new ApiError(409, `@${handle} is already a member`);
      if (existing.status === "invited") throw new ApiError(409, `@${handle} already has an invitation`);
      if (existing.status === "banned") throw new ApiError(403, `@${handle} was removed from this community`);
      throw new ApiError(409, `@${handle} already has a pending join request — approve it instead`);
    }

    db.insert(tables.communityMembers).values({ communityId: c.id, userId: target.id, status: "invited" }).run();
    notify({
      userId: target.id,
      actorId: user.id,
      type: "community",
      title: `Invitation — ${c.name}`,
      body: `@${user.handle} invited you to join`,
      href: `/communities/${c.slug}`,
    });
    return { ok: true };
  });
}
