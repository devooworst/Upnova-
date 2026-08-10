import { eq, and } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";
import { clientIdsOf, clientStats, parseBenefits, readEarlyAccess, activeBookingsForService } from "@/lib/server/preferred";

export const dynamic = "force-dynamic";

/**
 * GET /api/clients — the provider's PRIVATE client dashboard: everyone
 * who has booked/hired them, with completed-work stats, eligibility,
 * and the preferred-client relationship (including removed history).
 * Visible only to the provider themself — never to clients, visitors,
 * or other providers.
 */
export async function GET() {
  return guarded(() => {
    const user = requireUser();

    const rows = clientIdsOf(user.id).map((clientId) => {
      const u = db.select().from(tables.users).where(eq(tables.users.id, clientId)).get();
      const p = db.select().from(tables.profiles).where(eq(tables.profiles.userId, clientId)).get();
      const stats = clientStats(user.id, clientId);
      const rel = db
        .select()
        .from(tables.preferredClients)
        .where(and(eq(tables.preferredClients.providerId, user.id), eq(tables.preferredClients.clientId, clientId)))
        .get();
      return {
        id: clientId,
        handle: u?.handle ?? "?",
        displayName: p?.displayName ?? "?",
        avatarUrl: p?.avatarUrl ?? null,
        ...stats,
        preferred: rel
          ? {
              id: rel.id,
              status: rel.status,
              benefits: parseBenefits(rel.benefits),
              note: rel.note,
              addedAt: rel.addedAt.toISOString(),
              removedAt: rel.removedAt?.toISOString() ?? null,
            }
          : null,
      };
    });

    // services + their preferred-only windows (for the early-access control)
    const services = db
      .select()
      .from(tables.services)
      .where(eq(tables.services.ownerId, user.id))
      .all()
      .filter((s) => s.active)
      .map((s) => ({
        id: s.id,
        title: s.title,
        price: s.price,
        preferredUntil: s.preferredUntil && s.preferredUntil.getTime() > Date.now() ? s.preferredUntil.toISOString() : null,
        // Preferred Early Access setup: the slot cap counts for EVERYONE;
        // the preferred limit bounds bookings during the window only
        earlyAccess: (() => {
          const ea = readEarlyAccess(s.config);
          if (!ea) return null;
          const active = activeBookingsForService(s.id);
          return {
            slots: ea.slots,
            preferredLimit: ea.preferredLimit,
            activeBookings: active,
            slotsLeft: ea.slots != null ? Math.max(0, ea.slots - active) : null,
          };
        })(),
      }));

    rows.sort((a, b) => (b.lastCompletedAt ?? "").localeCompare(a.lastCompletedAt ?? ""));
    return {
      clients: rows,
      preferredCount: rows.filter((r) => r.preferred?.status === "active").length,
      services,
    };
  });
}
