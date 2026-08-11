import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import {
  createSession,
  SESSION_COOKIE,
  sessionCookieOptions,
  rememberDemoSession,
  signDemoToken,
  isDemoMode,
  getSessionUser,
  guarded,
  ApiError,
} from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import { ownProfile } from "@/lib/server/serialize";
import { consumeOtp } from "@/lib/server/otp";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/otp/verify { phone, code }
 *
 * With a session → verifies/attaches the phone to the signed-in account.
 * Without one    → PHONE LOGIN: issues a session through the exact same
 *                  path as password login (same cookies, same demo token,
 *                  same security notification). Every failure returns the
 *                  same generic message — no account enumeration.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return guarded(() => {
    // explicit credentials only — see the request route; sticky fallback
    // must never capture a credential-less phone LOGIN
    const hasExplicitCreds = !!req.headers.get("authorization") || !!cookies().get(SESSION_COOKIE);
    const sessionUser = hasExplicitCreds ? getSessionUser() : null;
    const phone = consumeOtp(body.phone, body.code); // throws generic errors

    if (sessionUser) {
      // VERIFY: attach to the signed-in account (a number belongs to one account)
      const taken = db.select().from(tables.users).where(eq(tables.users.phone, phone)).get();
      if (taken && taken.id !== sessionUser.id) throw new ApiError(409, "Couldn't verify this number.");
      db.update(tables.users)
        .set({ phone, phoneVerified: true })
        .where(eq(tables.users.id, sessionUser.id))
        .run();
      notify({
        userId: sessionUser.id,
        type: "security",
        title: "Phone number verified",
        body: "A phone number was verified on your account. If this wasn't you, review your security settings now.",
        href: "/settings",
        priority: "high",
      });
      return { verified: true };
    }

    // LOGIN: only a VERIFIED number signs in
    const user = db.select().from(tables.users).where(eq(tables.users.phone, phone)).get();
    if (!user || !user.phoneVerified || user.status !== "active")
      throw new ApiError(401, "That code didn't work — request a new one.");

    const { token, expiresAt } = createSession(user.id);
    rememberDemoSession(token);
    const cookieless = process.env.MAVYN_DISABLE_SESSION_COOKIES === "1";
    if (!cookieless) cookies().set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));

    notify({
      userId: user.id,
      type: "security",
      title: "New sign-in to your account",
      body: "Signed in with your phone number. If this wasn't you, reset your password now.",
      href: "/settings",
      priority: "high",
    });

    const profile = db.select().from(tables.profiles).where(eq(tables.profiles.userId, user.id)).get()!;
    return {
      ...ownProfile(user, profile),
      sessionToken: isDemoMode() ? signDemoToken(user.handle) : token,
      cookieless,
    };
  });
}
