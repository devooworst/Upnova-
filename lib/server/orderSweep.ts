import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { notify } from "@/lib/server/notify";
import { protectionRules } from "@/lib/protection";
import { logOrderEvent } from "@/lib/server/orderEvents";
import type { OrderTracking } from "@/lib/products";

/* ------------------------------------------------------------------ */
/*  Order lifecycle sweep — the PAYOUT TIMER.                          */
/*                                                                     */
/*  Two time-driven transitions that used to run only lazily inside    */
/*  GET /api/orders (i.e. only when a party happened to open their     */
/*  orders page — a seller who never looked never got paid):           */
/*                                                                     */
/*   · shipped → delivered      when the carrier ETA passes; starts    */
/*     the buyer-protection window                                     */
/*   · delivered → completed    when the protection window ends with   */
/*     no open dispute; RELEASES the held payment                      */
/*                                                                     */
/*  Now callable from the cron tick (all orders) AND still from the    */
/*  orders page (that user's rows, for instant UI freshness).          */
/*                                                                     */
/*  IDEMPOTENCY: each transition is a status-guarded state machine —   */
/*  an order can only pass shipped→delivered and delivered→completed   */
/*  once; the payment release targets status="held" rows only, so a    */
/*  second sweep (or a concurrent page load) finds nothing to do.      */
/*  Failures mid-sweep are safe: the next run re-examines the same     */
/*  conditions.                                                        */
/* ------------------------------------------------------------------ */

type OrderRow = typeof tables.orders.$inferSelect;

export async function sweepOrderRows(rows: OrderRow[]): Promise<{ delivered: number; released: number }> {
  const out = { delivered: 0, released: 0 };
  if (rows.length === 0) return out;

  // open disputes freeze everything
  const allDisputes = await db.select().from(tables.disputes).all();
  const hasOpenDispute = (orderId: string) =>
    allDisputes.some((d) => d.orderId === orderId && ["open", "under_review", "return_authorized", "return_in_transit"].includes(d.status));

  for (const o of rows) {
    // carrier confirms delivery (demo: ETA passed) → the buyer-protection
    // window STARTS. No eternal manual confirmation required.
    if (o.status === "shipped") {
      try {
        const t = JSON.parse(o.tracking) as OrderTracking;
        if (t.eta && new Date(t.eta).getTime() < Date.now()) {
          const rules = protectionRules(o.price * o.qty);
          const ends = new Date(Date.now() + rules.protectionHours * 3600_000);
          await db.update(tables.orders).set({ status: "delivered", protectionEndsAt: ends }).where(eq(tables.orders.id, o.id)).run();
          o.status = "delivered";
          o.protectionEndsAt = ends;
          await logOrderEvent(o.id, null, "delivered", "Carrier confirmed delivery");
          await logOrderEvent(o.id, null, "protection_started", `${rules.protectionHours}h buyer-protection window`);
          await notify({
            userId: o.buyerId,
            actorId: o.sellerId,
            type: "order",
            title: `Delivered — ${o.title}`,
            body: `Everything good? Confirm anytime — otherwise the order completes automatically when your ${rules.protectionHours}h protection window ends. Problems? Report them before then.`,
            href: "/orders",
          });
          out.delivered++;
        }
      } catch {}
    }
    // protection window over + no open case → auto-complete, release funds
    if (o.status === "delivered" && o.protectionEndsAt && o.protectionEndsAt.getTime() < Date.now() && !hasOpenDispute(o.id)) {
      await db.update(tables.orders).set({ status: "completed" }).where(eq(tables.orders.id, o.id)).run();
      await db.update(tables.payments)
        .set({ status: "released" })
        .where(and(eq(tables.payments.orderId, o.id), eq(tables.payments.status, "held")))
        .run();
      o.status = "completed";
      await logOrderEvent(o.id, null, "completed", "Protection window ended with no reported problem — funds released");
      await notify({ userId: o.sellerId, actorId: o.buyerId, type: "payment", title: `Order completed — $${o.price * o.qty} released`, body: `${o.title} · protection window ended with no reported problems`, href: "/orders", category: "payments" });
      out.released++;
    }
  }
  return out;
}

/** Sweep EVERY order still in a time-driven state — the cron entry point. */
export async function sweepAllOrders(): Promise<{ delivered: number; released: number }> {
  const rows = (await db.select().from(tables.orders).all()).filter((o) => o.status === "shipped" || o.status === "delivered");
  return sweepOrderRows(rows);
}
