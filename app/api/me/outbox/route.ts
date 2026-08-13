import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** GET /api/me/outbox — YOUR OWN delivered email/SMS messages. In this
    demo the outbox IS the delivery channel (inspectable, honest);
    production replaces the writer with a real provider. Own-account
    only — nobody can read anyone else's messages. */
export async function GET() {
  return guarded(async () => {
    const user = await requireUser();
    const rows = (await db
      .select()
      .from(tables.outbox)
      .where(eq(tables.outbox.userId, user.id))
      .orderBy(desc(tables.outbox.createdAt))
      .all())
      .slice(0, 30);
    return {
      messages: rows.map((r) => ({
        id: r.id,
        channel: r.channel,
        to: r.channel === "sms" ? `•••• ${r.to.slice(-4)}` : r.to,
        body: r.body,
        kind: r.kind,
        at: r.createdAt.toISOString(),
      })),
    };
  });
}
