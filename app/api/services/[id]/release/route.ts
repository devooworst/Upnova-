import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import { parseConfig } from "@/lib/servicePolicies";
import {
  preferredWithEarlyAccess,
  readRelease,
  writeRelease,
  writeEarlyAccess,
  readEarlyAccess,
  activeBookingsForService,
} from "@/lib/server/preferred";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  SCHEDULED RELEASE — "September bookings open August 25 at 9 AM."   */
/*                                                                     */
/*  POST { releaseAt, coversUntil, earlyAccessHours?, slots?,          */
/*         perClientLimit? }                                           */
/*  · Before releaseAt: the covered dates cannot be booked by ANYONE.  */
/*  · From releaseAt: Preferred Clients book first for                 */
/*    earlyAccessHours (optional); then everyone.                      */
/*  · Capacity (slots) and per-client limits bind exactly like a       */
/*    rolling-mode drop — a Preferred Client can never exceed them.    */
/*  Scheduling a release switches the service to "scheduled" mode.     */
/*                                                                     */
/*  DELETE — cancel the pending release (already-released dates stay). */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const svc = await db.select().from(tables.services).where(eq(tables.services.id, params.id)).get();
    if (!svc || !svc.active) throw new ApiError(404, "Service not found");
    if (svc.ownerId !== user.id) throw new ApiError(403, "Only the owner schedules releases");

    const releaseAt = new Date(String(body.releaseAt ?? ""));
    const coversUntil = new Date(String(body.coversUntil ?? ""));
    if (isNaN(releaseAt.getTime())) throw new ApiError(400, "Pick the date and time the release opens");
    if (isNaN(coversUntil.getTime()) || coversUntil.getTime() <= releaseAt.getTime())
      throw new ApiError(400, "The release must cover dates AFTER its opening time");

    const numOrNull = (v: unknown, label: string, max = 50) => {
      if (v == null || v === "") return null;
      const n = Math.round(Number(v));
      if (!Number.isFinite(n) || n < 1 || n > max) throw new ApiError(400, `${label} must be 1–${max}`);
      return n;
    };
    const eaHours = numOrNull(body.earlyAccessHours, "Early access", 168);
    const slots = numOrNull(body.slots, "Available slots");
    const perClientLimit = numOrNull(body.perClientLimit, "Per-client booking limit");
    if (slots != null && perClientLimit != null && perClientLimit > slots)
      throw new ApiError(400, "The per-client booking limit can't exceed the available slots");

    const holders = await preferredWithEarlyAccess(user.id);
    if (eaHours != null && holders.length === 0)
      throw new ApiError(409, "No Preferred Client currently holds a priority-booking or early-access benefit — add one first, or schedule the release without early access");

    const alreadyActive = await activeBookingsForService(svc.id);
    if (slots != null && alreadyActive >= slots)
      throw new ApiError(409, `This service already has ${alreadyActive} active bookings — a cap of ${slots} slots would be full before it opens`);

    // keep what's already released; schedule the new drop
    const prev = readRelease(svc.config);
    let config = writeRelease(svc.config, {
      releasedUntil: prev?.releasedUntil ?? null,
      releaseAt: releaseAt.toISOString(),
      releaseUntil: coversUntil.toISOString(),
      eaHours,
    });
    // capacity + per-client limit ride the same enforcement as drops;
    // the allocation clock starts at the RELEASE moment
    config = writeEarlyAccess(config, slots != null || perClientLimit != null
      ? { slots, preferredLimit: perClientLimit, startedAt: releaseAt.toISOString() }
      : null);
    // scheduling a release IS choosing scheduled mode
    const full = JSON.parse(config) as Record<string, unknown>;
    full.scheduling = { ...(typeof full.scheduling === "object" && full.scheduling !== null ? (full.scheduling as Record<string, unknown>) : {}), releaseMode: "scheduled" };
    config = JSON.stringify(full);

    await db.update(tables.services).set({ config }).where(eq(tables.services.id, svc.id)).run();

    const when = releaseAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    if (eaHours != null)
      for (const clientId of holders)
        await notify({
          userId: clientId,
          actorId: user.id,
          type: "preferred_window",
          title: `${user.profile.displayName} scheduled a release — you book first`,
          body: `${svc.title} — new availability opens ${when}; Preferred Clients get the first ${eaHours} hours${slots ? ` (${Math.max(0, slots - alreadyActive)} slots)` : ""}`,
          href: `/services/${svc.id}`,
        });

    return {
      id: svc.id,
      releaseMode: "scheduled",
      releaseAt: releaseAt.toISOString(),
      coversUntil: coversUntil.toISOString(),
      earlyAccessHours: eaHours,
      publicAt: new Date(releaseAt.getTime() + (eaHours ?? 0) * 3600_000).toISOString(),
      slots,
      slotsLeft: slots != null ? Math.max(0, slots - alreadyActive) : null,
      perClientLimit,
      notified: eaHours != null ? holders.length : 0,
    };
  });
}

/** DELETE — cancel the pending release. Already-released dates stay released. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    const svc = await db.select().from(tables.services).where(eq(tables.services.id, params.id)).get();
    if (!svc) throw new ApiError(404, "Service not found");
    if (svc.ownerId !== user.id) throw new ApiError(403, "Only the owner schedules releases");
    const prev = readRelease(svc.config);
    // a release whose early-access has fully finished has already opened its
    // dates — cancelling then just clears bookkeeping, folding it into
    // releasedUntil so nothing already public is ever taken back
    let releasedUntil = prev?.releasedUntil ?? null;
    if (prev?.releaseAt && prev.releaseUntil) {
      const publicAt = Date.parse(prev.releaseAt) + (prev.eaHours ?? 0) * 3600_000;
      if (Date.now() >= publicAt)
        releasedUntil = !releasedUntil || Date.parse(prev.releaseUntil) > Date.parse(releasedUntil) ? prev.releaseUntil : releasedUntil;
    }
    let config = writeRelease(svc.config, releasedUntil ? { releasedUntil, releaseAt: null, releaseUntil: null, eaHours: null } : null);
    if (readEarlyAccess(config)) config = writeEarlyAccess(config, null);
    await db.update(tables.services).set({ config }).where(eq(tables.services.id, svc.id)).run();
    void parseConfig; // (kept for symmetry with sibling routes)
    return { id: svc.id, releaseAt: null, releasedUntil };
  });
}
