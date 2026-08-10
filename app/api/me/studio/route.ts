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
    const demoBypass = !isPro && unrestrictedTester(user.id);
    return {
      studio: saved ?? DEFAULT_STUDIO,
      saved: !!saved,
      isPro,
      // active = shown on the public profile right now
      active: !!saved && isPro,
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
    if (u.plan !== "pro" && !unrestrictedTester(user.id))
      throw new ApiError(
        403,
        "Profile Studio is an UpNova Pro feature. Your saved customization (if any) is preserved — upgrade to Pro to edit and display it."
      );
    const clean = sanitizeStudio(body.studio ?? body);
    db.update(tables.profiles)
      .set({ studio: JSON.stringify(clean) })
      .where(eq(tables.profiles.userId, user.id))
      .run();
    return { ok: true, studio: clean, active: u.plan === "pro" };
  });
}

export async function DELETE() {
  return guarded(() => {
    const user = requireUser();
    db.update(tables.profiles).set({ studio: "" }).where(eq(tables.profiles.userId, user.id)).run();
    return { ok: true, studio: DEFAULT_STUDIO };
  });
}
