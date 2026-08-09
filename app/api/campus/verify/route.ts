import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { campusVerification, affiliationLabel } from "@/lib/server/campus";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

const AFFILIATIONS = ["current_student", "alumni", "faculty_staff"];
const cleanYear = (y: unknown) => {
  const s = String(y ?? "").trim();
  return /^(19|20)\d{2}$/.test(s) ? s : "";
};

/**
 * POST /api/campus/verify — school affiliation verification.
 * VERIFICATION-BASED, NEVER SUBSCRIPTION-BASED: Free vs Pro gates
 * platform features, not whether someone belongs to a campus.
 * DEV DEMO: verifies instantly against the seeded campus. In production
 * this kicks off the .edu email / document flow and stays "pending"
 * until the verification service approves; evidence never touches
 * this API.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return guarded(() => {
    const user = requireUser();
    const slug = String(body.campus || "bowie-state");
    const campus = db.select().from(tables.campuses).where(eq(tables.campuses.slug, slug)).get();
    if (!campus) throw new ApiError(404, "School not found");

    const affiliation = AFFILIATIONS.includes(body.affiliation) ? body.affiliation : "current_student";
    const gradYear = cleanYear(body.gradYear);
    const program = String(body.program || "").slice(0, 80);

    const existing = db
      .select()
      .from(tables.campusVerifications)
      .where(eq(tables.campusVerifications.userId, user.id))
      .all()
      .find((v) => v.campusId === campus.id);

    if (existing?.status === "verified") return { status: "verified", campus: campus.name, affiliation: existing.affiliation };

    if (existing) {
      db.update(tables.campusVerifications)
        .set({ status: "verified", affiliation, gradYear, program, verifiedAt: new Date() })
        .where(eq(tables.campusVerifications.id, existing.id))
        .run();
    } else {
      db.insert(tables.campusVerifications)
        .values({
          id: `cv-${user.id.slice(0, 8)}-${campus.slug}`,
          userId: user.id,
          campusId: campus.id,
          status: "verified",
          affiliation,
          gradYear,
          program,
          verifiedAt: new Date(),
        })
        .run();
    }

    notify({
      userId: user.id,
      type: "campus",
      title: `You're verified at ${campus.name}`,
      body: `${affiliationLabel(affiliation)} — Your Campus is now unlocked.`,
      href: "/campus",
      category: "campus",
      priority: "normal",
    });

    return { status: "verified", campus: campus.name, affiliation };
  });
}

/** GET — my campus verification + academic profile + visibility toggles. */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const v = campusVerification(user.id);
    if (!v) return { verified: false };
    const campus = db.select().from(tables.campuses).where(eq(tables.campuses.id, v.campusId)).get()!;
    return {
      verified: true,
      campusId: campus.id,
      campusName: campus.name,
      affiliation: v.affiliation,
      gradYear: v.gradYear,
      program: v.program,
      showSchool: !!v.showSchool,
      showGradYear: !!v.showGradYear,
      showProgram: !!v.showProgram,
    };
  });
}

/**
 * PATCH — academic profile + visibility, and the Student → Alumni
 * transition ({ action: "graduate" }). The transition changes ONE FIELD:
 * account, connections, messages, portfolio, history, bookmarks, and
 * community memberships are untouched. Current-student-only areas
 * (Marketplace, Student Groups) close; the alumni environment opens.
 */
export async function PATCH(req: NextRequest) {
  return guarded(async () => {
    const user = requireUser();
    const v = campusVerification(user.id);
    if (!v) throw new ApiError(403, "Verify your school first");
    const body = await req.json().catch(() => ({}));

    if (body.action === "graduate") {
      if (v.affiliation !== "current_student") throw new ApiError(409, "Only current students graduate");
      db.update(tables.campusVerifications)
        .set({ affiliation: "alumni" })
        .where(eq(tables.campusVerifications.id, v.id))
        .run();
      const campus = db.select().from(tables.campuses).where(eq(tables.campuses.id, v.campusId)).get()!;
      notify({
        userId: user.id,
        type: "campus",
        title: `Congratulations, ${campus.name} alum`,
        body: "Everything you built stays — connections, portfolio, history. Alumni communities and events are open; student-only areas (Marketplace, Student Groups) close.",
        href: "/campus",
        category: "campus",
      });
      return { ok: true, affiliation: "alumni" };
    }

    const patch: Record<string, unknown> = {};
    if (body.gradYear !== undefined) patch.gradYear = cleanYear(body.gradYear);
    if (body.program !== undefined) patch.program = String(body.program || "").slice(0, 80);
    if (typeof body.showSchool === "boolean") patch.showSchool = body.showSchool;
    if (typeof body.showGradYear === "boolean") patch.showGradYear = body.showGradYear;
    if (typeof body.showProgram === "boolean") patch.showProgram = body.showProgram;
    if (!Object.keys(patch).length) throw new ApiError(400, "Nothing to update");
    db.update(tables.campusVerifications).set(patch).where(eq(tables.campusVerifications.id, v.id)).run();
    return { ok: true };
  });
}
