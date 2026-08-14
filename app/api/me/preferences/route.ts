import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";
import {
  GOAL_OPTIONS,
  VIBE_OPTIONS,
  WANT_MORE_OPTIONS,
  INTEREST_OPTIONS,
  parsePrefs,
  sanitizeIds,
  sanitizeInterests,
} from "@/lib/onboardingPrefs";

const INTEREST_SET = new Set<string>(INTEREST_OPTIONS);

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  /api/me/preferences — the onboarding personalization signals.      */
/*                                                                     */
/*  GET   → current interests + goals/vibe/wantMore + whether the      */
/*          flow was answered (saved) — the client uses `saved` to     */
/*          decide if the post-signup flow should appear.              */
/*  PATCH → save any subset. Everything is validated against the       */
/*          canonical lists (lib/onboardingPrefs) — free-form input    */
/*          is never stored. Interests write to profiles.interests,    */
/*          the SAME field the profile editor curates, so both stay    */
/*          one source of truth and "edit later" is real.              */
/*                                                                     */
/*  These are initial recommendation signals, not permanent labels:    */
/*  buildTaste() blends them in and decays their weight as actual      */
/*  behavior (follows, likes, saves, views, not-interested) grows.     */
/* ------------------------------------------------------------------ */

export async function GET() {
  return guarded(async () => {
    const user = await requireUser();
    const profile = (await db.select().from(tables.profiles).where(eq(tables.profiles.userId, user.id)).get())!;
    const prefs = parsePrefs(profile.onboardingPrefs);
    let interests: string[] = [];
    try { interests = JSON.parse(profile.interests || "[]"); } catch {}
    return {
      interests,
      goals: prefs.goals,
      vibe: prefs.vibe,
      wantMore: prefs.wantMore,
      saved: !!prefs.savedAt,
      skipped: !!prefs.skipped,
    };
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const profile = (await db.select().from(tables.profiles).where(eq(tables.profiles.userId, user.id)).get())!;
    const prev = parsePrefs(profile.onboardingPrefs);

    const next = {
      goals: body.goals !== undefined ? sanitizeIds(body.goals, GOAL_OPTIONS) : prev.goals,
      vibe: body.vibe !== undefined ? sanitizeIds(body.vibe, VIBE_OPTIONS) : prev.vibe,
      wantMore: body.wantMore !== undefined ? sanitizeIds(body.wantMore, WANT_MORE_OPTIONS) : prev.wantMore,
      savedAt: prev.savedAt ?? new Date().toISOString(),
      // skipped records "answered by skipping" — still counts as done,
      // the flow never nags. Any real save clears it.
      skipped: body.skipped === true ? true : false,
    };

    const update: Partial<typeof tables.profiles.$inferInsert> = { onboardingPrefs: JSON.stringify(next) };
    if (body.interests !== undefined) {
      // merge canonical picks with any custom interests the user already
      // curated in their profile editor — onboarding never wipes those
      const chosen = sanitizeInterests(body.interests);
      let existing: string[] = [];
      try { existing = JSON.parse(profile.interests || "[]"); } catch {}
      const custom = existing.filter((i) => !(INTEREST_SET as Set<string>).has(i));
      update.interests = JSON.stringify([...chosen, ...custom].slice(0, 30));
    }

    await db.update(tables.profiles).set(update).where(eq(tables.profiles.userId, user.id)).run();
    return { ok: true, saved: true };
  });
}
