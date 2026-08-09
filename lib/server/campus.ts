/* Verified campus membership — the transaction gate for the Campus
   Marketplace. Browsing is public (limited); transacting requires a
   verified campus record. */

import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { ApiError } from "@/lib/server/auth";

export function requireCampus(userId: string): string {
  const v = db
    .select()
    .from(tables.campusVerifications)
    .where(and(eq(tables.campusVerifications.userId, userId), eq(tables.campusVerifications.status, "verified")))
    .get();
  if (!v) throw new ApiError(403, "This is a campus space — verify your school in Your Campus first");
  return v.campusId;
}
