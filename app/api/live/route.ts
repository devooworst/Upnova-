import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import {
  LIVE_CATEGORIES,
  LIVE_AUDIENCES,
  discoverStreams,
  activeStreamOf,
  verifiedCampusIdOf,
  isCommunityMember,
  streamCard,
} from "@/lib/server/live";

export const dynamic = "force-dynamic";

/**
 * GET /api/live?filter=now|following|foryou|campus|nearby|replays&category=&q=
 * Discovery. Every row is audience-gated for THIS viewer; coordinates
 * are never in the payload (nearby is computed server-side).
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return guarded(async () => {
    const user = await requireUser();
    return discoverStreams({
      viewerId: user.id,
      filter: String(p.get("filter") || "now"),
      category: String(p.get("category") || "all"),
      q: String(p.get("q") || "").slice(0, 60),
    });
  });
}

/**
 * POST /api/live — GO LIVE. One simple call: title, category, audience,
 * toggles. Campus audience requires the host's VERIFIED campus — an
 * arbitrary campusId in the payload is rejected, always.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();

    const title = String(body.title || "").trim().slice(0, 120);
    if (!title) throw new ApiError(400, "What's happening? Give your live a title.");

    const category = LIVE_CATEGORIES.includes(body.category) ? body.category : "other";
    const audience = LIVE_AUDIENCES.includes(body.audience) ? body.audience : "everyone";

    if (await activeStreamOf(user.id))
      throw new ApiError(409, "You're already live — end your current stream before starting a new one.");

    let campusId: string | null = null;
    if (audience === "campus") {
      const mine = await verifiedCampusIdOf(user.id);
      if (!mine)
        throw new ApiError(403, "Campus streams need a verified campus affiliation — verify your school in Settings first.");
      // a client-sent campusId may only ever CONFIRM the verified one
      if (body.campusId && String(body.campusId) !== mine)
        throw new ApiError(403, "You can only stream to the campus you're verified at.");
      campusId = mine;
    }

    let communityId: string | null = null;
    if (audience === "community") {
      communityId = String(body.communityId || "");
      if (!communityId || !(await isCommunityMember(user.id, communityId)))
        throw new ApiError(403, "Pick one of your own communities to stream to.");
    }

    // nearby scoping uses the host's profile city centroid — stored
    // server-side on the stream row, NEVER serialized to any client
    const profile = await db.select().from(tables.profiles).where(eq(tables.profiles.userId, user.id)).get();
    if (audience === "nearby" && (profile?.lat == null || profile?.lng == null))
      throw new ApiError(400, "Nearby streams need a city on your profile (Settings → Edit profile). Your exact location is never shared.");

    const id = randomBytes(12).toString("hex");
    await db.insert(tables.liveStreams)
      .values({
        id,
        hostId: user.id,
        title,
        category,
        audience,
        campusId,
        communityId,
        status: "live",
        chatEnabled: body.chatEnabled !== false,
        reactionsEnabled: body.reactionsEnabled !== false,
        sharingEnabled: body.sharingEnabled !== false,
        guestsEnabled: body.guestsEnabled !== false,
        saveReplay: body.saveReplay !== false,
        lat: profile?.lat ?? null,
        lng: profile?.lng ?? null,
      })
      .run();

    // the host counts as present from second zero
    await db.insert(tables.liveViewers).values({ streamId: id, userId: user.id }).run();

    return { id, stream: await streamCard((await db.select().from(tables.liveStreams).where(eq(tables.liveStreams.id, id)).get())!, user.id) };
  });
}
