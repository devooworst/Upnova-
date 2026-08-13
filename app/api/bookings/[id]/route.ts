import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import { seedConfirmsBookingPayment } from "@/lib/server/demo";
import { parseConfig, cancellationLabel } from "@/lib/servicePolicies";
import { randomBytes as rb } from "crypto";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/bookings/[id] { action, ... } — the booking lifecycle.
 * pending → accepted → confirmed → completed, with cancelled and
 * reschedule_requested. Role-checked and sequence-checked server-side,
 * exactly like projects.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const b = await db.select().from(tables.bookings).where(eq(tables.bookings.id, params.id)).get();
    if (!b) throw new ApiError(404, "Booking not found");
    const isProvider = b.providerId === user.id;
    const isClient = b.clientId === user.id;
    if (!isProvider && !isClient) throw new ApiError(403, "Not your booking");

    const other = isProvider ? b.clientId : b.providerId;
    const actorName = user.profile.displayName;
    const action = String(body.action);
    const when = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " · " +
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    const set = async (patch: Partial<typeof tables.bookings.$inferInsert>) =>
      await db.update(tables.bookings).set(patch).where(eq(tables.bookings.id, b.id)).run();

    // booking events post into the shared conversation, like project events
    const sys = async (text: string) => {
      if (!b.conversationId) return;
      await db.insert(tables.messages)
        .values({ id: rb(12).toString("hex"), conversationId: b.conversationId, senderId: user.id, body: text, kind: "system" })
        .run();
      await db.update(tables.conversations).set({ updatedAt: new Date() }).where(eq(tables.conversations.id, b.conversationId)).run();
    };

    if (action === "accept") {
      if (!isProvider) throw new ApiError(403, "Only the provider accepts requests");
      if (b.status !== "pending") throw new ApiError(409, `Cannot accept from ${b.status}`);
      await set({ status: "accepted" });
      await sys(`${actorName} accepted the booking request — ${b.title} · ${when(b.startsAt)}. Payment locks it in.`);
      await notify({ userId: other, actorId: user.id, type: "booking", title: `${actorName} accepted your booking`, body: `${b.title} · ${when(b.startsAt)} — payment pending`, href: "/calendar" });
    } else if (action === "decline") {
      if (!isProvider) throw new ApiError(403, "Only the provider declines requests");
      if (b.status !== "pending") throw new ApiError(409, `Cannot decline from ${b.status}`);
      await set({ status: "cancelled" });
      await notify({ userId: other, actorId: user.id, type: "booking", title: `${actorName} declined your booking request`, body: b.title, href: "/calendar", priority: "normal" });
    } else if (action === "pay") {
      if (!isClient) throw new ApiError(403, "Only the client pays");
      if (b.status !== "accepted") throw new ApiError(409, `Cannot pay from ${b.status}`);
      // transaction authentication: the client approves a SPECIFIC amount.
      // If anything changed since the summary was shown, refuse and re-show.
      if (body.expectedTotal != null) {
        const expectCents = Math.round(Number(body.expectedTotal) * 100);
        const actualCents = Math.round((b.price + b.travelFee) * 105);
        if (expectCents !== actualCents)
          throw new ApiError(409, `The total changed since you reviewed it — it is now $${(actualCents / 100).toFixed(2)}. Review the summary before paying.`);
      }
      // total = selected menu items + creator-defined travel fee, all disclosed pre-pay
      const amountCents = (b.price + b.travelFee) * 100;
      await db.insert(tables.payments)
        .values({
          id: randomBytes(12).toString("hex"),
          bookingId: b.id,
          payerId: b.clientId,
          payeeId: b.providerId,
          amountCents,
          feeCents: Math.round(amountCents * 0.05),
          status: "held",
        })
        .run();
      await set({ status: "confirmed" });
      // itemized receipt into the shared conversation — the frozen snapshot
      const items: { label: string; amount: number | null }[] = (() => {
        try { return JSON.parse(b.items); } catch { return []; }
      })();
      const itemized = items.length
        ? items.map((l) => `${l.label} ${l.amount == null ? "(quoted separately)" : `$${l.amount}`}`).join(" · ") + (b.travelFee ? ` · Travel $${b.travelFee}` : "")
        : "";
      await sys(
        `Booking confirmed — ${b.title} · ${when(b.startsAt)}. Payment secured: $${((b.price + b.travelFee) * 1.05).toFixed(2)}.${itemized ? ` Includes: ${itemized}.` : b.travelFee ? ` (incl. $${b.travelFee} travel)` : ""}`
      );
      await notify({ userId: other, actorId: user.id, type: "payment", title: `Booking confirmed — payment secured`, body: `${b.title} · ${when(b.startsAt)} · $${b.price}`, href: "/calendar", category: "payments" });
      // demo mode: the seed provider confirms in chat right away
      await seedConfirmsBookingPayment(b.id);
    } else if (action === "cancel") {
      if (!["pending", "accepted", "confirmed", "reschedule_requested"].includes(b.status))
        throw new ApiError(409, `Cannot cancel from ${b.status}`);
      // refunds follow the CREATOR'S cancellation policy — which the
      // client saw before paying. Provider-initiated cancels always
      // refund in full.
      const svc = b.serviceId ? await db.select().from(tables.services).where(eq(tables.services.id, b.serviceId)).get() : null;
      const policy = parseConfig(svc?.config).policies;
      const hoursOut = (b.startsAt.getTime() - Date.now()) / 3600_000;
      const fullRefund =
        isProvider ||
        policy.cancellation === "anytime" ||
        (policy.cancellation === "free_24h" && hoursOut >= 24) ||
        (policy.cancellation === "partial_48h" && hoursOut >= 48) ||
        policy.cancellation === "custom";
      await db.update(tables.payments)
        .set({ status: fullRefund ? "refunded" : "released" })
        .where(and(eq(tables.payments.bookingId, b.id), eq(tables.payments.status, "held")))
        .run();
      const hadPayment = b.status === "confirmed";
      await set({ status: "cancelled", proposedStartsAt: null });
      await sys(
        `${actorName} cancelled the booking — ${b.title}.` +
          (hadPayment
            ? fullRefund
              ? " Payment refunded in full."
              : ` Late cancellation — per the policy (${cancellationLabel(policy)}), the payment was released to the provider.`
            : "")
      );
      await notify({ userId: other, actorId: user.id, type: "booking", title: `${actorName} cancelled ${b.title}`, body: hadPayment ? (fullRefund ? "Payment refunded in full" : "Late cancellation — payment released per policy") : when(b.startsAt), href: "/calendar" });
    } else if (action === "reschedule_request") {
      if (!["accepted", "confirmed"].includes(b.status)) throw new ApiError(409, `Cannot reschedule from ${b.status}`);
      const newStart = new Date(body.newStartsAt);
      if (isNaN(newStart.getTime()) || newStart.getTime() < Date.now()) throw new ApiError(400, "Pick a future time");
      await set({ status: "reschedule_requested", proposedStartsAt: newStart });
      await notify({ userId: other, actorId: user.id, type: "booking", title: `${actorName} requested a reschedule`, body: `${b.title} → ${when(newStart)}`, href: "/calendar" });
    } else if (action === "reschedule_decide") {
      if (b.status !== "reschedule_requested" || !b.proposedStartsAt) throw new ApiError(409, "No reschedule pending");
      const hasPayment = !!(await db
        .select()
        .from(tables.payments)
        .where(and(eq(tables.payments.bookingId, b.id), eq(tables.payments.status, "held")))
        .get());
      if (body.approve) {
        await set({ startsAt: b.proposedStartsAt, proposedStartsAt: null, status: hasPayment ? "confirmed" : "accepted" });
        await notify({ userId: other, actorId: user.id, type: "booking", title: "Reschedule approved", body: `${b.title} · ${when(b.proposedStartsAt)}`, href: "/calendar" });
      } else {
        await set({ proposedStartsAt: null, status: hasPayment ? "confirmed" : "accepted" });
        await notify({ userId: other, actorId: user.id, type: "booking", title: "Reschedule declined — original time stands", body: `${b.title} · ${when(b.startsAt)}`, href: "/calendar" });
      }
    } else if (action === "complete") {
      if (!isProvider) throw new ApiError(403, "Only the provider marks a booking complete");
      if (b.status !== "confirmed") throw new ApiError(409, `Cannot complete from ${b.status}`);
      await db.update(tables.payments)
        .set({ status: "released" })
        .where(and(eq(tables.payments.bookingId, b.id), eq(tables.payments.status, "held")))
        .run();
      await set({ status: "completed" });
      await sys(`${b.title} completed — the secured $${b.price + b.travelFee} was released to ${actorName} (the provider).`);
      await notify({ userId: other, actorId: user.id, type: "payment", title: `${b.title} completed — your secured $${b.price + b.travelFee} was released to the provider`, body: "", href: "/calendar", category: "payments" });
    } else {
      throw new ApiError(400, "Unknown action");
    }

    const fresh = (await db.select().from(tables.bookings).where(eq(tables.bookings.id, b.id)).get())!;
    return { status: fresh.status };
  });
}
