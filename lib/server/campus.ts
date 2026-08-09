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
import { ApiError } from "@/lib/server/auth";

export function campusVerification(userId: string) {
  return db
    .select()
    .from(tables.campusVerifications)
    .where(and(eq(tables.campusVerifications.userId, userId), eq(tables.campusVerifications.status, "verified")))
    .get();
}

export function requireCampus(userId: string): string {
  const v = campusVerification(userId);
  if (!v) throw new ApiError(403, "This is a campus space — verify your school in Your Campus first");
  return v.campusId;
}

/** Student-to-student areas. The Student → Alumni transition deletes
    nothing — these areas simply become unavailable for new activity. */
export function requireCurrentStudent(userId: string): string {
  const v = campusVerification(userId);
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
