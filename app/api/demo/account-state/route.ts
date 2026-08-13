import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError, isDemoMode , requireQaOperator } from "@/lib/server/auth";

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
  return guarded(async () => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    const user = await requireQaOperator();
    // the developer test panel lives in DEMO MODE only — in Simulation Mode
    // you change verification/plan through the realistic user flows
    const mode = await db.select({ t: tables.users.testerMode }).from(tables.users).where(eq(tables.users.id, user.id)).get();
    if (mode?.t === "simulation")
      throw new ApiError(403, "Demo account-state switching requires Demo Mode — use the toggle in the top-left");
    const state = String(body.state || "");
    if (!STATES.includes(state as (typeof STATES)[number]))
      throw new ApiError(400, "state must be one of: " + STATES.join(", "));

    const rows = await db
      .select()
      .from(tables.campusVerifications)
      .where(eq(tables.campusVerifications.userId, user.id))
      .all();

    if (state === "unverified") {
      for (const r of rows)
        await db.delete(tables.campusVerifications).where(eq(tables.campusVerifications.id, r.id)).run();
      return { state: "unverified", campus: null };
    }

    const campus = await db
      .select()
      .from(tables.campuses)
      .where(eq(tables.campuses.slug, String(body.campus || "bowie-state")))
      .get();
    if (!campus) throw new ApiError(404, "School not found");

    // same status rule as real graduation: becoming alumni ends College+
    // (plan -> free); it NEVER auto-enrolls anyone in Pro
    if (state === "alumni") {
      const acct = (await db.select().from(tables.users).where(eq(tables.users.id, user.id)).get())!;
      if (acct.plan === "college")
        await db.update(tables.users).set({ plan: "free" }).where(eq(tables.users.id, user.id)).run();
    }
    const existing = rows.find((r) => r.campusId! === campus!.id);
    if (existing) {
      await db.update(tables.campusVerifications)
        .set({ status: "verified", affiliation: state, verifiedAt: existing.verifiedAt ?? new Date() })
        .where(eq(tables.campusVerifications.id, existing.id))
        .run();
    } else {
      await db.insert(tables.campusVerifications)
        .values({
          id: `cv-${user.id.slice(0, 8)}-${campus!.slug}`,
          userId: user.id,
          campusId: campus!.id,
          status: "verified",
          affiliation: state,
          gradYear: state === "alumni" ? "2022" : "2027",
          program: "",
          verifiedAt: new Date(),
        })
        .run();
    }
    return { state, campus: campus!.name };
  });
}
