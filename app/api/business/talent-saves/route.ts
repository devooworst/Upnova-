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
  return guarded(() => {
    const user = requireUser();
    const rows = db
      .select()
      .from(tables.bookmarks)
      .where(and(eq(tables.bookmarks.userId, user.id), eq(tables.bookmarks.targetType, "user")))
      .all()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const saved = rows
      .map((r) => {
        const u = db.select().from(tables.users).where(eq(tables.users.id, r.targetId)).get();
        const p = db.select().from(tables.profiles).where(eq(tables.profiles.userId, r.targetId)).get();
        if (!u || !p) return null;
        let skills: string[] = [];
        try {
          skills = JSON.parse(p.skills || "[]");
        } catch {}
        const service = db
          .select()
          .from(tables.services)
          .where(eq(tables.services.ownerId, u.id))
          .all()
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
      })
      .filter(Boolean);
    return { saved };
  });
}

function resolveTarget(body: Record<string, unknown>) {
  const target = body.userId
    ? db.select().from(tables.users).where(eq(tables.users.id, String(body.userId))).get()
    : db.select().from(tables.users).where(eq(tables.users.handle, String(body.handle ?? "").trim().toLowerCase())).get();
  if (!target || target.status !== "active") throw new ApiError(404, "Person not found");
  return target;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const target = resolveTarget(body);
    if (target.id === user.id) throw new ApiError(400, "You can't save yourself");
    const existing = db
      .select()
      .from(tables.bookmarks)
      .where(and(eq(tables.bookmarks.userId, user.id), eq(tables.bookmarks.targetType, "user"), eq(tables.bookmarks.targetId, target.id)))
      .get();
    if (existing) return { saved: true, handle: target.handle };
    // creation-only capacity gate; existing saves are never touched
    assertCapacityById(user.id, "savedTalent");
    db.insert(tables.bookmarks).values({ userId: user.id, targetType: "user", targetId: target.id }).run();
    return { saved: true, handle: target.handle };
  });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return guarded(() => {
    const user = requireUser();
    const target = resolveTarget(body);
    db.delete(tables.bookmarks)
      .where(and(eq(tables.bookmarks.userId, user.id), eq(tables.bookmarks.targetType, "user"), eq(tables.bookmarks.targetId, target.id)))
      .run();
    return { saved: false, handle: target.handle };
  });
}
