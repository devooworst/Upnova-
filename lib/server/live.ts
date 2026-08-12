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

export function getStream(id: string): Stream {
  const s = db.select().from(tables.liveStreams).where(eq(tables.liveStreams.id, id)).get();
  if (!s) throw new ApiError(404, "That live stream doesn't exist");
  return s;
}

export function activeStreamOf(hostId: string): Stream | undefined {
  return db
    .select()
    .from(tables.liveStreams)
    .where(and(eq(tables.liveStreams.hostId, hostId), eq(tables.liveStreams.status, "live")))
    .get();
}

export function isFollowing(followerId: string, followingId: string): boolean {
  return !!db
    .select()
    .from(tables.follows)
    .where(and(eq(tables.follows.followerId, followerId), eq(tables.follows.followingId, followingId)))
    .get();
}

export function isCommunityMember(userId: string, communityId: string): boolean {
  return !!db
    .select()
    .from(tables.communityMembers)
    .where(and(eq(tables.communityMembers.communityId, communityId), eq(tables.communityMembers.userId, userId)))
    .get();
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

export function isModerator(streamId: string, userId: string): boolean {
  return !!db
    .select()
    .from(tables.liveModerators)
    .where(and(eq(tables.liveModerators.streamId, streamId), eq(tables.liveModerators.userId, userId)))
    .get();
}

export function guestRow(streamId: string, userId: string) {
  return db
    .select()
    .from(tables.liveGuests)
    .where(and(eq(tables.liveGuests.streamId, streamId), eq(tables.liveGuests.userId, userId)))
    .all()
    .sort((a, b) => b.invitedAt.getTime() - a.invitedAt.getTime())[0];
}

/** the host's VERIFIED campus id — the only campus a stream may claim.
    NOBODY can claim a campus without a verified affiliation. The only
    exception: the three QA PERSONAS in demo mode (they're seated at the
    demo campus so the Test Center can exercise campus flows) — a fresh
    signup in demo mode gets NO campus, ever. */
export function verifiedCampusIdOf(userId: string): string | null {
  const v = campusVerification(userId);
  if (v && v.status === "verified") return v.campusId;
  if (unrestrictedTester(userId)) {
    const u = db.select().from(tables.users).where(eq(tables.users.id, userId)).get();
    if (u && QA_HANDLES.includes(u.handle)) {
      const c = db.select().from(tables.campuses).where(eq(tables.campuses.slug, "bowie-state")).get();
      return c?.id ?? null;
    }
  }
  return null;
}

/* ------------------------- audience gating ------------------------- */
/** Can this viewer WATCH this stream? Throws a friendly 403 when not.
    The exact same rule gates the detail page, presence, chat and lists. */
export function assertCanWatch(stream: Stream, viewerId: string): void {
  if (viewerId === stream.hostId) return;
  if (restrictionOf(stream.id, viewerId, "block"))
    throw new ApiError(403, "You can't join this live");
  const g = guestRow(stream.id, viewerId);
  if (g && (g.status === "invited" || g.status === "active")) return; // invited guests always may watch
  switch (stream.audience) {
    case "everyone":
      return;
    case "followers":
      if (!isFollowing(viewerId, stream.hostId))
        throw new ApiError(403, "This live is for the host's followers — follow them to join");
      return;
    case "campus": {
      const mine = verifiedCampusIdOf(viewerId);
      if (!mine || mine !== stream.campusId)
        throw new ApiError(403, "This live is for verified members of the host's campus");
      return;
    }
    case "nearby": {
      const viewer = db.select().from(tables.profiles).where(eq(tables.profiles.userId, viewerId)).get();
      if (
        stream.lat == null || stream.lng == null || viewer?.lat == null || viewer?.lng == null ||
        haversineMi(viewer.lat, viewer.lng, stream.lat, stream.lng) > NEARBY_MILES
      )
        throw new ApiError(403, "This live is for people nearby — add a city to your profile to join local streams");
      return;
    }
    case "community": {
      if (!stream.communityId || !isCommunityMember(viewerId, stream.communityId))
        throw new ApiError(403, "This live is for members of the host's community");
      return;
    }
    case "invite":
      throw new ApiError(403, "This live is invite-only");
    default:
      return;
  }
}

export function canWatch(stream: Stream, viewerId: string): boolean {
  try {
    assertCanWatch(stream, viewerId);
    return true;
  } catch {
    return false;
  }
}

/* --------------------------- serialization ------------------------- */

export function viewerCount(streamId: string): number {
  const cutoff = Date.now() - PRESENCE_WINDOW_MS;
  return db
    .select()
    .from(tables.liveViewers)
    .where(eq(tables.liveViewers.streamId, streamId))
    .all()
    .filter((v) => v.lastSeenAt.getTime() >= cutoff).length;
}

function hostCard(hostId: string) {
  const u = db.select().from(tables.users).where(eq(tables.users.id, hostId)).get()!;
  const p = db.select().from(tables.profiles).where(eq(tables.profiles.userId, hostId)).get()!;
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
export function streamCard(stream: Stream, viewerId?: string) {
  const campus = stream.campusId
    ? db.select().from(tables.campuses).where(eq(tables.campuses.id, stream.campusId)).get()
    : null;
  const community = stream.communityId
    ? db.select().from(tables.communities).where(eq(tables.communities.id, stream.communityId)).get()
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
    viewerCount: stream.status === "live" ? viewerCount(stream.id) : null,
    peakViewers: stream.peakViewers,
    host: hostCard(stream.hostId),
    campusName: campus?.name ?? null,
    communityName: community?.name ?? null,
    isMine: viewerId ? stream.hostId === viewerId : false,
  };
}

/* ----------------------------- discovery --------------------------- */

export function discoverStreams(opts: {
  viewerId: string;
  filter: string; // now | following | foryou | campus | nearby | replays
  category?: string;
  q?: string;
}) {
  const { viewerId, filter } = opts;
  let rows = db.select().from(tables.liveStreams).orderBy(desc(tables.liveStreams.startedAt)).all();

  if (filter === "replays") {
    rows = rows.filter((s) => s.status === "ended" && s.replayStatus === "saved");
  } else {
    rows = rows.filter((s) => s.status === "live");
  }

  // audience gating on EVERY list — an invite-only or blocked stream is
  // invisible to people who couldn't open it anyway
  rows = rows.filter((s) => (filter === "replays" ? s.replayStatus === "saved" : canWatch(s, viewerId)));

  let campusNote: string | null = null;
  if (filter === "following") {
    rows = rows.filter((s) => isFollowing(viewerId, s.hostId));
  } else if (filter === "campus") {
    const mine = verifiedCampusIdOf(viewerId);
    if (!mine) {
      rows = [];
      campusNote = "Campus Live shows streams from your verified school — verify your campus in Settings to unlock it.";
    } else {
      rows = rows.filter((s) => s.campusId === mine);
    }
  } else if (filter === "nearby") {
    const viewer = db.select().from(tables.profiles).where(eq(tables.profiles.userId, viewerId)).get();
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
    rows = rows
      .map((s) => ({ s, score: (isFollowing(viewerId, s.hostId) ? 1000 : 0) + viewerCount(s.id) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.s);
  }

  if (opts.category && opts.category !== "all") rows = rows.filter((s) => s.category === opts.category);
  if (opts.q) {
    const q = opts.q.toLowerCase();
    rows = rows.filter((s) => s.title.toLowerCase().includes(q));
  }

  return { items: rows.slice(0, 60).map((s) => streamCard(s, viewerId)), note: campusNote };
}

/* ------------------------------ lifecycle -------------------------- */

export function endStream(stream: Stream) {
  const replayStatus = stream.saveReplay ? "saved" : "none";
  db.update(tables.liveStreams)
    .set({ status: "ended", endedAt: new Date(), replayStatus })
    .where(eq(tables.liveStreams.id, stream.id))
    .run();
  // guests' active sessions end with the stream
  for (const g of db.select().from(tables.liveGuests).where(eq(tables.liveGuests.streamId, stream.id)).all())
    if (g.status === "active" || g.status === "invited")
      db.update(tables.liveGuests).set({ status: "left" }).where(eq(tables.liveGuests.id, g.id)).run();
}
