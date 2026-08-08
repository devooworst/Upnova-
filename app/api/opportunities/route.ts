import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { FeedScope, inScope, viewerContext, verifiedCampusMap } from "@/lib/server/feed";

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

    const id = randomBytes(12).toString("hex");
    db.insert(tables.opportunities)
      .values({
        id,
        posterId: user.id,
        title,
        description: String(body.description || "").slice(0, 2000),
        budget: Number.isFinite(Number(body.budget)) && Number(body.budget) > 0 ? Math.round(Number(body.budget)) : null,
        type: ["gig", "collab", "event", "campus"].includes(body.type) ? body.type : "gig",
        location: String(body.location || "").slice(0, 80),
        remote: !!body.remote,
        studentFriendly: !!body.studentFriendly,
        applyBy: body.applyBy ? new Date(body.applyBy) : null,
        eventDate: body.eventDate ? new Date(body.eventDate) : null,
        applyConfig: JSON.stringify({
          requireMessage: body.requireMessage !== false,
          question: String(body.question || "").slice(0, 160) || undefined,
        }),
        lat: user.profile.lat,
        lng: user.profile.lng,
      })
      .run();
    return { id };
  });
}
