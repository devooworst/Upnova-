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
