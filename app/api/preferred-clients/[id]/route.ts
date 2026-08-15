import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import { sanitizeBenefits, benefitSummary, parseBenefits } from "@/lib/server/preferred";

export const dynamic = "force-dynamic";

async function ownedRelationship(id: string, providerId: string) {
  const rel =await  await db.select().from(tables.preferredClients).where(eq(tables.preferredClients.id, id)).get();
  if (!rel) throw new ApiError(404, "Relationship not found");
  // AUTHORIZATION: only the provider who owns the relationship may touch
  // it. The client (or any third party) gets a 403 — clients can never
  // modify their own preferred status.
  if (rel.providerId !== providerId) throw new ApiError(403, "Only the provider manages this relationship");
  return rel;
}

/** PATCH { benefits, note } — the provider edits the benefits they offer. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const rel = ownedRelationship(params.id, user.id);
    if ((await rel).status !== "active") throw new ApiError(409, "This client was removed — add them again to restore benefits");
    const benefits = sanitizeBenefits(body.benefits);
    if (benefits.length === 0) throw new ApiError(400, "Choose at least one benefit");
    await db.update(tables.preferredClients)
      .set({ benefits: JSON.stringify(benefits), note: String(body.note ?? (await rel).note).slice(0, 300) })
      .where(eq(tables.preferredClients.id, (await rel).id))
      .run();
    await notify({
      userId: (await rel).clientId,
      actorId: user.id,
      type: "preferred_added",
      title: `${user.profile.displayName} updated your Preferred Client benefits`,
      body: benefitSummary(benefits),
      href: "/clients",
    });
    return { id: (await rel).id, benefits };
  });
}

/**
 * DELETE — the provider ends the relationship. The row is kept
 * (status "removed" + removedAt) so the private history survives; the
 * client is notified privately and never publicly penalized.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    const rel = ownedRelationship(params.id, user.id);
    if ((await rel).status === "removed") return { id: (await rel).id, status: "removed" };
    await db.update(tables.preferredClients)
      .set({ status: "removed", removedAt: new Date() })
      .where(eq(tables.preferredClients.id, (await rel).id))
      .run();
    await notify({
      userId: (await rel).clientId,
      actorId: user.id,
      type: "preferred_removed",
      title: `Your Preferred Client benefits with ${user.profile.displayName} have ended`,
      body: "",
      href: "/clients",
      priority: "low",
    });
    return { id: (await rel).id, status: "removed", hadBenefits: parseBenefits((await rel).benefits).length };
  });
}
