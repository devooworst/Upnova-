import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { streamCard } from "@/lib/server/live";

export const dynamic = "force-dynamic";

/**
 * GET /api/live/replays?host=<handle> — a member's SAVED replays for
 * their profile page. Deleted replays are gone from here too.
 */
export async function GET(req: NextRequest) {
  const handle = String(req.nextUrl.searchParams.get("host") || "").toLowerCase();
  return guarded(async () => {
    const viewer = await requireUser();
    if (!handle) throw new ApiError(400, "host is required");
    const host = await db.select().from(tables.users).where(eq(tables.users.handle, handle)).get();
    if (!host) throw new ApiError(404, "User not found");
    const rows = (await db
      .select()
      .from(tables.liveStreams)
      .where(eq(tables.liveStreams.hostId, host.id))
      .orderBy(desc(tables.liveStreams.startedAt))
      .all())
      .filter((s) => s.status === "ended" && s.replayStatus === "saved")
      .slice(0, 24);
    return { items: await Promise.all(rows.map((s) => streamCard(s, viewer.id))) };
  });
}
