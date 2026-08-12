import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { getStream, isModerator, PRESENCE_WINDOW_MS } from "@/lib/server/live";

export const dynamic = "force-dynamic";

/** GET /api/live/[id]/viewers — host/moderator only: who's here now. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const user = requireUser();
    const stream = getStream(params.id);
    if (stream.hostId !== user.id && !isModerator(stream.id, user.id))
      throw new ApiError(403, "Only the host and moderators see the viewer list");

    const cutoff = Date.now() - PRESENCE_WINDOW_MS;
    const restrictions = db.select().from(tables.liveRestrictions).where(eq(tables.liveRestrictions.streamId, stream.id)).all();
    const mods = new Set(
      db.select().from(tables.liveModerators).where(eq(tables.liveModerators.streamId, stream.id)).all().map((m) => m.userId)
    );
    const viewers = db
      .select()
      .from(tables.liveViewers)
      .where(eq(tables.liveViewers.streamId, stream.id))
      .all()
      .filter((v) => v.lastSeenAt.getTime() >= cutoff)
      .map((v) => {
        const u = db.select().from(tables.users).where(eq(tables.users.id, v.userId)).get();
        const p = db.select().from(tables.profiles).where(eq(tables.profiles.userId, v.userId)).get();
        return {
          userId: v.userId,
          handle: u?.handle ?? "",
          displayName: p?.displayName ?? "Member",
          avatarUrl: p?.avatarUrl ?? null,
          isHost: v.userId === stream.hostId,
          isModerator: mods.has(v.userId),
          muted: restrictions.some((r) => r.userId === v.userId && r.kind === "mute"),
          blocked: restrictions.some((r) => r.userId === v.userId && r.kind === "block"),
        };
      });
    return { viewers };
  });
}
