import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import {
  preferredWithEarlyAccess,
  readEarlyAccess,
  writeEarlyAccess,
  activeBookingsForService,
} from "@/lib/server/preferred";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  PREFERRED EARLY ACCESS                                             */
/*                                                                     */
/*  Early Access controls WHO gets access first; the provider's real   */
/*  availability controls HOW MANY people can actually book.           */
/*                                                                     */
/*  Provider setup: service → available slots (optional cap) →         */
/*  preferred-access duration → optional preferred booking limit →     */
/*  public opening time (= window end, returned explicitly).           */
/*                                                                     */
/*  While the window is open, POST /api/bookings refuses non-preferred */
/*  clients. Slot capacity applies to EVERYONE, Preferred Clients      */
/*  included — nobody can book beyond the provider's available slots,  */
/*  and when the window ends the REMAINING slots open to the public    */
/*  automatically. Cancellations free their slot.                      */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const svc = db.select().from(tables.services).where(eq(tables.services.id, params.id)).get();
    if (!svc || !svc.active) throw new ApiError(404, "Service not found");
    if (svc.ownerId !== user.id) throw new ApiError(403, "Only the owner controls Preferred Early Access");
    const hours = Math.round(Number(body.hours));
    if (!Number.isFinite(hours) || hours < 1 || hours > 168) throw new ApiError(400, "Early access must run 1–168 hours");

    // optional capacity controls — validated, never assumed
    const numOrNull = (v: unknown, label: string) => {
      if (v == null || v === "") return null;
      const n = Math.round(Number(v));
      if (!Number.isFinite(n) || n < 1 || n > 50) throw new ApiError(400, `${label} must be 1–50`);
      return n;
    };
    const slots = numOrNull(body.slots, "Available slots");
    const preferredLimit = numOrNull(body.preferredLimit, "Preferred booking limit");
    if (slots != null && preferredLimit != null && preferredLimit > slots)
      throw new ApiError(400, "The preferred booking limit can't exceed the available slots");

    // a slot cap below what's ALREADY booked would be a lie — refuse it honestly
    const alreadyActive = activeBookingsForService(svc.id);
    if (slots != null && alreadyActive >= slots)
      throw new ApiError(409, `This service already has ${alreadyActive} active bookings — a cap of ${slots} slots would be full before it starts`);

    const holders = preferredWithEarlyAccess(user.id);
    if (holders.length === 0)
      throw new ApiError(409, "No Preferred Client currently holds a priority-booking or early-access benefit — add one first");

    const until = new Date(Date.now() + hours * 3600_000);
    db.update(tables.services)
      .set({
        preferredUntil: until,
        config: writeEarlyAccess(svc.config, { slots, preferredLimit, startedAt: new Date().toISOString() }),
      })
      .where(eq(tables.services.id, svc.id))
      .run();

    for (const clientId of holders)
      notify({
        userId: clientId,
        actorId: user.id,
        type: "preferred_window",
        title: `${user.profile.displayName} opened Preferred Early Access`,
        body: `${svc.title} — you can book ${hours} hours before everyone else${slots ? ` (${Math.max(0, slots - alreadyActive)} slots available)` : ""}`,
        href: `/services/${svc.id}`,
      });

    return {
      id: svc.id,
      preferredUntil: until.toISOString(),
      opensToPublicAt: until.toISOString(), // remaining availability opens to everyone here
      slots,
      slotsLeft: slots != null ? Math.max(0, slots - alreadyActive) : null,
      preferredLimit,
      notified: holders.length,
    };
  });
}

/**
 * DELETE — end the early-access phase now: remaining slots open to
 * everyone immediately (the slot cap stays — capacity is availability,
 * a separate concept). `?full=1` also removes the slot cap entirely.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const user = requireUser();
    const svc = db.select().from(tables.services).where(eq(tables.services.id, params.id)).get();
    if (!svc) throw new ApiError(404, "Service not found");
    if (svc.ownerId !== user.id) throw new ApiError(403, "Only the owner controls Preferred Early Access");
    const full = req.nextUrl.searchParams.get("full") === "1";
    const kept = full ? null : (() => {
      const ea = readEarlyAccess(svc.config);
      return ea?.slots ? { slots: ea.slots, preferredLimit: null, startedAt: ea.startedAt } : null;
    })();
    db.update(tables.services)
      .set({ preferredUntil: null, config: writeEarlyAccess(svc.config, kept) })
      .where(eq(tables.services.id, svc.id))
      .run();
    return { id: svc.id, preferredUntil: null, slots: kept?.slots ?? null };
  });
}
