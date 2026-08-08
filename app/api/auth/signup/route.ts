import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { hashPassword, createSession, SESSION_COOKIE, guarded, ApiError } from "@/lib/server/auth";
import { ownProfile } from "@/lib/server/serialize";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const email = String(body.email || "").trim().toLowerCase();
    const handle = String(body.handle || "").trim().toLowerCase().replace(/^@/, "");
    const password = String(body.password || "");
    const displayName = String(body.displayName || "").trim();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError(400, "Enter a valid email");
    if (!/^[a-z0-9_.]{3,20}$/.test(handle))
      throw new ApiError(400, "Handle must be 3–20 characters: letters, numbers, underscores, periods");
    if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters");
    if (!displayName) throw new ApiError(400, "Display name is required");

    const existing = db
      .select({ id: tables.users.id })
      .from(tables.users)
      .where(or(eq(tables.users.email, email), eq(tables.users.handle, handle)))
      .get();
    if (existing) throw new ApiError(409, "Email or username already in use");

    const userId = randomBytes(12).toString("hex");
    db.insert(tables.users)
      .values({ id: userId, email, handle, passwordHash: hashPassword(password) })
      .run();
    db.insert(tables.profiles)
      .values({ id: randomBytes(12).toString("hex"), userId, displayName })
      .run();

    const { token, expiresAt } = createSession(userId);
    cookies().set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    const user = db.select().from(tables.users).where(eq(tables.users.id, userId)).get()!;
    const profile = db.select().from(tables.profiles).where(eq(tables.profiles.userId, userId)).get()!;
    return ownProfile(user, profile);
  });
}
