import { eq, and } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";
import { parseBenefits, clientStats } from "@/lib/server/preferred";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/preferred — the CLIENT's private view: providers who have
 * personally added me as a Preferred Client, with the benefits they
 * chose. Shows only MY relationships — never another client's, never a
 * provider's full list.
 */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const rows = db
      .select()
      .from(tables.preferredClients)
      .where(and(eq(tables.preferredClients.clientId, user.id), eq(tables.preferredClients.status, "active")))
      .all()
      .map((rel) => {
        const provider = db.select().from(tables.users).where(eq(tables.users.id, rel.providerId)).get();
        const profile = db.select().from(tables.profiles).where(eq(tables.profiles.userId, rel.providerId)).get();
        const stats = clientStats(rel.providerId, user.id);
        const service = db
          .select()
          .from(tables.services)
          .where(eq(tables.services.ownerId, rel.providerId))
          .all()
          .find((s) => s.active && s.visibility === "public");
        // an OPEN preferred-only window from this provider right now?
        const window = db
          .select()
          .from(tables.services)
          .where(eq(tables.services.ownerId, rel.providerId))
          .all()
          .filter((s) => s.active && s.preferredUntil && s.preferredUntil.getTime() > Date.now())
          .map((s) => ({ serviceId: s.id, title: s.title, until: s.preferredUntil!.toISOString() }));
        return {
          id: rel.id,
          provider: {
            id: rel.providerId,
            handle: provider?.handle ?? "?",
            displayName: profile?.displayName ?? "?",
            avatarUrl: profile?.avatarUrl ?? null,
            accountType: provider?.accountType ?? "individual",
          },
          benefits: parseBenefits(rel.benefits),
          since: rel.addedAt.toISOString(),
          completedBookings: stats.completedBookings,
          completedProjects: stats.completedProjects,
          bookAgainServiceId: service?.id ?? null,
          earlyWindows: window,
        };
      });
    return { preferred: rows };
  });
}
