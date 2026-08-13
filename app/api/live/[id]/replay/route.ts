import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { getStream } from "@/lib/server/live";

export const dynamic = "force-dynamic";

/**
 * POST /api/live/[id]/replay — after the live ends, the host decides:
 *   { action: "save" } · { action: "delete" } · { action: "highlight" }
 * A deleted replay disappears from every surface (profile, discovery,
 * direct link) — deletion is final for the replay, the stream record
 * stays for the host's own history.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const stream = await getStream(params.id);
    if (stream.hostId !== user.id) throw new ApiError(403, "Only the host manages the replay");
    if (stream.status !== "ended") throw new ApiError(409, "End the live first");

    const action = String(body.action || "");
    if (action === "save") {
      if (stream.replayStatus === "deleted") throw new ApiError(409, "This replay was deleted — that can't be undone");
      (await db.update(tables.liveStreams).set({ replayStatus: "saved" }).where(eq(tables.liveStreams.id, stream.id)).run());
      return { ok: true, replayStatus: "saved" };
    }
    if (action === "delete") {
      (await db.update(tables.liveStreams).set({ replayStatus: "deleted", replayHighlight: false }).where(eq(tables.liveStreams.id, stream.id)).run());
      return { ok: true, replayStatus: "deleted" };
    }
    if (action === "highlight") {
      if (stream.replayStatus !== "saved") throw new ApiError(409, "Save the replay first — highlights come from saved replays");
      (await db.update(tables.liveStreams).set({ replayHighlight: true }).where(eq(tables.liveStreams.id, stream.id)).run());
      return { ok: true, replayStatus: "saved", highlight: true };
    }
    throw new ApiError(400, "Unknown action");
  });
}
