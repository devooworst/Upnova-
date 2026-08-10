import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { guarded, ApiError } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/schools/[slug] — the public school directory behind the
 * profile pill: people affiliated with this school, filterable by
 * class year and affiliation.
 *
 * Privacy is the member's, not the school's: only people whose
 * verification has showSchool ON appear at all, and a class year is
 * included ONLY when that member shows it (showGradYear). Members with
 * a hidden year appear in "All" but never under a year filter.
 */
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  return guarded(() => {
    const campus = db.select().from(tables.campuses).where(eq(tables.campuses.slug, params.slug)).get();
    if (!campus) throw new ApiError(404, "School not found");

    const rows = db
      .select({ v: tables.campusVerifications, u: tables.users, p: tables.profiles })
      .from(tables.campusVerifications)
      .innerJoin(tables.users, eq(tables.campusVerifications.userId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .where(and(eq(tables.campusVerifications.campusId, campus.id), eq(tables.campusVerifications.status, "verified")))
      .all()
      .filter((r) => r.u.status === "active" && r.v.showSchool);

    const people = rows.map((r) => ({
      handle: r.u.handle,
      displayName: r.p.displayName,
      avatarUrl: r.p.avatarUrl,
      roleLine: [r.p.primaryRole].filter(Boolean).join(""),
      affiliation: r.v.affiliation, // current_student | alumni | faculty_staff
      classOf: r.v.showGradYear && r.v.gradYear ? r.v.gradYear : null,
      verified: r.p.verified,
    }));

    const years = Array.from(new Set(people.map((p) => p.classOf).filter(Boolean) as string[])).sort();

    return {
      school: { name: campus.name, slug: campus.slug },
      count: people.length,
      years,
      people: people.sort((a, b) => a.displayName.localeCompare(b.displayName)),
    };
  });
}
