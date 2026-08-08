import { db, tables } from "@/db";
import { requireAdmin, guarded } from "@/lib/server/auth";
import { OFFICIAL_CATEGORIES } from "@/lib/servicePolicies";

export const dynamic = "force-dynamic";

export async function GET() {
  return guarded(() => {
    requireAdmin();
    const count = (t: Parameters<typeof db.select>[0] extends never ? never : any) =>
      db.select().from(t).all().length;
    const paymentsAll = db.select().from(tables.payments).all();

    // custom-category tracking: creators can add their own; frequent ones
    // are promotion candidates for the official list. Counted live from
    // canonical service records — no separate bookkeeping to drift.
    const official = new Set<string>(OFFICIAL_CATEGORIES);
    const customCounts = new Map<string, number>();
    for (const s of db.select().from(tables.services).all()) {
      if (s.active && !official.has(s.category))
        customCounts.set(s.category, (customCounts.get(s.category) ?? 0) + 1);
    }
    const customCategories = Array.from(customCounts.entries())
      .map(([name, services]) => ({ name, services }))
      .sort((a, b) => b.services - a.services)
      .slice(0, 20);

    return {
      users: count(tables.users),
      posts: count(tables.posts),
      messages: count(tables.messages),
      communities: count(tables.communities),
      campuses: count(tables.campuses),
      services: count(tables.services),
      opportunities: count(tables.opportunities),
      applications: count(tables.applications),
      projects: count(tables.projects),
      bookings: count(tables.bookings),
      reportsOpen: db.select().from(tables.reports).all().filter((r) => r.status === "open").length,
      grossVolumeCents: paymentsAll.reduce((s, p) => s + p.amountCents, 0),
      feesCents: paymentsAll.reduce((s, p) => s + p.feeCents, 0),
      customCategories,
    };
  });
}
