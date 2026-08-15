import { NextRequest } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { getSessionUser, requireUser, guarded, ApiError } from "@/lib/server/auth";
import { serializeEvent, rsvpCounts, verifiedCampusOf } from "@/lib/server/events";
import { unrestrictedTester } from "@/lib/server/campus";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

function findEvent(idOrSlug: string) {
  return db
    .select({ event: tables.events, profile: tables.profiles, u: tables.users })
    .from(tables.events)
    .innerJoin(tables.users, eq(tables.events.hostId, tables.users.id))
    .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.events.hostId))
    .where(or(eq(tables.events.id, idOrSlug), eq(tables.events.slug, idOrSlug)))
    .get();
}

/** GET — event detail. Campus events are visible ONLY to verified members
 *  of that campus (the host always sees their own). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const r = await findEvent(params.id);
    if (!r) throw new ApiError(404, "Event not found");
    const viewer = await getSessionUser();

    let campusName: string | null = null;
    if (r!.event.campusId && r!.event.publicVisibility) {
      // organizer opted into public listing: anyone may VIEW (info only);
      // eligibility is enforced at RSVP, not here
      campusName = (await db.select().from(tables.campuses).where(eq(tables.campuses.id, r!.event.campusId)).get())?.name ?? null;
    } else if (r!.event.campusId) {
      const myCampus = await verifiedCampusOf(viewer?.id ?? null);
      if (myCampus !== r!.event.campusId && viewer?.id !== r!.event.hostId)
        throw new ApiError(403, "This is a campus event — it's visible to verified members of that campus");
      campusName = (await db.select().from(tables.campuses).where(eq(tables.campuses.id, r!.event.campusId)).get())?.name ?? null;
    }

    const rsvps = await rsvpCounts([r!.event.id]);
    const saved = viewer
      ? !!await db.select().from(tables.bookmarks)
          .where(and(eq(tables.bookmarks.userId, viewer.id), eq(tables.bookmarks.targetType, "event"), eq(tables.bookmarks.targetId, r!.event.id)))
          .get()
      : false;
    const going = viewer
      ? !!await db.select().from(tables.eventRsvps)
          .where(and(eq(tables.eventRsvps.eventId, r!.event.id), eq(tables.eventRsvps.userId, viewer.id)))
          .get()
      : false;

    return {
      event: serializeEvent(r!.event, {
        hostName: r!.profile.displayName,
        hostHandle: r!.u.handle,
        rsvps: rsvps.get(r!.event.id) ?? 0,
        saved,
        going,
        viewerLat: viewer?.profile.lat ?? null,
        viewerLng: viewer?.profile.lng ?? null,
        campusName,
        isHost: viewer?.id === r!.event.hostId,
      }),
      guest: !viewer,
    };
  });
}

/** POST — toggle "Going" (one-click RSVP / registration interest).
 *  Real attendee records; capacity enforced; campus events restricted to
 *  the campus. Ticket/approval events don't RSVP here: tickets need
 *  checkout (not yet built — labeled in the UI), approvals go to the host. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    const r = await findEvent(params.id);
    if (!r) throw new ApiError(404, "Event not found");
    if (r!.event.status !== "active") throw new ApiError(409, "This event was cancelled");
    if (r!.event.startsAt.getTime() < Date.now() - 6 * 3_600_000) throw new ApiError(409, "This event already happened");

    if (r!.event.campusId) {
      const myCampus = await verifiedCampusOf(user.id);
      if (myCampus !== r!.event.campusId && !(await unrestrictedTester(user.id)) /* DEMO MODE */) {
        const school = (await db.select().from(tables.campuses).where(eq(tables.campuses.id, r!.event.campusId)).get())?.name ?? "that campus";
        throw new ApiError(403, `Student verification required — this event is limited to verified ${school} members. Verify your affiliation for free to RSVP.`);
      }
    }

    if (r!.event.kind === "ticket") throw new ApiError(409, "This is a ticketed event — ticket checkout is coming; save it for now");
    if (r!.event.kind === "approval") throw new ApiError(409, "This event is request-to-attend — message the host to request a spot");

    const existing = await db
      .select()
      .from(tables.eventRsvps)
      .where(and(eq(tables.eventRsvps.eventId, r!.event.id), eq(tables.eventRsvps.userId, user.id)))
      .get();

    if (existing) {
      await db.delete(tables.eventRsvps)
        .where(and(eq(tables.eventRsvps.eventId, r!.event.id), eq(tables.eventRsvps.userId, user.id)))
        .run();
      return { ok: true, going: false };
    }

    const current = r!.event.attending + ((await rsvpCounts([r!.event.id])).get(r!.event.id) ?? 0);
    if (r!.event.capacity != null && current >= r!.event.capacity) throw new ApiError(409, "This event is full");
    await db.insert(tables.eventRsvps).values({ eventId: r!.event.id, userId: user.id }).run();
    return { ok: true, going: true };
  });
}

/** PATCH — HOST actions. Today exactly one: { action: "cancel" }.
 *  Uses the schema's existing status vocabulary (active | cancelled).
 *  The event and every RSVP record are PRESERVED — cancelled events
 *  disappear from discovery (the list already filters on status) and
 *  the RSVP route already refuses them; nothing is deleted. Every
 *  RSVPed attendee is notified. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  return guarded(async () => {
    const user = await requireUser();
    const r = await findEvent(params.id);
    if (!r) throw new ApiError(404, "Event not found");
    if (r!.event.hostId !== user.id) throw new ApiError(403, "Only the host can manage this event");

    if (body.action !== "cancel") throw new ApiError(400, "Unknown action — the only host action today is cancel");
    if (r!.event.status === "cancelled") throw new ApiError(409, "This event is already cancelled");

    await db.update(tables.events).set({ status: "cancelled" }).where(eq(tables.events.id, r!.event.id)).run();

    // tell everyone who RSVPed — their records stay, the plan changed
    const rsvps = await db.select().from(tables.eventRsvps).where(eq(tables.eventRsvps.eventId, r!.event.id)).all();
    for (const rsvp of rsvps) {
      await notify({
        userId: rsvp.userId,
        actorId: user.id,
        type: "event_cancelled",
        title: `Cancelled: ${r!.event.title}`,
        body: "The host cancelled this event. Your RSVP record is kept for reference.",
        href: `/events/${r!.event.slug}`,
        category: "activity",
      });
    }
    return { ok: true, status: "cancelled", notified: rsvps.length };
  });
}
