/* ------------------------------------------------------------------ */
/*  Business People + Hiring — relationship categorization over the    */
/*  REAL records. Four categories, kept separate on purpose:           */
/*                                                                     */
/*   TEAM     — explicit business_team rows only (never implied)       */
/*   CLIENTS  — people who booked/hired THIS account as the provider   */
/*   TALENT   — people THIS account hired (as client on bookings or    */
/*              projects, or via a hired opportunity application)      */
/*   CONTACTS — conversation partners with no hire/booking yet         */
/*                                                                     */
/*  One person can legitimately live in several categories (staff who  */
/*  also took a paid gig); what never happens is implicit promotion —  */
/*  a single hire NEVER makes someone an employee.                     */
/*  Everything here is PRIVATE to the account that owns the view.      */
/* ------------------------------------------------------------------ */

import { and, eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { parseBenefits } from "./preferred";

export const HIRED_APP_STATUSES = ["selected", "confirmed", "active", "completed"];
const ACTIVE_PROJECT_STATES = ["accepted", "in_progress", "extension_requested", "submitted", "approved"];
const DONE_PROJECT_STATES = ["completed", "reviewed"];

type Person = { id: string; handle: string; displayName: string; avatarUrl: string | null; primaryRole: string; skills: string[] };

async function person(userId: string): Promise<Person | null> {
  const u = await db.select().from(tables.users).where(eq(tables.users.id, userId)).get();
  const p = await db.select().from(tables.profiles).where(eq(tables.profiles.userId, userId)).get();
  if (!u || !p) return null;
  let skills: string[] = [];
  try {
    skills = JSON.parse(p.skills || "[]");
  } catch {}
  return { id: u.id, handle: u.handle, displayName: p.displayName, avatarUrl: p.avatarUrl, primaryRole: p.primaryRole, skills };
}

/** any real interaction between two accounts, either direction —
    the anti-spam basis for manual adds (team, preferred, …) */
export async function interactionBasis(a: string, b: string): Promise<boolean> {
  const bk = await db
    .select({ id: tables.bookings.id })
    .from(tables.bookings)
    .where(
      or(
        and(eq(tables.bookings.clientId, a), eq(tables.bookings.providerId, b)),
        and(eq(tables.bookings.clientId, b), eq(tables.bookings.providerId, a))
      )
    )
    .get();
  if (bk) return true;
  const pr = await db
    .select({ id: tables.projects.id })
    .from(tables.projects)
    .where(
      or(
        and(eq(tables.projects.clientId, a), eq(tables.projects.creatorId, b)),
        and(eq(tables.projects.clientId, b), eq(tables.projects.creatorId, a))
      )
    )
    .get();
  if (pr) return true;
  // an application on one side's opportunity
  for (const [poster, applicant] of [
    [a, b],
    [b, a],
  ] as const) {
    const app = await db
      .select({ app: tables.applications })
      .from(tables.applications)
      .innerJoin(tables.opportunities, eq(tables.applications.opportunityId, tables.opportunities.id))
      .where(and(eq(tables.opportunities.posterId, poster), eq(tables.applications.applicantId, applicant)))
      .get();
    if (app) return true;
  }
  // a shared two-person conversation
  for (const m of await db.select().from(tables.conversationMembers).where(eq(tables.conversationMembers.userId, a)).all()) {
    const other = await db
      .select()
      .from(tables.conversationMembers)
      .where(and(eq(tables.conversationMembers.conversationId, m.conversationId), eq(tables.conversationMembers.userId, b)))
      .get();
    if (other) return true;
  }
  return false;
}

/* ------------------------------ categories ------------------------------ */

export async function peopleFor(businessId: string) {
  const payments = await db
    .select()
    .from(tables.payments)
    .where(or(eq(tables.payments.payerId, businessId), eq(tables.payments.payeeId, businessId)))
    .all();

  /* ---- TEAM: explicit rows only ---- */
  const teamRows = await db.select().from(tables.businessTeam).where(eq(tables.businessTeam.businessId, businessId)).all();
  const team = (await Promise.all(teamRows
    .map(async (t) => {
      const p = await person(t.personId);
      if (!p) return null;
      const activeProjects = (await db
        .select()
        .from(tables.projects)
        .where(and(eq(tables.projects.clientId, businessId), eq(tables.projects.creatorId, t.personId)))
        .all())
        .filter((x) => ACTIVE_PROJECT_STATES.includes(x.state)).length;
      return {
        rowId: t.id,
        ...p,
        title: t.title,
        status: t.status,
        isAdmin: !!t.isAdmin,
        compensation: t.compensation,
        notes: t.notes,
        addedAt: t.addedAt.toISOString(),
        endedAt: t.endedAt?.toISOString() ?? null,
        activeProjects,
      };
    })))
    .filter(Boolean) as NonNullable<Awaited<ReturnType<typeof person>> & Record<string, unknown>>[];

  /* ---- CLIENTS: they booked/hired ME ---- */
  const clientIds = new Set<string>();
  const bookingsAsProvider = await db.select().from(tables.bookings).where(eq(tables.bookings.providerId, businessId)).all();
  for (const b of bookingsAsProvider) clientIds.add(b.clientId);
  const projectsAsProvider = await db.select().from(tables.projects).where(eq(tables.projects.creatorId, businessId)).all();
  for (const p of projectsAsProvider) clientIds.add(p.clientId);
  const clients = (await Promise.all(Array.from(clientIds)
    .map(async (cid) => {
      const p = await person(cid);
      if (!p) return null;
      const myBookings = bookingsAsProvider.filter((b) => b.clientId === cid);
      const myProjects = projectsAsProvider.filter((x) => x.clientId === cid);
      const totalSpentCents = payments
        .filter((x) => x.payerId === cid && x.payeeId === businessId && x.status === "released")
        .reduce((n, x) => n + x.amountCents + x.feeCents, 0);
      const pref = await db
        .select()
        .from(tables.preferredClients)
        .where(and(eq(tables.preferredClients.providerId, businessId), eq(tables.preferredClients.clientId, cid)))
        .get();
      const lastAt = [...myBookings.map((b) => b.startsAt), ...myProjects.map((x) => x.updatedAt)].sort((x, y) => y.getTime() - x.getTime())[0];
      return {
        ...p,
        bookings: myBookings.length,
        completedBookings: myBookings.filter((b) => b.status === "completed").length,
        activeProjects: myProjects.filter((x) => ACTIVE_PROJECT_STATES.includes(x.state)).length,
        completedProjects: myProjects.filter((x) => DONE_PROJECT_STATES.includes(x.state)).length,
        totalSpent: Math.round(totalSpentCents / 100),
        lastAt: lastAt?.toISOString() ?? null,
        preferred: pref?.status === "active" ? parseBenefits(pref!.benefits).length : 0,
      };
    }))).filter(Boolean);

  /* ---- TALENT: I hired THEM ---- */
  const talentIds = new Set<string>();
  const bookingsAsClient = await db.select().from(tables.bookings).where(eq(tables.bookings.clientId, businessId)).all();
  for (const b of bookingsAsClient) talentIds.add(b.providerId);
  const projectsAsClient = await db.select().from(tables.projects).where(eq(tables.projects.clientId, businessId)).all();
  for (const p of projectsAsClient) talentIds.add(p.creatorId);
  const hiredApps = (await db
    .select({ app: tables.applications, opp: tables.opportunities })
    .from(tables.applications)
    .innerJoin(tables.opportunities, eq(tables.applications.opportunityId, tables.opportunities.id))
    .where(eq(tables.opportunities.posterId, businessId))
    .all())
    .filter((r) => HIRED_APP_STATUSES.includes(r.app.status));
  for (const r of hiredApps) talentIds.add(r.app.applicantId);
  const talent = (await Promise.all(Array.from(talentIds)
    .map(async (tid) => {
      const p = await person(tid);
      if (!p) return null;
      const myBookings = bookingsAsClient.filter((b) => b.providerId === tid);
      const myProjects = projectsAsClient.filter((x) => x.creatorId === tid);
      const viaApps = hiredApps.filter((r) => r.app.applicantId === tid);
      const totalPaidCents = payments
        .filter((x) => x.payerId === businessId && x.payeeId === tid && x.status === "released")
        .reduce((n, x) => n + x.amountCents, 0);
      const myReview = (await db
        .select()
        .from(tables.reviews)
        .where(and(eq(tables.reviews.authorId, businessId), eq(tables.reviews.subjectId, tid)))
        .all())
        .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime())[0];
      const service = (await db
        .select()
        .from(tables.services)
        .where(eq(tables.services.ownerId, tid))
        .all())
        .find((s) => s.active && s.visibility === "public");
      const current = myProjects.filter((x) => ACTIVE_PROJECT_STATES.includes(x.state));
      return {
        ...p,
        hiredVia: [
          myProjects.length ? "projects" : null,
          myBookings.length ? "bookings" : null,
          viaApps.length ? "opportunities" : null,
        ].filter(Boolean) as string[],
        projectsWorked: myProjects.filter((x) => DONE_PROJECT_STATES.includes(x.state)).length + myBookings.filter((b) => b.status === "completed").length,
        currentProjects: current.map((x) => ({ id: x.id, title: x.title, state: x.state })),
        totalPaid: Math.round(totalPaidCents / 100),
        myReview: myReview ? { rating: myReview.rating, body: myReview.body } : null,
        hireAgainServiceId: service?.id ?? null,
        onTeam: teamRows.some((t) => t.personId === tid && t.status === "active"),
      };
    }))).filter(Boolean);

  /* ---- CONTACTS: talked, never hired/booked either way ---- */
  const known = new Set<string>([...teamRows.map((t) => t.personId), ...Array.from(clientIds), ...Array.from(talentIds), businessId]);
  const contacts: { id: string; handle: string; displayName: string; avatarUrl: string | null; primaryRole: string; skills: string[]; lastMessageAt: string | null; conversationId: string }[] = [];
  for (const m of await db.select().from(tables.conversationMembers).where(eq(tables.conversationMembers.userId, businessId)).all()) {
    const members = await db.select().from(tables.conversationMembers).where(eq(tables.conversationMembers.conversationId, m.conversationId)).all();
    if (members.length !== 2) continue;
    const other = members.find((x) => x.userId !== businessId);
    if (!other || known.has(other.userId)) continue;
    known.add(other.userId);
    const p = await person(other.userId);
    if (!p) continue;
    const lastMsg = (await db
      .select()
      .from(tables.messages)
      .where(eq(tables.messages.conversationId, m.conversationId))
      .all())
      .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime())[0];
    contacts.push({ ...p!, lastMessageAt: lastMsg?.createdAt.toISOString() ?? null, conversationId: m.conversationId });
  }

  return { team, clients, talent, contacts };
}

/* ------------------------------- hiring ------------------------------- */

export async function hiringFor(businessId: string) {
  const opps = await db.select().from(tables.opportunities).where(eq(tables.opportunities.posterId, businessId)).all();
  const apps = await db
    .select({ app: tables.applications, opp: tables.opportunities })
    .from(tables.applications)
    .innerJoin(tables.opportunities, eq(tables.applications.opportunityId, tables.opportunities.id))
    .where(eq(tables.opportunities.posterId, businessId))
    .all();
  const projects = await db.select().from(tables.projects).where(eq(tables.projects.clientId, businessId)).all();
  const bookings = await db.select().from(tables.bookings).where(eq(tables.bookings.clientId, businessId)).all();

  const activeHires =
    projects.filter((p) => ACTIVE_PROJECT_STATES.includes(p.state)).length +
    apps.filter((r) => ["selected", "confirmed", "active"].includes(r.app.status)).length +
    bookings.filter((b) => ["accepted", "confirmed"].includes(b.status)).length;
  const completedHires =
    projects.filter((p) => DONE_PROJECT_STATES.includes(p.state)).length +
    apps.filter((r) => r.app.status === "completed").length +
    bookings.filter((b) => b.status === "completed").length;
  const hiredPeople = new Set<string>();
  for (const r of apps) if (HIRED_APP_STATUSES.includes(r.app.status)) hiredPeople.add(r.app.applicantId);
  for (const p of projects) if (![...["draft", "offer_sent", "cancelled"]].includes(p.state)) hiredPeople.add(p.creatorId);
  for (const b of bookings) if (["confirmed", "completed"].includes(b.status)) hiredPeople.add(b.providerId);

  const name = async (uid: string) => {
    const p = await db.select().from(tables.profiles).where(eq(tables.profiles.userId, uid)).get();
    const u = await db.select().from(tables.users).where(eq(tables.users.id, uid)).get();
    return { id: uid, handle: u?.handle ?? "?", displayName: p?.displayName ?? "?", avatarUrl: p?.avatarUrl ?? null };
  };

  return {
    counts: {
      openOpportunities: opps.filter((o) => o.status === "open").length,
      applications: apps.length,
      shortlisted: apps.filter((r) => ["shortlisted", "interview"].includes(r.app.status)).length,
      activeHires,
      completedHires,
      peopleHired: hiredPeople.size,
    },
    opportunities: opps
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 12)
      .map((o) => ({
        id: o.id,
        title: o.title,
        status: o.status,
        budget: o.budget,
        applications: apps.filter((r) => r.app.opportunityId === o.id).length,
        createdAt: o.createdAt.toISOString(),
      })),
    activeEngagements: await Promise.all([
      ...projects
        .filter((p) => ACTIVE_PROJECT_STATES.includes(p.state))
        .map(async (p) => ({ kind: "project" as const, id: p.id, title: p.title, state: p.state, with: await name(p.creatorId), href: `/projects/${p.id}` })),
      ...bookings
        .filter((b) => ["pending", "accepted", "confirmed"].includes(b.status))
        .map(async (b) => ({ kind: "booking" as const, id: b.id, title: b.title, state: b.status, with: await name(b.providerId), href: `/activity?focus=booking:${b.id}` })),
      ...apps
        .filter((r) => ["selected", "confirmed", "active"].includes(r.app.status))
        .map(async (r) => ({ kind: "engagement" as const, id: r.app.id, title: r.opp.title, state: r.app.status, with: await name(r.app.applicantId), href: `/opportunities/${r.opp.id}/applicants` })),
    ]),
    // hiring activity — the real application trail, newest first
    activity: await Promise.all(apps
      .sort((a, b) => b.app.createdAt.getTime() - a.app.createdAt.getTime())
      .slice(0, 15)
      .map(async (r) => ({
        id: r.app.id,
        applicant: await name(r.app.applicantId),
        opportunityId: r.opp.id,
        opportunityTitle: r.opp.title,
        status: r.app.status,
        at: r.app.createdAt.toISOString(),
      }))),
  };
}

/* ------------------------------- payments ------------------------------- */

export async function paymentsFor(userId: string) {
  const rows = (await db
    .select()
    .from(tables.payments)
    .where(or(eq(tables.payments.payerId, userId), eq(tables.payments.payeeId, userId)))
    .all())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const titleOf = async (p: (typeof rows)[number]): Promise<string> => {
    if (p.bookingId) {
      const b = await db.select().from(tables.bookings).where(eq(tables.bookings.id, p.bookingId)).get();
      if (b) return b.title;
    }
    if (p.projectId) {
      const pr = await db.select().from(tables.projects).where(eq(tables.projects.id, p.projectId)).get();
      if (pr) return pr.title;
    }
    if (p.orderId) {
      const o = await db.select().from(tables.orders).where(eq(tables.orders.id, p.orderId)).get();
      if (o) return o.title;
    }
    return "Transaction";
  };
  const who = async (uid: string) => {
    const prof = await db.select().from(tables.profiles).where(eq(tables.profiles.userId, uid)).get();
    const u = await db.select().from(tables.users).where(eq(tables.users.id, uid)).get();
    return { id: uid, handle: u?.handle ?? "?", displayName: prof?.displayName ?? "?" };
  };

  const out = rows.filter((p) => p.payerId === userId);
  const inn = rows.filter((p) => p.payeeId === userId);
  const sum = (xs: typeof rows, withFee: boolean) => Math.round(xs.reduce((n, p) => n + p.amountCents + (withFee ? p.feeCents : 0), 0) / 100);

  return {
    summary: {
      totalSpent: sum(out.filter((p) => p.status === "released"), true),
      pendingOut: sum(out.filter((p) => p.status === "held"), true),
      refunded: sum(out.filter((p) => p.status === "refunded"), true),
      totalEarned: sum(inn.filter((p) => p.status === "released"), false),
      pendingIn: sum(inn.filter((p) => p.status === "held"), false),
    },
    transactions: await Promise.all(rows.slice(0, 60).map(async (p) => ({
      id: p.id,
      direction: p.payerId === userId ? ("out" as const) : ("in" as const),
      amountCents: p.amountCents,
      feeCents: p.feeCents,
      status: p.status, // held | released | refunded — all TEST
      title: await titleOf(p),
      with: await who(p.payerId === userId ? p.payeeId : p.payerId),
      record: p.bookingId ? { kind: "booking", id: p.bookingId } : p.projectId ? { kind: "project", id: p.projectId } : p.orderId ? { kind: "order", id: p.orderId } : null,
      at: p.createdAt.toISOString(),
    }))),
  };
}
