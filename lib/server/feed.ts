/* ------------------------------------------------------------------ */
/*  Feed + recommendations.                                            */
/*                                                                     */
/*  Scope (WHERE you look) and tab (WHAT you rank) stay orthogonal.    */
/*  Scoring is deterministic — documented weights, no magic:           */
/*    follow      +50   you follow the author                          */
/*    skills      +8/ea shared skill or interest (cap 24)              */
/*    community   +12   share a community with the author              */
/*    city        +15   same city   (+10 within 25 mi)                 */
/*    recency     −0…30 linear decay over 48h                          */
/*    engagement  +6·ln(likes + 2·comments + 1)                        */
/* ------------------------------------------------------------------ */

import { desc, eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";

export type FeedScope =
  | "for-you"
  | "5mi"
  | "25mi"
  | "city"
  | "county"
  | "state"
  | "country"
  | "global"
  | "school";

export function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const parse = (s: string): string[] => {
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
};

type ViewerCtx = {
  userId: string;
  profile: typeof tables.profiles.$inferSelect;
  followingIds: Set<string>;
  communityIds: Set<string>;
  campusIds: Set<string>;
  skills: Set<string>;
};

export async function viewerContext(userId: string, profile: typeof tables.profiles.$inferSelect): Promise<ViewerCtx> {
  const followingIds = new Set(
    (await db
      .select({ id: tables.follows.followingId })
      .from(tables.follows)
      .where(eq(tables.follows.followerId, userId))
      .all())
      .map((r) => r.id)
  );
  const communityIds = new Set(
    (await db
      .select({ id: tables.communityMembers.communityId })
      .from(tables.communityMembers)
      .where(eq(tables.communityMembers.userId, userId))
      .all())
      .map((r) => r.id)
  );
  const campusIds = new Set(
    (await db
      .select({ id: tables.campusVerifications.campusId })
      .from(tables.campusVerifications)
      .where(eq(tables.campusVerifications.userId, userId))
      .all())
      .filter((r, i, arr) => true)
      .map((r) => r.id)
  );
  const skills = new Set([...parse(profile.skills), ...parse(profile.interests)].map((s) => s.toLowerCase()));
  return { userId, profile, followingIds, communityIds, campusIds, skills };
}

/** Does the author's profile fall inside the viewer's chosen scope? */
export function inScope(scope: FeedScope, viewer: ViewerCtx, author: typeof tables.profiles.$inferSelect, authorCampusIds?: Set<string>): boolean {
  const v = viewer.profile;
  switch (scope) {
    case "for-you":
    case "global":
      return true;
    case "5mi":
    case "25mi": {
      if (v.lat == null || v.lng == null || author.lat == null || author.lng == null) return false;
      const mi = haversineMi(v.lat, v.lng, author.lat, author.lng);
      return mi <= (scope === "5mi" ? 5 : 25);
    }
    case "city":
      return !!v.city && author.city === v.city;
    case "county":
      return !!v.county && author.county === v.county;
    case "state":
      return !!v.state && author.state === v.state;
    case "country":
      return !!v.country && author.country === v.country;
    case "school": {
      if (!authorCampusIds) return false;
      return Array.from(viewer.campusIds).some((c) => authorCampusIds.has(c));
    }
  }
}

export function scorePost(
  post: { authorId: string; createdAt: Date },
  authorProfile: typeof tables.profiles.$inferSelect,
  authorCommunityIds: Set<string>,
  likes: number,
  commentsCount: number,
  viewer: ViewerCtx
): number {
  let score = 0;
  if (viewer.followingIds.has(post.authorId)) score += 50;

  const authorTags = [...parse(authorProfile.skills), ...parse(authorProfile.interests)].map((s) =>
    s.toLowerCase()
  );
  const shared = authorTags.filter((t) => viewer.skills.has(t)).length;
  score += Math.min(shared * 8, 24);

  if (Array.from(authorCommunityIds).some((c) => viewer.communityIds.has(c))) score += 12;

  const v = viewer.profile;
  if (v.city && authorProfile.city === v.city) score += 15;
  else if (v.lat != null && v.lng != null && authorProfile.lat != null && authorProfile.lng != null) {
    if (haversineMi(v.lat, v.lng, authorProfile.lat, authorProfile.lng) <= 25) score += 10;
  }

  const hours = (Date.now() - post.createdAt.getTime()) / 3600_000;
  score -= Math.min(30, (hours / 48) * 30);

  score += 6 * Math.log(likes + 2 * commentsCount + 1);
  return score;
}

/** Verified campus ids per user — for the My School scope. */
export async function verifiedCampusMap(userIds: string[]): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  if (userIds.length === 0) return map;
  const rows = db
    .select()
    .from(tables.campusVerifications)
    .where(inArray(tables.campusVerifications.userId, userIds))
    .all();
  for (const r of await rows) {
    if (r.status !== "verified") continue;
    if (!map.has(r.userId)) map.set(r.userId, new Set());
    map.get(r.userId)!.add(r.campusId);
  }
  return map;
}
