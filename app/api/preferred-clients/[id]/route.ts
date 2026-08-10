import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import { sanitizeBenefits, benefitSummary, parseBenefits } from "@/lib/server/preferred";

export const dynamic = "force-dynamic";

function ownedRelationship(id: string, providerId: string) {
  const rel = db.select().from(tables.preferredClients).where(eq(tables.preferredClients.id, id)).get();
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
  return guarded(() => {
    const user = requireUser();
    const rel = ownedRelationship(params.id, user.id);
    if (rel.status !== "active") throw new ApiError(409, "This client was removed — add them again to restore benefits");
    const benefits = sanitizeBenefits(body.benefits);
    if (benefits.length === 0) throw new ApiError(400, "Choose at least one benefit");
    db.update(tables.preferredClients)
      .set({ benefits: JSON.stringify(benefits), note: String(body.note ?? rel.note).slice(0, 300) })
      .where(eq(tables.preferredClients.id, rel.id))
      .run();
    notify({
      userId: rel.clientId,
      actorId: user.id,
      type: "preferred_added",
      title: `${user.profile.displayName} updated your Preferred Client benefits`,
      body: benefitSummary(benefits),
      href: "/clients",
    });
    return { id: rel.id, benefits };
  });
}

/**
 * DELETE — the provider ends the relationship. The row is kept
 * (status "removed" + removedAt) so the private history survives; the
 * client is notified privately and never publicly penalized.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const user = requireUser();
    const rel = ownedRelationship(params.id, user.id);
    if (rel.status === "removed") return { id: rel.id, status: "removed" };
    db.update(tables.preferredClients)
      .set({ status: "removed", removedAt: new Date() })
      .where(eq(tables.preferredClients.id, rel.id))
      .run();
    notify({
      userId: rel.clientId,
      actorId: user.id,
      type: "preferred_removed",
      title: `Your Preferred Client benefits with ${user.profile.displayName} have ended`,
      body: "",
      href: "/clients",
      priority: "low",
    });
    return { id: rel.id, status: "removed", hadBenefits: parseBenefits(rel.benefits).length };
  });
}
