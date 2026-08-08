import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";

export const dynamic = "force-dynamic";

/**
 * GET /api/opportunities/[id] — ONE public opportunity, the shareable unit.
 * Session-optional by design: a shared link must work for guests (they see
 * everything public — pay, place, poster, badges — and hit the contextual
 * account prompt only when they try to APPLY). Location privacy identical
 * to everywhere else: locationLabel only, never coordinates.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const viewer = getSessionUser();
    const row = db
      .select({ opp: tables.opportunities, user: tables.users, profile: tables.profiles })
      .from(tables.opportunities)
      .innerJoin(tables.users, eq(tables.opportunities.posterId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .where(eq(tables.opportunities.id, params.id))
      .get();
    if (!row || row.user.status !== "active") throw new ApiError(404, "Opportunity not found");
    const { opp, user, profile } = row;

    const hasServices = !!db.select().from(tables.services).where(eq(tables.services.ownerId, user.id)).get();
    const completed = db
      .select()
      .from(tables.projects)
      .where(eq(tables.projects.creatorId, user.id))
      .all()
      .filter((p) => ["completed", "reviewed"].includes(p.state)).length;
    const posterType =
      user.accountType === "business"
        ? user.businessVerified
          ? "verified_business"
          : "business_pending"
        : hasServices || completed > 0
          ? "creator"
          : "community";

    const applied = viewer
      ? !!db
          .select()
          .from(tables.applications)
          .where(and(eq(tables.applications.opportunityId, opp.id), eq(tables.applications.applicantId, viewer.id)))
          .get()
      : false;
    const applicants = db
      .select()
      .from(tables.applications)
      .where(eq(tables.applications.opportunityId, opp.id))
      .all().length;

    return {
      opportunity: {
        id: opp.id,
        title: opp.title,
        description: opp.description,
        budget: opp.budget,
        type: opp.type,
        status: opp.status,
        location: opp.location,
        remote: opp.remote,
        studentFriendly: opp.studentFriendly,
        trustRequired: opp.trustRequired,
        applyBy: opp.applyBy?.toISOString() ?? null,
        eventDate: opp.eventDate?.toISOString() ?? null,
        createdAt: opp.createdAt.toISOString(),
        applicants,
        poster: publicUser(user, profile),
        posterType,
        isMine: viewer?.id === opp.posterId,
        applied,
      },
    };
  });
}
