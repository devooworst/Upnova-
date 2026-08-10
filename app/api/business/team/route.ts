import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import { interactionBasis } from "@/lib/server/businessPeople";

export const dynamic = "force-dynamic";

/**
 * POST /api/business/team { handle | personId, title?, compensation?, notes? }
 * Add someone to MY internal team — an EXPLICIT relationship, never
 * implied by a hire. Requires a real prior interaction (booking,
 * project, application, or conversation) so it can't be used to spam
 * strangers. compensation is a private note; nothing here is public.
 * Re-adding a removed member reactivates the same row (history holds).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const target = body.personId
      ? db.select().from(tables.users).where(eq(tables.users.id, String(body.personId))).get()
      : db.select().from(tables.users).where(eq(tables.users.handle, String(body.handle ?? "").trim().toLowerCase())).get();
    if (!target || target.status !== "active") throw new ApiError(404, "Person not found");
    if (target.id === user.id) throw new ApiError(400, "You can't add yourself to your own team");
    if (!interactionBasis(user.id, target.id))
      throw new ApiError(409, "Team members are people you've actually interacted with — no booking, project, application, or conversation exists yet");

    const title = String(body.title ?? "").trim().slice(0, 80);
    const compensation = String(body.compensation ?? "").trim().slice(0, 200);
    const notes = String(body.notes ?? "").trim().slice(0, 400);

    const existing = db
      .select()
      .from(tables.businessTeam)
      .where(and(eq(tables.businessTeam.businessId, user.id), eq(tables.businessTeam.personId, target.id)))
      .get();
    let rowId: string;
    if (existing) {
      db.update(tables.businessTeam)
        .set({ status: "active", title: title || existing.title, compensation: compensation || existing.compensation, notes: notes || existing.notes, endedAt: null, addedAt: existing.status === "active" ? existing.addedAt : new Date() })
        .where(eq(tables.businessTeam.id, existing.id))
        .run();
      rowId = existing.id;
    } else {
      rowId = randomBytes(12).toString("hex");
      db.insert(tables.businessTeam).values({ id: rowId, businessId: user.id, personId: target.id, title, compensation, notes }).run();
    }

    notify({
      userId: target.id,
      actorId: user.id,
      type: "team_added", // unmapped type → in-app only, private
      title: `${user.profile.displayName} added you to their team`,
      body: title || "Team member",
      href: `/creator/${user.handle}`,
      priority: "low",
    });

    const row = db.select().from(tables.businessTeam).where(eq(tables.businessTeam.id, rowId)).get()!;
    return { id: row.id, personId: row.personId, title: row.title, status: row.status, addedAt: row.addedAt.toISOString() };
  });
}
