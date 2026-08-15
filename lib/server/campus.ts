/* Verified campus membership — the access layer for Your Campus.
   VERIFICATION-BASED, NEVER SUBSCRIPTION-BASED: Free vs Pro controls
   platform features; belonging to a school is proven, not purchased.

   Two layers of gate:
     requireCampus        — any verified affiliation (student, alumni,
                            faculty/staff): the shared campus environment
     requireCurrentStudent — student-to-student areas (Marketplace,
                            Student Groups). Alumni keep the alumni
                            environment; student-only areas close.       */

import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { ApiError, isDemoMode } from "@/lib/server/auth";

export function campusVerification(userId: string) {
  return db
    .select()
    .from(tables.campusVerifications)
    .where(and(eq(tables.campusVerifications.userId, userId), eq(tables.campusVerifications.status, "verified")))
    .get();
}

/* ------------------------------------------------------------------ */
/* DEMO MODE vs SIMULATION MODE — the tester-mode master switch.       */
/* Only meaningful on a demo deployment (db/DEMO_MODE present):        */
/*   demo       → unrestricted developer testing; access gates below   */
/*                 open without verification/affiliation               */
/*   simulation → the realistic user experience; every gate applies    */
/* Production has no db/DEMO_MODE → always false → gates always apply. */
/* This controls FEATURE ACCESS only. It never reads or writes auth/   */
/* session state, and display surfaces keep showing the REAL account   */
/* facts (verification, plan) — demo mode opens doors, it never lies.  */
/* ------------------------------------------------------------------ */
export async function unrestrictedTester(userId: string): Promise<boolean> {
  if (!isDemoMode()) return false;
  const u = await db
    .select({ t: tables.users.testerMode })
    .from(tables.users)
    .where(eq(tables.users.id, userId))
    .get();
  return (u?.t ?? "demo") === "demo";
}

/** Campus a demo-mode tester is dropped into when they have no real
    verification (the seeded campus). */
export async function demoCampusId(): Promise<string | null> {
  const c =
    await db.select().from(tables.campuses).where(eq(tables.campuses.slug, "bowie-state")).get() ??
    await db.select().from(tables.campuses).get();
  return c?.id ?? null;
}

export async function requireCampus(userId: string): Promise<string> {
  const v = await campusVerification(userId);
  if (v) return v.campusId;
  if (await unrestrictedTester(userId)) {
    const id = await demoCampusId();
    if (id) return id; // DEMO MODE: gate opens for testing
  }
  throw new ApiError(403, "This is a campus space — verify your school in Your Campus first");
}

/** Student-to-student areas. The Student → Alumni transition deletes
    nothing — these areas simply become unavailable for new activity.
    DEMO MODE bypasses the affiliation restriction too (unrestricted
    testing); SIMULATION MODE enforces it exactly like production. */
export async function requireCurrentStudent(userId: string): Promise<string> {
  const v = await campusVerification(userId);
  if (await unrestrictedTester(userId)) {
    const id = v?.campusId ?? (await demoCampusId());
    if (id) return id;
  }
  if (!v) throw new ApiError(403, "This is a campus space — verify your school in Your Campus first");
  if (v.affiliation !== "current_student")
    throw new ApiError(
      403,
      v.affiliation === "alumni"
        ? "This area is for current students — your alumni environment, communities, and events stay open"
        : "This area is for current students"
    );
  return v.campusId;
}

export const AFFILIATIONS = [
  { id: "current_student", label: "Current Student" },
  { id: "alumni", label: "Alumni" },
  { id: "faculty_staff", label: "Faculty / Staff" },
] as const;

export const affiliationLabel = (a: string) => AFFILIATIONS.find((x) => x.id === a)?.label ?? a;
