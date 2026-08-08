import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";

export const dynamic = "force-dynamic";

import { ctaFor } from "@/lib/server/cta";
import { parseConfig, travelFeeFor, DEFAULT_CONFIG, type ServiceConfig } from "@/lib/servicePolicies";
import { haversineMi } from "@/lib/server/feed";
import { buildTaste, ranker, type Scorable } from "@/lib/server/recsys";

/** GET /api/services — active marketplace listings with real owners. */
export async function GET() {
  return guarded(() => {
    const viewer = getSessionUser();
    const rows = db
      .select({ service: tables.services, user: tables.users, profile: tables.profiles })
      .from(tables.services)
      .innerJoin(tables.users, eq(tables.services.ownerId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .orderBy(desc(tables.services.createdAt))
      .all()
      .filter((r) => r.service.active && !r.service.paused && r.user.status === "active");

    // organic ordering from the recommendation engine (viewer's taste);
    // promoted listings are pinned first and labeled — never mixed in
    let ordered = rows;
    if (viewer) {
      const taste = buildTaste(viewer.id, viewer.profile);
      const mapped = rows
        .filter((r) => !r.service.promoted)
        .map((r) => ({
          item: r,
          scorable: {
            id: r.service.id,
            type: "service",
            authorId: r.service.ownerId,
            category: r.service.category,
            tags: [r.service.category, r.service.title],
            lat: r.profile.lat,
            lng: r.profile.lng,
            locationOk: r.profile.locationVisibility !== "hidden",
            sameCity: !!viewer.profile.city && r.profile.city === viewer.profile.city,
            createdAt: r.service.createdAt,
            engagement: 0,
          } as Scorable,
        }));
      const ranked = ranker.rank(mapped, taste).map((x) => x.item);
      ordered = [...rows.filter((r) => r.service.promoted), ...ranked];
    }

    return {
      services: ordered.map((r) => {
        const config = parseConfig(r.service.config);
        // per-viewer travel estimate from real profile distances —
        // disclosed here, recomputed server-side at booking time
        const distanceMi =
          viewer?.profile.lat != null && r.profile.lat != null
            ? Math.round(haversineMi(viewer.profile.lat, viewer.profile.lng!, r.profile.lat, r.profile.lng!) * 10) / 10
            : null;
        const travel = travelFeeFor(config.travel, distanceMi);
        return {
        id: r.service.id,
        title: r.service.title,
        description: r.service.description,
        price: r.service.price,
        category: r.service.category,
        aiPolicy: r.service.aiPolicy,
        trustRequired: r.service.trustRequired,
        fulfillment: r.service.fulfillment,
        cta: ctaFor(r.service),
        reach: r.service.reach,
        owner: publicUser(r.user, r.profile),
        isMine: viewer?.id === r.service.ownerId,
        promoted: r.service.promoted,
        config,
        distanceMi,
        travelEstimate: travel.fee,
        travelNote: travel.note,
        };
      }),
    };
  });
}

/** POST /api/services — create a listing owned by the authenticated user. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const title = String(body.title || "").trim();
    const price = Math.round(Number(body.price));
    if (!title) throw new ApiError(400, "Title is required");
    if (!Number.isFinite(price) || price < 1) throw new ApiError(400, "Price must be at least $1");

    // trust gate: high-trust categories can't be published without verification
    const category = String(body.category || "creative");
    const HIGH_TRUST = ["childcare", "petcare", "home", "transportation", "assistance", "care"];
    if (HIGH_TRUST.includes(category) && user.profile.trustLevel !== "high-trust")
      throw new ApiError(403, "This category requires High-Trust verification before publishing");

    // the creator's config IS the product — sanitize and store it
    const inC = (body.config ?? {}) as Partial<ServiceConfig>;
    const num = (v: unknown, max = 10_000) =>
      Number.isFinite(Number(v)) ? Math.min(max, Math.max(0, Math.round(Number(v)))) : undefined;
    const config: ServiceConfig = {
      locationMode: ["my_location", "client_location", "both", "remote", "flexible"].includes(inC.locationMode as string)
        ? (inC.locationMode as ServiceConfig["locationMode"])
        : "flexible",
      travel: {
        mode: ["none", "free", "flat", "per_mile", "quote"].includes(inC.travel?.mode as string)
          ? (inC.travel!.mode as ServiceConfig["travel"]["mode"])
          : "none",
        flatFee: num(inC.travel?.flatFee, 500),
        perMile: num(inC.travel?.perMile, 50),
        freeMiles: num(inC.travel?.freeMiles, 100),
        radiusMi: num(inC.travel?.radiusMi, 500),
      },
      scheduling: {
        durationMin: num(inC.scheduling?.durationMin, 480) ?? 60,
        maxPerDay: num(inC.scheduling?.maxPerDay, 20),
      },
      policies: {
        cancellation: ["anytime", "free_24h", "partial_48h", "custom"].includes(inC.policies?.cancellation as string)
          ? (inC.policies!.cancellation as ServiceConfig["policies"]["cancellation"])
          : DEFAULT_CONFIG.policies.cancellation,
        cancellationNote: String(inC.policies?.cancellationNote ?? "").slice(0, 160) || undefined,
        reschedule: ["free", "one_free", "fee", "approval"].includes(inC.policies?.reschedule as string)
          ? (inC.policies!.reschedule as ServiceConfig["policies"]["reschedule"])
          : "free",
        rescheduleFee: num(inC.policies?.rescheduleFee, 200),
        lateGraceMin: num(inC.policies?.lateGraceMin, 120) ?? 15,
        lateFee: num(inC.policies?.lateFee, 200) ?? 0,
        noShow: ["none", "partial", "full"].includes(inC.policies?.noShow as string)
          ? (inC.policies!.noShow as ServiceConfig["policies"]["noShow"])
          : "none",
      },
      requirements: Array.isArray(inC.requirements)
        ? inC.requirements.slice(0, 8).map((r) => String(r).slice(0, 60))
        : [],
    };

    const fulfillment = ["appointment", "project", "quote"].includes(body.fulfillment) ? body.fulfillment : "project";

    const id = randomBytes(12).toString("hex");
    db.insert(tables.services)
      .values({
        id,
        ownerId: user.id,
        title,
        description: String(body.description || "").slice(0, 1000),
        price,
        category,
        fulfillment,
        config: JSON.stringify(config),
        aiPolicy: ["no-ai", "disclosure", "assisted", "client-decides"].includes(body.aiPolicy)
          ? body.aiPolicy
          : "client-decides",
        reach: String(body.reach || "Remote").slice(0, 60),
      })
      .run();
    return { id };
  });
}
