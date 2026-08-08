import { db, tables } from "@/db";
import { requireAdmin, guarded } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return guarded(() => {
    requireAdmin();
    const count = (t: Parameters<typeof db.select>[0] extends never ? never : any) =>
      db.select().from(t).all().length;
    const paymentsAll = db.select().from(tables.payments).all();
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
    };
  });
}
