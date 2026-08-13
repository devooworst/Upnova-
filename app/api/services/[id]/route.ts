import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
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
  return guarded(async () => {
    const viewer = await getSessionUser();
    const row = await db
      .select({ service: tables.services, user: tables.users, profile: tables.profiles })
      .from(tables.services)
      .innerJoin(tables.users, eq(tables.services.ownerId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .where(eq(tables.services.id, params.id))
      .get();
    if (!row || row!.user.status !== "active") throw new ApiError(404, "Service not found");
    const { service, user, profile } = await row;
    const isOwner = viewer?.id === service.ownerId;

    // ---- visibility, enforced server-side ----
    // draft: owner only (a 404 — its existence is private)
    if (service.visibility === "draft" && !isOwner) throw new ApiError(404, "Service not found");
    // followers-only: the owner's followers (unlisted/public pass through —
    // an unlisted link is MEANT to work for anyone who has it)
    if (service.visibility === "followers" && !isOwner) {
      const follows = viewer
        ? !!(await db
            .select()
            .from(tables.follows)
            .where(and(eq(tables.follows.followerId, viewer.id), eq(tables.follows.followingId, service.ownerId)))
            .get())
        : false;
      if (!follows) throw new ApiError(403, "This service is only visible to followers");
    }
    // deactivated services stay viewable as history — unbookable, never erased

    const config = parseConfig(service.config);
    const distanceMi =
      viewer?.profile.lat != null && profile.lat != null
        ? Math.round(haversineMi(viewer.profile.lat, viewer.profile.lng!, profile.lat, profile.lng!) * 10) / 10
        : null;
    const travel = travelFeeFor(config.travel, distanceMi);

    // the provider's real track record — computed, never self-reported
    const reviews = await db.select().from(tables.reviews).where(eq(tables.reviews.subjectId, user.id)).all();
    const rating = reviews.length
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : null;
    const completedBookings = (await db
      .select()
      .from(tables.bookings)
      .where(eq(tables.bookings.providerId, user.id))
      .all())
      .filter((b) => b.status === "completed").length;
    const completedProjects = (await db
      .select()
      .from(tables.projects)
      .where(eq(tables.projects.creatorId, user.id))
      .all())
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
        visibility: service.visibility,
        deactivated: !service.active,
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
  return guarded(async () => {
    const user = await requireUser();
    await requireServiceOwner(params.id, user.id);

    const patch: Partial<typeof tables.services.$inferInsert> = {};
    if (body.price !== undefined) {
      const price = Math.round(Number(body.price));
      if (!Number.isFinite(price) || price < 1) throw new ApiError(400, "Price must be at least $1");
      patch.price = price;
    }
    if (typeof body.paused === "boolean") patch.paused = body.paused;
    // visibility + reactivation are owner controls — a deactivated service
    // can come back; its history never left
    if (["public", "followers", "unlisted", "draft"].includes(body.visibility)) patch.visibility = body.visibility;
    if (typeof body.active === "boolean") patch.active = body.active;
    if (typeof body.description === "string") patch.description = body.description.slice(0, 1000);
    if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 80);

    // SCHEDULING updates — booking horizon and friends, sanitized like
    // creation. Partial: only the keys sent change; the rest stay.
    if (body.scheduling && typeof body.scheduling === "object") {
      const svcRow = (await db.select().from(tables.services).where(eq(tables.services.id, params.id)).get())!;
      const cur = parseConfig(svcRow.config);
      const s = body.scheduling as Record<string, unknown>;
      const num = (v: unknown, lo: number, hi: number) => {
        const n = Math.round(Number(v));
        return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;
      };
      const nextSched = { ...cur.scheduling };
      if (s.horizonDays !== undefined) {
        const h = num(s.horizonDays, 1, 365);
        if (h === undefined) throw new ApiError(400, "Booking horizon must be 1–365 days");
        nextSched.horizonDays = h;
      }
      if (s.maxPerDay !== undefined) nextSched.maxPerDay = num(s.maxPerDay, 1, 20);
      if (s.advanceNoticeHours !== undefined) nextSched.advanceNoticeHours = num(s.advanceNoticeHours, 0, 168) ?? nextSched.advanceNoticeHours;
      if (typeof s.sameDayBooking === "boolean") nextSched.sameDayBooking = s.sameDayBooking;
      if (s.releaseMode !== undefined) {
        if (s.releaseMode !== "rolling" && s.releaseMode !== "scheduled") throw new ApiError(400, "Release mode must be rolling or scheduled");
        nextSched.releaseMode = s.releaseMode;
      }
      let full: Record<string, unknown> = {};
      try { full = JSON.parse(svcRow.config || "{}") ?? {}; } catch {}
      full.scheduling = { ...(typeof full.scheduling === "object" && full.scheduling !== null ? full.scheduling : {}), ...nextSched };
      patch.config = JSON.stringify(full);
    }

    await db.update(tables.services).set(patch).where(eq(tables.services.id, params.id)).run();
    return { ok: true };
  });
}

/** DELETE — deactivate (soft remove) a listing. Owner only. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    await requireServiceOwner(params.id, user.id);
    await db.update(tables.services).set({ active: false }).where(eq(tables.services.id, params.id)).run();
    return { ok: true };
  });
}
