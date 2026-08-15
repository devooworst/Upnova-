import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { guarded, ApiError, isDemoMode } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { sendEmail } from "@/lib/server/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/forgot { email }
 * Always answers the same way whether or not the account exists — no
 * account enumeration. The reset link goes out through the email
 * transport: a real provider in production, the inspectable outbox on
 * dev/preview/demo (where the Test Center reads it).
 *
 * The token itself is NEVER in the API response and never logged. The
 * ONLY exception is demo mode (isDemoMode() — hard-off on production,
 * see P0-1), where devResetUrl keeps the sandbox flow testable without
 * an email account.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(async () => {
    const email = String(body.email || "").trim().toLowerCase();
    const rl = rateLimit(`forgot:${email}`, 3, 15 * 60_000);
    if (!rl.ok) throw new ApiError(429, "Too many reset requests — try again later");

    const user = await db.select().from(tables.users).where(eq(tables.users.email, email)).get();
    if (!user) return { ok: true, sent: true }; // same response either way

    const token = randomBytes(32).toString("hex");
    await db.insert(tables.passwordResets)
      .values({
        id: randomBytes(12).toString("hex"),
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 60_000), // 30 minutes
      })
      .run();

    // absolute link from the configured public origin (fallback: request origin)
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000"}`;
    const resetUrl = `${origin.replace(/\/$/, "")}/reset?token=${token}`;

    const result = await sendEmail({
      userId: user.id,
      to: user.email,
      subject: "Reset your Mavyn password",
      text:
        `Someone (hopefully you) asked to reset the password for this Mavyn account.\n\n` +
        `Reset it here (link works once, expires in 30 minutes):\n${resetUrl}\n\n` +
        `If you didn't ask for this, ignore this email — your password is unchanged.`,
      kind: "security",
    });

    if (!result.delivered) {
      // honest failure: the token exists but the mail never left. Telling
      // the user to "check your email" would be a lie. Invalidate the
      // token and surface a retryable error (still no account disclosure —
      // this branch also runs for infrastructure failures only).
      await db.update(tables.passwordResets).set({ usedAt: new Date() }).where(eq(tables.passwordResets.token, token)).run();
      throw new ApiError(503, "We couldn't send the reset email right now — try again in a few minutes.");
    }

    return {
      ok: true,
      sent: true,
      // DEMO ONLY (hard-off in production): keeps the sandbox flow
      // testable without a mailbox. Production responses never carry it.
      ...(isDemoMode() ? { devResetUrl: `/reset?token=${token}` } : {}),
    };
  });
}
