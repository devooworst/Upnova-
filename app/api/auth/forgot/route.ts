import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { guarded, ApiError } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/forgot { email }
 * Always answers the same way whether or not the account exists — no
 * account enumeration. In production the reset link goes out by email;
 * in this sandbox (no SMTP) the link is returned as devResetUrl,
 * clearly labeled.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(async () => {
    const email = String(body.email || "").trim().toLowerCase();
    const rl = rateLimit(`forgot:${email}`, 3, 15 * 60_000);
    if (!rl.ok) throw new ApiError(429, "Too many reset requests — try again later");

    const user = await db.select().from(tables.users).where(eq(tables.users.email, email)).get();
    if (!user) return { ok: true }; // same response either way

    const token = randomBytes(32).toString("hex");
    await db.insert(tables.passwordResets)
      .values({
        id: randomBytes(12).toString("hex"),
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 60_000), // 30 minutes
      })
      .run();

    return {
      ok: true,
      // DEV ONLY — production sends this by email instead of returning it
      devResetUrl: `/reset?token=${token}`,
    };
  });
}
