import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** GET /api/me/applications — everything the user has applied to. */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const rows = db
      .select({ app: tables.applications, opp: tables.opportunities, poster: tables.profiles })
      .from(tables.applications)
      .innerJoin(tables.opportunities, eq(tables.applications.opportunityId, tables.opportunities.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.opportunities.posterId))
      .where(eq(tables.applications.applicantId, user.id))
      .orderBy(desc(tables.applications.createdAt))
      .all();

    return {
      applications: rows.map((r) => ({
        id: r.app.id,
        status: r.app.status, // submitted | shortlisted | selected | declined
        availability: r.app.availability,
        message: r.app.message,
        createdAt: r.app.createdAt.toISOString(),
        opportunity: {
          id: r.opp.id,
          title: r.opp.title,
          budget: r.opp.budget,
          location: r.opp.remote ? "Remote" : r.opp.location,
          status: r.opp.status,
          poster: r.poster.displayName,
        },
      })),
    };
  });
}
