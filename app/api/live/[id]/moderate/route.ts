import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { getStream, isModerator, restrictionOf } from "@/lib/server/live";

export const dynamic = "force-dynamic";

/**
 * POST /api/live/[id]/moderate — chat-safety powers.
 *   moderators + host: delete_message · mute · unmute
 *   host only:         block · unblock · add_mod · remove_mod
 * The host can never be muted/blocked/demoted — no self-lockout.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const stream = getStream(params.id);
    const host = stream.hostId === user.id;
    const mod = host || isModerator(stream.id, user.id);
    if (!mod) throw new ApiError(403, "Only the host and moderators can do that");

    const action = String(body.action || "");
    const targetId = String(body.userId || "");

    if (action === "delete_message") {
      const msg = db
        .select()
        .from(tables.liveMessages)
        .where(and(eq(tables.liveMessages.id, String(body.messageId || "")), eq(tables.liveMessages.streamId, stream.id)))
        .get();
      if (!msg) throw new ApiError(404, "That message isn't in this chat");
      db.update(tables.liveMessages).set({ deleted: true }).where(eq(tables.liveMessages.id, msg.id)).run();
      if (stream.pinnedMessageId === msg.id)
        db.update(tables.liveStreams).set({ pinnedMessageId: "" }).where(eq(tables.liveStreams.id, stream.id)).run();
      return { ok: true };
    }

    if (["mute", "unmute", "block", "unblock"].includes(action)) {
      if (!targetId) throw new ApiError(400, "Who?");
      if (targetId === stream.hostId) throw new ApiError(400, "The host can't be restricted in their own live");
      if (["block", "unblock"].includes(action) && !host) throw new ApiError(403, "Only the host can block viewers");
      const kind = action.includes("mute") ? "mute" : "block";
      const existing = restrictionOf(stream.id, targetId, kind as "mute" | "block");
      if (action === "mute" || action === "block") {
        if (!existing)
          db.insert(tables.liveRestrictions)
            .values({ id: randomBytes(12).toString("hex"), streamId: stream.id, userId: targetId, kind })
            .run();
      } else if (existing) {
        db.delete(tables.liveRestrictions).where(eq(tables.liveRestrictions.id, existing.id)).run();
      }
      return { ok: true };
    }

    if (action === "add_mod" || action === "remove_mod") {
      if (!host) throw new ApiError(403, "Only the host manages moderators");
      if (!targetId || targetId === stream.hostId) throw new ApiError(400, "Pick a viewer");
      const existing = db
        .select()
        .from(tables.liveModerators)
        .where(and(eq(tables.liveModerators.streamId, stream.id), eq(tables.liveModerators.userId, targetId)))
        .get();
      if (action === "add_mod" && !existing)
        db.insert(tables.liveModerators).values({ streamId: stream.id, userId: targetId }).run();
      if (action === "remove_mod" && existing)
        db.delete(tables.liveModerators)
          .where(and(eq(tables.liveModerators.streamId, stream.id), eq(tables.liveModerators.userId, targetId)))
          .run();
      return { ok: true };
    }

    throw new ApiError(400, "Unknown action");
  });
}
