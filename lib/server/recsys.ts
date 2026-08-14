/* ------------------------------------------------------------------ */
/*  Mavyn recommendation engine — modular, transparent, swappable.    */
/*                                                                     */
/*  Architecture:                                                      */
/*    interactions table  → raw behavioral signals (recordInteraction) */
/*    buildTaste()        → the viewer's taste profile (follows,       */
/*                          interests, per-author/category affinity,   */
/*                          hides, not-interested)                     */
/*    Scorable            → the ONE shape every rankable thing maps to */
/*    WeightedRanker      → documented weighted scoring, no ML         */
/*    Ranker interface    → an ML model replaces WeightedRanker later  */
/*                          without touching routes or UI              */
/*                                                                     */
/*  Rules baked in:                                                    */
/*    · promoted content NEVER enters organic ranking — it is slotted  */
/*      and labeled separately by the caller                           */
/*    · authors with locationVisibility="hidden" receive no proximity  */
/*      scoring at all — privacy settings shape the algorithm too      */
/*    · hide = never show that item again; not_interested = downrank   */
/*      the author and category behind it                              */
/* ------------------------------------------------------------------ */

import { randomBytes } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { haversineMi } from "./feed";

/* ------------------------------ recording ------------------------------ */

export const INTERACTION_ACTIONS = [
  "view",
  "like",
  "unlike",
  "comment",
  "save",
  "unsave",
  "follow",
  "unfollow",
  "profile_view",
  "service_view",
  "book",
  "apply",
  "join",
  "hide",
  "not_interested",
  "report",
] as const;
export type InteractionAction = (typeof INTERACTION_ACTIONS)[number];

export const TARGET_TYPES = ["post", "service", "opportunity", "community", "event", "user"] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

const VIEW_DEDUP_MS = 6 * 3600_000;

export async function recordInteraction(
  userId: string,
  targetType: TargetType,
  targetId: string,
  action: InteractionAction,
  meta = ""
) {
  try {
    // views dedupe within a window so scrolling doesn't spam the log
    if (["view", "profile_view", "service_view"].includes(action)) {
      const recent = (await db
        .select()
        .from(tables.interactions)
        .where(
          and(
            eq(tables.interactions.userId, userId),
            eq(tables.interactions.targetId, targetId),
            eq(tables.interactions.action, action)
          )
        )
        .all())
        .some((r) => r.createdAt.getTime() > Date.now() - VIEW_DEDUP_MS);
      if (recent) return;
    }
    await db.insert(tables.interactions)
      .values({ id: randomBytes(12).toString("hex"), userId, targetType, targetId, action, meta: meta.slice(0, 120) })
      .run();
  } catch {
    /* signal recording must never break the primary action */
  }
}

/* ---------------------------- taste profile ---------------------------- */

/** How much each action says about what the user wants more of. */
const ACTION_AFFINITY: Partial<Record<InteractionAction, number>> = {
  view: 0.5,
  like: 3,
  comment: 4,
  save: 5,
  follow: 10,
  profile_view: 1,
  service_view: 1.5,
  book: 8,
  apply: 6,
  join: 6,
  unlike: -2,
  unsave: -2,
  unfollow: -6,
  hide: -6,
  not_interested: -8,
  report: -20,
};

export interface Taste {
  userId: string;
  lat: number | null;
  lng: number | null;
  city: string;
  interests: Set<string>; // interests + skills, lowercased
  followingIds: Set<string>;
  communityIds: Set<string>;
  /** author id → affinity −1..1 from interaction history */
  authorAffinity: Map<string, number>;
  /** category (lowercased) → affinity −1..1 */
  categoryAffinity: Map<string, number>;
  /** target ids the user explicitly hid or marked not interested */
  hiddenTargets: Set<string>;
  /** authors the user marked not-interested / reported */
  downrankedAuthors: Set<string>;
  /** categories the user marked not-interested */
  downrankedCategories: Set<string>;
}

const parse = (s: string): string[] => {
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
};

export async function buildTaste(userId: string, profile: typeof tables.profiles.$inferSelect): Promise<Taste> {
  const followingIds = new Set(
    (await db.select({ id: tables.follows.followingId }).from(tables.follows).where(eq(tables.follows.followerId, userId)).all()).map((r) => r.id)
  );
  const communityIds = new Set(
    (await db.select({ id: tables.communityMembers.communityId }).from(tables.communityMembers).where(eq(tables.communityMembers.userId, userId)).all()).map((r) => r.id)
  );
  const events = await db.select().from(tables.interactions).where(eq(tables.interactions.userId, userId)).all();

  // resolve post/service targets to their authors + categories once
  const postIds = events.filter((e) => e.targetType === "post").map((e) => e.targetId);
  const posts = postIds.length ? await db.select().from(tables.posts).where(inArray(tables.posts.id, postIds)).all() : [];
  const serviceIds = events.filter((e) => e.targetType === "service").map((e) => e.targetId);
  const services = serviceIds.length ? await db.select().from(tables.services).where(inArray(tables.services.id, serviceIds)).all() : [];

  const authorRaw = new Map<string, number>();
  const categoryRaw = new Map<string, number>();
  const hiddenTargets = new Set<string>();
  const downrankedAuthors = new Set<string>();
  const downrankedCategories = new Set<string>();

  const bump = (map: Map<string, number>, key: string, v: number) => {
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + v);
  };

  for (const e of events) {
    const w = ACTION_AFFINITY[e.action as InteractionAction] ?? 0;
    let authorId: string | null = null;
    let category = "";
    if (e.targetType === "post") {
      const p = posts.find((x) => x.id === e.targetId);
      authorId = p?.authorId ?? null;
      category = (p?.category ?? "").toLowerCase();
    } else if (e.targetType === "service") {
      const s = services.find((x) => x.id === e.targetId);
      authorId = s?.ownerId ?? null;
      category = (s?.category ?? "").toLowerCase();
    } else if (e.targetType === "user") {
      authorId = e.targetId;
    }
    if (authorId) bump(authorRaw, authorId, w);
    if (category) bump(categoryRaw, category, w);

    if (e.action === "hide" || e.action === "not_interested") hiddenTargets.add(e.targetId);
    if (e.action === "not_interested") {
      if (authorId) downrankedAuthors.add(authorId);
      if (category) downrankedCategories.add(category);
      if (e.meta.startsWith("category:")) downrankedCategories.add(e.meta.slice(9).toLowerCase());
    }
    if (e.action === "report" && authorId) downrankedAuthors.add(authorId);
  }

  const squash = (m: Map<string, number>) => new Map(Array.from(m.entries()).map(([k, v]) => [k, Math.tanh(v / 10)]));

  return {
    userId,
    lat: profile.lat,
    lng: profile.lng,
    city: profile.city,
    interests: new Set([...parse(profile.interests), ...parse(profile.skills)].map((s) => s.toLowerCase())),
    followingIds,
    communityIds,
    authorAffinity: squash(authorRaw),
    categoryAffinity: squash(categoryRaw),
    hiddenTargets,
    downrankedAuthors,
    downrankedCategories,
  };
}

/* ------------------------------- scoring ------------------------------- */

/** The one shape every rankable thing maps to. */
export interface Scorable {
  id: string;
  type: TargetType;
  authorId?: string;
  category?: string;
  tags?: string[]; // skills/interest words attached to the item/author
  lat?: number | null;
  lng?: number | null;
  /** author allows proximity signals (locationVisibility !== "hidden") */
  locationOk?: boolean;
  sameCity?: boolean;
  createdAt: Date;
  engagement: number; // likes + 2·comments + saves (or attending, applicants…)
  authorCommunityIds?: Set<string>;
}

/** Transparent, configurable weights — the whole algorithm on one screen. */
export const WEIGHTS = {
  followedAuthor: 50,
  interestMatch: 8, // per shared tag…
  interestCap: 24, // …capped
  sharedCommunity: 12,
  sameCity: 15,
  within25mi: 10,
  authorAffinity: 20, // × tanh-squashed history (−1..1)
  categoryAffinity: 15,
  freshnessMax: 30, // linear decay to 0 over freshnessHours
  freshnessHours: 48,
  engagementLog: 6, // × ln(engagement + 1)
  notInterestedAuthor: -40,
  notInterestedCategory: -25,
};

export interface ScoredItem<T> {
  item: T;
  score: number;
  /** human-readable explanation — transparency beats magic */
  reasons: string[];
}

export function scoreItem(s: Scorable, taste: Taste): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (s.authorId && taste.followingIds.has(s.authorId)) {
    score += WEIGHTS.followedAuthor;
    reasons.push("you follow them");
  }

  const tags = (s.tags ?? []).map((t) => t.toLowerCase());
  const shared = tags.filter((t) => taste.interests.has(t)).length;
  if (shared > 0) {
    score += Math.min(shared * WEIGHTS.interestMatch, WEIGHTS.interestCap);
    reasons.push(`matches ${shared} of your interests`);
  }

  if (s.authorCommunityIds && Array.from(s.authorCommunityIds).some((c) => taste.communityIds.has(c))) {
    score += WEIGHTS.sharedCommunity;
    reasons.push("shares a community with you");
  }

  // proximity — only when the author allows location signals at all
  if (s.locationOk !== false) {
    if (s.sameCity) {
      score += WEIGHTS.sameCity;
      reasons.push("in your city");
    } else if (taste.lat != null && taste.lng != null && s.lat != null && s.lng != null) {
      if (haversineMi(taste.lat, taste.lng, s.lat, s.lng) <= 25) {
        score += WEIGHTS.within25mi;
        reasons.push("near you");
      }
    }
  }

  if (s.authorId) {
    const aff = taste.authorAffinity.get(s.authorId) ?? 0;
    if (Math.abs(aff) > 0.05) {
      score += WEIGHTS.authorAffinity * aff;
      if (aff > 0.2) reasons.push("you engage with this creator");
    }
  }
  const cat = (s.category ?? "").toLowerCase();
  if (cat) {
    const aff = taste.categoryAffinity.get(cat) ?? 0;
    if (Math.abs(aff) > 0.05) score += WEIGHTS.categoryAffinity * aff;
    if (taste.downrankedCategories.has(cat)) {
      score += WEIGHTS.notInterestedCategory;
      reasons.push("category you marked not interested");
    }
  }
  if (s.authorId && taste.downrankedAuthors.has(s.authorId)) score += WEIGHTS.notInterestedAuthor;

  const hours = (Date.now() - s.createdAt.getTime()) / 3600_000;
  score += Math.max(0, WEIGHTS.freshnessMax * (1 - hours / WEIGHTS.freshnessHours));
  score += WEIGHTS.engagementLog * Math.log(Math.max(0, s.engagement) + 1);

  return { score, reasons };
}

/* ------------------------------- ranking ------------------------------- */

/** Swap point: an ML model implements this and replaces weightedRanker. */
export interface Ranker {
  rank<T>(items: { item: T; scorable: Scorable }[], taste: Taste): ScoredItem<T>[];
}

export const weightedRanker: Ranker = {
  rank(items, taste) {
    return items
      .filter(({ scorable }) => !taste.hiddenTargets.has(scorable.id)) // hide = gone, always
      .map(({ item, scorable }) => {
        const { score, reasons } = scoreItem(scorable, taste);
        return { item, score, reasons };
      })
      .sort((a, b) => b.score - a.score);
  },
};

/** The active ranker — routes call this, never a concrete implementation. */
export const ranker: Ranker = weightedRanker;

/* --------------------------- feed arrangement --------------------------- */

/** Post-ranking arrangement for CONSUMPTION feeds (For You). Raw ranked
 *  order maximizes per-item score but tolerates monotony — five posts in
 *  a row from the creator you engage with most, or one category wall.
 *  This pass trades a little score for a better session:
 *
 *    · author spacing  — an author repeats only after `authorGap` other
 *      authors have appeared (greedy pick of the best non-violating item;
 *      if EVERYTHING violates, score wins — small feeds never starve);
 *    · category runs   — at most `categoryRun` consecutive items of one
 *      category, same greedy rule;
 *    · exploration     — every `exploreEvery`-th slot surfaces the
 *      highest-ranked item that matched NONE of the viewer's personal
 *      signals (no follow / interest / affinity reason), labeled
 *      honestly. Taste keeps compounding from interactions without the
 *      feed collapsing into a bubble.
 *
 *  Pure arrangement: no item is added or dropped, hides stay hidden,
 *  Following is NEVER arranged (chronological, exactly who you follow). */
export const ARRANGE = { authorGap: 2, categoryRun: 2, exploreEvery: 8 };
export const EXPLORE_REASON = "outside your usual — exploring";

export function arrangeFeed<T>(
  ranked: ScoredItem<T>[],
  meta: (item: T) => { authorId?: string; category?: string }
): ScoredItem<T>[] {
  const pool = ranked.slice();
  const out: ScoredItem<T>[] = [];
  const recentAuthors: string[] = []; // last `authorGap` authors
  const recentCats: string[] = []; // last `categoryRun` categories

  while (pool.length) {
    let idx = -1;

    // exploration slot: the best item with zero personal signals
    if ((out.length + 1) % ARRANGE.exploreEvery === 0) {
      idx = pool.findIndex((r) => r.reasons.length === 0);
      if (idx >= 0) pool[idx] = { ...pool[idx], reasons: [EXPLORE_REASON] };
    }

    // normal slot: best item that keeps authors spaced and category runs short
    if (idx < 0) {
      idx = pool.findIndex((r) => {
        const m = meta(r.item);
        if (m.authorId && recentAuthors.includes(m.authorId)) return false;
        const cat = (m.category ?? "").toLowerCase();
        if (
          cat &&
          recentCats.length >= ARRANGE.categoryRun &&
          recentCats.slice(-ARRANGE.categoryRun).every((c) => c === cat)
        )
          return false;
        return true;
      });
      if (idx < 0) idx = 0; // every candidate violates spacing → score wins
    }

    const pick = pool.splice(idx, 1)[0];
    const m = meta(pick.item);
    recentAuthors.push(m.authorId ?? "");
    if (recentAuthors.length > ARRANGE.authorGap) recentAuthors.shift();
    recentCats.push((m.category ?? "").toLowerCase());
    if (recentCats.length > ARRANGE.categoryRun) recentCats.shift();
    out.push(pick);
  }
  return out;
}
