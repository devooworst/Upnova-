import { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { getSessionUser, guarded } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** GET /api/events — upcoming events with real hosts. */
export async function GET(_req: NextRequest) {
  return guarded(() => {
    const viewer = getSessionUser();
    const rows = db
      .select({ event: tables.events, profile: tables.profiles })
      .from(tables.events)
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.events.hostId))
      .orderBy(asc(tables.events.startsAt))
      .all();

    const saved = viewer
      ? new Set(
          db
            .select()
            .from(tables.bookmarks)
            .where(eq(tables.bookmarks.userId, viewer.id))
            .all()
            .filter((b) => b.targetType === "event")
            .map((b) => b.targetId)
        )
      : new Set<string>();

    return {
      events: rows.map((r) => ({
        id: r.event.id,
        slug: r.event.slug,
        title: r.event.title,
        description: r.event.description,
        startsAt: r.event.startsAt.toISOString(),
        timeLabel: r.event.timeLabel,
        location: r.event.location,
        city: r.event.city,
        price: r.event.price,
        capacity: r.event.capacity,
        attending: r.event.attending,
        imageUrl: r.event.imageUrl,
        kind: r.event.kind,
        ageRule: r.event.ageRule,
        host: r.profile.displayName,
        saved: saved.has(r.event.id),
      })),
    };
  });
}
