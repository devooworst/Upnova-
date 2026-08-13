import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import { getStream, guestRow } from "@/lib/server/live";

export const dynamic = "force-dynamic";

/**
 * POST /api/live/[id]/guests — co-hosts for interviews, podcasts, music
 * collabs, tutoring, campus discussions…
 *   host:   { action:"invite", handle } · { action:"remove", userId }
 *   guest:  { action:"accept" } · { action:"decline" } · { action:"leave" }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const stream = await getStream(params.id);
    if (stream.status !== "live") throw new ApiError(409, "This live has ended");
    const action = String(body.action || "");

    if (action === "invite" || action === "remove") {
      if (stream.hostId !== user.id) throw new ApiError(403, "Only the host manages guests");
      if (!stream.guestsEnabled) throw new ApiError(403, "Guests are turned off for this live — enable them in your live controls");

      if (action === "invite") {
        const handle = String(body.handle || "").trim().toLowerCase().replace(/^@/, "");
        const target = await db.select().from(tables.users).where(eq(tables.users.handle, handle)).get();
        if (!target || target.status !== "active") throw new ApiError(404, "No Mavyn member with that username");
        if (target.id === user.id) throw new ApiError(400, "You're already the host");
        const existing = await guestRow(stream.id, target.id);
        if (existing && (existing.status === "invited" || existing.status === "active"))
          throw new ApiError(409, "They're already invited");
        const active = ((await db.select().from(tables.liveGuests).where(eq(tables.liveGuests.streamId, stream.id)).all()))
          .filter((g) => g.status === "active" || g.status === "invited");
        if (active.length >= 3) throw new ApiError(409, "A live supports the host plus up to 3 guests");
        await db.insert(tables.liveGuests)
          .values({ id: randomBytes(12).toString("hex"), streamId: stream.id, userId: target.id })
          .run();
        await notify({
          userId: target.id,
          actorId: user.id,
          type: "live_guest_invite",
          title: `${user.profile.displayName} invited you into their live`,
          body: stream.title.slice(0, 120),
          href: `/live/${stream.id}`,
        });
        return { ok: true };
      }

      const g = await guestRow(stream.id, String(body.userId || ""));
      if (!g || (g.status !== "invited" && g.status !== "active")) throw new ApiError(404, "They're not in this live");
      (await db.update(tables.liveGuests).set({ status: "removed" }).where(eq(tables.liveGuests.id, g.id)).run());
      return { ok: true };
    }

    if (["accept", "decline", "leave"].includes(action)) {
      const g = await guestRow(stream.id, user.id);
      if (!g || (g.status !== "invited" && g.status !== "active")) throw new ApiError(404, "You're not invited to this live");
      if (action === "accept") {
        if (g.status !== "invited") throw new ApiError(409, "You're already on stage");
        (await db.update(tables.liveGuests).set({ status: "active", joinedAt: new Date() }).where(eq(tables.liveGuests.id, g.id)).run());
      } else {
        (await db.update(tables.liveGuests).set({ status: action === "decline" ? "declined" : "left" }).where(eq(tables.liveGuests.id, g.id)).run());
      }
      return { ok: true };
    }

    throw new ApiError(400, "Unknown action");
  });
}
