import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

/**
 * POST /api/campus/verify — student verification.
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

    const existing = db
      .select()
      .from(tables.campusVerifications)
      .where(eq(tables.campusVerifications.userId, user.id))
      .all()
      .find((v) => v.campusId === campus.id);

    if (existing?.status === "verified") return { status: "verified", campus: campus.name };

    if (existing) {
      db.update(tables.campusVerifications)
        .set({ status: "verified", verifiedAt: new Date() })
        .where(eq(tables.campusVerifications.id, existing.id))
        .run();
    } else {
      db.insert(tables.campusVerifications)
        .values({
          id: `cv-${user.id.slice(0, 8)}-${campus.slug}`,
          userId: user.id,
          campusId: campus.id,
          status: "verified",
          program: String(body.program || "").slice(0, 80),
          verifiedAt: new Date(),
        })
        .run();
    }

    notify({
      userId: user.id,
      type: "campus",
      title: `You're verified at ${campus.name}`,
      body: "Your Campus is now unlocked — communities, services, orgs, and student work.",
      href: "/campus",
      category: "campus",
      priority: "normal",
    });

    return { status: "verified", campus: campus.name };
  });
}

/** GET — my campus verification status (for campus-linked features). */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const v = db
      .select({ v: tables.campusVerifications, c: tables.campuses })
      .from(tables.campusVerifications)
      .innerJoin(tables.campuses, eq(tables.campusVerifications.campusId, tables.campuses.id))
      .where(eq(tables.campusVerifications.userId, user.id))
      .all()
      .find((r) => r.v.status === "verified");
    return v ? { verified: true, campusId: v.c.id, campusName: v.c.name } : { verified: false };
  });
}
