/* ------------------------------------------------------------------ */
/*  Auth — email/password with DB-backed sessions.                     */
/*  httpOnly cookie carries an opaque token; the session row is the    */
/*  source of truth. No JWT, nothing user-forgeable.                   */
/*                                                                     */
/*  Access model — three states, enforced HERE, never by hidden UI:    */
/*    Guest    — no session. May READ limited public content            */
/*               (getSessionUser() returns null; public GETs handle    */
/*               it). Every create/interact endpoint calls             */
/*               requireUser() and 401s guests.                        */
/*    Member   — session exists. Can participate: post, message,       */
/*               follow, save, book, apply, pay.                       */
/*    Verified — capabilities layered on top of Member (identity /     */
/*               student / creator / business verification, admin).    */
/*               Verification is EARNED, never granted by Pro or       */
/*               Business subscriptions.                               */
/* ------------------------------------------------------------------ */

import { cookies, headers } from "next/headers";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";

export const SESSION_COOKIE = "upnova_session";
const SESSION_DAYS = 30;

/* Session cookie attributes — THE fix for "login succeeds but I'm logged
   out afterwards" in proxied/embedded environments:

   · Behind HTTPS (previews, production — detected via x-forwarded-proto,
     the standard proxy header) the app is often rendered inside an
     iframe on another origin. Browsers treat its cookies as THIRD-PARTY
     and refuse SameSite=Lax ones, so the login sets a cookie the browser
     never keeps. Embedded contexts require SameSite=None + Secure, and
     modern third-party-cookie rules additionally want Partitioned
     (CHIPS) — partitioned per top site, which is exactly right for a
     session cookie.
   · On plain HTTP (local dev, curl) Secure cookies would be DROPPED
     instead, so there we keep SameSite=Lax without Secure.

   Same server-side session either way — only the cookie attributes
   adapt to the transport. */
export function sessionCookieOptions(expiresAt?: Date) {
  let https = false;
  try {
    const h = headers();
    const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim();
    const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase();
    https =
      proto === "https" ||
      (h.get("x-forwarded-ssl") ?? "").toLowerCase() === "on" ||
      // known HTTPS-only preview domains — belt and suspenders in case the
      // proxy doesn't forward the proto header
      host.endsWith(".e2b.app") ||
      process.env.UPNOVA_SECURE_COOKIES === "1";
  } catch {
    /* outside a request scope — default to http attributes */
  }
  return {
    httpOnly: true as const,
    path: "/" as const,
    ...(expiresAt ? { expires: expiresAt } : {}),
    ...(https
      ? { sameSite: "none" as const, secure: true, partitioned: true }
      : { sameSite: "lax" as const }),
  };
}

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
      // never mask the real failure while developing — surfacing
      // "no such table: users" instead of "Internal error" is the
      // difference between a 5-minute fix and a mystery
      console.error("[upnova] unhandled route error:", err);
      const detail =
        process.env.NODE_ENV !== "production" || process.env.UPNOVA_VERBOSE_ERRORS === "1"
          ? `: ${err instanceof Error ? err.message : String(err)}`
          : "";
      return Response.json({ error: `Internal error${detail}` }, { status: 500 });
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
