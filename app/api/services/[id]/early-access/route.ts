import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import { preferredWithEarlyAccess } from "@/lib/server/preferred";

export const dynamic = "force-dynamic";

/**
 * POST /api/services/[id]/early-access { hours } — the OWNER opens this
 * service's appointments to Preferred Clients first. While the window
 * is open, POST /api/bookings refuses non-preferred clients (real
 * enforcement, not a label); it expires on its own, or DELETE closes it
 * early. Requires at least one active Preferred Client holding a
 * priority-booking / early-access benefit — a window nobody can use is
 * refused honestly.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const svc = db.select().from(tables.services).where(eq(tables.services.id, params.id)).get();
    if (!svc || !svc.active) throw new ApiError(404, "Service not found");
    if (svc.ownerId !== user.id) throw new ApiError(403, "Only the owner controls early access");
    const hours = Math.round(Number(body.hours));
    if (!Number.isFinite(hours) || hours < 1 || hours > 168) throw new ApiError(400, "Window must be 1–168 hours");

    const holders = preferredWithEarlyAccess(user.id);
    if (holders.length === 0)
      throw new ApiError(409, "No Preferred Client currently holds a priority-booking or early-access benefit — add one first");

    const until = new Date(Date.now() + hours * 3600_000);
    db.update(tables.services).set({ preferredUntil: until }).where(eq(tables.services.id, svc.id)).run();

    for (const clientId of holders)
      notify({
        userId: clientId,
        actorId: user.id,
        type: "preferred_window",
        title: `${user.profile.displayName} opened appointments to Preferred Clients first`,
        body: `${svc.title} — you can book ${hours} hours before everyone else`,
        href: `/services/${svc.id}`,
      });

    return { id: svc.id, preferredUntil: until.toISOString(), notified: holders.length };
  });
}

/** DELETE — close the window early; the service opens to everyone. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const user = requireUser();
    const svc = db.select().from(tables.services).where(eq(tables.services.id, params.id)).get();
    if (!svc) throw new ApiError(404, "Service not found");
    if (svc.ownerId !== user.id) throw new ApiError(403, "Only the owner controls early access");
    db.update(tables.services).set({ preferredUntil: null }).where(eq(tables.services.id, svc.id)).run();
    return { id: svc.id, preferredUntil: null };
  });
}
