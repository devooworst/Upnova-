import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { randomBytes, randomInt } from "crypto";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { guarded, ApiError, getSessionUser, isDemoMode } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { deliver } from "@/lib/server/notify";
import { normalizePhone, hashOtp } from "@/lib/server/otp";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/otp — request a one-time code for a phone number.
 * Used for BOTH phone login (no session) and phone verification (with
 * a session). SECURITY: only the sha256 hash is stored; 5-minute
 * expiry; 3 requests / 10 min per number; the response is IDENTICAL
 * whether or not an account exists (no enumeration). The code itself
 * is never persisted in plaintext anywhere — in production it rides
 * the SMS provider only; in this demo it is returned once, flagged,
 * because no SMS provider exists in the sandbox.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return guarded(async () => {
    const phone = normalizePhone(body.phone);
    if (!phone) throw new ApiError(400, "Enter a valid phone number");

    const rl = rateLimit(`otp:${phone}`, 3, 10 * 60_000);
    if (!rl.ok) throw new ApiError(429, "Too many codes requested — try again in a few minutes.");

    // EXPLICIT credentials only: the demo sticky-session fallback must
    // never turn a phone LOGIN into a phone-verify for someone else.
    const hasExplicitCreds = !!req.headers.get("authorization") || !!cookies().get("mavyn_session");
    const sessionUser = hasExplicitCreds ? await getSessionUser() : null;
    const purpose = sessionUser ? "verify" : "login";
    const code = String(randomInt(100000, 1000000)); // 6 digits, CSPRNG

    await db.insert(tables.otpCodes)
      .values({
        id: randomBytes(12).toString("hex"),
        phone,
        codeHash: hashOtp(code),
        purpose,
        expiresAt: new Date(Date.now() + 5 * 60_000),
      })
      .run();

    // delivery note in the outbox WITHOUT the code (codes are never
    // persisted in plaintext) — only when the number belongs to someone
    const owner = await db.select().from(tables.users).where(eq(tables.users.phone, phone)).get();
    if (owner)
      await deliver(owner.id, "sms", phone, "Mavyn: your sign-in code was sent to this number. It expires in 5 minutes. Never share it.", "otp");

    return {
      ok: true,
      message: "If this number can receive codes, one is on its way. It expires in 5 minutes.",
      // DEMO ONLY: the sandbox has no SMS provider, so the code is handed
      // back once for testing. Production never returns this field.
      ...(isDemoMode() ? { demoCode: code } : {}),
    };
  });
}
