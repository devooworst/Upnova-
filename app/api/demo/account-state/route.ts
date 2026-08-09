import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError, isDemoMode } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/demo/account-state — DEMO-ONLY verification-state switcher.
 *
 * Lets a tester cycle Unverified → Current Student → Alumni on their OWN
 * account without being permanently stuck in any state. This exists so the
 * demo can exercise every verification × plan combination; production
 * (db/DEMO_MODE removed) returns 404 and real affiliation changes go
 * through the verification provider + the one-way graduate transition.
 *
 * It changes ONLY the campus_verifications row for the caller:
 *   - never touches the sessions table or any auth state
 *   - never touches users.plan (plan is a separate fact — /api/me/plan)
 *   - preserves gradYear/program when switching student ↔ alumni
 */
const STATES = ["unverified", "current_student", "alumni", "faculty_staff"] as const;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return guarded(() => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    const user = requireUser();
    const state = String(body.state || "");
    if (!STATES.includes(state as (typeof STATES)[number]))
      throw new ApiError(400, "state must be one of: " + STATES.join(", "));

    const rows = db
      .select()
      .from(tables.campusVerifications)
      .where(eq(tables.campusVerifications.userId, user.id))
      .all();

    if (state === "unverified") {
      for (const r of rows)
        db.delete(tables.campusVerifications).where(eq(tables.campusVerifications.id, r.id)).run();
      return { state: "unverified", campus: null };
    }

    const campus = db
      .select()
      .from(tables.campuses)
      .where(eq(tables.campuses.slug, String(body.campus || "bowie-state")))
      .get();
    if (!campus) throw new ApiError(404, "School not found");

    const existing = rows.find((r) => r.campusId === campus.id);
    if (existing) {
      db.update(tables.campusVerifications)
        .set({ status: "verified", affiliation: state, verifiedAt: existing.verifiedAt ?? new Date() })
        .where(eq(tables.campusVerifications.id, existing.id))
        .run();
    } else {
      db.insert(tables.campusVerifications)
        .values({
          id: `cv-${user.id.slice(0, 8)}-${campus.slug}`,
          userId: user.id,
          campusId: campus.id,
          status: "verified",
          affiliation: state,
          gradYear: state === "alumni" ? "2022" : "2027",
          program: "",
          verifiedAt: new Date(),
        })
        .run();
    }
    return { state, campus: campus.name };
  });
}
