import { NextRequest } from "next/server";
import { asc, eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { rsvpCounts } from "@/lib/server/events";

export const dynamic = "force-dynamic";

/** GET /api/events/[id]/attendees — the HOST's attendee list.
 *
 *  Host-only by design: attending an event is a social act toward the
 *  host (campus events already gate RSVP by verified membership), but
 *  the list never leaves the host's view. Exposes exactly what a door
 *  list needs — display name, handle, avatar, RSVP time — nothing else
 *  (no emails, no locations, no account internals). Built entirely on
 *  the existing eventRsvps records; no new tables. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    const event = await db
      .select()
      .from(tables.events)
      .where(or(eq(tables.events.id, params.id), eq(tables.events.slug, params.id)))
      .get();
    if (!event) throw new ApiError(404, "Event not found");
    if (event.hostId !== user.id) throw new ApiError(403, "Only the host can see the attendee list");

    const rows = await db
      .select({ rsvp: tables.eventRsvps, profile: tables.profiles, u: tables.users })
      .from(tables.eventRsvps)
      .innerJoin(tables.users, eq(tables.eventRsvps.userId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.eventRsvps.userId))
      .where(eq(tables.eventRsvps.eventId, event.id))
      .orderBy(asc(tables.eventRsvps.createdAt))
      .all();

    const realRsvps = (await rsvpCounts([event.id])).get(event.id) ?? 0;
    return {
      attendees: rows.map((r) => ({
        handle: r.u.handle,
        displayName: r.profile.displayName,
        avatarUrl: r.profile.avatarUrl,
        rsvpAt: r.rsvp.createdAt.toISOString(),
      })),
      counts: {
        rsvps: realRsvps, // real attendee records
        baseline: event.attending, // seed/legacy baseline counter
        going: event.attending + realRsvps, // what the public event page shows
        capacity: event.capacity,
        spotsLeft: event.capacity != null ? Math.max(0, event.capacity - (event.attending + realRsvps)) : null,
      },
    };
  });
}
