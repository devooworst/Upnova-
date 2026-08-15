import { asc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";
import { requireCampus } from "@/lib/server/campus";
import { serializeEvent, rsvpCounts } from "@/lib/server/events";

export const dynamic = "force-dynamic";

/** GET /api/campus/events — YOUR CAMPUS ONLY. Strictly events stamped
 *  with the member's verified campus: on-campus or directly associated
 *  with the school. Off-campus parties, concerts, and city events never
 *  appear here — they live in the public Events section. */
export async function GET() {
  return guarded(async () => {
    const user = await requireUser();
    const campusId = await requireCampus(user.id);
    const campus = (await db.select().from(tables.campuses).where(eq(tables.campuses.id, campusId)).get())!;

    const now = Date.now();
    const rows = (await db
      .select({ event: tables.events, profile: tables.profiles, u: tables.users })
      .from(tables.events)
      .innerJoin(tables.users, eq(tables.events.hostId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.events.hostId))
      .where(eq(tables.events.campusId, campusId)) // ← the scope rule
      .orderBy(asc(tables.events.startsAt))
      .all())
      .filter((r) => r.event.status === "active" && r.u.status === "active" && r.event.startsAt.getTime() > now - 6 * 3_600_000);

    const rsvps = await rsvpCounts(rows.map((r) => r.event.id));
    const mine = new Set((await db.select().from(tables.eventRsvps).where(eq(tables.eventRsvps.userId, user.id)).all()).map((r) => r.eventId));
    const saved = new Set(
      (await db.select().from(tables.bookmarks).where(eq(tables.bookmarks.userId, user.id)).all())
        .filter((b) => b.targetType === "event").map((b) => b.targetId)
    );

    return {
      campusName: campus.name,
      events: rows.map((r) =>
        serializeEvent(r.event, {
          hostName: r.profile.displayName,
          hostHandle: r.u.handle,
          rsvps: rsvps.get(r.event.id) ?? 0,
          saved: saved.has(r.event.id),
          going: mine.has(r.event.id),
          campusName: campus.name,
          isHost: user.id === r.event.hostId,
        })
      ),
    };
  });
}
