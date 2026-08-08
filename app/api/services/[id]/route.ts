import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import { requireServiceOwner } from "@/lib/server/authz";
import { publicUser } from "@/lib/server/serialize";
import { ctaFor } from "@/lib/server/cta";
import { parseConfig, travelFeeFor } from "@/lib/servicePolicies";
import { haversineMi } from "@/lib/server/feed";

export const dynamic = "force-dynamic";

/**
 * GET /api/services/[id] — ONE public listing, the shareable unit.
 * Session-optional: a shared booking-page link works for guests (price,
 * menu, policies, availability, reviews, badges all public) — the account
 * prompt appears only when they press Book. Location = service area only.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const viewer = getSessionUser();
    const row = db
      .select({ service: tables.services, user: tables.users, profile: tables.profiles })
      .from(tables.services)
      .innerJoin(tables.users, eq(tables.services.ownerId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .where(eq(tables.services.id, params.id))
      .get();
    if (!row || !row.service.active || row.user.status !== "active") throw new ApiError(404, "Service not found");
    const { service, user, profile } = row;

    const config = parseConfig(service.config);
    const distanceMi =
      viewer?.profile.lat != null && profile.lat != null
        ? Math.round(haversineMi(viewer.profile.lat, viewer.profile.lng!, profile.lat, profile.lng!) * 10) / 10
        : null;
    const travel = travelFeeFor(config.travel, distanceMi);

    // the provider's real track record — computed, never self-reported
    const reviews = db.select().from(tables.reviews).where(eq(tables.reviews.subjectId, user.id)).all();
    const rating = reviews.length
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : null;
    const completedBookings = db
      .select()
      .from(tables.bookings)
      .where(eq(tables.bookings.providerId, user.id))
      .all()
      .filter((b) => b.status === "completed").length;
    const completedProjects = db
      .select()
      .from(tables.projects)
      .where(eq(tables.projects.creatorId, user.id))
      .all()
      .filter((p) => ["completed", "reviewed"].includes(p.state)).length;

    return {
      service: {
        id: service.id,
        title: service.title,
        description: service.description,
        price: service.price,
        category: service.category,
        aiPolicy: service.aiPolicy,
        trustRequired: service.trustRequired,
        fulfillment: service.fulfillment,
        cta: ctaFor(service),
        reach: service.reach,
        paused: service.paused,
        promoted: service.promoted,
        media: (() => { try { return JSON.parse(service.media); } catch { return []; } })(),
        config,
        distanceMi,
        travelEstimate: travel.fee,
        travelNote: travel.note,
        owner: publicUser(user, profile),
        ownerStats: {
          rating,
          reviewsCount: reviews.length,
          completedBookings,
          completedProjects,
          identityVerified: profile.trustLevel === "high-trust",
          businessVerified: user.businessVerified,
        },
        recentReviews: reviews.slice(0, 3).map((r) => ({ rating: r.rating, body: r.body, createdAt: r.createdAt.toISOString() })),
        isMine: viewer?.id === service.ownerId,
      },
    };
  });
}

/** PATCH /api/services/[id] { price?, paused?, description? } — owner only. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    requireServiceOwner(params.id, user.id);

    const patch: Partial<typeof tables.services.$inferInsert> = {};
    if (body.price !== undefined) {
      const price = Math.round(Number(body.price));
      if (!Number.isFinite(price) || price < 1) throw new ApiError(400, "Price must be at least $1");
      patch.price = price;
    }
    if (typeof body.paused === "boolean") patch.paused = body.paused;
    if (typeof body.description === "string") patch.description = body.description.slice(0, 1000);
    if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 80);

    db.update(tables.services).set(patch).where(eq(tables.services.id, params.id)).run();
    return { ok: true };
  });
}

/** DELETE — deactivate (soft remove) a listing. Owner only. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const user = requireUser();
    requireServiceOwner(params.id, user.id);
    db.update(tables.services).set({ active: false }).where(eq(tables.services.id, params.id)).run();
    return { ok: true };
  });
}
