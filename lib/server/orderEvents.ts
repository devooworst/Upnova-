/* Append-only order audit log — the private evidence timeline. Every
   state change, payment event, evidence submission, and decision lands
   here and is never rewritten. Parties + platform review only. */

import { randomBytes } from "crypto";
import { asc, eq } from "drizzle-orm";
import { db, tables } from "@/db";

export function logOrderEvent(orderId: string, actorId: string | null, kind: string, note = "") {
  db.insert(tables.orderEvents)
    .values({ id: randomBytes(12).toString("hex"), orderId, actorId, kind, note: note.slice(0, 300) })
    .run();
}

export function orderTimeline(orderId: string) {
  const names = new Map(db.select().from(tables.profiles).all().map((p) => [p.userId, p.displayName]));
  return db
    .select()
    .from(tables.orderEvents)
    .where(eq(tables.orderEvents.orderId, orderId))
    .orderBy(asc(tables.orderEvents.createdAt))
    .all()
    .map((e) => ({
      at: e.createdAt.toISOString(),
      actor: e.actorId ? names.get(e.actorId) ?? "—" : "UpNova",
      kind: e.kind,
      note: e.note,
    }));
}
