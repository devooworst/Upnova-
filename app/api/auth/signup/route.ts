import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { hashPassword, createSession, SESSION_COOKIE, sessionCookieOptions, rememberDemoSession, signDemoToken, isDemoMode, guarded, ApiError } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { validatePassword, HANDLE_RE, HANDLE_RULE } from "@/lib/passwordPolicy";
import { ownProfile } from "@/lib/server/serialize";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    // handle uniqueness is case-insensitive: handles are stored lowercased
    const email = String(body.email || "").trim().toLowerCase();
    const handle = String(body.handle || "").trim().toLowerCase().replace(/^@/, "");
    const password = String(body.password || ""); // never trimmed, never truncated
    const displayName = String(body.displayName || "").trim();

    const rl = rateLimit(`signup:${email}`, 5, 15 * 60_000);
    if (!rl.ok) throw new ApiError(429, `Too many attempts — try again in ${Math.ceil(rl.retryAfterSec / 60)} min`);

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError(400, "Enter a valid email");
    if (!HANDLE_RE.test(handle)) throw new ApiError(400, `Username: ${HANDLE_RULE}`);
    const pwError = validatePassword(password);
    if (pwError) throw new ApiError(400, pwError);
    if (!displayName) throw new ApiError(400, "Display name is required");

    const existing = db
      .select({ id: tables.users.id })
      .from(tables.users)
      .where(or(eq(tables.users.email, email), eq(tables.users.handle, handle)))
      .get();
    if (existing) throw new ApiError(409, "Email or username already in use");

    const userId = randomBytes(12).toString("hex");
    db.insert(tables.users)
      .values({
        id: userId,
        email,
        handle,
        passwordHash: hashPassword(password),
        // business accounts start UNVERIFIED — verification is a separate
        // process, never granted by signup or any subscription
        accountType: body.accountType === "business" ? "business" : "individual",
        // optional phone at signup — stored UNVERIFIED; OTP verification
        // happens in Settings. SMS consent is recorded but SMS only ever
        // sends once the number is verified AND consent is on.
        ...(() => {
          const digits = String(body.phone ?? "").replace(/[^\d+]/g, "");
          const m = digits.match(/^\+?(\d{7,15})$/);
          return m ? { phone: `+${m[1]}`, smsConsent: !!body.smsConsent } : {};
        })(),
        ...(body.notifyEmail === false ? { notifyPrefs: JSON.stringify({ projects: { email: false }, opportunities: { email: false }, bookings: { email: false } }) } : {}),
      })
      .run();
    db.insert(tables.profiles)
      .values({ id: randomBytes(12).toString("hex"), userId, displayName })
      .run();

    const { token, expiresAt } = createSession(userId);
    rememberDemoSession(token); // dev sticky marker (no-op unless enabled)
    const cookieless = process.env.UPNOVA_DISABLE_SESSION_COOKIES === "1";
    if (!cookieless) cookies().set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));

    const user = db.select().from(tables.users).where(eq(tables.users.id, userId)).get()!;
    const profile = db.select().from(tables.profiles).where(eq(tables.profiles.userId, userId)).get()!;
    return {
      ...ownProfile(user, profile),
      sessionToken: isDemoMode() ? signDemoToken(user.handle) : token,
      cookieless,
    };
  });
}
