/* ------------------------------------------------------------------ */
/*  Opportunity role flow — selection → acceptance → scheduled booking */
/*  Shared by the applicant's accept endpoint and Demo Mode (seed      */
/*  applicants accept instantly). Acceptance produces a REAL booking:  */
/*  the participant sees it on their calendar, the poster pays through */
/*  the normal booking payment flow (secured → completed → released).  */
/* ------------------------------------------------------------------ */

import { randomBytes } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import { parseRoles } from "@/lib/opportunityRoles";
import { parseOffer, cycleLabel, type EngagementOffer } from "@/lib/engagement";

const rid = () => randomBytes(12).toString("hex");

/** Find (or create) the direct conversation between two users. */
export function conversationBetween(a: string, b: string): string {
  const mine = db
    .select()
    .from(tables.conversationMembers)
    .where(eq(tables.conversationMembers.userId, a))
    .all()
    .map((m) => m.conversationId);
  if (mine.length) {
    const shared = db
      .select()
      .from(tables.conversationMembers)
      .where(inArray(tables.conversationMembers.conversationId, mine))
      .all();
    const byConv = new Map<string, string[]>();
    for (const m of shared) {
      if (!byConv.has(m.conversationId)) byConv.set(m.conversationId, []);
      byConv.get(m.conversationId)!.push(m.userId);
    }
    for (const [convId, members] of Array.from(byConv.entries()))
      if (members.length === 2 && members.includes(b)) return convId;
  }
  const convId = rid();
  db.insert(tables.conversations).values({ id: convId }).run();
  db.insert(tables.conversationMembers)
    .values([{ conversationId: convId, userId: a }, { conversationId: convId, userId: b }])
    .run();
  return convId;
}

/**
 * The applicant accepts a role offer. Creates the scheduled engagement:
 * a booking in "accepted" state (participant confirmed — the poster's
 * payment locks it in), linked to the shared conversation.
 */
export function acceptRoleOffer(applicationId: string) {
  const app = db.select().from(tables.applications).where(eq(tables.applications.id, applicationId)).get();
  if (!app) throw new ApiError(404, "Application not found");
  if (app.status !== "selected") throw new ApiError(409, `Nothing to accept from "${app.status}"`);
  const opp = db.select().from(tables.opportunities).where(eq(tables.opportunities.id, app.opportunityId)).get()!;

  // engagement offers (configurable terms) take precedence over role offers
  const engOffer = parseOffer(app.offer);
  if (engOffer) return acceptEngagementOffer(app, opp, engOffer);

  const role = parseRoles(opp.roles).find((r) => r.id === app.roleId);
  if (!role) throw new ApiError(409, "This offer isn't tied to a role");

  db.update(tables.applications).set({ status: "confirmed" }).where(eq(tables.applications.id, app.id)).run();

  const convId = conversationBetween(opp.posterId, app.applicantId);
  // schedule: the opportunity's event date (afternoon default) or a week out
  const base = opp.eventDate ?? new Date(Date.now() + 7 * 86400_000);
  const startsAt = new Date(base);
  if (startsAt.getHours() === 0) startsAt.setHours(14, 0, 0, 0);

  const bookingId = rid();
  db.insert(tables.bookings)
    .values({
      id: bookingId,
      serviceId: null,
      clientId: opp.posterId, // the poster pays
      providerId: app.applicantId, // the participant performs
      title: `${role.title} — ${opp.title}`,
      startsAt,
      durationMin: 240,
      price: role.pay ?? 0,
      items: JSON.stringify([{ label: `${role.title} · ${opp.title}`, amount: role.pay ?? 0 }]),
      location: opp.remote ? "Remote" : opp.location,
      status: "accepted", // participant confirmed — payment (client) locks it
      conversationId: convId,
    })
    .run();

  const applicant = db.select().from(tables.profiles).where(eq(tables.profiles.userId, app.applicantId)).get();
  db.insert(tables.messages)
    .values({
      id: rid(),
      conversationId: convId,
      senderId: app.applicantId,
      kind: "system",
      body: `${applicant?.displayName ?? "Participant"} accepted the ${role.title} role for "${opp.title}" — ${startsAt.toLocaleDateString("en-US", { month: "long", day: "numeric" })}${role.pay ? ` · $${role.pay}` : ""}. Payment secures the booking.`,
    })
    .run();
  db.update(tables.conversations).set({ updatedAt: new Date() }).where(eq(tables.conversations.id, convId)).run();

  notify({
    userId: opp.posterId,
    actorId: app.applicantId,
    type: "booking",
    title: `${applicant?.displayName ?? "An applicant"} accepted — ${role.title}`,
    body: `${opp.title}${role.pay ? ` · $${role.pay}` : ""} — pay to secure the booking`,
    href: `/opportunities/${opp.id}/applicants`,
  });

  return { bookingId, conversationId: convId };
}

/** The applicant turns the offer down — the opening frees up. */
export function declineRoleOffer(applicationId: string, userId: string) {
  const app = db.select().from(tables.applications).where(eq(tables.applications.id, applicationId)).get();
  if (!app) throw new ApiError(404, "Application not found");
  if (app.applicantId !== userId) throw new ApiError(403, "Not your application");
  if (app.status !== "selected") throw new ApiError(409, `Nothing to decline from "${app.status}"`);
  const opp = db.select().from(tables.opportunities).where(eq(tables.opportunities.id, app.opportunityId)).get()!;
  db.update(tables.applications).set({ status: "offer_declined" }).where(eq(tables.applications.id, app.id)).run();
  const applicant = db.select().from(tables.profiles).where(eq(tables.profiles.userId, userId)).get();
  notify({
    userId: opp.posterId,
    actorId: userId,
    type: "application",
    title: `${applicant?.displayName ?? "An applicant"} declined the offer`,
    body: `${opp.title} — the opening is available again`,
    href: `/opportunities/${opp.id}/applicants`,
    priority: "normal",
  });
  return { declined: true };
}

/* --------------------- ongoing engagements (offers) --------------------- */

/**
 * Accepting a configurable engagement offer.
 * · external_employment → ACTIVE relationship, clearly labeled as handled
 *   by the employer OUTSIDE Mavyn — no Mavyn payment pretense.
 * · mavyn_freelance one-time → a single booking (existing machinery).
 * · mavyn_freelance ongoing → ACTIVE + the first paid CYCLE as a booking;
 *   each cycle runs secured → completed → released, visibly.
 */
function acceptEngagementOffer(
  app: typeof tables.applications.$inferSelect,
  opp: typeof tables.opportunities.$inferSelect,
  offer: EngagementOffer
) {
  const convId = conversationBetween(opp.posterId, app.applicantId);
  const applicant = db.select().from(tables.profiles).where(eq(tables.profiles.userId, app.applicantId)).get();
  const name = applicant?.displayName ?? "Applicant";

  if (offer.classification === "external_employment") {
    db.update(tables.applications).set({ status: "active" }).where(eq(tables.applications.id, app.id)).run();
    db.insert(tables.messages)
      .values({
        id: rid(), conversationId: convId, senderId: app.applicantId, kind: "system",
        body: `${name} accepted the ${offer.title} offer — external employment: compensation and payroll are handled by the employer OUTSIDE Mavyn.`,
      })
      .run();
    db.update(tables.conversations).set({ updatedAt: new Date() }).where(eq(tables.conversations.id, convId)).run();
    notify({
      userId: opp.posterId, actorId: app.applicantId, type: "application",
      title: `${name} accepted — ${offer.title}`,
      body: "External employment — handled outside Mavyn.",
      href: `/opportunities/${opp.id}/applicants`,
    });
    return { status: "active", conversationId: convId, external: true };
  }

  if (offer.engagementType === "one_time") {
    // single engagement: one booking, one payment — existing machinery
    const startsAt = offer.startDate ? new Date(offer.startDate) : new Date(Date.now() + 7 * 86400_000);
    if (startsAt.getHours() === 0) startsAt.setHours(14, 0, 0, 0);
    const bookingId = rid();
    db.insert(tables.bookings)
      .values({
        id: bookingId, serviceId: null, clientId: opp.posterId, providerId: app.applicantId,
        title: `${offer.title} — ${opp.title}`, startsAt, durationMin: 240, price: offer.amount,
        items: JSON.stringify([{ label: `${offer.title} · ${opp.title}`, amount: offer.amount }]),
        location: opp.remote ? "Remote" : opp.location, status: "accepted", conversationId: convId,
      })
      .run();
    db.update(tables.applications).set({ status: "confirmed" }).where(eq(tables.applications.id, app.id)).run();
    db.insert(tables.messages)
      .values({ id: rid(), conversationId: convId, senderId: app.applicantId, kind: "system",
        body: `${name} accepted the ${offer.title} offer — $${offer.amount}. Payment secures the engagement.` })
      .run();
    db.update(tables.conversations).set({ updatedAt: new Date() }).where(eq(tables.conversations.id, convId)).run();
    notify({ userId: opp.posterId, actorId: app.applicantId, type: "booking",
      title: `${name} accepted — ${offer.title}`, body: `$${offer.amount} — pay to secure`, href: "/calendar" });
    return { status: "confirmed", bookingId, conversationId: convId };
  }

  // ongoing: ACTIVE + first paid cycle
  db.update(tables.applications).set({ status: "active" }).where(eq(tables.applications.id, app.id)).run();
  const { bookingId } = startEngagementCycle(app.id);
  db.insert(tables.messages)
    .values({ id: rid(), conversationId: convId, senderId: app.applicantId, kind: "system",
      body: `${name} accepted the ${offer.title} offer — ${offer.engagementType.replace("_", "-")} · $${offer.amount} per ${cycleLabel(offer.compModel)}. Cycle 1 is ready — payment secures it.` })
    .run();
  db.update(tables.conversations).set({ updatedAt: new Date() }).where(eq(tables.conversations.id, convId)).run();
  notify({ userId: opp.posterId, actorId: app.applicantId, type: "booking",
    title: `${name} accepted — ${offer.title}`,
    body: `Ongoing engagement active · $${offer.amount} per ${cycleLabel(offer.compModel)} — secure cycle 1`, href: "/calendar" });
  return { status: "active", bookingId, conversationId: convId };
}

/**
 * Start the next paid cycle of an ACTIVE engagement: one booking per cycle,
 * each with its own secured → completed → released payment. Poster-driven.
 */
export function startEngagementCycle(applicationId: string) {
  const app = db.select().from(tables.applications).where(eq(tables.applications.id, applicationId)).get();
  if (!app) throw new ApiError(404, "Application not found");
  if (app.status !== "active") throw new ApiError(409, "Engagement isn't active");
  const offer = parseOffer(app.offer);
  if (!offer) throw new ApiError(409, "No offer terms on file");
  if (offer.classification === "external_employment")
    throw new ApiError(409, "External employment — compensation is handled outside Mavyn");
  const opp = db.select().from(tables.opportunities).where(eq(tables.opportunities.id, app.opportunityId)).get()!;

  const n = (offer.cycles ?? 0) + 1;
  const convId = conversationBetween(opp.posterId, app.applicantId);
  const startsAt =
    n === 1 && offer.startDate ? new Date(offer.startDate) : new Date(Date.now() + 2 * 86400_000);
  if (startsAt.getHours() === 0) startsAt.setHours(10, 0, 0, 0);

  const bookingId = rid();
  db.insert(tables.bookings)
    .values({
      id: bookingId, serviceId: null, clientId: opp.posterId, providerId: app.applicantId,
      title: `${offer.title} — ${cycleLabel(offer.compModel)} ${n}`,
      startsAt, durationMin: 60, price: offer.amount,
      items: JSON.stringify([{ label: `${offer.title} · ${cycleLabel(offer.compModel)} ${n}`, amount: offer.amount }]),
      location: opp.remote ? "Remote" : opp.location, status: "accepted", conversationId: convId,
    })
    .run();
  db.update(tables.applications)
    .set({ offer: JSON.stringify({ ...offer, cycles: n }) })
    .where(eq(tables.applications.id, app.id))
    .run();
  return { bookingId, cycle: n, conversationId: convId };
}
