import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/services — EVERY service the creator owns, whatever its
 * state: drafts, unlisted, followers-only, paused, and deactivated ones.
 * This is the management view behind the profile — one canonical record
 * per service, with its live booking history attached. Deactivated
 * services appear here (and in public history) instead of being erased.
 */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const services = db
      .select()
      .from(tables.services)
      .where(eq(tables.services.ownerId, user.id))
      .orderBy(desc(tables.services.createdAt))
      .all();

    const bookings = db
      .select()
      .from(tables.bookings)
      .where(eq(tables.bookings.providerId, user.id))
      .all();

    return {
      services: services.map((s) => {
        const mine = bookings.filter((b) => b.serviceId === s.id);
        const now = Date.now();
        return {
          id: s.id,
          title: s.title,
          price: s.price,
          category: s.category,
          fulfillment: s.fulfillment,
          visibility: s.visibility,
          active: s.active,
          paused: s.paused,
          promoted: s.promoted,
          createdAt: s.createdAt.toISOString(),
          bookings: {
            upcoming: mine.filter((b) => ["pending", "accepted", "confirmed", "reschedule_requested"].includes(b.status) && b.startsAt.getTime() >= now).length,
            completed: mine.filter((b) => b.status === "completed").length,
            cancelled: mine.filter((b) => b.status === "cancelled").length,
            // payouts from completed bookings of THIS service (whole dollars)
            earned: mine.filter((b) => b.status === "completed").reduce((sum, b) => sum + b.price, 0),
          },
        };
      }),
    };
  });
}
