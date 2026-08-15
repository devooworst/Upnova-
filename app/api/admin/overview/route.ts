import { db, tables } from "@/db";
import { requireAdmin, guarded } from "@/lib/server/auth";
import { OFFICIAL_CATEGORIES } from "@/lib/servicePolicies";

export const dynamic = "force-dynamic";

export async function GET() {
  return guarded(async () => {
    await requireAdmin();
    const count = async (t: Parameters<typeof db.select>[0] extends never ? never : any) =>
      (await db.select().from(t).all()).length;
    const paymentsAll = await db.select().from(tables.payments).all();

    // custom-category tracking: creators can add their own; frequent ones
    // are promotion candidates for the official list. Counted live from
    // canonical service records — no separate bookkeeping to drift.
    const official = new Set<string>(OFFICIAL_CATEGORIES);
    const customCounts = new Map<string, number>();
    for (const s of await db.select().from(tables.services).all()) {
      if (s.active && !official.has(s.category))
        customCounts.set(s.category, (customCounts.get(s.category) ?? 0) + 1);
    }
    const customCategories = Array.from(customCounts.entries())
      .map(([name, services]) => ({ name, services }))
      .sort((a, b) => b.services - a.services)
      .slice(0, 20);

    return {
      users: await count(tables.users),
      posts: await count(tables.posts),
      messages: await count(tables.messages),
      communities: await count(tables.communities),
      campuses: await count(tables.campuses),
      services: await count(tables.services),
      opportunities: await count(tables.opportunities),
      applications: await count(tables.applications),
      projects: await count(tables.projects),
      bookings: await count(tables.bookings),
      reportsOpen: (await db.select().from(tables.reports).all()).filter((r) => r.status === "open").length,
      grossVolumeCents: paymentsAll.reduce((s, p) => s + p.amountCents, 0),
      feesCents: paymentsAll.reduce((s, p) => s + p.feeCents, 0),
      customCategories,
    };
  });
}
