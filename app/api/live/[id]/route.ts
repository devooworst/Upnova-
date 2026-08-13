import { NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import {
  getStream,
  streamCard,
  assertCanWatch,
  isModerator,
  restrictionOf,
  guestRow,
  endStream,
  isFollowing,
  REACTION_TYPES,
} from "@/lib/server/live";

export const dynamic = "force-dynamic";

/**
 * GET /api/live/[id] — the full stream payload for the viewer page.
 * Audience-gated: a blocked viewer or a non-follower on a followers-only
 * stream gets a friendly 403 here, on presence, on chat — everywhere.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    const stream = await getStream(params.id);

    // ended streams: watchable only as a SAVED replay (or by the host)
    if (stream.status === "ended") {
      if (stream.replayStatus !== "saved" && stream.hostId !== user.id)
        throw new ApiError(404, "This live has ended and the replay isn't available.");
    } else {
      await assertCanWatch(stream, user.id);
    }

    const guests = await Promise.all((await db
      .select()
      .from(tables.liveGuests)
      .where(eq(tables.liveGuests.streamId, stream.id))
      .all())
      .filter((g) => g.status === "invited" || g.status === "active")
      .map(async (g) => {
        const u = (await db.select().from(tables.users).where(eq(tables.users.id, g.userId)).get())!;
        const p = (await db.select().from(tables.profiles).where(eq(tables.profiles.userId, g.userId)).get())!;
        return { id: g.id, userId: g.userId, handle: u.handle, displayName: p.displayName, avatarUrl: p.avatarUrl, status: g.status };
      }));

    const mods = await Promise.all(((await db.select().from(tables.liveModerators).where(eq(tables.liveModerators.streamId, stream.id)).all()))
      .map(async (m) => {
        const u = (await db.select().from(tables.users).where(eq(tables.users.id, m.userId)).get())!;
        const p = (await db.select().from(tables.profiles).where(eq(tables.profiles.userId, m.userId)).get())!;
        return { userId: m.userId, handle: u.handle, displayName: p.displayName };
      }));

    const pinned = stream.pinnedMessageId
      ? (await db.select().from(tables.liveMessages).where(eq(tables.liveMessages.id, stream.pinnedMessageId)).get())
      : null;
    const pinnedUser = pinned ? await db.select().from(tables.profiles).where(eq(tables.profiles.userId, pinned.userId)).get() : null;

    const counts: Record<string, number> = {};
    for (const t of REACTION_TYPES) counts[t] = 0;
    for (const r of (await db.select().from(tables.liveReactions).where(eq(tables.liveReactions.streamId, stream.id)).all()))
      counts[r.type] = (counts[r.type] ?? 0) + 1;

    const myGuest = await guestRow(stream.id, user.id);
    return {
      stream: {
        ...(await streamCard(stream, user.id)),
        chatEnabled: stream.chatEnabled,
        reactionsEnabled: stream.reactionsEnabled,
        sharingEnabled: stream.sharingEnabled,
        guestsEnabled: stream.guestsEnabled,
        saveReplay: stream.saveReplay,
      },
      guests,
      moderators: mods,
      pinnedMessage:
        pinned && !pinned.deleted
          ? { id: pinned.id, body: pinned.body, displayName: pinnedUser?.displayName ?? "", createdAt: pinned.createdAt.toISOString() }
          : null,
      reactionCounts: counts,
      me: {
        isHost: stream.hostId === user.id,
        isModerator: await isModerator(stream.id, user.id),
        guestStatus: myGuest && (myGuest.status === "invited" || myGuest.status === "active") ? myGuest.status : null,
        muted: !!(await restrictionOf(stream.id, user.id, "mute")),
        following: await isFollowing(user.id, stream.hostId),
      },
    };
  });
}

/**
 * PATCH /api/live/[id] — HOST controls only:
 *   { action: "end" } · { action: "toggle", key, value } ·
 *   { action: "pin", messageId } · { action: "unpin" }
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const stream = await getStream(params.id);
    if (stream.hostId !== user.id) throw new ApiError(403, "Only the host controls this live");

    const action = String(body.action || "");
    if (action === "end") {
      if (stream.status !== "live") throw new ApiError(409, "This live has already ended");
      await endStream(stream);
      return { ok: true, ended: true, replayStatus: stream.saveReplay ? "saved" : "none" };
    }
    if (stream.status !== "live") throw new ApiError(409, "This live has ended — controls are closed");

    if (action === "toggle") {
      const allowed = ["chatEnabled", "reactionsEnabled", "sharingEnabled", "guestsEnabled", "saveReplay"] as const;
      const key = allowed.find((k) => k === body.key);
      if (!key) throw new ApiError(400, "Unknown setting");
      (await db.update(tables.liveStreams).set({ [key]: !!body.value }).where(eq(tables.liveStreams.id, stream.id)).run());
      return { ok: true };
    }
    if (action === "pin") {
      const msg = await db
        .select()
        .from(tables.liveMessages)
        .where(and(eq(tables.liveMessages.id, String(body.messageId || "")), eq(tables.liveMessages.streamId, stream.id)))
        .get();
      if (!msg || msg!.deleted) throw new ApiError(404, "That message isn't in this chat");
      (await db.update(tables.liveStreams).set({ pinnedMessageId: msg!.id }).where(eq(tables.liveStreams.id, stream.id)).run());
      return { ok: true };
    }
    if (action === "unpin") {
      (await db.update(tables.liveStreams).set({ pinnedMessageId: "" }).where(eq(tables.liveStreams.id, stream.id)).run());
      return { ok: true };
    }
    throw new ApiError(400, "Unknown action");
  });
}
