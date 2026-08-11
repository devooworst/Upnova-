import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { destroySession, forgetDemoSession, readDemoSession, revokeDemoToken, verifyDemoToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  // destroy the session no matter which transport carried it — the cookie
  // OR the Bearer fallback (cookie-blocked embedded previews)
  let token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) {
    const auth = headers().get("authorization") ?? "";
    if (auth.startsWith("Bearer ")) token = auth.slice(7).trim() || undefined;
  }
  if (!token) token = cookies().get("mavyn-session-token")?.value || undefined;
  if (!token) token = readDemoSession() ?? undefined; // storage-blocked browsers still sign out
  // signed demo token: revoke ALL demo tokens for that handle from now on
  if (token?.startsWith("demo.")) {
    const handle = verifyDemoToken(token);
    revokeDemoToken(token); // this exact token dies, by hash — clock-free
    const marker = readDemoSession();
    if (marker?.startsWith("demo.")) revokeDemoToken(marker);
    if (handle) {
      const u = db.select().from(tables.users).where(eq(tables.users.handle, handle)).get();
      if (u) db.delete(tables.sessions).where(eq(tables.sessions.userId, u.id)).run(); // account-level signout
    }
    forgetDemoSession();
    cookies().set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
    return Response.json({ ok: true });
  }
  if (token) {
    // sign the ACCOUNT out, not just this one token: if the sticky marker
    // holds a different (e.g. newer) session for the same user, destroy
    // that too — otherwise the sticky restore would resurrect the login
    // right after sign-out
    const row = db.select().from(tables.sessions).where(eq(tables.sessions.token, token)).get();
    const marker = readDemoSession();
    if (marker && marker !== token) {
      const markerRow = db.select().from(tables.sessions).where(eq(tables.sessions.token, marker)).get();
      if (markerRow && row && markerRow.userId === row.userId) {
        destroySession(marker);
        forgetDemoSession(marker);
      }
    }
    destroySession(token); // the session row dies server-side either way
    forgetDemoSession(token); // and the sandbox stops remembering it
  }
  // deletion must match the attributes the cookie was set with —
  // otherwise Secure/Partitioned cookies outlive "logout" in embedded contexts
  cookies().set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return Response.json({ ok: true });
}
