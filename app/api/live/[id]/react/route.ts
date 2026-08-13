import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError, isQaOperator, isDemoMode } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { getStream, assertCanWatch, REACTION_TYPES } from "@/lib/server/live";

export const dynamic = "force-dynamic";

/** POST /api/live/[id]/react { type: heart|fire|clap|wow|laugh } */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const stream = await getStream(params.id);
    if (stream.status !== "live") throw new ApiError(409, "This live has ended");
    await assertCanWatch(stream, user.id);
    if (!stream.reactionsEnabled) throw new ApiError(403, "The host turned reactions off for this live");

    const type = REACTION_TYPES.includes(body.type) ? body.type : "heart";
    if (!(isDemoMode() && isQaOperator(user))) {
      const rl = rateLimit(`livereact:${user.id}:${stream.id}`, 30, 30_000);
      if (!rl.ok) throw new ApiError(429, "Easy on the reactions — short cooldown");
    }
    await db.insert(tables.liveReactions)
      .values({ id: randomBytes(12).toString("hex"), streamId: stream.id, userId: user.id, type })
      .run();

    const counts: Record<string, number> = {};
    for (const t of REACTION_TYPES) counts[t] = 0;
    for (const r of (await db.select().from(tables.liveReactions).where(eq(tables.liveReactions.streamId, stream.id)).all()))
      counts[r.type] = (counts[r.type] ?? 0) + 1;
    return { ok: true, counts };
  });
}
