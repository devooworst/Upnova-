import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { verifyPassword, createSession, SESSION_COOKIE, guarded, ApiError } from "@/lib/server/auth";
import { ownProfile } from "@/lib/server/serialize";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    const user = db.select().from(tables.users).where(eq(tables.users.email, email)).get();
    if (!user || !verifyPassword(password, user.passwordHash))
      throw new ApiError(401, "Invalid email or password");
    if (user.status !== "active") throw new ApiError(403, "This account is suspended");

    const { token, expiresAt } = createSession(user.id);
    cookies().set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    const profile = db.select().from(tables.profiles).where(eq(tables.profiles.userId, user.id)).get()!;
    return ownProfile(user, profile);
  });
}
