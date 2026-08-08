import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { requireServiceOwner } from "@/lib/server/authz";

export const dynamic = "force-dynamic";

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
