import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { CREATOR_SUB_MODES, CONTENT_SUB_TYPES } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  /api/me/subscriptions — "notify me about THIS", stored on the      */
/*  account (works across every device, and later every push target).  */
/*                                                                     */
/*  creator targets  → a LEVEL: all | posts | live | bookings |        */
/*                     opportunities | important | off                 */
/*  content targets  → post | opportunity | service, mode "on"         */
/*                     (PUT mode "off" deletes the row)                */
/*                                                                     */
/*  GET  ?targetType=&targetId=  → that one subscription (mode|null)   */
/*  GET                          → all my subscriptions                */
/*  PUT  {targetType,targetId,mode} → upsert / delete                  */
/* ------------------------------------------------------------------ */

const TARGET_TYPES = ["creator", ...CONTENT_SUB_TYPES] as const;

async function targetExists(targetType: string, targetId: string): Promise<boolean> {
  if (targetType === "creator") return !!(await db.select().from(tables.users).where(eq(tables.users.id, targetId)).get());
  if (targetType === "post") return !!(await db.select().from(tables.posts).where(eq(tables.posts.id, targetId)).get());
  if (targetType === "opportunity") return !!(await db.select().from(tables.opportunities).where(eq(tables.opportunities.id, targetId)).get());
  if (targetType === "service") return !!(await db.select().from(tables.services).where(eq(tables.services.id, targetId)).get());
  return false;
}

export async function GET(req: NextRequest) {
  return guarded(async () => {
    const user = await requireUser();
    const targetType = req.nextUrl.searchParams.get("targetType");
    const targetId = req.nextUrl.searchParams.get("targetId");
    if (targetType && targetId) {
      const row = await db
        .select()
        .from(tables.notifySubscriptions)
        .where(and(eq(tables.notifySubscriptions.userId, user.id), eq(tables.notifySubscriptions.targetType, targetType), eq(tables.notifySubscriptions.targetId, targetId)))
        .get();
      return { mode: row?.mode ?? null };
    }
    const rows = await db.select().from(tables.notifySubscriptions).where(eq(tables.notifySubscriptions.userId, user.id)).all();
    return { subscriptions: rows.map((r) => ({ targetType: r.targetType, targetId: r.targetId, mode: r.mode })) };
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const targetType = String(body.targetType || "");
    const targetId = String(body.targetId || "").slice(0, 64);
    const mode = String(body.mode || "");
    if (!(TARGET_TYPES as readonly string[]).includes(targetType)) throw new ApiError(400, "Unknown target type");
    if (!targetId) throw new ApiError(400, "Missing target");
    if (targetType === "creator") {
      if (!(CREATOR_SUB_MODES as readonly string[]).includes(mode)) throw new ApiError(400, "Unknown notification level");
      if (targetId === user.id) throw new ApiError(400, "That's you — no need to subscribe to yourself");
    } else if (!["on", "off"].includes(mode)) throw new ApiError(400, "Content subscriptions are on or off");
    if (!(await targetExists(targetType, targetId))) throw new ApiError(404, "Target not found");

    const where = and(
      eq(tables.notifySubscriptions.userId, user.id),
      eq(tables.notifySubscriptions.targetType, targetType),
      eq(tables.notifySubscriptions.targetId, targetId)
    );
    // "off" on content targets = no row at all; creator "off" keeps the
    // explicit choice (the bell remembers you silenced this creator)
    if (mode === "off" && targetType !== "creator") {
      await db.delete(tables.notifySubscriptions).where(where).run();
      return { ok: true, mode: null };
    }
    const existing = await db.select().from(tables.notifySubscriptions).where(where).get();
    if (existing) await db.update(tables.notifySubscriptions).set({ mode }).where(where).run();
    else await db.insert(tables.notifySubscriptions).values({ userId: user.id, targetType, targetId, mode }).run();
    return { ok: true, mode };
  });
}
