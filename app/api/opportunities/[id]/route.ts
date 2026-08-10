import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { notify } from "@/lib/server/notify";
import { requireOpportunityPoster } from "@/lib/server/authz";
import { requireUser } from "@/lib/server/auth";
import { parseRoles, openingsLeft } from "@/lib/opportunityRoles";
import { parseEngagement } from "@/lib/engagement";
import { eligibilityLabel, checkApplicantEligibility } from "@/lib/server/eligibility";

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
    const apps = db
      .select()
      .from(tables.applications)
      .where(eq(tables.applications.opportunityId, opp.id))
      .all();
    const applicants = apps.length;
    // roles with live remaining openings — capacity is public information
    const roles = parseRoles(opp.roles).map((r) => ({ ...r, open: openingsLeft(r, apps) }));
    const myApp = viewer ? apps.find((a) => a.applicantId === viewer.id) : undefined;

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
        eligibility: opp.eligibility,
        eligibilityLabel: eligibilityLabel(opp.eligibility, opp.eligibilityCampusId),
        viewerEligibility: viewer ? checkApplicantEligibility(opp, viewer.id) : null,
        trustRequired: opp.trustRequired,
        applyBy: opp.applyBy?.toISOString() ?? null,
        eventDate: opp.eventDate?.toISOString() ?? null,
        createdAt: opp.createdAt.toISOString(),
        applicants,
        roles,
        engagement: parseEngagement(opp.engagement),
        myRoleId: myApp?.roleId ?? null,
        myStatus: myApp?.status ?? null,
        poster: publicUser(user, profile),
        posterType,
        isMine: viewer?.id === opp.posterId,
        applied: !!myApp || applied,
      },
    };
  });
}

/**
 * PATCH /api/opportunities/[id] { action: "close" | "reopen" } — poster only.
 * Closing sends the professional update to everyone still un-selected,
 * according to the poster's notification setting (never a harsh decline).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const opp = requireOpportunityPoster(params.id, user.id);
    const action = String(body.action);
    if (action === "reopen") {
      db.update(tables.opportunities).set({ status: "open" }).where(eq(tables.opportunities.id, opp.id)).run();
      return { status: "open" };
    }
    if (action !== "close") throw new ApiError(400, "Unknown action");
    db.update(tables.opportunities).set({ status: "closed" }).where(eq(tables.opportunities.id, opp.id)).run();

    let cfg: { notifyUnselected?: boolean } = {};
    try { cfg = JSON.parse(opp.applyConfig); } catch {}
    let notified = 0;
    if (cfg.notifyUnselected !== false) {
      const pending = db
        .select()
        .from(tables.applications)
        .where(eq(tables.applications.opportunityId, opp.id))
        .all()
        .filter((a) => ["submitted", "shortlisted"].includes(a.status));
      for (const a of pending) {
        db.update(tables.applications).set({ status: "declined" }).where(eq(tables.applications.id, a.id)).run();
        notify({
          userId: a.applicantId,
          actorId: user.id,
          type: "application",
          title: "Update on your application",
          body: `Thank you for applying to ${opp.title}. The creator has decided to move forward with other applicants for this opportunity. We appreciate your interest.`,
          href: "/opportunities",
          priority: "low",
        });
        notified++;
      }
    }
    return { status: "closed", notified };
  });
}
