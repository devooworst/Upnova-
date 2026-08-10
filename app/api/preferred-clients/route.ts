import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import {
  sanitizeBenefits,
  benefitSummary,
  hasRelationshipBasis,
  upsertPreferred,
  parseBenefits,
} from "@/lib/server/preferred";

export const dynamic = "force-dynamic";

/**
 * POST /api/preferred-clients { clientHandle | clientId, benefits, note }
 * The PROVIDER adds (or re-adds) a client to their private Preferred
 * Clients list. Only the provider who owns the relationship can create
 * it — a client can never grant themself preferred status. Requires a
 * real prior interaction (booking, project, or conversation) so the
 * feature can't be used to spam strangers.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const client = body.clientId
      ? db.select().from(tables.users).where(eq(tables.users.id, String(body.clientId))).get()
      : db.select().from(tables.users).where(eq(tables.users.handle, String(body.clientHandle ?? "").trim().toLowerCase())).get();
    if (!client || client.status !== "active") throw new ApiError(404, "Client not found");
    if (client.id === user.id) throw new ApiError(400, "You can't add yourself as a Preferred Client");
    if (!hasRelationshipBasis(user.id, client.id))
      throw new ApiError(409, "Preferred Clients are people you've actually worked with — no booking, project, or conversation exists yet");

    const benefits = sanitizeBenefits(body.benefits);
    if (benefits.length === 0) throw new ApiError(400, "Choose at least one benefit");
    const rel = upsertPreferred(user.id, client.id, benefits, String(body.note ?? ""));

    const clientProfile = db.select().from(tables.profiles).where(eq(tables.profiles.userId, client.id)).get();
    void clientProfile;
    notify({
      userId: client.id,
      actorId: user.id,
      type: "preferred_added",
      title: `You've been added as a Preferred Client by ${user.profile.displayName}`,
      body: benefitSummary(benefits),
      href: "/clients",
    });

    return {
      id: rel.id,
      status: rel.status,
      benefits: parseBenefits(rel.benefits),
      addedAt: rel.addedAt.toISOString(),
    };
  });
}
