import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { getStream, assertCanWatch, viewerCount, PRESENCE_WINDOW_MS } from "@/lib/server/live";

export const dynamic = "force-dynamic";

/**
 * POST /api/live/[id]/presence — the viewer heartbeat (join + keepalive).
 * A refresh/reconnect just heartbeats again; a disconnect ages out of
 * the presence window naturally. Returns the live viewer count.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    const stream = await getStream(params.id);
    if (stream.status !== "live") return { status: "ended", viewerCount: null };
    await assertCanWatch(stream, user.id);

    const existing = await db
      .select()
      .from(tables.liveViewers)
      .where(and(eq(tables.liveViewers.streamId, stream.id), eq(tables.liveViewers.userId, user.id)))
      .get();
    if (existing)
      await db.update(tables.liveViewers)
        .set({ lastSeenAt: new Date() })
        .where(and(eq(tables.liveViewers.streamId, stream.id), eq(tables.liveViewers.userId, user.id)))
        .run();
    else (await db.insert(tables.liveViewers).values({ streamId: stream.id, userId: user.id }).run());

    const count = await viewerCount(stream.id);
    if (count > stream.peakViewers)
      (await db.update(tables.liveStreams).set({ peakViewers: count }).where(eq(tables.liveStreams.id, stream.id)).run());
    return { status: "live", viewerCount: count, windowMs: PRESENCE_WINDOW_MS };
  });
}
