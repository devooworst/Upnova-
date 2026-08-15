import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** GET /api/me/applications — everything the user has applied to. */
export async function GET() {
  return guarded(async () => {
    const user = await requireUser();
    const rows = await db
      .select({ app: tables.applications, opp: tables.opportunities, poster: tables.profiles })
      .from(tables.applications)
      .innerJoin(tables.opportunities, eq(tables.applications.opportunityId, tables.opportunities.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.opportunities.posterId))
      .where(eq(tables.applications.applicantId, user.id))
      .orderBy(desc(tables.applications.createdAt))
      .all();

    return {
      applications: await Promise.all(rows.map(async (r) => {
        const role = (() => {
          try {
            const roles = JSON.parse(r.opp.roles) as { id: string; title: string; pay: number | null }[];
            return roles.find((x) => x.id === r.app.roleId) ?? null;
          } catch {
            return null;
          }
        })();
        const interview = (() => { try { const i = JSON.parse(r.app.interview); return i.mode ? i : null; } catch { return null; } })();
        const offer = (() => { try { const o = JSON.parse(r.app.offer); return o.title ? o : null; } catch { return null; } })();
        return {
          id: r.app.id,
          interview,
          offer,
          status: r.app.status, // submitted | shortlisted | selected | confirmed | declined | offer_declined
          availability: r.app.availability,
          message: r.app.message,
          createdAt: r.app.createdAt.toISOString(),
          role: role ? { title: role.title, pay: role.pay } : null,
          opportunity: {
            id: r.opp.id,
            title: r.opp.title,
            budget: r.opp.budget,
            location: r.opp.remote ? "Remote" : r.opp.location,
            eventDate: r.opp.eventDate?.toISOString() ?? null,
            status: r.opp.status,
            poster: r.poster.displayName,
          },
        };
      })),
    };
  });
}
