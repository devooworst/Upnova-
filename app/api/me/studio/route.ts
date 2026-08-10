import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError, isDemoMode } from "@/lib/server/auth";
import { unrestrictedTester } from "@/lib/server/campus";
import { sanitizeStudio, parseStudio, DEFAULT_STUDIO } from "@/lib/profileStudio";

export const dynamic = "force-dynamic";

/**
 * Profile Studio (Pro) — appearance-only profile customization.
 *
 * GET    — my saved config (preserved even when not Pro) + whether it's
 *          currently ACTIVE (displayed publicly).
 * PATCH  — save. Pro-gated: SIMULATION MODE / production require the
 *          real Pro plan; DEMO MODE lets a tester exercise everything.
 *          Input is allow-list sanitized — off-menu values can't persist.
 * DELETE — reset to the standard UpNova design (always allowed).
 *
 * Downgrade never deletes anything: the config stays, display turns off
 * until Pro is active again (enforced where the public payload is built).
 */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const p = db.select().from(tables.profiles).where(eq(tables.profiles.userId, user.id)).get()!;
    const u = db.select().from(tables.users).where(eq(tables.users.id, user.id)).get()!;
    const saved = parseStudio(p.studio);
    const isPro = u.plan === "pro";
    const isCollege = u.plan === "college";
    const demoBypass = !isPro && unrestrictedTester(user.id);
    return {
      studio: saved ?? DEFAULT_STUDIO,
      saved: !!saved,
      isPro,
      isCollege,
      // active = shown on the public profile right now (college = basics only)
      active: !!saved && (isPro || isCollege),
      demoBypass, // demo tester: editor + own preview work, public display still honest
      demoDeployment: isDemoMode(),
    };
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return guarded(() => {
    const user = requireUser();
    const u = db.select().from(tables.users).where(eq(tables.users.id, user.id)).get()!;
    const p = db.select().from(tables.profiles).where(eq(tables.profiles.userId, user.id)).get()!;
    const demoBypass = unrestrictedTester(user.id);
    // BACKEND permission — never just a hidden button:
    //   pro       → full Studio + My World
    //   college   → Studio basics (theme/frame/accent/font/effect/layout);
    //               My World stays Pro (forced off below)
    //   free      → 403 in Simulation/production; DEMO MODE tests everything
    if (u.plan !== "pro" && u.plan !== "college" && !demoBypass)
      throw new ApiError(
        403,
        "Profile Studio is an UpNova Pro feature. Your saved customization (if any) is preserved — upgrade to Pro to edit and display it."
      );

    // MERGE-ON-SAVE: changing one thing never erases the rest. The saved
    // config is the base; only provided fields override; then the whole
    // result passes the allow-list sanitizer.
    const saved = parseStudio(p.studio);
    const incoming = (typeof (body.studio ?? body) === "object" && (body.studio ?? body) !== null ? (body.studio ?? body) : {}) as Record<string, unknown>;
    const merged = {
      ...(saved ?? DEFAULT_STUDIO),
      ...incoming,
      world:
        incoming.world !== undefined
          ? incoming.world
          : saved?.world,
    };
    const clean = sanitizeStudio(merged);
    // My World is Pro-only: College+ saves keep the design but it stays off
    let worldNote: string | null = null;
    if (clean.world?.enabled && u.plan !== "pro" && !demoBypass) {
      clean.world = { ...clean.world, enabled: false };
      worldNote = "My World is Pro-only — your design is saved but stays off until Pro is active.";
    }
    db.update(tables.profiles)
      .set({ studio: JSON.stringify(clean) })
      .where(eq(tables.profiles.userId, user.id))
      .run();
    return { ok: true, studio: clean, active: u.plan === "pro" || u.plan === "college", worldNote };
  });
}

export async function DELETE() {
  return guarded(() => {
    const user = requireUser();
    db.update(tables.profiles).set({ studio: "" }).where(eq(tables.profiles.userId, user.id)).run();
    return { ok: true, studio: DEFAULT_STUDIO };
  });
}
