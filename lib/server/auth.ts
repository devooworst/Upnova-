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
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

/* ---------------- DEV/DEMO ONLY: sticky sandbox session ----------------
   Some embedded previews block EVERY client storage mechanism (cookies,
   localStorage, sessionStorage, window.name). No client can survive a
   refresh there. When MAVYN_DEMO_STICKY_SESSION=1, the sandbox itself
   remembers the demo session: login writes the session token to a local
   marker file; a request arriving with NO credentials restores that
   session; logout destroys the session row AND the marker. It restores a
   REAL session created by a real password check — wrong passwords never
   create one, sign-out really ends it. Single-user demo sandboxes only;
   NEVER set in production (any visitor would resume the demo session).  */
const STICKY_FILE = join(process.cwd(), "db", ".demo-session");
const stickyOn = () => process.env.MAVYN_DEMO_STICKY_SESSION === "1";
/* Demo mode gate that SURVIVES instance swaps: env files are per-machine
   and do not travel with the platform's snapshots — a committed marker
   file does. Production deletes db/DEMO_MODE (see README + the file
   itself); until then every instance of this demo accepts demo tokens. */
const demoModeOn = () => stickyOn() || existsSync(join(process.cwd(), "db", "DEMO_MODE"));

/* Signed demo token — the transport that survives BOTH storage-blocked
   embeddings and preview-instance swaps. Format:
     demo.<handle>.<issuedAtMs>.<hmac-sha256(handle|iat, SESSION_SECRET)>
   Obtained ONLY through a real password check at login; verified
   cryptographically on every request; resolved to the account BY HANDLE
   (seed identities are deterministic across instances); revoked by
   sign-out via a per-handle issued-before cutoff. Demo-only (flag). */
import { createHmac } from "crypto";
/* CONSTANT on purpose: cross-instance verification must not depend on any
   per-machine env value. Demo-only — production removes db/DEMO_MODE and
   this whole path goes dead. */
const demoSecret = () => "mavyn-demo-signing-key-NOT-FOR-PRODUCTION";

export const isDemoMode = () => demoModeOn();

export function signDemoToken(handle: string): string {
  const iat = Date.now();
  const nonce = randomBytes(4).toString("hex"); // uniqueness only — carries no machine meaning
  const sig = createHmac("sha256", demoSecret()).update(`${handle}|${iat}|${nonce}`).digest("hex");
  return `demo.${handle}.${iat}.${nonce}.${sig}`;
}

/* Revocation by TOKEN HASH — the only clock-free, snapshot-safe scheme.
   Sign-out records sha256(token); verification refuses hashes in the set.
   A FRESH login can never be affected: its hash cannot pre-exist. */
const REVOKED_FILE = join(process.cwd(), "db", ".demo-revoked.json");

function revokedHashes(): string[] {
  try { return JSON.parse(readFileSync(REVOKED_FILE, "utf8")); } catch { return []; }
}

export function revokeDemoToken(token: string) {
  try {
    const h = createHmac("sha256", "revocation").update(token).digest("hex");
    const set = revokedHashes();
    if (!set.includes(h)) set.push(h);
    writeFileSync(REVOKED_FILE, JSON.stringify(set.slice(-200)), "utf8");
  } catch {}
}

function isRevoked(token: string): boolean {
  const h = createHmac("sha256", "revocation").update(token).digest("hex");
  return revokedHashes().includes(h);
}

/** Verify a signed demo token. Returns the handle, or a rejection reason
 *  prefixed with "!" so /api/auth/me can name the exact sub-case. */
export function verifyDemoTokenDetailed(token: string): { handle: string | null; reason?: string } {
  if (!demoModeOn()) return { handle: null, reason: "demo_mode_off_on_this_instance" };
  // v2: demo.<handle>.<iat>.<instance>.<sig> — v1 (no instance) still accepted
  const v2 = /^demo\.([a-z0-9_]+)\.(\d+)\.([a-f0-9]{8})\.([a-f0-9]{64})$/.exec(token);
  const v1 = v2 ? null : /^demo\.([a-z0-9_]+)\.(\d+)\.([a-f0-9]{64})$/.exec(token);
  if (!v2 && !v1) return { handle: null, reason: "bad_token_format" };
  const handle = (v2 ?? v1)![1];
  const iatStr = (v2 ?? v1)![2];
  const inst = v2 ? v2[3] : null;
  const sig = v2 ? v2[4] : v1![3];
  const payload = v2 ? `${handle}|${iatStr}|${inst}` : `${handle}|${iatStr}`;
  const expect = createHmac("sha256", demoSecret()).update(payload).digest("hex");
  if (sig !== expect) return { handle: null, reason: "bad_signature" };
  const iat = Number(iatStr);
  if (Date.now() - iat > 30 * 86400_000) return { handle: null, reason: "token_expired_30d" };
  // revocation by hash of the EXACT token — clock-free, snapshot-safe;
  // a freshly minted token can never be pre-revoked
  if (isRevoked(token)) return { handle: null, reason: "revoked_by_signout" };
  return { handle };
}

export function verifyDemoToken(token: string): string | null {
  return verifyDemoTokenDetailed(token).handle;
}

export function rememberDemoSession(token: string) {
  if (!stickyOn()) return;
  try { writeFileSync(STICKY_FILE, token, "utf8"); } catch {}
}
export function readDemoSession(): string | null {
  if (!stickyOn()) return null;
  try { return readFileSync(STICKY_FILE, "utf8").trim() || null; } catch { return null; }
}
export function forgetDemoSession(token?: string) {
  try {
    if (token && readFileSync(STICKY_FILE, "utf8").trim() !== token) return;
    unlinkSync(STICKY_FILE);
  } catch {}
}
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";

export const SESSION_COOKIE = "mavyn_session";
/** the pre-rebrand cookie names — READ as fallbacks so existing UpNova
    sessions stay signed in (the tokens live in the same sessions table);
    all writes use the Mavyn names. */
export const LEGACY_SESSION_COOKIE = "upnova_session";
const LEGACY_TOKEN_COOKIE = "upnova-session-token";
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
      process.env.MAVYN_SECURE_COOKIES === "1";
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
  let token = cookies().get(SESSION_COOKIE)?.value || cookies().get(LEGACY_SESSION_COOKIE)?.value;
  if (!token) {
    // DEV/DEMO fallback transport: embedded previews can block third-party
    // cookies entirely. The client then presents the SAME opaque session
    // token as a Bearer header; it is validated against the same sessions
    // table and dies with the same logout. Nothing is mocked.
    try {
      const auth = headers().get("authorization") ?? "";
      if (auth.startsWith("Bearer ")) token = auth.slice(7).trim() || undefined;
    } catch {
      /* outside request scope */
    }
    // demo transport #3: the JS-set token cookie (first-party contexts
    // send it automatically on every request, including full page loads)
    if (!token) token = cookies().get("mavyn-session-token")?.value || cookies().get(LEGACY_TOKEN_COOKIE)?.value || undefined;
    // demo transport #4 (LAST): no credentials at all — the sandbox's own
    // sticky marker restores the current demo session (see block above)
    if (!token) token = readDemoSession() ?? undefined;
  }
  if (!token) return null;

  // signed demo token? verify cryptographically + resolve BY HANDLE —
  // works on ANY preview instance, no shared state needed
  if (token.startsWith("demo.")) {
    const handle = verifyDemoToken(token);
    if (!handle) return null;
    const row = db
      .select({ user: tables.users, profile: tables.profiles })
      .from(tables.users)
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .where(eq(tables.users.handle, handle))
      .get();
    if (!row || row.user.status !== "active") return null;
    return {
      id: row.user.id,
      email: row.user.email,
      handle: row.user.handle,
      role: row.user.role,
      plan: row.user.plan,
      profile: row.profile,
    };
  }

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
      console.error("[mavyn] unhandled route error:", err);
      const detail =
        process.env.NODE_ENV !== "production" || process.env.MAVYN_VERBOSE_ERRORS === "1"
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
