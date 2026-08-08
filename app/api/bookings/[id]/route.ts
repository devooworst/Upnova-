import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import { seedConfirmsBookingPayment } from "@/lib/server/demo";
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
  return guarded(() => {
    const user = requireUser();
    const b = db.select().from(tables.bookings).where(eq(tables.bookings.id, params.id)).get();
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

    const set = (patch: Partial<typeof tables.bookings.$inferInsert>) =>
      db.update(tables.bookings).set(patch).where(eq(tables.bookings.id, b.id)).run();

    // booking events post into the shared conversation, like project events
    const sys = (text: string) => {
      if (!b.conversationId) return;
      db.insert(tables.messages)
        .values({ id: rb(12).toString("hex"), conversationId: b.conversationId, senderId: user.id, body: text, kind: "system" })
        .run();
      db.update(tables.conversations).set({ updatedAt: new Date() }).where(eq(tables.conversations.id, b.conversationId)).run();
    };

    if (action === "accept") {
      if (!isProvider) throw new ApiError(403, "Only the provider accepts requests");
      if (b.status !== "pending") throw new ApiError(409, `Cannot accept from ${b.status}`);
      set({ status: "accepted" });
      sys(`${actorName} accepted the booking request — ${b.title} · ${when(b.startsAt)}. Payment locks it in.`);
      notify({ userId: other, actorId: user.id, type: "booking", title: `${actorName} accepted your booking`, body: `${b.title} · ${when(b.startsAt)} — payment pending`, href: "/calendar" });
    } else if (action === "decline") {
      if (!isProvider) throw new ApiError(403, "Only the provider declines requests");
      if (b.status !== "pending") throw new ApiError(409, `Cannot decline from ${b.status}`);
      set({ status: "cancelled" });
      notify({ userId: other, actorId: user.id, type: "booking", title: `${actorName} declined your booking request`, body: b.title, href: "/calendar", priority: "normal" });
    } else if (action === "pay") {
      if (!isClient) throw new ApiError(403, "Only the client pays");
      if (b.status !== "accepted") throw new ApiError(409, `Cannot pay from ${b.status}`);
      const amountCents = b.price * 100;
      db.insert(tables.payments)
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
      set({ status: "confirmed" });
      sys(`Booking confirmed — ${b.title} · ${when(b.startsAt)}. Payment secured: $${(b.price * 1.05).toFixed(2)}.`);
      notify({ userId: other, actorId: user.id, type: "payment", title: `Booking confirmed — payment secured`, body: `${b.title} · ${when(b.startsAt)} · $${b.price}`, href: "/calendar", category: "payments" });
      // demo mode: the seed provider confirms in chat right away
      seedConfirmsBookingPayment(b.id);
    } else if (action === "cancel") {
      if (!["pending", "accepted", "confirmed", "reschedule_requested"].includes(b.status))
        throw new ApiError(409, `Cannot cancel from ${b.status}`);
      // secured payment refunds in full on cancellation
      db.update(tables.payments)
        .set({ status: "refunded" })
        .where(and(eq(tables.payments.bookingId, b.id), eq(tables.payments.status, "held")))
        .run();
      set({ status: "cancelled", proposedStartsAt: null });
      sys(`${actorName} cancelled the booking — ${b.title}.${b.status === "confirmed" ? " Payment refunded in full." : ""}`);
      notify({ userId: other, actorId: user.id, type: "booking", title: `${actorName} cancelled ${b.title}`, body: b.status === "confirmed" ? "Payment refunded in full" : when(b.startsAt), href: "/calendar" });
    } else if (action === "reschedule_request") {
      if (!["accepted", "confirmed"].includes(b.status)) throw new ApiError(409, `Cannot reschedule from ${b.status}`);
      const newStart = new Date(body.newStartsAt);
      if (isNaN(newStart.getTime()) || newStart.getTime() < Date.now()) throw new ApiError(400, "Pick a future time");
      set({ status: "reschedule_requested", proposedStartsAt: newStart });
      notify({ userId: other, actorId: user.id, type: "booking", title: `${actorName} requested a reschedule`, body: `${b.title} → ${when(newStart)}`, href: "/calendar" });
    } else if (action === "reschedule_decide") {
      if (b.status !== "reschedule_requested" || !b.proposedStartsAt) throw new ApiError(409, "No reschedule pending");
      const hasPayment = !!db
        .select()
        .from(tables.payments)
        .where(and(eq(tables.payments.bookingId, b.id), eq(tables.payments.status, "held")))
        .get();
      if (body.approve) {
        set({ startsAt: b.proposedStartsAt, proposedStartsAt: null, status: hasPayment ? "confirmed" : "accepted" });
        notify({ userId: other, actorId: user.id, type: "booking", title: "Reschedule approved", body: `${b.title} · ${when(b.proposedStartsAt)}`, href: "/calendar" });
      } else {
        set({ proposedStartsAt: null, status: hasPayment ? "confirmed" : "accepted" });
        notify({ userId: other, actorId: user.id, type: "booking", title: "Reschedule declined — original time stands", body: `${b.title} · ${when(b.startsAt)}`, href: "/calendar" });
      }
    } else if (action === "complete") {
      if (!isProvider) throw new ApiError(403, "Only the provider marks a booking complete");
      if (b.status !== "confirmed") throw new ApiError(409, `Cannot complete from ${b.status}`);
      db.update(tables.payments)
        .set({ status: "released" })
        .where(and(eq(tables.payments.bookingId, b.id), eq(tables.payments.status, "held")))
        .run();
      set({ status: "completed" });
      sys(`${b.title} completed — payout of $${b.price} released to ${actorName}.`);
      notify({ userId: other, actorId: user.id, type: "payment", title: `${b.title} completed — $${b.price} released`, body: "", href: "/calendar", category: "payments" });
    } else {
      throw new ApiError(400, "Unknown action");
    }

    const fresh = db.select().from(tables.bookings).where(eq(tables.bookings.id, b.id)).get()!;
    return { status: fresh.status };
  });
}
