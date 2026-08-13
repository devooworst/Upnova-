import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import {
  verifyPassword,
  hashPassword,
  needsRehash,
  createSession,
  SESSION_COOKIE,
  sessionCookieOptions,
  rememberDemoSession,
  signDemoToken,
  isDemoMode,
  guarded,
  ApiError,
} from "@/lib/server/auth";
import { rateLimit, rateLimitReset } from "@/lib/server/ratelimit";
import { verifyTotp } from "@/lib/server/totp";
import { notify } from "@/lib/server/notify";
import { ownProfile } from "@/lib/server/serialize";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(async () => {
    // ONE identifier field: email, username, or phone number — the type
    // is detected automatically. Every failure uses the same generic
    // message so nothing about account existence leaks.
    const identifier = String(body.identifier ?? body.email ?? "").trim();
    const password = String(body.password || "");
    const code = body.code != null ? String(body.code) : null;

    // rate limit: 5 failed attempts per identifier per 15 minutes
    const rlKey = `login:${identifier.toLowerCase()}`;
    const rl = rateLimit(rlKey, 5, 15 * 60_000);
    if (!rl.ok)
      throw new ApiError(429, `Too many attempts. Try again in ${Math.max(1, Math.ceil(rl.retryAfterSec / 60))} min.`);

    const phoneDigits = identifier.replace(/[^\d+]/g, "");
    const looksPhone = /^\+?\d{7,15}$/.test(phoneDigits);
    const user = identifier.includes("@")
      ? await db.select().from(tables.users).where(eq(tables.users.email, identifier.toLowerCase())).get()
      : looksPhone
        ? await db.select().from(tables.users).where(eq(tables.users.phone, `+${phoneDigits.replace(/^\+/, "")}`)).get()
        : await db.select().from(tables.users).where(eq(tables.users.handle, identifier.toLowerCase())).get();
    if (!user || !verifyPassword(password, user.passwordHash))
      throw new ApiError(401, "Invalid credentials — check your email, username, or phone and password");
    if (user.status !== "active") throw new ApiError(403, "This account is suspended");

    // MFA: password checked out — now the second factor, if enabled
    if (user.mfaEnabled && user.mfaSecret) {
      if (!code) return { mfaRequired: true };
      if (!verifyTotp(user.mfaSecret, code)) throw new ApiError(401, "That code didn't match — try the current one");
    }

    rateLimitReset(rlKey);

    // transparent upgrade: legacy bcrypt hashes become scrypt on login
    if (needsRehash(user.passwordHash)) {
      await db.update(tables.users)
        .set({ passwordHash: hashPassword(password) })
        .where(eq(tables.users.id, user.id))
        .run();
    }

    const { token, expiresAt } = await createSession(user.id);
    rememberDemoSession(token); // dev sticky marker (no-op unless enabled)
    const cookieless = process.env.MAVYN_DISABLE_SESSION_COOKIES === "1";
    if (!cookieless) cookies().set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));

    // security notification: every new sign-in is visible to the account
    await notify({
      userId: user.id,
      type: "campus", // reuse a neutral channel icon-wise
      category: "activity",
      priority: "low",
      title: "New sign-in to your account",
      body: "If this was you, no action is needed. If not, reset your password now.",
      href: "/settings",
    });

    const profile = (await db.select().from(tables.profiles).where(eq(tables.profiles.userId, user.id)).get())!;
    // sessionToken lets the client fall back to Bearer transport if the
    // browser refuses the cookie (embedded previews) — same session row
    return {
      ...ownProfile(user, profile),
      // the client stores THIS in its persistence layers: in demo mode a
      // SIGNED token any instance can verify; otherwise the opaque token
      sessionToken: isDemoMode() ? signDemoToken(user.handle) : token,
      cookieless,
    };
  });
}
