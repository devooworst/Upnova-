import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError, isQaOperator, isDemoMode } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { getStream, assertCanWatch, restrictionOf, isModerator } from "@/lib/server/live";

export const dynamic = "force-dynamic";

/**
 * GET /api/live/[id]/chat?after=<ms> — the real-time chat feed
 * (short-poll transport). Deleted messages are never served.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const after = Number(req.nextUrl.searchParams.get("after") || 0);
  return guarded(async () => {
    const user = await requireUser();
    const stream = await getStream(params.id);
    if (stream.status === "live") await assertCanWatch(stream, user.id);
    else if (stream.replayStatus !== "saved" && stream.hostId !== user.id)
      throw new ApiError(404, "This live has ended");

    const canModerate = stream.hostId === user.id || (await isModerator(stream.id, user.id));
    const msgs = await Promise.all((await db
      .select()
      .from(tables.liveMessages)
      .where(eq(tables.liveMessages.streamId, stream.id))
      .all())
      .filter((m) => !m.deleted && m.createdAt.getTime() > after)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(-120)
      .map(async (m) => {
        const p = await db.select().from(tables.profiles).where(eq(tables.profiles.userId, m.userId)).get();
        const u = await db.select().from(tables.users).where(eq(tables.users.id, m.userId)).get();
        return {
          id: m.id,
          userId: m.userId,
          handle: u?.handle ?? "",
          displayName: p?.displayName ?? "Member",
          avatarUrl: p?.avatarUrl ?? null,
          body: m.body,
          kind: m.kind,
          isHost: m.userId === stream.hostId,
          at: m.createdAt.getTime(),
        };
      }));
    return {
      messages: msgs,
      chatEnabled: stream.chatEnabled,
      status: stream.status,
      pinnedMessageId: stream.pinnedMessageId || null,
      canModerate,
      muted: !!(await restrictionOf(stream.id, user.id, "mute")),
    };
  });
}

/** POST /api/live/[id]/chat { body } — send a message. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const stream = await getStream(params.id);
    if (stream.status !== "live") throw new ApiError(409, "This live has ended — chat is closed");
    await assertCanWatch(stream, user.id);

    if (!stream.chatEnabled && stream.hostId !== user.id)
      throw new ApiError(403, "The host turned chat off for this live");
    if ((await restrictionOf(stream.id, user.id, "mute")))
      throw new ApiError(403, "You've been muted in this live");

    const text = String(body.body || "").trim().slice(0, 300);
    if (!text) throw new ApiError(400, "Say something first");

    // spam protection: burst limit per user per stream (QA operators
    // exempt in demo mode — same rule as conversations)
    if (!(isDemoMode() && isQaOperator(user))) {
      const rl = rateLimit(`livechat:${user.id}:${stream.id}`, 20, 30_000);
      if (!rl.ok) throw new ApiError(429, "Slow down a moment — chat has a burst limit");
    }
    // duplicate-flood guard: identical to your previous message within 5s
    const last = (await db
      .select()
      .from(tables.liveMessages)
      .where(eq(tables.liveMessages.streamId, stream.id))
      .all())
      .filter((m) => m.userId === user.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    if (last && last.body === text && Date.now() - last.createdAt.getTime() < 5_000)
      throw new ApiError(429, "You just said that");

    const id = randomBytes(12).toString("hex");
    (await db.insert(tables.liveMessages).values({ id, streamId: stream.id, userId: user.id, body: text }).run());
    return { ok: true, id };
  });
}
