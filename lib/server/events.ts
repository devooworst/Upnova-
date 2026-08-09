/* ------------------------------------------------------------------ */
/*  Events — server helpers. One serializer; scope rule enforced at    */
/*  the query level: campus events NEVER leave campus surfaces, public */
/*  events never claim campus association.                             */
/* ------------------------------------------------------------------ */

import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { haversineMi } from "@/lib/server/feed";

type EventRow = typeof tables.events.$inferSelect;

export function verifiedCampusOf(userId: string | null): string | null {
  if (!userId) return null;
  return (
    db
      .select()
      .from(tables.campusVerifications)
      .where(and(eq(tables.campusVerifications.userId, userId), eq(tables.campusVerifications.status, "verified")))
      .get()?.campusId ?? null
  );
}

export function rsvpCounts(eventIds: string[]): Map<string, number> {
  const m = new Map<string, number>();
  if (!eventIds.length) return m;
  for (const r of db.select().from(tables.eventRsvps).all()) {
    if (eventIds.includes(r.eventId)) m.set(r.eventId, (m.get(r.eventId) ?? 0) + 1);
  }
  return m;
}

export function serializeEvent(
  e: EventRow,
  opts: {
    hostName: string;
    hostHandle: string;
    rsvps: number;
    saved?: boolean;
    going?: boolean;
    viewerLat?: number | null;
    viewerLng?: number | null;
    campusName?: string | null;
    isHost?: boolean;
  }
) {
  const going = e.attending + opts.rsvps;
  let distanceMi: number | null = null;
  if (opts.viewerLat != null && opts.viewerLng != null && e.lat != null && e.lng != null)
    distanceMi = Math.round(haversineMi(opts.viewerLat, opts.viewerLng, e.lat, e.lng) * 10) / 10;
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(e.config || "{}");
  } catch {}
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    description: e.description,
    category: e.category,
    startsAt: e.startsAt.toISOString(),
    timeLabel: e.timeLabel,
    location: e.location,
    city: e.city,
    state: e.state,
    price: e.price,
    capacity: e.capacity,
    attending: going,
    spotsLeft: e.capacity != null ? Math.max(0, e.capacity - going) : null,
    imageUrl: e.imageUrl,
    kind: e.kind,
    ageRule: e.ageRule,
    status: e.status,
    config,
    isCampus: !!e.campusId,
    campusName: opts.campusName ?? null,
    host: opts.hostName,
    hostHandle: opts.hostHandle,
    isHost: !!opts.isHost,
    saved: !!opts.saved,
    going: !!opts.going,
    distanceMi,
    // lat/lng deliberately never serialized
  };
}
