import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError, isDemoMode } from "@/lib/server/auth";
import { unrestrictedTester } from "@/lib/server/campus";
import { sanitizeStudio, parseStudio, collegeRestrict, DEFAULT_STUDIO } from "@/lib/profileStudio";
import { storeImage } from "@/lib/server/blobs";

export const dynamic = "force-dynamic";

/**
 * Profile Studio (Pro) — appearance-only profile customization.
 *
 * GET    — my saved config (preserved even when not Pro) + whether it's
 *          currently ACTIVE (displayed publicly).
 * PATCH  — save. Pro-gated: SIMULATION MODE / production require the
 *          real Pro plan; DEMO MODE lets a tester exercise everything.
 *          Input is allow-list sanitized — off-menu values can't persist.
 * DELETE — reset to the standard Mavyn design (always allowed).
 *
 * Downgrade never deletes anything: the config stays, display turns off
 * until Pro is active again (enforced where the public payload is built).
 */
export async function GET() {
  return guarded(async () => {
    const user = await requireUser();
    const p = (await db.select().from(tables.profiles).where(eq(tables.profiles.userId, user.id)).get())!;
    const u = (await db.select().from(tables.users).where(eq(tables.users.id, user.id)).get())!;
    const saved = parseStudio(p.studio);
    const isPro = ["pro", "business_pro", "agency"].includes(u.plan);
    const isCollege = u.plan === "college";
    const demoBypass = !isPro && (await unrestrictedTester(user.id));
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
  return guarded(async () => {
    const user = await requireUser();
    const u = (await db.select().from(tables.users).where(eq(tables.users.id, user.id)).get())!;
    const p = (await db.select().from(tables.profiles).where(eq(tables.profiles.userId, user.id)).get())!;
    const demoBypass = await unrestrictedTester(user.id);
    // BACKEND permission — never just a hidden button:
    //   pro       → full Studio + My World
    //   college   → Studio basics (theme/frame/accent/font/effect/layout);
    //               My World stays Pro (forced off below)
    //   free      → 403 in Simulation/production; DEMO MODE tests everything
    const fullTier = ["pro", "business_pro", "agency"].includes(u.plan); // My World / Business World
    if (!fullTier && u.plan !== "college" && !demoBypass)
      throw new ApiError(
        403,
        u.accountType === "business"
          ? "Business World customization comes with Business Pro. Your saved design (if any) is preserved — upgrade to edit and display it."
          : "Profile Studio is an Mavyn Pro feature. Your saved customization (if any) is preserved — upgrade to Pro to edit and display it."
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
    // My World decorative images: uploaded data-URIs are written to disk
    // and replaced with their /uploads path BEFORE sanitizing — the DB
    // stores a ~30-char path instead of up to 900KB of base64 per image.
    const externalizeImages = async (o: unknown) => {
      if (typeof o !== "object" || o === null) return;
      const rec = o as Record<string, unknown>;
      const imgs = rec.images;
      if (typeof imgs === "object" && imgs !== null)
        for (const key of Object.keys(imgs as Record<string, unknown>)) {
          const im = (imgs as Record<string, Record<string, unknown>>)[key];
          if (im && typeof im.src === "string" && im.src.startsWith("data:image/"))
            im.src = (await storeImage(im.src, "world", 950_000)) ?? "";
        }
    };
    const worldAny = (merged as Record<string, unknown>).world;
    if (typeof worldAny === "object" && worldAny !== null) {
      await externalizeImages(worldAny);
      await externalizeImages((worldAny as Record<string, unknown>).tablet);
      await externalizeImages((worldAny as Record<string, unknown>).phone);
    }
    let clean = sanitizeStudio(merged);
    // College+ = decorate the room (student themes, frames, accents,
    // banners, decorations); Pro = design the house (all themes, layout,
    // My World). Enforced HERE, not by hiding buttons.
    let worldNote: string | null = null;
    if (!fullTier && !demoBypass) {
      const before = clean;
      clean = collegeRestrict(clean);
      if (before.world?.enabled) worldNote = "My World and full layout control are Pro-only — your design is saved but stays off until Pro is active.";
      else if (before.theme !== clean.theme) worldNote = "That theme is Pro-only — College+ uses the student preset themes.";
    }
    await db.update(tables.profiles)
      .set({ studio: JSON.stringify(clean) })
      .where(eq(tables.profiles.userId, user.id))
      .run();
    return { ok: true, studio: clean, active: fullTier || u.plan === "college", worldNote };
  });
}

export async function DELETE() {
  return guarded(async () => {
    const user = await requireUser();
    await db.update(tables.profiles).set({ studio: "" }).where(eq(tables.profiles.userId, user.id)).run();
    return { ok: true, studio: DEFAULT_STUDIO };
  });
}
