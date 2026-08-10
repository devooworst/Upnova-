import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify, parsePrefs, PREF_CATEGORIES, type NotifyPrefs } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

/** GET /api/me/notifications — prefs + phone/SMS state (own account). */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const u = db.select().from(tables.users).where(eq(tables.users.id, user.id)).get()!;
    return {
      prefs: parsePrefs(u.notifyPrefs),
      phone: u.phone ? `•••• ${u.phone.slice(-4)}` : null, // never echo the full number back out
      phoneVerified: !!u.phoneVerified,
      smsConsent: !!u.smsConsent,
    };
  });
}

/**
 * PATCH — update notification preferences and/or SMS consent.
 * SMS consent is EXPLICIT and requires a verified phone. Security
 * notifications can never be silenced in-app (enforced in parsePrefs
 * and at dispatch).
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return guarded(() => {
    const user = requireUser();
    const u = db.select().from(tables.users).where(eq(tables.users.id, user.id)).get()!;
    const patch: Record<string, unknown> = {};

    if (body.prefs !== undefined) {
      // sanitize through the same parser used at dispatch — one source of truth
      const clean: NotifyPrefs = parsePrefs(JSON.stringify(body.prefs));
      patch.notifyPrefs = JSON.stringify(clean);
    }
    if (typeof body.smsConsent === "boolean") {
      if (body.smsConsent && !u.phoneVerified)
        throw new ApiError(400, "Verify a phone number first — SMS alerts need a verified number.");
      patch.smsConsent = body.smsConsent;
      if (body.smsConsent !== !!u.smsConsent)
        notify({
          userId: user.id,
          type: "security",
          title: body.smsConsent ? "SMS alerts turned on" : "SMS alerts turned off",
          body: "You can change this anytime in Settings → Notifications.",
          href: "/settings",
        });
    }
    if (!Object.keys(patch).length) throw new ApiError(400, "Nothing to update");
    db.update(tables.users).set(patch).where(eq(tables.users.id, user.id)).run();
    const fresh = db.select().from(tables.users).where(eq(tables.users.id, user.id)).get()!;
    return { ok: true, prefs: parsePrefs(fresh.notifyPrefs), smsConsent: !!fresh.smsConsent, categories: PREF_CATEGORIES };
  });
}

/** DELETE — remove the phone number (and with it, all SMS). */
export async function DELETE() {
  return guarded(() => {
    const user = requireUser();
    db.update(tables.users)
      .set({ phone: null, phoneVerified: false, smsConsent: false })
      .where(eq(tables.users.id, user.id))
      .run();
    notify({
      userId: user.id,
      type: "security",
      title: "Phone number removed",
      body: "The phone number was removed from your account. If this wasn't you, secure your account now.",
      href: "/settings",
      priority: "high",
    });
    return { ok: true };
  });
}
