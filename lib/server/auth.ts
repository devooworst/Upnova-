/* ------------------------------------------------------------------ */
/*  Auth — email/password with DB-backed sessions.                     */
/*  httpOnly cookie carries an opaque token; the session row is the    */
/*  source of truth. No JWT, nothing user-forgeable.                   */
/* ------------------------------------------------------------------ */

import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";

export const SESSION_COOKIE = "upnova_session";
const SESSION_DAYS = 30;

// scrypt with per-password salt; legacy bcrypt verified + rehashed on login
export { hashPassword, verifyPassword, needsRehash } from "./passwords";

export function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  db.insert(tables.sessions)
    .values({ id: randomBytes(12).toString("hex"), token, userId, expiresAt })
    .run();
  return { token, expiresAt };
}

export function destroySession(token: string) {
  db.delete(tables.sessions).where(eq(tables.sessions.token, token)).run();
}

export type SessionUser = {
  id: string;
  email: string;
  handle: string;
  role: string;
  plan: string;
  profile: typeof tables.profiles.$inferSelect;
};

/** Resolve the authenticated user from the request cookie. Null when logged out. */
export function getSessionUser(): SessionUser | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = db
    .select({ session: tables.sessions, user: tables.users, profile: tables.profiles })
    .from(tables.sessions)
    .innerJoin(tables.users, eq(tables.sessions.userId, tables.users.id))
    .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
    .where(eq(tables.sessions.token, token))
    .all();

  const row = rows[0];
  if (!row) return null;
  if (row.session.expiresAt.getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  if (row.user.status !== "active") return null;

  return {
    id: row.user.id,
    email: row.user.email,
    handle: row.user.handle,
    role: row.user.role,
    plan: row.user.plan,
    profile: row.profile,
  };
}

/** 401 guard for route handlers. */
export function requireUser(): SessionUser {
  const user = getSessionUser();
  if (!user) throw new AuthError(401, "Not authenticated");
  return user;
}

export function requireAdmin(): SessionUser {
  const user = requireUser();
  if (user.role !== "admin") throw new AuthError(403, "Admin only");
  return user;
}

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

/** Wrap a route handler body: converts AuthError into a JSON response. */
export function guarded<T>(fn: () => T | Promise<T>): Promise<Response> {
  return Promise.resolve()
    .then(fn)
    .then((data) => Response.json(data as object))
    .catch((err) => {
      if (err instanceof AuthError) return Response.json({ error: err.message }, { status: err.status });
      if (err instanceof ApiError) return Response.json({ error: err.message }, { status: err.status });
      console.error(err);
      return Response.json({ error: "Internal error" }, { status: 500 });
    });
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
