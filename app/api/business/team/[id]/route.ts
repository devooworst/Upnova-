import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { assertCapacityById } from "@/lib/server/businessLimits";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

function ownedRow(id: string, businessId: string) {
  const row = db.select().from(tables.businessTeam).where(eq(tables.businessTeam.id, id)).get();
  if (!row) throw new ApiError(404, "Team record not found");
  // AUTHORIZATION: only the business that owns the row manages it —
  // a person can never edit their own team listing.
  if (row.businessId !== businessId) throw new ApiError(403, "Only the business manages its team records");
  return row;
}

/** PATCH { title?, status?, compensation?, notes? } — edit a team record. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const row = ownedRow(params.id, user.id);
    const patch: Partial<typeof tables.businessTeam.$inferInsert> = {};
    if (body.title != null) patch.title = String(body.title).trim().slice(0, 80);
    if (body.compensation != null) patch.compensation = String(body.compensation).trim().slice(0, 200);
    if (body.notes != null) patch.notes = String(body.notes).trim().slice(0, 400);
    if (body.isAdmin != null) {
      const flag = !!body.isAdmin;
      // granting an admin seat is capacity-gated (owner is always seat #1)
      if (flag && !row.isAdmin) assertCapacityById(user.id, "admins");
      patch.isAdmin = flag;
    }
    if (body.status != null) {
      const s = String(body.status);
      if (!["active", "inactive"].includes(s)) throw new ApiError(400, "Status must be active or inactive");
      patch.status = s;
      patch.endedAt = s === "inactive" ? new Date() : null;
    }
    db.update(tables.businessTeam).set(patch).where(eq(tables.businessTeam.id, row.id)).run();
    const fresh = db.select().from(tables.businessTeam).where(eq(tables.businessTeam.id, row.id)).get()!;
    return { id: fresh.id, title: fresh.title, status: fresh.status, isAdmin: !!fresh.isAdmin };
  });
}

/** DELETE — end the membership (row kept with endedAt; history holds). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const user = requireUser();
    const row = ownedRow(params.id, user.id);
    if (row.status !== "inactive") {
      db.update(tables.businessTeam).set({ status: "inactive", endedAt: new Date() }).where(eq(tables.businessTeam.id, row.id)).run();
      notify({
        userId: row.personId,
        actorId: user.id,
        type: "team_added",
        title: `Your team listing with ${user.profile.displayName} has ended`,
        body: "",
        href: `/creator/${user.handle}`,
        priority: "low",
      });
    }
    return { id: row.id, status: "inactive" };
  });
}
