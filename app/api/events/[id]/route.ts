import { NextRequest } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { getSessionUser, requireUser, guarded, ApiError } from "@/lib/server/auth";
import { serializeEvent, rsvpCounts, verifiedCampusOf } from "@/lib/server/events";

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
  return guarded(() => {
    const r = findEvent(params.id);
    if (!r) throw new ApiError(404, "Event not found");
    const viewer = getSessionUser();

    let campusName: string | null = null;
    if (r.event.campusId) {
      const myCampus = verifiedCampusOf(viewer?.id ?? null);
      if (myCampus !== r.event.campusId && viewer?.id !== r.event.hostId)
        throw new ApiError(403, "This is a campus event — it's visible to verified members of that campus");
      campusName = db.select().from(tables.campuses).where(eq(tables.campuses.id, r.event.campusId)).get()?.name ?? null;
    }

    const rsvps = rsvpCounts([r.event.id]);
    const saved = viewer
      ? !!db.select().from(tables.bookmarks)
          .where(and(eq(tables.bookmarks.userId, viewer.id), eq(tables.bookmarks.targetType, "event"), eq(tables.bookmarks.targetId, r.event.id)))
          .get()
      : false;
    const going = viewer
      ? !!db.select().from(tables.eventRsvps)
          .where(and(eq(tables.eventRsvps.eventId, r.event.id), eq(tables.eventRsvps.userId, viewer.id)))
          .get()
      : false;

    return {
      event: serializeEvent(r.event, {
        hostName: r.profile.displayName,
        hostHandle: r.u.handle,
        rsvps: rsvps.get(r.event.id) ?? 0,
        saved,
        going,
        viewerLat: viewer?.profile.lat ?? null,
        viewerLng: viewer?.profile.lng ?? null,
        campusName,
        isHost: viewer?.id === r.event.hostId,
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
    const user = requireUser();
    const r = findEvent(params.id);
    if (!r) throw new ApiError(404, "Event not found");
    if (r.event.status !== "active") throw new ApiError(409, "This event was cancelled");
    if (r.event.startsAt.getTime() < Date.now() - 6 * 3_600_000) throw new ApiError(409, "This event already happened");

    if (r.event.campusId) {
      const myCampus = verifiedCampusOf(user.id);
      if (myCampus !== r.event.campusId) throw new ApiError(403, "This is a campus event — verified members of that campus only");
    }

    if (r.event.kind === "ticket") throw new ApiError(409, "This is a ticketed event — ticket checkout is coming; save it for now");
    if (r.event.kind === "approval") throw new ApiError(409, "This event is request-to-attend — message the host to request a spot");

    const existing = db
      .select()
      .from(tables.eventRsvps)
      .where(and(eq(tables.eventRsvps.eventId, r.event.id), eq(tables.eventRsvps.userId, user.id)))
      .get();

    if (existing) {
      db.delete(tables.eventRsvps)
        .where(and(eq(tables.eventRsvps.eventId, r.event.id), eq(tables.eventRsvps.userId, user.id)))
        .run();
      return { ok: true, going: false };
    }

    const current = r.event.attending + (rsvpCounts([r.event.id]).get(r.event.id) ?? 0);
    if (r.event.capacity != null && current >= r.event.capacity) throw new ApiError(409, "This event is full");
    db.insert(tables.eventRsvps).values({ eventId: r.event.id, userId: user.id }).run();
    return { ok: true, going: true };
  });
}
