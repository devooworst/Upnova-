import { eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/work — the authenticated user's COMPLETED transactions,
 * offered by the composer as "link this post to real work". Linking is
 * what makes a post eligible for the Verified Work label (the link is
 * re-validated server-side at post time — this list is a convenience,
 * not the authority).
 */
export async function GET() {
  return guarded(async () => {
    const user = await requireUser();

    const projects = (await db
      .select()
      .from(tables.projects)
      .where(or(eq(tables.projects.creatorId, user.id), eq(tables.projects.clientId, user.id)))
      .all())
      .filter((p) => ["approved", "completed", "reviewed"].includes(p.state));

    const bookings = (await db
      .select()
      .from(tables.bookings)
      .where(or(eq(tables.bookings.providerId, user.id), eq(tables.bookings.clientId, user.id)))
      .all())
      .filter((b) => b.status === "completed");

    const otherIds = Array.from(
      new Set([
        ...projects.map((p) => (p.creatorId === user.id ? p.clientId : p.creatorId)),
        ...bookings.map((b) => (b.providerId === user.id ? b.clientId : b.providerId)),
      ])
    );
    const names = new Map(
      (await db.select().from(tables.profiles).all()).filter((pr) => otherIds.includes(pr.userId)).map((pr) => [pr.userId, pr.displayName])
    );

    return {
      work: [
        ...projects.map((p) => ({
          kind: "project" as const,
          id: p.id,
          title: p.title,
          with: names.get(p.creatorId === user.id ? p.clientId : p.creatorId) ?? "client",
        })),
        ...bookings.map((b) => ({
          kind: "booking" as const,
          id: b.id,
          title: b.title,
          with: names.get(b.providerId === user.id ? b.clientId : b.providerId) ?? "client",
        })),
      ],
    };
  });
}
