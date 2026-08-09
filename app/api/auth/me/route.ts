import { eq, asc } from "drizzle-orm";
import { db, tables } from "@/db";
import { getSessionUser } from "@/lib/server/auth";
import { ownProfile } from "@/lib/server/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = getSessionUser();
    if (!session) return Response.json({ user: null });
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
