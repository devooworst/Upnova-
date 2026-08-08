import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";

export const dynamic = "force-dynamic";

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

    return {
      services: rows.map((r) => ({
        id: r.service.id,
        title: r.service.title,
        description: r.service.description,
        price: r.service.price,
        category: r.service.category,
        aiPolicy: r.service.aiPolicy,
        trustRequired: r.service.trustRequired,
        reach: r.service.reach,
        owner: publicUser(r.user, r.profile),
        isMine: viewer?.id === r.service.ownerId,
      })),
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

    const id = randomBytes(12).toString("hex");
    db.insert(tables.services)
      .values({
        id,
        ownerId: user.id,
        title,
        description: String(body.description || "").slice(0, 1000),
        price,
        category,
        aiPolicy: ["no-ai", "disclosure", "assisted", "client-decides"].includes(body.aiPolicy)
          ? body.aiPolicy
          : "client-decides",
        reach: String(body.reach || "Remote").slice(0, 60),
      })
      .run();
    return { id };
  });
}
