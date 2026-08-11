import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import { logOrderEvent, orderTimeline } from "@/lib/server/orderEvents";
import { PROBLEM_REASONS, RETURN_REASONS, PROTECTED_REASONS, parseReturnPolicy, protectionRules } from "@/lib/protection";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  Disputes & returns — two-sided, evidence-based, never automatic.   */
/*  Opening a dispute FREEZES the payout (auto-complete stops). Both   */
/*  parties submit evidence; returns can resolve between the parties;  */
/*  contested cases go to platform review. Nobody wins by default.     */
/* ------------------------------------------------------------------ */

const openStates = ["open", "under_review", "return_authorized", "return_in_transit"];

function getOrder(id: string, userId: string) {
  const o = db.select().from(tables.orders).where(eq(tables.orders.id, id)).get();
  if (!o) throw new ApiError(404, "Order not found");
  if (o.buyerId !== userId && o.sellerId !== userId) throw new ApiError(403, "Not your order");
  return o;
}

function activeDispute(orderId: string) {
  return db
    .select()
    .from(tables.disputes)
    .where(eq(tables.disputes.orderId, orderId))
    .orderBy(desc(tables.disputes.createdAt))
    .all()
    .find((d) => openStates.includes(d.status));
}

function pushEvidence(dispute: typeof tables.disputes.$inferSelect, by: string, note: string, photos: unknown) {
  const list = (() => { try { return JSON.parse(dispute.evidence); } catch { return []; } })();
  list.push({
    by,
    at: new Date().toISOString(),
    note: String(note || "").slice(0, 1000),
    photos: Array.isArray(photos)
      ? photos.filter((p: unknown) => typeof p === "string" && (p as string).startsWith("data:image/") && (p as string).length < 500_000).slice(0, 3)
      : [],
  });
  db.update(tables.disputes).set({ evidence: JSON.stringify(list) }).where(eq(tables.disputes.id, dispute.id)).run();
}

/** GET — the private evidence timeline + dispute detail (parties only). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const user = requireUser();
    const o = getOrder(params.id, user.id);
    const dispute = db
      .select()
      .from(tables.disputes)
      .where(eq(tables.disputes.orderId, o.id))
      .orderBy(desc(tables.disputes.createdAt))
      .get();
    const sellerEv = (() => { try { return JSON.parse(o.sellerEvidence); } catch { return {}; } })();
    return {
      timeline: orderTimeline(o.id),
      dispute: dispute
        ? {
            id: dispute.id,
            kind: dispute.kind,
            reason: dispute.reason,
            status: dispute.status,
            openedByMe: dispute.openedById === user.id,
            returnTracking: dispute.returnTracking,
            resolutionNote: dispute.resolutionNote,
            evidence: (() => {
              try {
                const names = new Map(db.select().from(tables.profiles).all().map((p) => [p.userId, p.displayName]));
                return (JSON.parse(dispute.evidence) as { by: string; at: string; note: string; photos: string[] }[]).map((e) => ({
                  ...e,
                  by: names.get(e.by) ?? "—",
                }));
              } catch { return []; }
            })(),
          }
        : null,
      // seller's shipment evidence: the SELLER sees everything they filed;
      // the buyer sees THAT it exists (serial masked) — privacy by design
      sellerEvidence:
        o.sellerId === user.id
          ? sellerEv
          : { ...sellerEv, serial: sellerEv.serial ? "recorded — visible to platform review" : undefined },
    };
  });
}

/** POST — buyer opens a problem report or a return request. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const o = getOrder(params.id, user.id);
    if (o.buyerId !== user.id) throw new ApiError(403, "Only the buyer opens problem reports and returns");
    if (o.status === "cancelled") throw new ApiError(409, "Cancelled orders have nothing to dispute");
    if (activeDispute(o.id)) throw new ApiError(409, "There's already an open case on this order");

    const kind = body.kind === "return" ? "return" : "problem";
    const valid = (kind === "return" ? RETURN_REASONS : PROBLEM_REASONS).some((r) => r.id === body.reason);
    if (!valid) throw new ApiError(400, "Pick what happened");
    const reason = String(body.reason);

    if (kind === "problem" && ["placed"].includes(o.status))
      throw new ApiError(409, "Nothing has been paid yet — just cancel the order");

    // ordinary returns respect the SELLER's policy; platform-protected
    // reasons (non-delivery, wrong/damaged/counterfeit/misrepresented)
    // survive a "no returns" setting — that's the platform floor
    if (kind === "return" && !PROTECTED_REASONS.has(reason)) {
      const product = o.productId ? db.select().from(tables.products).where(eq(tables.products.id, o.productId)).get() : null;
      const policy = parseReturnPolicy(product?.returnPolicy);
      if (!policy.accepts)
        throw new ApiError(409, "This seller doesn't accept ordinary returns (platform protection still covers non-delivery and misrepresented/defective items)");
      const deliveredAt = o.protectionEndsAt
        ? o.protectionEndsAt.getTime() - protectionRules(o.price * o.qty).protectionHours * 3600_000
        : o.createdAt.getTime();
      if (Date.now() > deliveredAt + policy.windowDays * 86400_000)
        throw new ApiError(409, `The ${policy.windowDays}-day return window has closed`);
    }

    const id = randomBytes(12).toString("hex");
    db.insert(tables.disputes)
      .values({ id, orderId: o.id, openedById: user.id, kind, reason, status: "open" })
      .run();
    const d = db.select().from(tables.disputes).where(eq(tables.disputes.id, id)).get()!;
    if (body.note || body.photos) pushEvidence(d, user.id, String(body.note || ""), body.photos);

    logOrderEvent(o.id, user.id, kind === "return" ? "return_requested" : "disputed", reason);
    const label = (kind === "return" ? RETURN_REASONS : PROBLEM_REASONS).find((r) => r.id === reason)!.label;
    notify({
      userId: o.sellerId,
      actorId: user.id,
      type: "order",
      title: kind === "return" ? `Return requested — ${o.title}` : `Problem reported — ${o.title}`,
      body: `"${label}" — respond with your evidence in Orders. Funds stay held while the case is open.`,
      href: "/orders",
      priority: "high",
    });
    return { id, status: "open" };
  });
}

/** PATCH — dispute actions: evidence, seller response, return flow, withdraw. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const o = getOrder(params.id, user.id);
    const d = activeDispute(o.id);
    if (!d) throw new ApiError(404, "No open case on this order");
    const isBuyer = o.buyerId === user.id;
    const isSeller = o.sellerId === user.id;
    const action = String(body.action);
    const set = (patch: Partial<typeof tables.disputes.$inferInsert>) =>
      db.update(tables.disputes).set(patch).where(eq(tables.disputes.id, d.id)).run();
    const other = isBuyer ? o.sellerId : o.buyerId;

    if (action === "add_evidence") {
      pushEvidence(d, user.id, String(body.note || ""), body.photos);
      logOrderEvent(o.id, user.id, "evidence", String(body.note || "").slice(0, 80));
      notify({ userId: other, actorId: user.id, type: "order", title: `New evidence — ${o.title}`, body: "Review it in Orders.", href: "/orders", priority: "normal" });
      return { ok: true };
    }

    if (action === "approve_return") {
      if (!isSeller) throw new ApiError(403, "Only the seller approves returns");
      if (!["open", "under_review"].includes(d.status)) throw new ApiError(409, `Cannot approve from "${d.status}"`);
      set({ status: "return_authorized" });
      logOrderEvent(o.id, user.id, "return_authorized", String(body.note || ""));
      notify({ userId: other, actorId: user.id, type: "order", title: `Return approved — ${o.title}`, body: `Ship it back and add the tracking in Orders.${body.note ? ` ${String(body.note).slice(0, 100)}` : ""}`, href: "/orders" });
      return { status: "return_authorized" };
    }

    if (action === "refute") {
      if (!isSeller) throw new ApiError(403, "Only the seller contests a case");
      if (d.status !== "open") throw new ApiError(409, `Cannot contest from "${d.status}"`);
      pushEvidence(d, user.id, String(body.note || "Seller contests the claim."), body.photos);
      set({ status: "under_review" });
      logOrderEvent(o.id, user.id, "escalated", "Seller contested — sent to platform review");
      notify({ userId: other, actorId: user.id, type: "order", title: `Case under review — ${o.title}`, body: "The seller contested with evidence. Mavyn will review both sides.", href: "/orders" });
      return { status: "under_review" };
    }

    if (action === "escalate") {
      // buyer sends an unanswered/authorized-but-stuck case to review
      if (!isBuyer) throw new ApiError(403, "Only the buyer escalates");
      if (!["open", "return_authorized", "return_in_transit"].includes(d.status)) throw new ApiError(409, `Cannot escalate from "${d.status}"`);
      set({ status: "under_review" });
      logOrderEvent(o.id, user.id, "escalated", "Buyer escalated to platform review");
      return { status: "under_review" };
    }

    if (action === "mark_returned") {
      if (!isBuyer) throw new ApiError(403, "Only the buyer ships the return");
      if (d.status !== "return_authorized") throw new ApiError(409, `Cannot mark returned from "${d.status}"`);
      const code = String(body.code || "").slice(0, 40);
      if (protectionRules(o.price * o.qty).returnTrackingRequired && !code)
        throw new ApiError(400, "Return tracking is required for this order value");
      set({ status: "return_in_transit", returnTracking: code ? `${String(body.carrier || "Carrier").slice(0, 20)} · ${code}` : "" });
      logOrderEvent(o.id, user.id, "return_shipped", code ? `Tracking ${code}` : "");
      notify({ userId: other, actorId: user.id, type: "order", title: `Return shipped — ${o.title}`, body: code ? `Tracking ${code}. Confirm when it arrives.` : "Confirm when it arrives.", href: "/orders" });
      return { status: "return_in_transit" };
    }

    if (action === "confirm_return_received") {
      if (!isSeller) throw new ApiError(403, "Only the seller confirms the return arrived");
      if (d.status !== "return_in_transit") throw new ApiError(409, `Cannot confirm from "${d.status}"`);
      // refund: full for platform-protected reasons; ordinary returns may
      // carry the DISCLOSED restocking fee from the pre-checkout policy
      const product = o.productId ? db.select().from(tables.products).where(eq(tables.products.id, o.productId)).get() : null;
      const policy = parseReturnPolicy(product?.returnPolicy);
      const ordinary = d.kind === "return" && !PROTECTED_REASONS.has(d.reason);
      const pct = ordinary ? 100 - policy.restockingPct : 100;
      db.update(tables.payments)
        .set({ status: "refunded" })
        .where(and(eq(tables.payments.orderId, o.id), eq(tables.payments.status, "held")))
        .run();
      if (product)
        db.update(tables.products)
          .set({ sold: Math.max(0, product.sold - o.qty), status: product.status === "sold_out" ? "active" : product.status })
          .where(eq(tables.products.id, product.id))
          .run();
      db.update(tables.orders).set({ status: "cancelled" }).where(eq(tables.orders.id, o.id)).run();
      set({ status: "resolved_refund", resolvedAt: new Date(), resolutionNote: pct < 100 ? `Refunded ${pct}% per the disclosed restocking policy` : "Refunded in full after return received" });
      logOrderEvent(o.id, user.id, "refunded", `Return received — refund ${pct}%`);
      notify({ userId: other, actorId: user.id, type: "payment", title: `Refund processed — ${o.title}`, body: pct < 100 ? `${pct}% refunded per the disclosed restocking policy.` : "Refunded in full.", href: "/orders", category: "payments" });
      return { status: "resolved_refund" };
    }

    if (action === "withdraw") {
      if (d.openedById !== user.id) throw new ApiError(403, "Only whoever opened the case can withdraw it");
      set({ status: "withdrawn", resolvedAt: new Date() });
      logOrderEvent(o.id, user.id, "withdrawn", "");
      notify({ userId: other, actorId: user.id, type: "order", title: `Case withdrawn — ${o.title}`, body: "The order continues normally.", href: "/orders", priority: "normal" });
      return { status: "withdrawn" };
    }

    throw new ApiError(400, "Unknown action");
  });
}
