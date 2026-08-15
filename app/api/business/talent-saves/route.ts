import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { assertCapacityById } from "@/lib/server/businessLimits";

export const dynamic = "force-dynamic";

/**
 * Saved talent — a business's private prospect list (bookmarks with
 * targetType "user"). Capacity-gated per plan at CREATION (Free 25 /
 * Pro 250); saves are private, never visible to the saved person or
 * anyone else, and removal is instant.
 *
 *   GET            → my saved talent, newest first
 *   POST { handle | userId }   → save
 *   DELETE { handle | userId } → unsave
 */
export async function GET() {
  return guarded(async () => {
    const user = await requireUser();
    const rows = (await db
      .select()
      .from(tables.bookmarks)
      .where(and(eq(tables.bookmarks.userId, user.id), eq(tables.bookmarks.targetType, "user")))
      .all())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const saved = (await Promise.all(rows
      .map(async (r) => {
        const u = await db.select().from(tables.users).where(eq(tables.users.id, r.targetId)).get();
        const p = await db.select().from(tables.profiles).where(eq(tables.profiles.userId, r.targetId)).get();
        if (!u || !p) return null;
        let skills: string[] = [];
        try {
          skills = JSON.parse(p.skills || "[]");
        } catch {}
        const service = (await db
          .select()
          .from(tables.services)
          .where(eq(tables.services.ownerId, u.id))
          .all())
          .find((s) => s.active && s.visibility === "public");
        return {
          id: u.id,
          handle: u.handle,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          primaryRole: p.primaryRole,
          skills: skills.slice(0, 6),
          openToWork: !!p.openToWork,
          serviceId: service?.id ?? null,
          savedAt: r.createdAt.toISOString(),
        };
      })))
      .filter(Boolean);
    return { saved };
  });
}

async function resolveTarget(body: Record<string, unknown>) {
  const target = await body.userId
    ? await db.select().from(tables.users).where(eq(tables.users.id, String(body.userId))).get()
    : await db.select().from(tables.users).where(eq(tables.users.handle, String(body.handle ?? "").trim().toLowerCase())).get();
  if (!target || target.status !== "active") throw new ApiError(404, "Person not found");
  return target;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const target = resolveTarget(body);
    if ((await target).id === user.id) throw new ApiError(400, "You can't save yourself");
    const existing = await db
      .select()
      .from(tables.bookmarks)
      .where(and(eq(tables.bookmarks.userId, user.id), eq(tables.bookmarks.targetType, "user"), eq(tables.bookmarks.targetId, (await target).id)))
      .get();
    if (existing) return { saved: true, handle: (await target).handle };
    // creation-only capacity gate; existing saves are never touched
    await assertCapacityById(user.id, "savedTalent");
    await db.insert(tables.bookmarks).values({ userId: user.id, targetType: "user", targetId: (await target).id }).run();
    return { saved: true, handle: (await target).handle };
  });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return guarded(async () => {
    const user = await requireUser();
    const target = resolveTarget(body);
    await db.delete(tables.bookmarks)
      .where(and(eq(tables.bookmarks.userId, user.id), eq(tables.bookmarks.targetType, "user"), eq(tables.bookmarks.targetId, (await target).id)))
      .run();
    return { saved: false, handle: (await target).handle };
  });
}
