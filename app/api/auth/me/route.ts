import { eq, asc } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db, tables } from "@/db";
import { getSessionUser, verifyDemoTokenDetailed, readDemoSession, isDemoMode, SESSION_COOKIE } from "@/lib/server/auth";
import { ownProfile } from "@/lib/server/serialize";

/* demo-only diagnostics: classify WHY a request is unauthenticated.
   Reasons only — token values never leave the server. */
function whyUnauthenticated(): string {
  if (!isDemoMode()) return "";
  let token = cookies().get(SESSION_COOKIE)?.value;
  let via = "httpOnly cookie";
  if (!token) {
    const auth = headers().get("authorization") ?? "";
    if (auth.startsWith("Bearer ")) { token = auth.slice(7).trim() || undefined; via = "bearer header"; }
  }
  if (!token) { token = cookies().get("upnova-session-token")?.value || undefined; via = "js token cookie"; }
  if (!token) { token = readDemoSession() ?? undefined; via = "server sticky marker"; }
  if (!token) return "no_credentials_presented";
  if (token.startsWith("demo.")) {
    const v = verifyDemoTokenDetailed(token);
    return v.handle ? `demo_token_valid_but_handle_not_in_db (@${v.handle}; via ${via})` : `demo_token_rejected: ${v.reason} (via ${via})`;
  }
  const row = db.select().from(tables.sessions).where(eq(tables.sessions.token, token)).get();
  if (!row) return `stale_opaque_token: no session row on THIS server (via ${via}) — issued before a server reset/wipe; sign in again to get a portable signed token`;
  if (new Date(row.expiresAt).getTime() < Date.now()) return "session_expired";
  return "unknown";
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = getSessionUser();
    if (!session) return Response.json({ user: null, reason: whyUnauthenticated() || undefined });
  const user = db.select().from(tables.users).where(eq(tables.users.id, session.id)).get()!;
  const experience = db
    .select()
    .from(tables.experiences)
    .where(eq(tables.experiences.userId, session.id))
    .orderBy(asc(tables.experiences.order))
    .all();
  const verification = db
    .select({ v: tables.campusVerifications, c: tables.campuses })
    .from(tables.campusVerifications)
    .innerJoin(tables.campuses, eq(tables.campusVerifications.campusId, tables.campuses.id))
    .where(eq(tables.campusVerifications.userId, session.id))
    .all()
    .find((r) => r.v.status === "verified");
  return Response.json({
    user: {
      ...ownProfile(user, session.profile),
      experience,
      // tester mode is only meaningful on a demo deployment; production is
      // always the realistic experience (feature access, never auth state)
      testerMode: isDemoMode() ? (user.testerMode === "simulation" ? "simulation" : "demo") : "simulation",
      demoTools: isDemoMode(), // demo deployment only: Test Center + Demo Controls visibility
      campus: verification
        ? {
            name: verification.c.name,
            slug: verification.c.slug,
            program: verification.v.program,
            affiliation: verification.v.affiliation,
            gradYear: verification.v.gradYear,
          }
        : null,
    },
  });
  } catch (err) {
    // NEVER an empty/HTML error body — the client always gets parseable
    // JSON, and an internal failure reads as "unauthenticated", not a crash
    console.error("[upnova] /api/auth/me failed:", err);
    return Response.json({ user: null });
  }
}
