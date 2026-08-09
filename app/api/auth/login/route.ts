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
  return guarded(() => {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const code = body.code != null ? String(body.code) : null;

    // rate limit: 5 failed attempts per account per 15 minutes
    const rlKey = `login:${email}`;
    const rl = rateLimit(rlKey, 5, 15 * 60_000);
    if (!rl.ok)
      throw new ApiError(429, `Too many attempts. Try again in ${Math.max(1, Math.ceil(rl.retryAfterSec / 60))} min.`);

    const user = db.select().from(tables.users).where(eq(tables.users.email, email)).get();
    if (!user || !verifyPassword(password, user.passwordHash))
      throw new ApiError(401, "Invalid email or password");
    if (user.status !== "active") throw new ApiError(403, "This account is suspended");

    // MFA: password checked out — now the second factor, if enabled
    if (user.mfaEnabled && user.mfaSecret) {
      if (!code) return { mfaRequired: true };
      if (!verifyTotp(user.mfaSecret, code)) throw new ApiError(401, "That code didn't match — try the current one");
    }

    rateLimitReset(rlKey);

    // transparent upgrade: legacy bcrypt hashes become scrypt on login
    if (needsRehash(user.passwordHash)) {
      db.update(tables.users)
        .set({ passwordHash: hashPassword(password) })
        .where(eq(tables.users.id, user.id))
        .run();
    }

    const { token, expiresAt } = createSession(user.id);
    cookies().set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));

    // security notification: every new sign-in is visible to the account
    notify({
      userId: user.id,
      type: "campus", // reuse a neutral channel icon-wise
      category: "activity",
      priority: "low",
      title: "New sign-in to your account",
      body: "If this was you, no action is needed. If not, reset your password now.",
      href: "/settings",
    });

    const profile = db.select().from(tables.profiles).where(eq(tables.profiles.userId, user.id)).get()!;
    return ownProfile(user, profile);
  });
}
