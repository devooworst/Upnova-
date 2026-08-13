import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { hashPassword, guarded, ApiError } from "@/lib/server/auth";
import { validatePassword } from "@/lib/passwordPolicy";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

/** POST /api/auth/reset { token, password } — single-use, 30-min expiry. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(async () => {
    const token = String(body.token || "");
    const password = String(body.password || "");

    const reset = await db.select().from(tables.passwordResets).where(eq(tables.passwordResets.token, token)).get();
    if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now())
      throw new ApiError(400, "This reset link is invalid or expired — request a new one.");

    const pwError = validatePassword(password);
    if (pwError) throw new ApiError(400, pwError);

    await db.update(tables.users)
      .set({ passwordHash: hashPassword(password) })
      .where(eq(tables.users.id, reset.userId))
      .run();
    await db.update(tables.passwordResets)
      .set({ usedAt: new Date() })
      .where(eq(tables.passwordResets.id, reset.id))
      .run();
    // every existing session is revoked when the password changes
    await db.delete(tables.sessions).where(eq(tables.sessions.userId, reset.userId)).run();

    await notify({
      userId: reset.userId,
      type: "campus",
      category: "activity",
      priority: "high",
      title: "Your password was changed",
      body: "All sessions were signed out. If this wasn't you, contact support immediately.",
      href: "/settings",
    });

    return { ok: true };
  });
}
