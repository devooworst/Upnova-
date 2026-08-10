import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { assertCapacityById } from "@/lib/server/businessLimits";
import { requireUser, getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { normalizeRoles, parseRoles, openingsLeft } from "@/lib/opportunityRoles";
import { seedApplicantsApplyToRoles } from "@/lib/server/demo";
import { normalizeEngagement, parseEngagement } from "@/lib/engagement";
import { createLinkedPost } from "@/lib/server/publish";
import { FeedScope, inScope, viewerContext, verifiedCampusMap } from "@/lib/server/feed";
import { ELIGIBILITIES, eligibilityLabel, checkApplicantEligibility } from "@/lib/server/eligibility";
import { campusVerification } from "@/lib/server/campus";
import { buildTaste, ranker, type Scorable } from "@/lib/server/recsys";

export const dynamic = "force-dynamic";

/** GET /api/opportunities?scope= — open listings, scope-aware like the feed. */
export async function GET(req: NextRequest) {
  return guarded(() => {
    const viewer = getSessionUser();
    const scope = (req.nextUrl.searchParams.get("scope") || "for-you") as FeedScope;

    const rows = db
      .select({ opp: tables.opportunities, user: tables.users, profile: tables.profiles })
      .from(tables.opportunities)
      .innerJoin(tables.users, eq(tables.opportunities.posterId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .orderBy(desc(tables.opportunities.createdAt))
      .all()
      .filter((r) => r.opp.status === "open" && r.user.status === "active");

    let filtered = rows;
    if (viewer && scope !== "for-you" && scope !== "global") {
      const ctx = viewerContext(viewer.id, viewer.profile);
      const campusMap = verifiedCampusMap(rows.map((r) => r.opp.posterId));
      filtered = rows.filter(
        (r) => r.opp.remote || inScope(scope, ctx, r.profile, campusMap.get(r.opp.posterId))
      );
    }

    // poster identity: verified_business | business_pending | creator | community
    // "creator" = has active listings or completed work; purely descriptive.
    const posterIds = Array.from(new Set(filtered.map((r) => r.opp.posterId)));
    const serviceOwners = new Set(
      db.select({ ownerId: tables.services.ownerId }).from(tables.services).all()
        .filter((s) => posterIds.includes(s.ownerId))
        .map((s) => s.ownerId)
    );
    const completedCreators = new Set(
      db.select({ creatorId: tables.projects.creatorId, state: tables.projects.state }).from(tables.projects).all()
        .filter((pr) => ["completed", "reviewed"].includes(pr.state))
        .map((pr) => pr.creatorId)
    );
    const posterTypeFor = (u: { id: string; accountType: string; businessVerified: boolean }) =>
      u.accountType === "business"
        ? u.businessVerified
          ? "verified_business"
          : "business_pending"
        : serviceOwners.has(u.id) || completedCreators.has(u.id)
          ? "creator"
          : "community";

    // For You ordering comes from the engine; hides apply everywhere
    if (viewer) {
      const taste = buildTaste(viewer.id, viewer.profile);
      const mapped = filtered.map((r) => ({
        item: r,
        scorable: {
          id: r.opp.id,
          type: "opportunity",
          authorId: r.opp.posterId,
          category: r.opp.type,
          tags: [r.opp.title, r.opp.type],
          lat: r.opp.lat,
          lng: r.opp.lng,
          locationOk: r.profile.locationVisibility !== "hidden",
          sameCity: !!viewer.profile.city && r.profile.city === viewer.profile.city,
          createdAt: r.opp.createdAt,
          engagement: 0,
        } as Scorable,
      }));
      filtered = ranker.rank(mapped, taste).map((x) => x.item);
    }

    // roles + remaining openings, one query for all listings
    const allApps = db
      .select({ opportunityId: tables.applications.opportunityId, roleId: tables.applications.roleId, status: tables.applications.status })
      .from(tables.applications)
      .all();
    const rolesFor = (oppId: string, raw: string) => {
      const roles = parseRoles(raw);
      const apps = allApps.filter((a) => a.opportunityId === oppId);
      return roles.map((r) => ({ ...r, open: openingsLeft(r, apps) }));
    };

    const myApplications = viewer
      ? new Set(
          db
            .select({ oppId: tables.applications.opportunityId })
            .from(tables.applications)
            .where(eq(tables.applications.applicantId, viewer.id))
            .all()
            .map((r) => r.oppId)
        )
      : new Set<string>();

    return {
      opportunities: filtered.map((r) => ({
        id: r.opp.id,
        title: r.opp.title,
        description: r.opp.description,
        budget: r.opp.budget,
        type: r.opp.type,
        location: r.opp.location,
        remote: r.opp.remote,
        studentFriendly: r.opp.studentFriendly,
        // ELIGIBILITY ≠ VISIBILITY: everyone sees the card; the badge says
        // who can apply, and the viewer's verdict pre-renders the lock
        eligibility: r.opp.eligibility,
        eligibilityLabel: eligibilityLabel(r.opp.eligibility, r.opp.eligibilityCampusId),
        viewerEligibility: viewer ? checkApplicantEligibility(r.opp, viewer.id) : null,
        trustRequired: r.opp.trustRequired,
        applyBy: r.opp.applyBy?.toISOString() ?? null,
        eventDate: r.opp.eventDate?.toISOString() ?? null,
        applyConfig: (() => {
          try {
            return JSON.parse(r.opp.applyConfig);
          } catch {
            return {};
          }
        })(),
        roles: rolesFor(r.opp.id, r.opp.roles),
        engagement: parseEngagement(r.opp.engagement),
        poster: publicUser(r.user, r.profile),
        posterType: posterTypeFor(r.user),
        isMine: viewer?.id === r.opp.posterId,
        applied: myApplications.has(r.opp.id),
      })),
    };
  });
}

/** POST /api/opportunities — post a listing as the authenticated user. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const title = String(body.title || "").trim();
    if (!title) throw new ApiError(400, "Title is required");

    // BUSINESS CAPACITY: creation-only gate — 409 with the honest
    // current/limit + Pro numbers. Existing opportunities are never
    // touched; individuals are unaffected.
    assertCapacityById(user.id, "activeOpportunities");

    // budget guard, enforced SERVER-side: total role compensation
    // (pay × openings) can never exceed the stated maximum budget
    const roleList = normalizeRoles(body.roles);
    const budgetNum = Number.isFinite(Number(body.budget)) && Number(body.budget) > 0 ? Math.round(Number(body.budget)) : null;
    const totalComp = roleList.reduce((s, r) => s + (r.pay ?? 0) * r.count, 0);
    if (budgetNum != null && roleList.length > 0 && totalComp > budgetNum)
      throw new ApiError(400, `Over budget by $${totalComp - budgetNum} — total role compensation is $${totalComp}, budget is $${budgetNum}`);

    const id = randomBytes(12).toString("hex");
    db.insert(tables.opportunities)
      .values({
        id,
        posterId: user.id,
        title,
        description: String(body.description || "").slice(0, 2000),
        budget: budgetNum ?? (totalComp > 0 ? totalComp : null),
        type: ["gig", "collab", "event", "campus"].includes(body.type) ? body.type : "gig",
        location: String(body.location || "").slice(0, 80),
        remote: !!body.remote,
        studentFriendly: !!body.studentFriendly,
        // WHO CAN APPLY — the poster's rule. my_school requires the poster
        // to actually be verified at a school (you can't gate to a campus
        // you don't belong to); alumni is campus-scoped when verified.
        ...(() => {
          const e = ELIGIBILITIES.includes(body.eligibility) ? body.eligibility : "anyone";
          if (e === "my_school") {
            const v = campusVerification(user.id);
            if (!v) throw new ApiError(400, "Limiting applicants to your school requires your own verified campus status first — verification is free in Your Campus");
            return { eligibility: "my_school", eligibilityCampusId: v.campusId };
          }
          if (e === "alumni") {
            const v = campusVerification(user.id);
            return { eligibility: "alumni", eligibilityCampusId: v?.campusId ?? null };
          }
          return { eligibility: e, eligibilityCampusId: null };
        })(),
        applyBy: body.applyBy ? new Date(body.applyBy) : null,
        eventDate: body.eventDate ? new Date(body.eventDate) : null,
        applyConfig: JSON.stringify({
          requireMessage: body.requireMessage !== false,
          question: String(body.question || "").slice(0, 160) || undefined,
          // manual selection is the default; unselected applicants get the
          // professional update on close unless the poster opts out
          selection: ["manual", "shortlist"].includes(body.selection) ? body.selection : "manual",
          notifyUnselected: body.notifyUnselected !== false,
        }),
        // TEAM & OPENINGS — roles are configuration of the universal
        // system, never a separate casting/job board
        roles: JSON.stringify(roleList),
        // engagement type is CONFIGURATION — one-time or ongoing, same system
        engagement: JSON.stringify(body.engagement ? normalizeEngagement(body.engagement) ?? {} : {}),
        lat: user.profile.lat,
        lng: user.profile.lng,
      })
      .run();
    // ONE canonical opportunity + ONE linked feed post — it appears in
    // For You (ranked) and on the poster's profile immediately
    const rolesLine = roleList.length
      ? roleList.map((r) => `${r.title} ×${r.count}${r.pay ? ` · $${r.pay}` : ""}`).join(" · ")
      : "";
    createLinkedPost({
      userId: user.id,
      refType: "opportunity",
      refId: id,
      body: `${title}\n${rolesLine || String(body.description || "").slice(0, 140)}${budgetNum ?? totalComp ? `\n$${budgetNum ?? totalComp}${roleList.length ? " total" : ""}` : ""} · ${body.remote ? "Remote" : String(body.location || "").slice(0, 40)}`,
      category: "Opportunity",
    });
    // demo mode: seed locals apply to each role right away so the poster
    // can walk review → select → team → payment immediately
    seedApplicantsApplyToRoles(id);
    return { id };
  });
}
