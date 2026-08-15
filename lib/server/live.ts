/* ------------------------------------------------------------------ */
/*  Mavyn Live — server core.                                          */
/*                                                                     */
/*  ONE universal live ecosystem. Campus/Nearby/Community/Followers/   */
/*  Invite are AUDIENCE + DISCOVERY layers, enforced HERE:             */
/*   · campus streams require the host's VERIFIED campus — nobody can  */
/*     claim a school they aren't verified at                          */
/*   · nearby scoping runs on server-side city centroids and NEVER     */
/*     returns coordinates or distances to the client                  */
/*   · followers/community/invite audiences check real relationship    */
/*     rows on every read — the dropdown is not the security           */
/*   · blocks remove access entirely; mutes silence chat only          */
/*                                                                     */
/*  Roles: host > moderator > guest > viewer. Only the host manages    */
/*  moderators/guests/toggles; moderators handle chat safety.          */
/* ------------------------------------------------------------------ */

import { and, desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { campusVerification, unrestrictedTester } from "@/lib/server/campus";
import { QA_HANDLES } from "@/lib/server/qa";
import { haversineMi } from "@/lib/server/feed";

export const LIVE_CATEGORIES = [
  "music", "gaming", "fashion", "fitness", "education", "business",
  "conversation", "behind_the_scenes", "irl", "creative", "other",
] as const;
export const LIVE_AUDIENCES = ["everyone", "followers", "campus", "nearby", "community", "invite"] as const;
export const REACTION_TYPES = ["heart", "fire", "clap", "wow", "laugh"] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  music: "Music", gaming: "Gaming", fashion: "Fashion", fitness: "Fitness", education: "Education",
  business: "Business", conversation: "Conversation", behind_the_scenes: "Behind the Scenes",
  irl: "IRL", creative: "Creative", other: "Other",
};

/** presence window: a viewer counts while their heartbeat is this fresh */
export const PRESENCE_WINDOW_MS = 45_000;
export const NEARBY_MILES = 50;

type Stream = typeof tables.liveStreams.$inferSelect;

export async function getStream(id: string): Promise<Stream> {
  const s = await db.select().from(tables.liveStreams).where(eq(tables.liveStreams.id, id)).get();
  if (!s) throw new ApiError(404, "That live stream doesn't exist");
  return s;
}

export async function activeStreamOf(hostId: string): Promise<Stream | undefined> {
  return db
    .select()
    .from(tables.liveStreams)
    .where(and(eq(tables.liveStreams.hostId, hostId), eq(tables.liveStreams.status, "live")))
    .get();
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  return !!(await db
    .select()
    .from(tables.follows)
    .where(and(eq(tables.follows.followerId, followerId), eq(tables.follows.followingId, followingId)))
    .get());
}

export async function isCommunityMember(userId: string, communityId: string): Promise<boolean> {
  return !!(await db
    .select()
    .from(tables.communityMembers)
    .where(and(eq(tables.communityMembers.communityId, communityId), eq(tables.communityMembers.userId, userId)))
    .get());
}

export function restrictionOf(streamId: string, userId: string, kind: "mute" | "block") {
  return db
    .select()
    .from(tables.liveRestrictions)
    .where(
      and(
        eq(tables.liveRestrictions.streamId, streamId),
        eq(tables.liveRestrictions.userId, userId),
        eq(tables.liveRestrictions.kind, kind)
      )
    )
    .get();
}

export async function isModerator(streamId: string, userId: string): Promise<boolean> {
  return !!(await db
    .select()
    .from(tables.liveModerators)
    .where(and(eq(tables.liveModerators.streamId, streamId), eq(tables.liveModerators.userId, userId)))
    .get());
}

export async function guestRow(streamId: string, userId: string) {
  return (await db
    .select()
    .from(tables.liveGuests)
    .where(and(eq(tables.liveGuests.streamId, streamId), eq(tables.liveGuests.userId, userId)))
    .all())
    .sort((a, b) => b.invitedAt.getTime() - a.invitedAt.getTime())[0];
}

/** the host's VERIFIED campus id — the only campus a stream may claim.
    NOBODY can claim a campus without a verified affiliation. The only
    exception: the three QA PERSONAS in demo mode (they're seated at the
    demo campus so the Test Center can exercise campus flows) — a fresh
    signup in demo mode gets NO campus, ever. */
export async function verifiedCampusIdOf(userId: string): Promise<string | null> {
  const v = await campusVerification(userId);
  if (v && v!.status === "verified") return v!.campusId;
  if (await unrestrictedTester(userId)) {
    const u = await db.select().from(tables.users).where(eq(tables.users.id, userId)).get();
    if (u && QA_HANDLES.includes(u.handle)) {
      const c = await db.select().from(tables.campuses).where(eq(tables.campuses.slug, "bowie-state")).get();
      return c?.id ?? null;
    }
  }
  return null;
}

/* ------------------------- audience gating ------------------------- */
/** Can this viewer WATCH this stream? Throws a friendly 403 when not.
    The exact same rule gates the detail page, presence, chat and lists. */
export async function assertCanWatch(stream: Stream, viewerId: string): Promise<void> {
  if (viewerId === stream.hostId) return;
  if ((await restrictionOf(stream.id, viewerId, "block")))
    throw new ApiError(403, "You can't join this live");
  const g = await guestRow(stream.id, viewerId);
  if (g && (g.status === "invited" || g.status === "active")) return; // invited guests always may watch
  switch (stream.audience) {
    case "everyone":
      return;
    case "followers":
      if (!(await isFollowing(viewerId, stream.hostId)))
        throw new ApiError(403, "This live is for the host's followers — follow them to join");
      return;
    case "campus": {
      const mine = await verifiedCampusIdOf(viewerId);
      if (!mine || mine !== stream.campusId)
        throw new ApiError(403, "This live is for verified members of the host's campus");
      return;
    }
    case "nearby": {
      const viewer = await db.select().from(tables.profiles).where(eq(tables.profiles.userId, viewerId)).get();
      if (
        stream.lat == null || stream.lng == null || viewer?.lat == null || viewer?.lng == null ||
        haversineMi(viewer.lat, viewer.lng, stream.lat, stream.lng) > NEARBY_MILES
      )
        throw new ApiError(403, "This live is for people nearby — add a city to your profile to join local streams");
      return;
    }
    case "community": {
      if (!stream.communityId || !(await isCommunityMember(viewerId, stream.communityId)))
        throw new ApiError(403, "This live is for members of the host's community");
      return;
    }
    case "invite":
      throw new ApiError(403, "This live is invite-only");
    default:
      return;
  }
}

export async function canWatch(stream: Stream, viewerId: string): Promise<boolean> {
  try {
    await assertCanWatch(stream, viewerId);
    return true;
  } catch {
    return false;
  }
}

/* --------------------------- serialization ------------------------- */

export async function viewerCount(streamId: string): Promise<number> {
  const cutoff = Date.now() - PRESENCE_WINDOW_MS;
  return (await db
    .select()
    .from(tables.liveViewers)
    .where(eq(tables.liveViewers.streamId, streamId))
    .all())
    .filter((v) => v.lastSeenAt.getTime() >= cutoff).length;
}

async function hostCard(hostId: string) {
  const u = (await db.select().from(tables.users).where(eq(tables.users.id, hostId)).get())!;
  const p = (await db.select().from(tables.profiles).where(eq(tables.profiles.userId, hostId)).get())!;
  const pub = publicUser(u, p);
  return {
    id: u.id,
    handle: u.handle,
    displayName: pub.displayName,
    avatarUrl: pub.avatarUrl,
    accountType: pub.accountType,
    verified: pub.verified,
    // privacy: only the host's chosen public location label — never
    // coordinates, never a more precise level than they allow
    locationLabel: pub.locationLabel,
  };
}

/** card shape for lists / feed sections — NO coordinates, ever */
export async function streamCard(stream: Stream, viewerId?: string) {
  const campus = stream.campusId
    ? await db.select().from(tables.campuses).where(eq(tables.campuses.id, stream.campusId)).get()
    : null;
  const community = stream.communityId
    ? await db.select().from(tables.communities).where(eq(tables.communities.id, stream.communityId)).get()
    : null;
  return {
    id: stream.id,
    title: stream.title,
    category: stream.category,
    categoryLabel: CATEGORY_LABEL[stream.category] ?? "Other",
    audience: stream.audience,
    status: stream.status,
    startedAt: stream.startedAt.toISOString(),
    endedAt: stream.endedAt ? stream.endedAt.toISOString() : null,
    replayStatus: stream.replayStatus,
    replayHighlight: stream.replayHighlight,
    viewerCount: stream.status === "live" ? await viewerCount(stream.id) : null,
    peakViewers: stream.peakViewers,
    host: await hostCard(stream.hostId),
    campusName: campus?.name ?? null,
    communityName: community?.name ?? null,
    isMine: viewerId ? stream.hostId === viewerId : false,
  };
}

/* ----------------------------- discovery --------------------------- */

export async function discoverStreams(opts: {
  viewerId: string;
  filter: string; // now | following | foryou | campus | nearby | replays
  category?: string;
  q?: string;
}) {
  const { viewerId, filter } = opts;
  let rows = await db.select().from(tables.liveStreams).orderBy(desc(tables.liveStreams.startedAt)).all();

  if (filter === "replays") {
    rows = rows.filter((s) => s.status === "ended" && s.replayStatus === "saved");
  } else {
    rows = rows.filter((s) => s.status === "live");
  }

  // audience gating on EVERY list — an invite-only or blocked stream is
  // invisible to people who couldn't open it anyway
  {
    const watchable = await Promise.all(rows.map((s) => (filter === "replays" ? Promise.resolve(s.replayStatus === "saved") : canWatch(s, viewerId))));
    rows = rows.filter((_, i) => watchable[i]);
  }

  let campusNote: string | null = null;
  if (filter === "following") {
    const followedFlags = await Promise.all(rows.map((s) => isFollowing(viewerId, s.hostId)));
    rows = rows.filter((_, i) => followedFlags[i]);
  } else if (filter === "campus") {
    const mine = await verifiedCampusIdOf(viewerId);
    if (!mine) {
      rows = [];
      campusNote = "Campus Live shows streams from your verified school — verify your campus in Settings to unlock it.";
    } else {
      rows = rows.filter((s) => s.campusId === mine);
    }
  } else if (filter === "nearby") {
    const viewer = await db.select().from(tables.profiles).where(eq(tables.profiles.userId, viewerId)).get();
    if (viewer?.lat == null || viewer?.lng == null) {
      rows = [];
      campusNote = "Add a city to your profile to see live streams near you — your exact location is never shared.";
    } else {
      rows = rows.filter(
        (s) => s.lat != null && s.lng != null && haversineMi(viewer.lat!, viewer.lng!, s.lat!, s.lng!) <= NEARBY_MILES
      );
    }
  } else if (filter === "foryou") {
    // simple honest ranking: people you follow first, then by live audience size
    rows = (
      await Promise.all(
        rows.map(async (s) => ({
          s,
          score: ((await isFollowing(viewerId, s.hostId)) ? 1000 : 0) + (await viewerCount(s.id)),
        }))
      )
    )
      .sort((a, b) => b.score - a.score)
      .map((x) => x.s);
  }

  if (opts.category && opts.category !== "all") rows = rows.filter((s) => s.category === opts.category);
  if (opts.q) {
    const q = opts.q.toLowerCase();
    rows = rows.filter((s) => s.title.toLowerCase().includes(q));
  }

  return { items: await Promise.all(rows.slice(0, 60).map((s) => streamCard(s, viewerId))), note: campusNote };
}

/* ------------------------------ lifecycle -------------------------- */

export async function endStream(stream: Stream) {
  const replayStatus = stream.saveReplay ? "saved" : "none";
  await db.update(tables.liveStreams)
    .set({ status: "ended", endedAt: new Date(), replayStatus })
    .where(eq(tables.liveStreams.id, stream.id))
    .run();
  // guests' active sessions end with the stream
  for (const g of await db.select().from(tables.liveGuests).where(eq(tables.liveGuests.streamId, stream.id)).all())
    if (g.status === "active" || g.status === "invited")
      await db.update(tables.liveGuests).set({ status: "left" }).where(eq(tables.liveGuests.id, g.id)).run();
}
