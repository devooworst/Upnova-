/* Append-only order audit log — the private evidence timeline. Every
   state change, payment event, evidence submission, and decision lands
   here and is never rewritten. Parties + platform review only. */

import { randomBytes } from "crypto";
import { asc, eq } from "drizzle-orm";
import { db, tables } from "@/db";

export async function logOrderEvent(orderId: string, actorId: string | null, kind: string, note = "") {
  await db.insert(tables.orderEvents)
    .values({ id: randomBytes(12).toString("hex"), orderId, actorId, kind, note: note.slice(0, 300) })
    .run();
}

export async function orderTimeline(orderId: string) {
  const names = new Map((await db.select().from(tables.profiles).all()).map((p) => [p.userId, p.displayName] as const));
  return (await db
    .select()
    .from(tables.orderEvents)
    .where(eq(tables.orderEvents.orderId, orderId))
    .orderBy(asc(tables.orderEvents.createdAt))
    .all())
    .map((e) => ({
      at: e.createdAt.toISOString(),
      actor: e.actorId ? names.get(e.actorId) ?? "—" : "Mavyn",
      kind: e.kind,
      note: e.note,
    }));
}
