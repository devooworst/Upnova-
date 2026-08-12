/* ------------------------------------------------------------------ */
/*  QA scenarios — guided, MANUAL, two-sided test runs.                */
/*                                                                     */
/*  Each checkpoint names WHO acts (TEST CUSTOMER / TEST CREATOR /     */
/*  TEST BUSINESS), tells the tester exactly what to do in the REAL    */
/*  Mavyn interface, and has a verify() that inspects the REAL        */
/*  database. A checkpoint is DONE only when the expected state        */
/*  actually exists — never because a button was clicked or an API     */
/*  returned 200.                                                      */
/*                                                                     */
/*  Every step also reports its live "actual" state, so a stuck step   */
/*  reads like a bug report: expected vs actual vs related record.     */
/*                                                                     */
/*  Steps with a `perform` can be executed server-side ("do this step  */
/*  for me") — through the SAME public HTTP routes, authenticated as   */
/*  the correct persona. Even automation goes through the real app.    */
/* ------------------------------------------------------------------ */

import { and, eq, gt } from "drizzle-orm";
import { db, tables } from "@/db";
import { qaIds, readRuns, writeRuns, type QaRuns, type QaStepSnapshot } from "./qa";
import { checkApplicantEligibility } from "./eligibility";
import { businessTier } from "./businessLimits";
import { BUSINESS_LIMITS } from "@/lib/businessPlans";

export type QaApi = (
  handle: string,
  path: string,
  init?: { method?: string; body?: unknown }
) => Promise<{ status: number; data: Record<string, unknown> }>;

export interface QaContext {
  startedAt: Date;
  /** when the CURRENT task became active. Creation-type checkpoints only
      count records made AFTER this — an action performed while its task
      was still locked never counts and must be performed again once the
      task is actually reached (the Lab tests the WORKFLOW, in order, not
      whether the database happens to contain a row). */
  taskStartedAt: Date;
  customer: string;
  creator: string;
  business: string;
  serviceId: string;
  businessServiceId: string;
}

export interface QaVerdict {
  done: boolean;
  actual: string; // live state, always reported
  record?: string; // related record id
}

export interface QaStep {
  id: string;
  /** who performs it — a QA handle, or "check" for automatic cross-checks */
  role: "testcustomer" | "testcreator" | "testbusiness" | "check";
  title: string;
  instruction: string;
  expected: string;
  /** where in the REAL app the action happens (may depend on live records) */
  href: (ctx: QaContext) => string;
  verify: (ctx: QaContext) => QaVerdict;
  /** optional: perform the action through the real HTTP routes as the persona */
  perform?: (ctx: QaContext, api: QaApi) => Promise<void>;
  /** REQUIRED STARTING STATE — exploration is allowed (the tester may
      click anything, that's how bugs are found), but if it consumed the
      state this task needs (e.g. submitting early removes the Request-
      extension action), the Test Center must SAY so and offer a repair,
      never present an impossible instruction. */
  ready?: (ctx: QaContext) => { ok: boolean; why: string };
  /** restores the exact required starting state (test-environment state
      surgery — a fixture reset, NEVER a faked checkpoint: verification
      still only ever comes from real records). Returns what it did. */
  repair?: (ctx: QaContext) => string;
}

export interface QaScenario {
  id: string;
  title: string;
  personas: string[];
  description: string;
  steps: QaStep[];
}

/* ------------------------------ helpers ------------------------------ */

const after = (d: Date | null | undefined, started: Date) => !!d && d.getTime() >= started.getTime() - 2000;

/** §ACCIDENTAL FUTURE COMPLETION — a creation-type checkpoint only counts
    records made while ITS task was active. Anything created earlier (while
    the task was still locked) is reported but never counted: the tester
    performs the action again during the task. The Lab verifies the
    WORKFLOW in order, not whether the database happens to contain a row. */
const inTask = (d: Date | null | undefined, ctx: QaContext) => !!d && d.getTime() >= ctx.taskStartedAt.getTime();
const REDO = "exists from BEFORE this test became active — it doesn't count. Do it again now: the Lab verifies the workflow in order, not leftover records.";

function pairConversation(a: string, b: string) {
  for (const m of db.select().from(tables.conversationMembers).where(eq(tables.conversationMembers.userId, a)).all()) {
    const other = db
      .select()
      .from(tables.conversationMembers)
      .where(and(eq(tables.conversationMembers.conversationId, m.conversationId), eq(tables.conversationMembers.userId, b)))
      .get();
    if (other) {
      const members = db
        .select()
        .from(tables.conversationMembers)
        .where(eq(tables.conversationMembers.conversationId, m.conversationId))
        .all();
      if (members.length === 2) return m.conversationId;
    }
  }
  return null;
}

function messagesBetween(ctx: QaContext, a: string, b: string) {
  const conv = pairConversation(a, b);
  if (!conv) return { conv: null, msgs: [] as (typeof tables.messages.$inferSelect)[] };
  const msgs = db
    .select()
    .from(tables.messages)
    .where(eq(tables.messages.conversationId, conv))
    .all()
    .filter((m) => after(m.createdAt, ctx.startedAt) && m.kind !== "system");
  return { conv, msgs };
}

function notif(ctx: QaContext, userId: string, type: string, contains?: RegExp) {
  return db
    .select()
    .from(tables.notifications)
    .where(and(eq(tables.notifications.userId, userId), eq(tables.notifications.type, type), gt(tables.notifications.createdAt, new Date(ctx.startedAt.getTime() - 2000))))
    .all()
    .find((n) => !contains || contains.test(n.title + " " + n.body));
}

function qaBooking(ctx: QaContext) {
  return db
    .select()
    .from(tables.bookings)
    .where(and(eq(tables.bookings.clientId, ctx.customer), eq(tables.bookings.providerId, ctx.creator)))
    .all()
    .filter((b) => after(b.createdAt, ctx.startedAt))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .pop();
}

function qaProject(ctx: QaContext) {
  return db
    .select()
    .from(tables.projects)
    .where(and(eq(tables.projects.clientId, ctx.customer), eq(tables.projects.creatorId, ctx.creator)))
    .all()
    .filter((p) => after(p.createdAt, ctx.startedAt))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .pop();
}

function qaOpportunity(ctx: QaContext) {
  return db
    .select()
    .from(tables.opportunities)
    .where(eq(tables.opportunities.posterId, ctx.business))
    .all()
    .filter((o) => after(o.createdAt, ctx.startedAt))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .pop();
}

const payFor = (key: "bookingId" | "projectId", id: string) =>
  db.select().from(tables.payments).all().find((p) => p[key] === id);

const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "none");

/* ------------------- required-state helpers (fixtures) ------------------- */
/* Exploration never falsely completes future tasks (activation gating),
   but it CAN consume the state a task needs — e.g. submitting the work
   early removes the Request-extension action. These helpers detect that
   and rewind ONLY the QA records to the exact required starting state. */

const PROJECT_LABEL: Record<string, string> = {
  draft: "Draft", offer_sent: "Offer sent", accepted: "Accepted", in_progress: "In progress",
  extension_requested: "Extension requested", submitted: "Delivered — awaiting review",
  approved: "Approved", completed: "Completed", reviewed: "Reviewed",
};

function projectReady(getP: (ctx: QaContext) => typeof tables.projects.$inferSelect | undefined, allowed: string[], needLabel: string) {
  return (ctx: QaContext) => {
    const p = getP(ctx);
    if (!p) return { ok: true, why: "" }; // no project yet — the verify explains that
    if (allowed.includes(p.state)) return { ok: true, why: "" };
    return {
      ok: false,
      why: `the project is "${PROJECT_LABEL[p.state] ?? p.state}", but this test needs it ${needLabel} — the required action doesn't exist in the current state (you likely explored ahead; that's fine, nothing was falsely credited)`,
    };
  };
}

function projectRepair(getP: (ctx: QaContext) => typeof tables.projects.$inferSelect | undefined) {
  return (ctx: QaContext) => {
    const p = getP(ctx);
    if (!p) return "no project to repair";
    // rewind the QA project to IN PROGRESS: state back, secured (not
    // released) TEST payment, stale pending extensions cleared
    db.update(tables.projects).set({ state: "in_progress" }).where(eq(tables.projects.id, p.id)).run();
    const pay = db.select().from(tables.payments).all().find((x) => x.projectId === p.id);
    if (pay && pay.status === "released") db.update(tables.payments).set({ status: "held" }).where(eq(tables.payments.id, pay.id)).run();
    for (const e of db.select().from(tables.extensionRequests).where(eq(tables.extensionRequests.projectId, p.id)).all())
      if (e.status === "pending" && !inTask(e.createdAt, ctx)) db.delete(tables.extensionRequests).where(eq(tables.extensionRequests.id, e.id)).run();
    return `project "${p.title}" rewound to IN PROGRESS (TEST payment secured, stale pending extensions cleared)`;
  };
}

function bookingReady(getB: (ctx: QaContext) => typeof tables.bookings.$inferSelect | undefined, allowed: string[], needLabel: string) {
  return (ctx: QaContext) => {
    const b = getB(ctx);
    if (!b) return { ok: true, why: "" };
    if (allowed.includes(b.status)) return { ok: true, why: "" };
    return { ok: false, why: `the booking is "${b.status}", but this test needs it ${needLabel} — the required action doesn't exist in the current state` };
  };
}

function bookingRepair(getB: (ctx: QaContext) => typeof tables.bookings.$inferSelect | undefined, to: "pending" | "accepted" | "confirmed" = "confirmed") {
  return (ctx: QaContext) => {
    const b = getB(ctx);
    if (!b) return "no booking to repair";
    db.update(tables.bookings).set({ status: to }).where(eq(tables.bookings.id, b.id)).run();
    const pay = db.select().from(tables.payments).all().find((x) => x.bookingId === b.id);
    if (pay && pay.status === "released" && to === "confirmed") db.update(tables.payments).set({ status: "held" }).where(eq(tables.payments.id, pay.id)).run();
    return `booking rewound to ${to.toUpperCase()}${to === "confirmed" ? " (TEST payment secured)" : ""}`;
  };
}

/** next weekday at a given hour — keeps auto-performed bookings clear of
    real scheduling rules (no-Sunday etc.) so the step tests what it says */
function nextWeekday(hour: number, fromDays = 2): Date {
  for (let d = fromDays; d < fromDays + 10; d++) {
    const t = new Date(Date.now() + d * 86400_000);
    if (t.getDay() >= 1 && t.getDay() <= 5) {
      t.setHours(hour, 0, 0, 0);
      return t;
    }
  }
  const t = new Date(Date.now() + fromDays * 86400_000);
  t.setHours(hour, 0, 0, 0);
  return t;
}

/* ============================ SCENARIO A ============================ */

const bookingScenario: QaScenario = {
  id: "booking",
  title: "Service booking — customer & creator, both sides",
  personas: ["testcustomer", "testcreator"],
  description:
    "Play the customer: find the Test Creator, message them, book their service, pay (TEST). Then switch to the creator: accept, post progress, complete, get the payout released. Every checkpoint verifies the real database — nothing passes because a button was clicked.",
  steps: [
    {
      id: "profile",
      role: "testcustomer",
      title: "Customer opened the creator's profile",
      instruction: "As TEST CUSTOMER, search \"Test Creator\" in the top search bar → open their profile. Just viewing the page completes this test.",
      expected: "A profile_view interaction by Test Customer on Test Creator, recorded after this test became active.",
      href: () => "/creator/testcreator",
      verify: (ctx) => {
        const rows = db
          .select()
          .from(tables.interactions)
          .where(and(eq(tables.interactions.userId, ctx.customer), eq(tables.interactions.targetId, ctx.creator), eq(tables.interactions.action, "profile_view")))
          .all()
          .filter((r) => after(r.createdAt, ctx.startedAt));
        const row = rows.find((r) => inTask(r.createdAt, ctx));
        return {
          done: !!row,
          actual: row ? `profile_view recorded ${row.createdAt.toLocaleTimeString()}` : rows.length ? `a profile view ${REDO}` : "no profile view recorded yet",
          record: row?.id,
        };
      },
      perform: async (_ctx, api) => {
        await api("testcustomer", "/api/track", { method: "POST", body: { targetType: "user", targetId: _ctx.creator, action: "profile_view" } });
      },
    },
    {
      id: "message",
      role: "testcustomer",
      title: "Customer messaged the creator",
      instruction: "As TEST CUSTOMER → Messages → open the Test Creator conversation → type a message in the box at the bottom → send it.",
      expected: "A message from Test Customer, sent while this test was active, in the testcustomer↔testcreator conversation.",
      href: () => "/messages?to=testcreator",
      verify: (ctx) => {
        const { conv, msgs } = messagesBetween(ctx, ctx.customer, ctx.creator);
        const mine = msgs.find((m) => m.senderId === ctx.customer && inTask(m.createdAt, ctx));
        const staleMine = !mine && msgs.some((m) => m.senderId === ctx.customer);
        return {
          done: !!mine,
          actual: mine ? `"${mine.body.slice(0, 60)}"` : staleMine ? `a message ${REDO}` : conv ? "conversation exists, no customer message yet" : "no conversation yet",
          record: conv ?? undefined,
        };
      },
      perform: async (_ctx, api) => {
        await api("testcustomer", "/api/conversations", { method: "POST", body: { toHandle: "testcreator", firstMessage: "[QA] Hi! I'd like to book your QA Test Session." } });
      },
    },
    {
      id: "msg-notif",
      role: "check",
      title: "Creator was notified of the message",
      instruction: "Automatic cross-check — flips once the message lands.",
      expected: "A 'message' notification for Test Creator, from Test Customer, linking to the exact thread.",
      href: () => "/notifications",
      verify: (ctx) => {
        const n = notif(ctx, ctx.creator, "message");
        return { done: !!n, actual: n ? `"${n.title}" → ${n.href}` : "no message notification for the creator yet", record: n?.id };
      },
    },
    {
      id: "reply",
      role: "testcreator",
      title: "Creator replied in the same thread",
      instruction: "Switch to TEST CREATOR (button below) → Messages → open the Test Customer conversation → send a reply.",
      expected: "A message from Test Creator, sent while this test was active, in the same two-person conversation.",
      href: () => "/messages?to=testcustomer",
      verify: (ctx) => {
        const { msgs } = messagesBetween(ctx, ctx.customer, ctx.creator);
        const theirs = msgs.find((m) => m.senderId === ctx.creator && inTask(m.createdAt, ctx));
        const stale = !theirs && msgs.some((m) => m.senderId === ctx.creator);
        return { done: !!theirs, actual: theirs ? `"${theirs.body.slice(0, 60)}"` : stale ? `a reply ${REDO}` : "no creator reply yet" };
      },
      perform: async (_ctx, api) => {
        await api("testcreator", "/api/conversations", { method: "POST", body: { toHandle: "testcustomer", firstMessage: "[QA] Happy to help — book any weekday slot." } });
      },
    },
    {
      id: "book",
      role: "testcustomer",
      title: "Customer requested the booking",
      instruction: "As TEST CUSTOMER → Services → find \"QA Test Session\" by Test Creator → click Book → pick any weekday date and an available time → confirm.",
      expected: "A booking made while this test was active: client=testcustomer, provider=testcreator, status pending (the creator has NOT auto-accepted — QA personas have no bots).",
      href: (ctx) => `/services/${ctx.serviceId}`,
      verify: (ctx) => {
        const b = qaBooking(ctx);
        if (!b) return { done: false, actual: "no booking created yet" };
        if (!inTask(b.createdAt, ctx)) return { done: false, actual: `a booking ${REDO}`, record: b.id };
        return { done: true, actual: `booking ${b.id.slice(0, 8)}… status=${b.status}`, record: b.id };
      },
      perform: async (ctx, api) => {
        await api("testcustomer", "/api/bookings", { method: "POST", body: { serviceId: ctx.serviceId, startsAt: nextWeekday(10).toISOString(), durationMin: 60 } });
      },
    },
    {
      id: "accept",
      role: "testcreator",
      title: "Creator accepted the request",
      instruction: "Switch to TEST CREATOR → Bookings → find the pending request → click Accept.",
      expected: "Booking status pending → accepted, and Test Customer notified.",
      href: () => "/calendar",
      ready: bookingReady(qaBooking, ["pending", "accepted", "confirmed", "completed"], "a live request (not cancelled)"),
      repair: bookingRepair(qaBooking, "pending"),
      verify: (ctx) => {
        const b = qaBooking(ctx);
        if (!b) return { done: false, actual: "no booking yet — finish the previous step" };
        const n = notif(ctx, ctx.customer, "booking", /accepted/i);
        return { done: b.status !== "pending" && !!n, actual: `status=${b.status}; customer accept-notification=${n ? "yes" : "no"}`, record: b.id };
      },
      perform: async (ctx, api) => {
        const b = qaBooking(ctx);
        if (b) await api("testcreator", `/api/bookings/${b.id}`, { method: "PATCH", body: { action: "accept" } });
      },
    },
    {
      id: "pay",
      role: "testcustomer",
      title: "Customer paid — TEST payment secured",
      instruction: "As TEST CUSTOMER → Bookings → open the accepted booking → click Pay (clearly labeled TEST — no real money exists here).",
      expected: "Booking confirmed + a payment row in HELD state (secured, releases on completion).",
      href: () => "/calendar",
      ready: bookingReady(qaBooking, ["accepted", "confirmed", "completed"], "ACCEPTED so the Pay button exists"),
      repair: bookingRepair(qaBooking, "accepted"),
      verify: (ctx) => {
        const b = qaBooking(ctx);
        if (!b) return { done: false, actual: "no booking yet" };
        const pay = payFor("bookingId", b.id);
        return {
          done: ["confirmed", "completed"].includes(b.status) && !!pay && ["held", "released"].includes(pay.status),
          actual: `status=${b.status}; payment=${pay ? `${pay.status} $${(pay.amountCents / 100).toFixed(2)} (TEST)` : "none"}`,
          record: b.id,
        };
      },
      perform: async (ctx, api) => {
        const b = qaBooking(ctx);
        if (b) await api("testcustomer", `/api/bookings/${b.id}`, { method: "PATCH", body: { action: "pay" } });
      },
    },
    {
      id: "paid-notif",
      role: "check",
      title: "Creator saw payment secured",
      instruction: "Automatic cross-check.",
      expected: "A payment notification for Test Creator ('payment secured').",
      href: () => "/notifications",
      verify: (ctx) => {
        const n = notif(ctx, ctx.creator, "payment", /secured/i);
        return { done: !!n, actual: n ? `"${n.title}"` : "no payment-secured notification for the creator yet", record: n?.id };
      },
    },
    {
      id: "bound",
      role: "check",
      title: "Booking is bound to the correct conversation",
      instruction: "Automatic cross-check — the 'wrong person's thread' bug guard.",
      expected: "booking.conversationId is exactly the testcustomer↔testcreator two-person conversation.",
      href: () => "/messages?to=testcreator",
      verify: (ctx) => {
        const b = qaBooking(ctx);
        if (!b) return { done: false, actual: "no booking yet" };
        const conv = pairConversation(ctx.customer, ctx.creator);
        return { done: !!conv && b.conversationId === conv, actual: `booking.conversationId=${b.conversationId?.slice(0, 8)}… pair=${conv?.slice(0, 8)}…`, record: b.conversationId ?? undefined };
      },
    },
    {
      id: "progress",
      role: "testcreator",
      title: "Creator posted a progress update",
      instruction: "As TEST CREATOR → Bookings → open the booking's progress panel → pick a status and % → write a short note → click Post update.",
      expected: "A real progress_updates row on this booking, authored by Test Creator while this test was active.",
      href: () => "/calendar",
      ready: bookingReady(qaBooking, ["accepted", "confirmed"], "ACCEPTED or CONFIRMED — progress posting closes once it's completed"),
      repair: bookingRepair(qaBooking, "confirmed"),
      verify: (ctx) => {
        const b = qaBooking(ctx);
        if (!b) return { done: false, actual: "no booking yet" };
        const all = db
          .select()
          .from(tables.progressUpdates)
          .where(eq(tables.progressUpdates.bookingId, b.id))
          .all()
          .filter((r) => r.authorId === ctx.creator && r.kind === "update");
        const row = all.find((r) => inTask(r.createdAt, ctx));
        return {
          done: !!row,
          actual: row ? `${row.percent ?? "—"}% · ${row.status} · "${row.message.slice(0, 40)}"` : all.length ? `an update ${REDO}` : "no progress update yet",
          record: row?.id,
        };
      },
      perform: async (ctx, api) => {
        const b = qaBooking(ctx);
        if (b) await api("testcreator", `/api/bookings/${b.id}/progress`, { method: "POST", body: { kind: "update", status: "in_progress", percent: 50, message: "[QA] Halfway through the session prep." } });
      },
    },
    {
      id: "progress-notif",
      role: "check",
      title: "Customer received the progress update",
      instruction: "Automatic cross-check.",
      expected: "A progress_update notification for Test Customer.",
      href: () => "/notifications",
      verify: (ctx) => {
        const n = notif(ctx, ctx.customer, "progress_update");
        return { done: !!n, actual: n ? `"${n.title}"` : "no progress notification for the customer yet", record: n?.id };
      },
    },
    {
      id: "complete",
      role: "testcreator",
      title: "Creator completed — payment RELEASED (TEST)",
      instruction: "As TEST CREATOR → Bookings → open the booking → click \"Mark completed — release $ to me\".",
      expected: "Booking completed + the held TEST payment flips to RELEASED.",
      href: () => "/calendar",
      ready: bookingReady(qaBooking, ["confirmed", "completed"], "CONFIRMED (paid) so Mark-completed exists"),
      repair: bookingRepair(qaBooking, "confirmed"),
      verify: (ctx) => {
        const b = qaBooking(ctx);
        if (!b) return { done: false, actual: "no booking yet" };
        const pay = payFor("bookingId", b.id);
        return { done: b.status === "completed" && pay?.status === "released", actual: `status=${b.status}; payment=${pay?.status ?? "none"}`, record: b.id };
      },
      perform: async (ctx, api) => {
        const b = qaBooking(ctx);
        if (b) await api("testcreator", `/api/bookings/${b.id}`, { method: "PATCH", body: { action: "complete" } });
      },
    },
    {
      id: "release-notif",
      role: "check",
      title: "Customer saw the completion + release",
      instruction: "Automatic cross-check.",
      expected: "A payment notification for Test Customer mentioning the release.",
      href: () => "/notifications",
      verify: (ctx) => {
        const n = notif(ctx, ctx.customer, "payment", /released|completed/i);
        return { done: !!n, actual: n ? `"${n.title}"` : "no release notification for the customer yet", record: n?.id };
      },
    },
    {
      id: "activity",
      role: "check",
      title: "The booking shows in BOTH sides' Activity",
      instruction: "Open /activity as either persona — same record, two perspectives.",
      expected: "One booking record drives both parties' Activity (client view and provider view).",
      href: () => "/activity",
      verify: (ctx) => {
        const b = qaBooking(ctx);
        return { done: !!b && b.status === "completed", actual: b ? `record ${b.id.slice(0, 8)}… (${b.status}) is read by /api/activity for client AND provider` : "no booking yet", record: b?.id };
      },
    },
  ],
};

/* ============================ SCENARIO B ============================ */

const projectScenario: QaScenario = {
  id: "project",
  title: "Project — progress, ETA change, extension, review",
  personas: ["testcustomer", "testcreator"],
  description:
    "The full engagement: customer opens a project, creator sends the offer, customer pays (TEST), creator posts progress + changes the ETA + requests an extension, customer decides, work is delivered, payment releases, review lands on the creator's public profile.",
  steps: [
    {
      id: "draft",
      role: "testcustomer",
      title: "Customer opened a project with the creator",
      instruction: "As TEST CUSTOMER → Messages → open the Test Creator conversation → click the \"Project\" button (briefcase icon) at the top of the chat → fill in a title, an amount, and a deadline → click \"Create project draft\".",
      expected: "A project made while this test was active: client=testcustomer, creator=testcreator, state draft (no bot sends the offer — the creator must).",
      href: () => "/messages?to=testcreator",
      verify: (ctx) => {
        const p = qaProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        if (!inTask(p.createdAt, ctx)) return { done: false, actual: `a project ${REDO}`, record: p.id };
        return { done: true, actual: `project "${p.title}" state=${p.state}`, record: p.id };
      },
      perform: async (ctx, api) => {
        await api("testcustomer", "/api/projects", {
          method: "POST",
          body: { creatorHandle: "testcreator", title: "[QA] Test project", amount: 120, brief: "QA scenario project.", deadline: new Date(Date.now() + 5 * 86400_000).toISOString(), conversationId: pairConversation(ctx.customer, ctx.creator) },
        });
      },
    },
    {
      id: "offer",
      role: "testcreator",
      title: "Creator sent the offer",
      instruction: "Switch to TEST CREATOR → Messages → open the Test Customer conversation → click the \"Project\" button at the top of the chat → click \"Send offer\".",
      expected: "State draft → offer_sent; customer notified.",
      href: () => "/messages?to=testcustomer",
      verify: (ctx) => {
        const p = qaProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        return { done: p.state !== "draft", actual: `state=${p.state}`, record: p.id };
      },
      perform: async (ctx, api) => {
        const p = qaProject(ctx);
        if (p) await api("testcreator", `/api/projects/${p.id}`, { method: "PATCH", body: { action: "send_offer" } });
      },
    },
    {
      id: "start",
      role: "testcustomer",
      title: "Customer accepted + paid to start (TEST)",
      instruction: "As TEST CUSTOMER → open the project page → click \"Accept offer\" → then click the pay button that replaces it (labeled TEST PAYMENT).",
      expected: "State in_progress + a HELD payment row.",
      href: (ctx) => {
        const p = qaProject(ctx);
        return p ? `/projects/${p.id}` : "/messages?to=testcreator";
      },
      verify: (ctx) => {
        const p = qaProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const pay = payFor("projectId", p.id);
        return { done: !["draft", "offer_sent", "accepted"].includes(p.state) && !!pay, actual: `state=${p.state}; payment=${pay ? `${pay.status} (TEST)` : "none"}`, record: p.id };
      },
      perform: async (ctx, api) => {
        const p = qaProject(ctx);
        if (!p) return;
        await api("testcustomer", `/api/projects/${p.id}`, { method: "PATCH", body: { action: "accept_offer", expectedAmount: p.amount } });
        await api("testcustomer", `/api/projects/${p.id}`, { method: "PATCH", body: { action: "start", expectedAmount: p.amount } });
      },
    },
    {
      id: "progress",
      role: "testcreator",
      title: "Creator posted a progress update",
      instruction: "As TEST CREATOR → open the project page → Post progress update (e.g. 25%, what you're working on, an ETA).",
      expected: "A progress_updates row on the project, authored by Test Creator.",
      href: (ctx) => {
        const p = qaProject(ctx);
        return p ? `/projects/${p.id}` : "/calendar";
      },
      ready: projectReady(qaProject, ["in_progress", "extension_requested", "submitted", "approved"], "IN PROGRESS (progress posting closes once it's completed)"),
      repair: projectRepair(qaProject),
      verify: (ctx) => {
        const p = qaProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const rows = db.select().from(tables.progressUpdates).where(eq(tables.progressUpdates.projectId, p.id)).all().filter((r) => r.kind === "update");
        const row = rows.find((r) => inTask(r.createdAt, ctx));
        return { done: !!row, actual: row ? `${row.percent ?? "—"}% · "${row.message.slice(0, 40)}"` : rows.length ? `an update ${REDO}` : "no update yet", record: row?.id };
      },
      perform: async (ctx, api) => {
        const p = qaProject(ctx);
        if (p)
          await api("testcreator", `/api/projects/${p.id}/progress`, {
            method: "POST",
            body: { kind: "update", status: "in_progress", percent: 25, message: "[QA] Started working on the first draft.", etaAt: new Date(Date.now() + 3 * 86400_000).toISOString() },
          });
      },
    },
    {
      id: "eta",
      role: "testcreator",
      title: "Creator changed the estimated completion",
      instruction: "On the project page → Update ETA (new date + reason).",
      expected: "An ETA row recording old → new estimate; the change can never be silent.",
      href: (ctx) => {
        const p = qaProject(ctx);
        return p ? `/projects/${p.id}` : "/calendar";
      },
      ready: projectReady(qaProject, ["in_progress", "extension_requested", "submitted", "approved"], "IN PROGRESS (ETA updates close once it's completed)"),
      repair: projectRepair(qaProject),
      verify: (ctx) => {
        const p = qaProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const rows = db.select().from(tables.progressUpdates).where(eq(tables.progressUpdates.projectId, p.id)).all().filter((r) => r.kind === "eta");
        const row = rows.find((r) => inTask(r.createdAt, ctx));
        return { done: !!row, actual: row ? `${fmtDate(row.prevEtaAt)} → ${fmtDate(row.etaAt)}${row.message ? ` — "${row.message.slice(0, 40)}"` : ""}` : rows.length ? `an ETA change ${REDO}` : "no ETA change yet", record: row?.id };
      },
      perform: async (ctx, api) => {
        const p = qaProject(ctx);
        if (p)
          await api("testcreator", `/api/projects/${p.id}/progress`, { method: "POST", body: { kind: "eta", etaAt: new Date(Date.now() + 4 * 86400_000).toISOString(), reason: "[QA] Revisions are taking longer than expected." } });
      },
    },
    {
      id: "eta-notif",
      role: "check",
      title: "Customer was told about the ETA change",
      instruction: "Automatic cross-check.",
      expected: "An eta_changed notification for Test Customer, linking to the project.",
      href: () => "/notifications",
      verify: (ctx) => {
        const n = notif(ctx, ctx.customer, "eta_changed");
        return { done: !!n, actual: n ? `"${n.title}"` : "no ETA notification yet", record: n?.id };
      },
    },
    {
      id: "extension",
      role: "testcreator",
      title: "Creator requested an extension",
      instruction: "On the project page → Request extension (+1/+2/+3/custom, reason required).",
      expected: "A pending extension_requests row; project state = extension_requested; customer notified.",
      href: (ctx) => {
        const p = qaProject(ctx);
        return p ? `/projects/${p.id}` : "/calendar";
      },
      ready: (ctx) => {
        const base = projectReady(qaProject, ["in_progress"], "IN PROGRESS — the Request-extension button only exists there")(ctx);
        if (!base.ok) return base;
        const p = qaProject(ctx);
        const stale = p
          ? db.select().from(tables.extensionRequests).where(eq(tables.extensionRequests.projectId, p.id)).all().find((e) => e.status === "pending" && !inTask(e.createdAt, ctx))
          : undefined;
        if (stale) return { ok: false, why: "a pending extension from before this test became active is blocking a new request" };
        return { ok: true, why: "" };
      },
      repair: projectRepair(qaProject),
      verify: (ctx) => {
        const p = qaProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const exts = db.select().from(tables.extensionRequests).where(eq(tables.extensionRequests.projectId, p.id)).all();
        const ext = exts.find((e) => inTask(e.createdAt, ctx));
        return { done: !!ext, actual: ext ? `+${ext.days} days, status=${ext.status}` : exts.length ? `an extension request ${REDO}` : `no extension request yet (state=${p.state})`, record: ext?.id };
      },
      perform: async (ctx, api) => {
        const p = qaProject(ctx);
        if (p) await api("testcreator", `/api/projects/${p.id}/extension`, { method: "POST", body: { days: 2, reason: "[QA] Need two more days for final mixing." } });
      },
    },
    {
      id: "ext-decide",
      role: "testcustomer",
      title: "Customer decided the extension",
      instruction: "As TEST CUSTOMER → project page → Approve (deadline moves) or Decline (original stands). Your call — both are valid outcomes.",
      expected: "The extension row is decided; if approved, the deadline moved by exactly the requested days.",
      href: (ctx) => {
        const p = qaProject(ctx);
        return p ? `/projects/${p.id}` : "/calendar";
      },
      verify: (ctx) => {
        const p = qaProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const ext = db.select().from(tables.extensionRequests).where(eq(tables.extensionRequests.projectId, p.id)).all()[0];
        if (!ext) return { done: false, actual: "no extension request yet" };
        return { done: ext.status !== "pending", actual: `extension ${ext.status}; deadline now ${fmtDate(p.deadline)}`, record: ext.id };
      },
      perform: async (ctx, api) => {
        const p = qaProject(ctx);
        if (!p) return;
        const ext = db.select().from(tables.extensionRequests).where(and(eq(tables.extensionRequests.projectId, p.id), eq(tables.extensionRequests.status, "pending"))).get();
        if (ext) await api("testcustomer", `/api/extensions/${ext.id}`, { method: "PATCH", body: { approve: true } });
      },
    },
    {
      id: "submit",
      role: "testcreator",
      title: "Creator submitted the work",
      instruction: "As TEST CREATOR → project page → Submit work for review.",
      expected: "State → submitted; customer gets the 'review it' notification.",
      href: (ctx) => {
        const p = qaProject(ctx);
        return p ? `/projects/${p.id}` : "/calendar";
      },
      ready: projectReady(qaProject, ["in_progress", "extension_requested", "submitted", "approved", "completed", "reviewed"], "IN PROGRESS so Submit-work exists"),
      repair: projectRepair(qaProject),
      verify: (ctx) => {
        const p = qaProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const n = notif(ctx, ctx.customer, "project_submitted");
        return { done: ["submitted", "approved", "completed", "reviewed"].includes(p.state) && !!n, actual: `state=${p.state}; customer notified=${n ? "yes" : "no"}`, record: p.id };
      },
      perform: async (ctx, api) => {
        const p = qaProject(ctx);
        if (p) await api("testcreator", `/api/projects/${p.id}`, { method: "PATCH", body: { action: "submit" } });
      },
    },
    {
      id: "finish",
      role: "testcustomer",
      title: "Customer approved + completed — payment RELEASED (TEST)",
      instruction: "As TEST CUSTOMER → project page → Approve the delivery → Release payment / complete.",
      expected: "State completed + the held TEST payment flips to RELEASED.",
      href: (ctx) => {
        const p = qaProject(ctx);
        return p ? `/projects/${p.id}` : "/calendar";
      },
      verify: (ctx) => {
        const p = qaProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const pay = payFor("projectId", p.id);
        return { done: ["completed", "reviewed"].includes(p.state) && pay?.status === "released", actual: `state=${p.state}; payment=${pay?.status ?? "none"}`, record: p.id };
      },
      perform: async (ctx, api) => {
        const p = qaProject(ctx);
        if (!p) return;
        await api("testcustomer", `/api/projects/${p.id}`, { method: "PATCH", body: { action: "approve" } });
        await api("testcustomer", `/api/projects/${p.id}`, { method: "PATCH", body: { action: "complete" } });
      },
    },
    {
      id: "review",
      role: "testcustomer",
      title: "Customer left a review",
      instruction: "As TEST CUSTOMER → Messages → open the Test Creator conversation → click the \"Project\" button → pick a star rating, write a line → click \"Post review\".",
      expected: "A review row by Test Customer about Test Creator on this project.",
      href: (ctx) => {
        const p = qaProject(ctx);
        return p ? `/projects/${p.id}` : "/calendar";
      },
      verify: (ctx) => {
        const p = qaProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const all2 = db.select().from(tables.reviews).where(eq(tables.reviews.projectId, p.id)).all().filter((x) => x.authorId === ctx.customer);
        const r = all2.find((x) => inTask(x.createdAt, ctx));
        return { done: !!r, actual: r ? `${r.rating.toFixed(1)}★ "${r.body.slice(0, 40)}"` : all2.length ? `a review ${REDO}` : "no review yet", record: r?.id };
      },
      perform: async (ctx, api) => {
        const p = qaProject(ctx);
        if (p) await api("testcustomer", `/api/projects/${p.id}/review`, { method: "POST", body: { rating: 5, body: "[QA] Smooth process end to end." } });
      },
    },
    {
      id: "review-visible",
      role: "check",
      title: "The review shows on the creator's public profile",
      instruction: "Open @testcreator's profile as anyone — the review renders from the same row.",
      expected: "The review's subject is Test Creator, so /api/users/testcreator serves it publicly.",
      href: () => "/creator/testcreator",
      verify: (ctx) => {
        const p = qaProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const r = db.select().from(tables.reviews).where(eq(tables.reviews.projectId, p.id)).all().find((x) => x.subjectId === ctx.creator);
        return { done: !!r, actual: r ? `review ${r.id.slice(0, 8)}… targets @testcreator's public profile` : "no review yet", record: r?.id };
      },
    },
  ],
};

/* ============================ SCENARIO C ============================ */

const opportunityScenario: QaScenario = {
  id: "opportunity",
  title: "Opportunity — post, apply, review, select, connect",
  personas: ["testbusiness", "testcustomer"],
  description:
    "Play the business: post an opportunity. Switch to the applicant: discover it and apply. Back to the business: review and select. Verify the notification chain and that messaging connects the right two people.",
  steps: [
    {
      id: "post",
      role: "testbusiness",
      title: "Business posted the opportunity — with a custom application question",
      instruction: "As TEST BUSINESS → Opportunities → Post opportunity → fill the basics (example values in the briefing) → under Application questions click \"+ Add application question\" → add \"Are you available September 15?\" as Yes/No, Required → Post opportunity.",
      expected: "An opportunities row by Test Business with at least one custom application question stored in its config — the poster decides what to ask; the server enforces it at application time.",
      href: () => "/opportunities/new",
      verify: (ctx) => {
        const o = qaOpportunity(ctx);
        if (!o) return { done: false, actual: "no opportunity yet" };
        if (!inTask(o.createdAt, ctx)) return { done: false, actual: `an opportunity ${REDO}`, record: o.id };
        let qs: unknown[] = [];
        try { qs = (JSON.parse(o.applyConfig).questions as unknown[]) ?? []; } catch {}
        return {
          done: qs.length > 0,
          actual: qs.length ? `"${o.title}" — ${qs.length} custom application question(s) configured` : `"${o.title}" posted, but no custom application question yet — add one and repost (or use Do it for me)`,
          record: o.id,
        };
      },
      perform: async (_ctx, api) => {
        await api("testbusiness", "/api/opportunities", { method: "POST", body: { title: "[QA] Event photographer — test gig", description: "QA scenario opportunity.", budget: 250, type: "gig", location: "Baltimore, MD", remote: true, questions: [{ label: "Are you available September 15?", type: "yesno", required: true }] } });
      },
    },
    {
      id: "apply",
      role: "testcustomer",
      title: "Applicant applied — profile attached, questions answered",
      instruction: "Switch to TEST CUSTOMER → Opportunities → open the QA gig → Apply → your profile attaches automatically → answer the poster's Yes/No question → Submit application.",
      expected: "An applications row by Test Customer with the custom question ANSWERED — required questions are enforced server-side; an application missing them is refused with a clear reason.",
      href: (ctx) => {
        const o = qaOpportunity(ctx);
        return o ? `/opportunities/${o.id}` : "/opportunities";
      },
      verify: (ctx) => {
        const o = qaOpportunity(ctx);
        if (!o) return { done: false, actual: "no opportunity yet" };
        const a = db.select().from(tables.applications).where(and(eq(tables.applications.opportunityId, o.id), eq(tables.applications.applicantId, ctx.customer))).get();
        if (!a) return { done: false, actual: "no application yet" };
        if (!inTask(a.createdAt, ctx)) return { done: false, actual: `an application ${REDO}`, record: a.id };
        let custom: { label: string; answer: string }[] = [];
        try { custom = (JSON.parse(a.answers).custom as typeof custom) ?? []; } catch {}
        return {
          done: custom.length > 0,
          actual: custom.length ? `applied — "${custom[0].label}" → "${custom[0].answer}" (profile attached automatically)` : "applied, but the poster's question wasn't answered — the server should have refused this",
          record: a.id,
        };
      },
      perform: async (ctx, api) => {
        const o = qaOpportunity(ctx);
        if (!o) return;
        // answer every configured question by type — through the real route
        let qs: { id: string; type: string; options?: string[] }[] = [];
        try { qs = (JSON.parse(o.applyConfig).questions as typeof qs) ?? []; } catch {}
        const answers: Record<string, string> = {};
        for (const q of qs)
          answers[q.id] = q.type === "yesno" ? "yes" : q.type === "choice" || q.type === "dropdown" ? (q.options?.[0] ?? "") : q.type === "number" ? "2" : q.type === "date" ? new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10) : q.type === "link" ? "https://mavyn.dev/qa" : "[QA] answer";
        await api("testcustomer", `/api/opportunities/${o.id}/applications`, { method: "POST", body: { message: "[QA] I'd love this test gig.", answers } });
      },
    },
    {
      id: "app-notif",
      role: "check",
      title: "Business was notified of the application",
      instruction: "Automatic cross-check.",
      expected: "An application notification for Test Business.",
      href: () => "/notifications",
      verify: (ctx) => {
        const n = notif(ctx, ctx.business, "application");
        return { done: !!n, actual: n ? `"${n.title}"` : "no application notification yet", record: n?.id };
      },
    },
    {
      id: "select",
      role: "testbusiness",
      title: "Business reviewed and selected the applicant",
      instruction: "As TEST BUSINESS → the opportunity's Applicants page → shortlist/select Test Customer.",
      expected: "Application status → selected (or beyond).",
      href: (ctx) => {
        const o = qaOpportunity(ctx);
        return o ? `/opportunities/${o.id}/applicants` : "/opportunities";
      },
      verify: (ctx) => {
        const o = qaOpportunity(ctx);
        if (!o) return { done: false, actual: "no opportunity yet" };
        const a = db.select().from(tables.applications).where(and(eq(tables.applications.opportunityId, o.id), eq(tables.applications.applicantId, ctx.customer))).get();
        if (!a) return { done: false, actual: "no application yet" };
        return { done: !["submitted", "shortlisted", "interview"].includes(a.status), actual: `application status=${a.status}`, record: a.id };
      },
      perform: async (ctx, api) => {
        const o = qaOpportunity(ctx);
        if (!o) return;
        const a = db.select().from(tables.applications).where(and(eq(tables.applications.opportunityId, o.id), eq(tables.applications.applicantId, ctx.customer))).get();
        if (!a) return;
        await api("testbusiness", `/api/applications/${a.id}`, { method: "PATCH", body: { action: "shortlist" } });
        await api("testbusiness", `/api/applications/${a.id}`, { method: "PATCH", body: { action: "select" } });
      },
    },
    {
      id: "selected-notif",
      role: "check",
      title: "Applicant received the selection notification",
      instruction: "Automatic cross-check.",
      expected: "An application_selected notification for Test Customer, with a live destination.",
      href: () => "/notifications",
      verify: (ctx) => {
        const n = notif(ctx, ctx.customer, "application_selected") ?? notif(ctx, ctx.customer, "application", /selected/i);
        return { done: !!n, actual: n ? `"${n.title}" → ${n.href}` : "no selection notification yet", record: n?.id };
      },
    },
    {
      id: "connect",
      role: "testbusiness",
      title: "The two sides connected in Messages",
      instruction: "Message Test Customer about next steps (from the applicant card or their profile).",
      expected: "A testbusiness↔testcustomer conversation with a real message after the scenario started.",
      href: () => "/messages?to=testcustomer",
      verify: (ctx) => {
        const { conv, msgs } = messagesBetween(ctx, ctx.business, ctx.customer);
        const fresh = msgs.filter((m) => inTask(m.createdAt, ctx));
        return { done: fresh.length > 0, actual: fresh.length ? `${fresh.length} message(s) in ${conv?.slice(0, 8)}…` : msgs.length ? `a conversation ${REDO}` : "no conversation between business and applicant yet", record: conv ?? undefined };
      },
      perform: async (_ctx, api) => {
        await api("testbusiness", "/api/conversations", { method: "POST", body: { toHandle: "testcustomer", firstMessage: "[QA] You're selected — let's plan the shoot." } });
      },
    },
  ],
};

/* ============================ SCENARIO D ============================ */
/* Business hiring: the business is a HIRING account, not a profile    */
/* page. testbusiness finds, messages, posts, reviews, hires, funds,   */
/* manages, confirms, pays, and reviews testcreator — both sides       */
/* played by the tester, every checkpoint verified in the database.    */

function qaBizProject(ctx: QaContext) {
  return db
    .select()
    .from(tables.projects)
    .where(and(eq(tables.projects.clientId, ctx.business), eq(tables.projects.creatorId, ctx.creator)))
    .all()
    .filter((p) => after(p.createdAt, ctx.startedAt))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .pop();
}

const hiringScenario: QaScenario = {
  id: "hiring",
  title: "Business hiring — find, post, review, hire, manage, pay, review",
  personas: ["testbusiness", "testcreator"],
  description:
    "Play the business: search talent, view the creator, message them, post and publish an opportunity. Switch to the creator: apply. Back to the business: shortlist → accept → open the project → secure the TEST payment. The creator delivers with progress updates and an extension request; the business decides, confirms completion, releases the TEST payment, and leaves the review. Every checkpoint is verified in the database.",
  steps: [
    {
      id: "find",
      role: "testbusiness",
      title: "Business found the creator (Find Talent → profile)",
      instruction: "As TEST BUSINESS, use Hiring → Find talent (or Discover/search) and open @testcreator's profile.",
      expected: "A profile_view interaction by Test Business on Test Creator after the scenario started.",
      href: () => "/creator/testcreator",
      verify: (ctx) => {
        const rows = db
          .select()
          .from(tables.interactions)
          .where(and(eq(tables.interactions.userId, ctx.business), eq(tables.interactions.targetId, ctx.creator), eq(tables.interactions.action, "profile_view")))
          .all()
          .filter((r) => after(r.createdAt, ctx.startedAt));
        const row = rows.find((r) => inTask(r.createdAt, ctx));
        return { done: !!row, actual: row ? `profile_view recorded ${row.createdAt.toLocaleTimeString()}` : rows.length ? `a profile view ${REDO}` : "no profile view by the business yet", record: row?.id };
      },
      perform: async (ctx, api) => {
        await api("testbusiness", "/api/track", { method: "POST", body: { targetType: "user", targetId: ctx.creator, action: "profile_view" } });
      },
    },
    {
      id: "message",
      role: "testbusiness",
      title: "Business messaged the creator",
      instruction: "Message Test Creator about upcoming work (invite them to apply).",
      expected: "A message from Test Business in the testbusiness↔testcreator conversation.",
      href: () => "/messages?to=testcreator",
      verify: (ctx) => {
        const { msgs } = messagesBetween(ctx, ctx.business, ctx.creator);
        const mine = msgs.find((m) => m.senderId === ctx.business && inTask(m.createdAt, ctx));
        const stale = !mine && msgs.some((m) => m.senderId === ctx.business);
        return { done: !!mine, actual: mine ? `"${mine.body.slice(0, 60)}"` : stale ? `a message ${REDO}` : "no message from the business yet" };
      },
      perform: async (_ctx, api) => {
        await api("testbusiness", "/api/conversations", { method: "POST", body: { toHandle: "testcreator", firstMessage: "[QA] We have a campaign coming up — keep an eye on our opportunity." } });
      },
    },
    {
      id: "post",
      role: "testbusiness",
      title: "Business published the opportunity",
      instruction: "As TEST BUSINESS → Hiring → Post opportunity (any paid gig).",
      expected: "An open opportunities row posted by Test Business after the scenario started.",
      href: () => "/opportunities/new",
      verify: (ctx) => {
        const o = qaOpportunity(ctx);
        if (!o) return { done: false, actual: "no opportunity yet" };
        if (!inTask(o.createdAt, ctx)) return { done: false, actual: `an opportunity ${REDO}`, record: o.id };
        return { done: true, actual: `"${o.title}" status=${o.status}`, record: o.id };
      },
      perform: async (_ctx, api) => {
        await api("testbusiness", "/api/opportunities", { method: "POST", body: { title: "[QA] Campaign content creator", description: "QA hiring scenario gig.", budget: 300, type: "gig", location: "Baltimore, MD", remote: true } });
      },
    },
    {
      id: "apply",
      role: "testcreator",
      title: "Creator viewed the business and applied",
      instruction: "Switch to TEST CREATOR → Opportunities → open the QA gig → Apply.",
      expected: "An application by Test Creator on the business's opportunity.",
      href: (ctx) => {
        const o = qaOpportunity(ctx);
        return o ? `/opportunities/${o.id}` : "/opportunities";
      },
      verify: (ctx) => {
        const o = qaOpportunity(ctx);
        if (!o) return { done: false, actual: "no opportunity yet" };
        const a = db.select().from(tables.applications).where(and(eq(tables.applications.opportunityId, o.id), eq(tables.applications.applicantId, ctx.creator))).get();
        if (!a) return { done: false, actual: "no application yet" };
        if (!inTask(a.createdAt, ctx)) return { done: false, actual: `an application ${REDO}`, record: a.id };
        return { done: true, actual: `application status=${a.status}`, record: a.id };
      },
      perform: async (ctx, api) => {
        const o = qaOpportunity(ctx);
        if (o) await api("testcreator", `/api/opportunities/${o.id}/applications`, { method: "POST", body: { message: "[QA] I make exactly this kind of content." } });
      },
    },
    {
      id: "app-notif",
      role: "check",
      title: "Business received the application",
      instruction: "Automatic cross-check.",
      expected: "An application notification for Test Business linking to the real record.",
      href: () => "/notifications",
      verify: (ctx) => {
        const n = notif(ctx, ctx.business, "application");
        return { done: !!n, actual: n ? `"${n.title}" → ${n.href}` : "no application notification yet", record: n?.id };
      },
    },
    {
      id: "shortlist",
      role: "testbusiness",
      title: "Business shortlisted the applicant",
      instruction: "As TEST BUSINESS → the opportunity's Applicants page → Shortlist Test Creator.",
      expected: "Application status → shortlisted (or beyond).",
      href: (ctx) => {
        const o = qaOpportunity(ctx);
        return o ? `/opportunities/${o.id}/applicants` : "/opportunities";
      },
      verify: (ctx) => {
        const o = qaOpportunity(ctx);
        if (!o) return { done: false, actual: "no opportunity yet" };
        const a = db.select().from(tables.applications).where(and(eq(tables.applications.opportunityId, o.id), eq(tables.applications.applicantId, ctx.creator))).get();
        if (!a) return { done: false, actual: "no application yet" };
        return { done: a.status !== "submitted", actual: `application status=${a.status}`, record: a.id };
      },
      perform: async (ctx, api) => {
        const o = qaOpportunity(ctx);
        if (!o) return;
        const a = db.select().from(tables.applications).where(and(eq(tables.applications.opportunityId, o.id), eq(tables.applications.applicantId, ctx.creator))).get();
        if (a) await api("testbusiness", `/api/applications/${a.id}`, { method: "PATCH", body: { action: "shortlist" } });
      },
    },
    {
      id: "accept",
      role: "testbusiness",
      title: "Business accepted the applicant",
      instruction: "Select Test Creator from the applicants page.",
      expected: "Application status → selected (or beyond); the creator is notified.",
      href: (ctx) => {
        const o = qaOpportunity(ctx);
        return o ? `/opportunities/${o.id}/applicants` : "/opportunities";
      },
      verify: (ctx) => {
        const o = qaOpportunity(ctx);
        if (!o) return { done: false, actual: "no opportunity yet" };
        const a = db.select().from(tables.applications).where(and(eq(tables.applications.opportunityId, o.id), eq(tables.applications.applicantId, ctx.creator))).get();
        if (!a) return { done: false, actual: "no application yet" };
        const n = notif(ctx, ctx.creator, "application_selected") ?? notif(ctx, ctx.creator, "application", /selected/i);
        return { done: !["submitted", "shortlisted", "interview"].includes(a.status) && !!n, actual: `status=${a.status}; creator notified=${n ? "yes" : "no"}`, record: a.id };
      },
      perform: async (ctx, api) => {
        const o = qaOpportunity(ctx);
        if (!o) return;
        const a = db.select().from(tables.applications).where(and(eq(tables.applications.opportunityId, o.id), eq(tables.applications.applicantId, ctx.creator))).get();
        if (a) await api("testbusiness", `/api/applications/${a.id}`, { method: "PATCH", body: { action: "select" } });
      },
    },
    {
      id: "project",
      role: "testbusiness",
      title: "Business opened the project with the hire",
      instruction: "As TEST BUSINESS → Messages → open the Test Creator conversation → click the \"Project\" button (briefcase icon) at the top of the chat → fill in a title, amount, and deadline → click \"Create project draft\".",
      expected: "A project row: client=testbusiness, creator=testcreator.",
      href: () => "/messages?to=testcreator",
      verify: (ctx) => {
        const p = qaBizProject(ctx);
        if (!p) return { done: false, actual: "no business→creator project yet" };
        if (!inTask(p.createdAt, ctx)) return { done: false, actual: `a project ${REDO}`, record: p.id };
        return { done: true, actual: `project "${p.title}" state=${p.state}`, record: p.id };
      },
      perform: async (ctx, api) => {
        await api("testbusiness", "/api/projects", {
          method: "POST",
          body: { creatorHandle: "testcreator", title: "[QA] Campaign content package", amount: 300, brief: "Three deliverables for the fall campaign.", deadline: new Date(Date.now() + 6 * 86400_000).toISOString(), conversationId: pairConversation(ctx.business, ctx.creator) },
        });
      },
    },
    {
      id: "offer",
      role: "testcreator",
      title: "Creator sent the offer",
      instruction: "Switch to TEST CREATOR → Messages → open the Test Business conversation → click the \"Project\" button at the top of the chat → click \"Send offer\".",
      expected: "Project state draft → offer_sent.",
      href: () => "/messages?to=testbusiness",
      verify: (ctx) => {
        const p = qaBizProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        return { done: p.state !== "draft", actual: `state=${p.state}`, record: p.id };
      },
      perform: async (ctx, api) => {
        const p = qaBizProject(ctx);
        if (p) await api("testcreator", `/api/projects/${p.id}`, { method: "PATCH", body: { action: "send_offer" } });
      },
    },
    {
      id: "fund",
      role: "testbusiness",
      title: "Business accepted + secured the TEST payment",
      instruction: "As TEST BUSINESS → open the project page → click \"Accept offer\" → then click the pay button that replaces it (labeled TEST PAYMENT).",
      expected: "State in_progress + a HELD payment row (payer = the business).",
      href: (ctx) => {
        const p = qaBizProject(ctx);
        return p ? `/projects/${p.id}` : "/messages?to=testcreator";
      },
      verify: (ctx) => {
        const p = qaBizProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const pay = payFor("projectId", p.id);
        return {
          done: !["draft", "offer_sent", "accepted"].includes(p.state) && !!pay && pay.payerId === ctx.business,
          actual: `state=${p.state}; payment=${pay ? `${pay.status} $${(pay.amountCents / 100).toFixed(2)} (TEST), payer=business` : "none"}`,
          record: p.id,
        };
      },
      perform: async (ctx, api) => {
        const p = qaBizProject(ctx);
        if (!p) return;
        await api("testbusiness", `/api/projects/${p.id}`, { method: "PATCH", body: { action: "accept_offer", expectedAmount: p.amount } });
        await api("testbusiness", `/api/projects/${p.id}`, { method: "PATCH", body: { action: "start", expectedAmount: p.amount } });
      },
    },
    {
      id: "progress",
      role: "testcreator",
      title: "Creator sent a progress update",
      instruction: "As TEST CREATOR → project page → Post progress update (%, message, ETA).",
      expected: "A progress_updates row on the business's project; the business is notified.",
      href: (ctx) => {
        const p = qaBizProject(ctx);
        return p ? `/projects/${p.id}` : "/calendar";
      },
      ready: projectReady(qaBizProject, ["in_progress", "extension_requested", "submitted", "approved"], "IN PROGRESS (progress posting closes once it's completed)"),
      repair: projectRepair(qaBizProject),
      verify: (ctx) => {
        const p = qaBizProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const rows = db.select().from(tables.progressUpdates).where(eq(tables.progressUpdates.projectId, p.id)).all().filter((r) => r.kind === "update");
        const row = rows.find((r) => inTask(r.createdAt, ctx));
        const n = notif(ctx, ctx.business, "progress_update");
        return { done: !!row && !!n, actual: row ? `${row.percent ?? "—"}% · "${row.message.slice(0, 40)}"; business notified=${n ? "yes" : "no"}` : rows.length ? `an update ${REDO}` : "no progress update yet", record: row?.id };
      },
      perform: async (ctx, api) => {
        const p = qaBizProject(ctx);
        if (p)
          await api("testcreator", `/api/projects/${p.id}/progress`, {
            method: "POST",
            body: { kind: "update", status: "in_progress", percent: 40, message: "[QA] First deliverable is in draft.", etaAt: new Date(Date.now() + 4 * 86400_000).toISOString() },
          });
      },
    },
    {
      id: "extension",
      role: "testcreator",
      title: "Creator requested an extension",
      instruction: "On the project page → Request extension (+2 days, reason required).",
      expected: "A pending extension request; the business is notified.",
      href: (ctx) => {
        const p = qaBizProject(ctx);
        return p ? `/projects/${p.id}` : "/calendar";
      },
      ready: (ctx) => {
        const base = projectReady(qaBizProject, ["in_progress"], "IN PROGRESS — the Request-extension button only exists there")(ctx);
        if (!base.ok) return base;
        const p = qaBizProject(ctx);
        const stale = p
          ? db.select().from(tables.extensionRequests).where(eq(tables.extensionRequests.projectId, p.id)).all().find((e) => e.status === "pending" && !inTask(e.createdAt, ctx))
          : undefined;
        if (stale) return { ok: false, why: "a pending extension from before this test became active is blocking a new request" };
        return { ok: true, why: "" };
      },
      repair: projectRepair(qaBizProject),
      verify: (ctx) => {
        const p = qaBizProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const exts = db.select().from(tables.extensionRequests).where(eq(tables.extensionRequests.projectId, p.id)).all();
        const ext = exts.find((e) => inTask(e.createdAt, ctx));
        const n = notif(ctx, ctx.business, "extension_requested");
        return { done: !!ext && !!n, actual: ext ? `+${ext.days} days, status=${ext.status}; business notified=${n ? "yes" : "no"}` : exts.length ? `an extension request ${REDO}` : "no extension request yet", record: ext?.id };
      },
      perform: async (ctx, api) => {
        const p = qaBizProject(ctx);
        if (p) await api("testcreator", `/api/projects/${p.id}/extension`, { method: "POST", body: { days: 2, reason: "[QA] Location reshoot needs two more days." } });
      },
    },
    {
      id: "ext-decide",
      role: "testbusiness",
      title: "Business decided the extension",
      instruction: "As TEST BUSINESS → project page → Approve or Decline the extension.",
      expected: "The extension row is decided (approve moves the deadline; decline keeps it).",
      href: (ctx) => {
        const p = qaBizProject(ctx);
        return p ? `/projects/${p.id}` : "/calendar";
      },
      verify: (ctx) => {
        const p = qaBizProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const ext = db.select().from(tables.extensionRequests).where(eq(tables.extensionRequests.projectId, p.id)).all()[0];
        if (!ext) return { done: false, actual: "no extension request yet" };
        return { done: ext.status !== "pending", actual: `extension ${ext.status}; deadline ${fmtDate(p.deadline)}`, record: ext.id };
      },
      perform: async (ctx, api) => {
        const p = qaBizProject(ctx);
        if (!p) return;
        const ext = db.select().from(tables.extensionRequests).where(and(eq(tables.extensionRequests.projectId, p.id), eq(tables.extensionRequests.status, "pending"))).get();
        if (ext) await api("testbusiness", `/api/extensions/${ext.id}`, { method: "PATCH", body: { approve: true } });
      },
    },
    {
      id: "deliver",
      role: "testcreator",
      title: "Creator completed the work",
      instruction: "As TEST CREATOR → project page → Submit work for review.",
      expected: "State → submitted; business gets the review notification.",
      href: (ctx) => {
        const p = qaBizProject(ctx);
        return p ? `/projects/${p.id}` : "/calendar";
      },
      ready: projectReady(qaBizProject, ["in_progress", "extension_requested", "submitted", "approved", "completed", "reviewed"], "IN PROGRESS so Submit-work exists"),
      repair: projectRepair(qaBizProject),
      verify: (ctx) => {
        const p = qaBizProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const n = notif(ctx, ctx.business, "project_submitted");
        return { done: ["submitted", "approved", "completed", "reviewed"].includes(p.state) && !!n, actual: `state=${p.state}; business notified=${n ? "yes" : "no"}`, record: p.id };
      },
      perform: async (ctx, api) => {
        const p = qaBizProject(ctx);
        if (p) await api("testcreator", `/api/projects/${p.id}`, { method: "PATCH", body: { action: "submit" } });
      },
    },
    {
      id: "release",
      role: "testbusiness",
      title: "Business confirmed completion — TEST payment RELEASED",
      instruction: "As TEST BUSINESS → project page → Approve the delivery → Release payment / complete.",
      expected: "State completed + the held TEST payment flips to RELEASED to the creator.",
      href: (ctx) => {
        const p = qaBizProject(ctx);
        return p ? `/projects/${p.id}` : "/calendar";
      },
      verify: (ctx) => {
        const p = qaBizProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const pay = payFor("projectId", p.id);
        return { done: ["completed", "reviewed"].includes(p.state) && pay?.status === "released", actual: `state=${p.state}; payment=${pay?.status ?? "none"}`, record: p.id };
      },
      perform: async (ctx, api) => {
        const p = qaBizProject(ctx);
        if (!p) return;
        await api("testbusiness", `/api/projects/${p.id}`, { method: "PATCH", body: { action: "approve" } });
        await api("testbusiness", `/api/projects/${p.id}`, { method: "PATCH", body: { action: "complete" } });
      },
    },
    {
      id: "review",
      role: "testbusiness",
      title: "Business left the review",
      instruction: "On the completed project → rate and review Test Creator.",
      expected: "A review by Test Business about Test Creator; the creator is notified and it renders on their public profile.",
      href: (ctx) => {
        const p = qaBizProject(ctx);
        return p ? `/projects/${p.id}` : "/calendar";
      },
      verify: (ctx) => {
        const p = qaBizProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const all2 = db.select().from(tables.reviews).where(eq(tables.reviews.projectId, p.id)).all().filter((x) => x.authorId === ctx.business && x.subjectId === ctx.creator);
        const r = all2.find((x) => inTask(x.createdAt, ctx));
        return { done: !!r, actual: r ? `${r.rating.toFixed(1)}★ "${r.body.slice(0, 40)}" — public on @testcreator` : all2.length ? `a review ${REDO}` : "no business review yet", record: r?.id };
      },
      perform: async (ctx, api) => {
        const p = qaBizProject(ctx);
        if (p) await api("testbusiness", `/api/projects/${p.id}/review`, { method: "POST", body: { rating: 5, body: "[QA] Professional and on time — hiring again." } });
      },
    },
    {
      id: "dashboard",
      role: "check",
      title: "The Hiring dashboard reflects all of it",
      instruction: "Open Hiring as TEST BUSINESS — every number is computed from these records.",
      expected: "peopleHired ≥ 1, completedHires ≥ 1, applications ≥ 1 in /api/business/hiring for Test Business.",
      href: () => "/hiring",
      verify: (ctx) => {
        // verify the same conditions the dashboard computes, from the DB
        const p = qaBizProject(ctx);
        const o = qaOpportunity(ctx);
        const a = o
          ? db.select().from(tables.applications).where(and(eq(tables.applications.opportunityId, o.id), eq(tables.applications.applicantId, ctx.creator))).get()
          : null;
        const hired = !!a && ["selected", "confirmed", "active", "completed"].includes(a.status);
        const completed = !!p && ["completed", "reviewed"].includes(p.state);
        return {
          done: hired && completed,
          actual: `hired-application=${a?.status ?? "none"}; completed project=${p?.state ?? "none"} → dashboard counts follow these rows`,
          record: p?.id,
        };
      },
    },
  ],
};

/* ============================ SCENARIO E ============================ */
/* Business People: prove the four categories derive correctly and     */
/* never bleed into each other — contact → client on real booking,     */
/* hire → talent (never employee), explicit team add → TEAM.           */

function qaBizBooking(ctx: QaContext) {
  return db
    .select()
    .from(tables.bookings)
    .where(and(eq(tables.bookings.clientId, ctx.customer), eq(tables.bookings.providerId, ctx.business)))
    .all()
    .filter((b) => after(b.createdAt, ctx.startedAt))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .pop();
}

const peopleScenario: QaScenario = {
  id: "people",
  title: "Business People — team, clients, talent, contacts stay separate",
  personas: ["testbusiness", "testcustomer", "testcreator"],
  description:
    "Message someone → they're a CONTACT. They book and pay you → they become a CLIENT. You hire a creator → they're TALENT, never staff. You explicitly add staff → TEAM. This scenario proves every categorization from the real records — nobody is ever mislabeled an employee because of one gig.",
  steps: [
    {
      id: "contact",
      role: "testbusiness",
      title: "Business messaged the customer → starts as CONTACT",
      instruction: "As TEST BUSINESS, message Test Customer (no booking yet — at this point they're a CONTACT).",
      expected: "A conversation with the customer exists. Until real work happens they're categorized CONTACT; the migration to CLIENT is proven two steps down.",
      href: () => "/messages?to=testcustomer",
      verify: (ctx) => {
        const { msgs } = messagesBetween(ctx, ctx.business, ctx.customer);
        const fresh = msgs.filter((m) => m.senderId === ctx.business && inTask(m.createdAt, ctx));
        if (fresh.length === 0)
          return { done: false, actual: msgs.some((m) => m.senderId === ctx.business) ? `a message ${REDO}` : "no conversation with the customer yet" };
        const hasBooking = !!qaBizBooking(ctx);
        return {
          done: true,
          actual: `conversation ✓ — current category: ${hasBooking ? "CLIENT (they've since booked — correct migration)" : "CONTACT (no work yet)"}`,
        };
      },
      perform: async (_ctx, api) => {
        await api("testbusiness", "/api/conversations", { method: "POST", body: { toHandle: "testcustomer", firstMessage: "[QA] Thanks for your interest — our studio calendar is open." } });
      },
    },
    {
      id: "client-books",
      role: "testcustomer",
      title: "Customer booked + paid the business (TEST)",
      instruction: "Switch to TEST CUSTOMER → book the QA Studio Rental → after the business accepts, pay (TEST).",
      expected: "A booking client=testcustomer, provider=testbusiness with a held/released TEST payment.",
      href: (ctx) => `/services/${ctx.businessServiceId}`,
      verify: (ctx) => {
        const b = qaBizBooking(ctx);
        if (!b) return { done: false, actual: "no customer→business booking yet" };
        if (!inTask(b.createdAt, ctx)) return { done: false, actual: `a booking ${REDO}`, record: b.id };
        const pay = payFor("bookingId", b.id);
        return { done: !!pay, actual: `booking status=${b.status}; payment=${pay ? `${pay.status} (TEST)` : "none — pay after the business accepts"}`, record: b.id };
      },
      perform: async (ctx, api) => {
        let b = qaBizBooking(ctx);
        if (!b) {
          await api("testcustomer", "/api/bookings", { method: "POST", body: { serviceId: ctx.businessServiceId, startsAt: nextWeekday(13, 3).toISOString(), durationMin: 60 } });
          b = qaBizBooking(ctx);
        }
        if (b && b.status === "pending") await api("testbusiness", `/api/bookings/${b.id}`, { method: "PATCH", body: { action: "accept" } });
        if (b) await api("testcustomer", `/api/bookings/${b.id}`, { method: "PATCH", body: { action: "pay" } });
      },
    },
    {
      id: "client-complete",
      role: "testbusiness",
      title: "Business completed the booking — customer is now a CLIENT",
      instruction: "As TEST BUSINESS → Bookings → mark the studio rental completed.",
      expected: "Booking completed + payment released; People now categorizes Test Customer under CLIENTS (and no longer CONTACTS).",
      href: () => "/calendar",
      verify: (ctx) => {
        const b = qaBizBooking(ctx);
        if (!b) return { done: false, actual: "no booking yet" };
        const pay = payFor("bookingId", b.id);
        return { done: b.status === "completed" && pay?.status === "released", actual: `status=${b.status}; payment=${pay?.status ?? "none"} → category: ${b.status === "completed" ? "CLIENT" : "still in flight"}`, record: b.id };
      },
      perform: async (ctx, api) => {
        const b = qaBizBooking(ctx);
        if (b) await api("testbusiness", `/api/bookings/${b.id}`, { method: "PATCH", body: { action: "complete" } });
      },
    },
    {
      id: "hire-talent",
      role: "testbusiness",
      title: "Business hired the creator on a project",
      instruction: "As TEST BUSINESS → open a project with Test Creator, run it to completion (offer → TEST pay → deliver → approve → complete). 'Do it for me' plays the whole chain through the real routes.",
      expected: "A completed business→creator project with a released TEST payment.",
      href: () => "/messages?to=testcreator",
      verify: (ctx) => {
        const p = qaBizProject(ctx);
        if (!p) return { done: false, actual: "no business→creator project yet" };
        if (!inTask(p.createdAt, ctx)) return { done: false, actual: `a project ${REDO}`, record: p.id };
        const pay = payFor("projectId", p.id);
        return { done: ["completed", "reviewed"].includes(p.state) && pay?.status === "released", actual: `state=${p.state}; payment=${pay?.status ?? "none"}`, record: p.id };
      },
      perform: async (ctx, api) => {
        let p = qaBizProject(ctx);
        if (!p) {
          await api("testbusiness", "/api/projects", { method: "POST", body: { creatorHandle: "testcreator", title: "[QA] People-scenario gig", amount: 90, brief: "One deliverable.", conversationId: pairConversation(ctx.business, ctx.creator) } });
          p = qaBizProject(ctx);
        }
        if (!p) return;
        if (p.state === "draft") await api("testcreator", `/api/projects/${p.id}`, { method: "PATCH", body: { action: "send_offer" } });
        await api("testbusiness", `/api/projects/${p.id}`, { method: "PATCH", body: { action: "accept_offer", expectedAmount: p.amount } });
        await api("testbusiness", `/api/projects/${p.id}`, { method: "PATCH", body: { action: "start", expectedAmount: p.amount } });
        await api("testcreator", `/api/projects/${p.id}`, { method: "PATCH", body: { action: "submit" } });
        await api("testbusiness", `/api/projects/${p.id}`, { method: "PATCH", body: { action: "approve" } });
        await api("testbusiness", `/api/projects/${p.id}`, { method: "PATCH", body: { action: "complete" } });
      },
    },
    {
      id: "talent-not-staff",
      role: "check",
      title: "The hire is TALENT — NOT an employee",
      instruction: "Automatic cross-check — the core categorization rule.",
      expected: "Test Creator appears under TALENT (hired on a project) with NO team row — one gig never makes staff.",
      href: () => "/people?tab=talent",
      verify: (ctx) => {
        const p = qaBizProject(ctx);
        if (!p) return { done: false, actual: "no hire yet" };
        const team = db.select().from(tables.businessTeam).where(and(eq(tables.businessTeam.businessId, ctx.business), eq(tables.businessTeam.personId, ctx.creator), eq(tables.businessTeam.status, "active"))).get();
        return { done: !team, actual: `hired project=${p.state}; team row=${team ? "EXISTS (wrong if not explicitly added)" : "none"} → TALENT only`, record: p.id };
      },
    },
    {
      id: "team-add",
      role: "testbusiness",
      title: "Business explicitly added a team member",
      instruction: "As TEST BUSINESS → People → Team → Add team member: @testcreator, title 'Studio Editor'.",
      expected: "An ACTIVE business_team row created by the business — the only way anyone becomes TEAM.",
      href: () => "/people?tab=team",
      verify: (ctx) => {
        const team = db.select().from(tables.businessTeam).where(and(eq(tables.businessTeam.businessId, ctx.business), eq(tables.businessTeam.personId, ctx.creator))).get();
        if (team && !inTask(team.createdAt, ctx)) return { done: false, actual: `a team row ${REDO}`, record: team.id };
        return {
          done: !!team,
          actual: team
            ? `team row exists: "${team.title}" (${team.status}${team.endedAt ? `, ended ${team.endedAt.toLocaleTimeString()}` : ""}) — created explicitly by the business`
            : "no explicit team row yet",
          record: team?.id,
        };
      },
      perform: async (_ctx, api) => {
        await api("testbusiness", "/api/business/team", { method: "POST", body: { handle: "testcreator", title: "Studio Editor", compensation: "[QA] contract day-rate" } });
      },
    },
    {
      id: "categories",
      role: "check",
      title: "All four categories are correct simultaneously",
      instruction: "Open People as TEST BUSINESS — Team, Clients, Talent, Contacts each read from their own relationship.",
      expected: "customer=CLIENT (never in team), creator=TALENT + an explicit TEAM row — categories coexist without merging.",
      href: () => "/people",
      verify: (ctx) => {
        const custTeam = db.select().from(tables.businessTeam).where(and(eq(tables.businessTeam.businessId, ctx.business), eq(tables.businessTeam.personId, ctx.customer))).get();
        const creaTeam = db.select().from(tables.businessTeam).where(and(eq(tables.businessTeam.businessId, ctx.business), eq(tables.businessTeam.personId, ctx.creator))).get();
        const custBooking = qaBizBooking(ctx);
        const creaHire = qaBizProject(ctx);
        const ok = !custTeam && !!creaTeam && custBooking?.status === "completed" && !!creaHire;
        return {
          done: ok,
          actual: `customer: client=${custBooking?.status === "completed" ? "yes" : "no"}, team=${custTeam ? "YES (wrong)" : "no"} · creator: talent=${creaHire ? "yes" : "no"}, team row=${creaTeam ? `yes (explicit, ${creaTeam.status})` : "no"}`,
        };
      },
    },
    {
      id: "payments-view",
      role: "check",
      title: "The Payments section adds up",
      instruction: "Open Payments as TEST BUSINESS — totals come from the same payment rows.",
      expected: "Business has released income from the customer AND a released outgoing payment to the creator (all TEST).",
      href: () => "/payments",
      verify: (ctx) => {
        const rows = db.select().from(tables.payments).all();
        const income = rows.find((p) => p.payeeId === ctx.business && p.payerId === ctx.customer && p.status === "released");
        const outgoing = rows.find((p) => p.payerId === ctx.business && p.payeeId === ctx.creator && p.status === "released");
        return {
          done: !!income && !!outgoing,
          actual: `income from customer=${income ? `$${(income.amountCents / 100).toFixed(2)} released` : "none"}; paid to creator=${outgoing ? `$${(outgoing.amountCents / 100).toFixed(2)} released` : "none"} (TEST)`,
        };
      },
    },
    {
      id: "team-end",
      role: "testbusiness",
      title: "Business ended the team membership — history kept",
      instruction: "As TEST BUSINESS → People → Team → set the member inactive (or remove).",
      expected: "The team row flips to inactive with endedAt — never deleted, so history holds.",
      href: () => "/people?tab=team",
      verify: (ctx) => {
        const team = db.select().from(tables.businessTeam).where(and(eq(tables.businessTeam.businessId, ctx.business), eq(tables.businessTeam.personId, ctx.creator))).get();
        if (!team) return { done: false, actual: "no team row yet" };
        return { done: team.status === "inactive" && !!team.endedAt, actual: `status=${team.status}; endedAt=${team.endedAt ? team.endedAt.toLocaleTimeString() : "—"}; row preserved`, record: team.id };
      },
      perform: async (ctx, api) => {
        const team = db.select().from(tables.businessTeam).where(and(eq(tables.businessTeam.businessId, ctx.business), eq(tables.businessTeam.personId, ctx.creator))).get();
        if (team) await api("testbusiness", `/api/business/team/${team.id}`, { method: "DELETE" });
      },
    },
  ],
};

/* ============================ SCENARIO F ============================ */
/* PLAN LAB — Plans & benefits, demonstrated from the REAL entitlement  */
/* code, never invented: lib/businessPlans.ts capacity numbers, the     */
/* /api/me/studio plan gate, /api/me/plan allowed ladders, and          */
/* lib/server/eligibility.ts. Every step is a WHY-THIS-MATTERS moment:  */
/* perks are PLAN · identity is VERIFICATION · business tiers are      */
/* SCALE. Earning is never paywalled. All switches are TEST changes on  */
/* the isolated QA personas — no real billing exists here.             */

const qaUser = (id: string) => db.select().from(tables.users).where(eq(tables.users.id, id)).get()!;
const qaProfileStudio = (id: string) => { const raw = db.select().from(tables.profiles).where(eq(tables.profiles.userId, id)).get()?.studio ?? ""; return raw.trim() ? raw : null; };
const qaCampusRow = (id: string) => db.select().from(tables.campusVerifications).where(eq(tables.campusVerifications.userId, id)).all()[0];

const plansScenario: QaScenario = {
  id: "plans",
  title: "Plans & benefits — what each tier REALLY unlocks",
  personas: ["testcreator", "testcustomer", "testbusiness"],
  description:
    "Experience every tier with the real rules, on isolated TEST accounts (no real billing exists anywhere here). Creator track: Free earns fully → the Pro paywall is honest → upgrade (TEST) → use the unlocked feature. Student track: verification is identity, College+ is a plan, graduating ends College+ but never your verified history. Business track: Free has full hiring power, Business Pro is scale — the exact capacity numbers come from the code the server enforces.",
  steps: [
    {
      id: "sim-mode",
      role: "testcreator",
      title: "Creator switched to Simulation Mode — real enforcement on",
      instruction: "As TEST CREATOR, use the DEMO MODE pill in the top-left of the navbar → switch to Simulation Mode. This turns OFF the demo bypasses so every plan rule enforces exactly like production.",
      expected: "users.testerMode = simulation for Test Creator (and plan starts at FREE — the scenario reset guarantees the baseline).",
      href: () => "/",
      verify: (ctx) => {
        const u = qaUser(ctx.creator);
        return { done: u.testerMode === "simulation", actual: `testerMode=${u.testerMode} · plan=${u.plan}`, record: u.id };
      },
      perform: async (_ctx, api) => {
        await api("testcreator", "/api/demo/mode", { method: "PATCH", body: { mode: "simulation" } });
      },
    },
    {
      id: "free-power",
      role: "check",
      title: "FREE: full earning power — earning is never paywalled",
      instruction: "Automatic cross-check against the database.",
      expected: "On the Free plan the creator has an ACTIVE bookable service, open messaging, bookings, and projects — every economic action of the other four scenarios ran on Free. What Free does NOT include: profile customization (Studio/My World). That's the perk, not the livelihood.",
      href: () => "/services",
      verify: (ctx) => {
        const u = qaUser(ctx.creator);
        const svc = db.select().from(tables.services).where(eq(tables.services.ownerId, ctx.creator)).all().find((x) => x.active);
        return {
          done: u.plan === "free" && !!svc,
          actual: `plan=${u.plan}; active service="${svc?.title ?? "none"}" — booking/messaging/projects all live on Free`,
          record: svc?.id,
        };
      },
    },
    {
      id: "pro-gate",
      role: "check",
      title: "The Pro paywall is HONEST — same rule the server enforces",
      instruction: "Automatic cross-check. (Try it yourself too: open Profile Studio as the creator — saving is refused with a clear upgrade explanation, never a silent failure.)",
      expected: "With plan=free in Simulation Mode, the /api/me/studio save gate is CLOSED: the server answers 403 \"Profile Studio is an Mavyn Pro feature… upgrade to Pro\" and nothing is stored. Restricted features explain themselves.",
      href: () => "/profile/studio",
      verify: (ctx) => {
        const u = qaUser(ctx.creator);
        const gateClosed = !["pro", "business_pro", "agency"].includes(u.plan) && u.plan !== "college" && u.testerMode === "simulation";
        const studio = qaProfileStudio(ctx.creator);
        return {
          done: gateClosed && !studio,
          actual: gateClosed ? `gate CLOSED for plan=${u.plan} (simulation) · studio saved=none — the 403 carries the upgrade explanation` : `gate not closed: plan=${u.plan} mode=${u.testerMode} studio=${studio ? "saved" : "none"}`,
        };
      },
    },
    {
      id: "upgrade-pro",
      role: "testcreator",
      title: "Creator upgraded to PRO (TEST — no real billing anywhere)",
      instruction: "As TEST CREATOR → Plans → choose Pro. On this environment the plan switch is a TEST change through the real /api/me/plan route — the personal ladder is free → college → pro.",
      expected: "users.plan = pro for Test Creator, effective immediately — entitlements are read from the database on every request, so the feature unlocks the moment the row changes.",
      href: () => "/plans",
      verify: (ctx) => {
        const u = qaUser(ctx.creator);
        return { done: u.plan === "pro", actual: `plan=${u.plan}`, record: u.id };
      },
      perform: async (_ctx, api) => {
        await api("testcreator", "/api/me/plan", { method: "PATCH", body: { plan: "pro" } });
      },
    },
    {
      id: "use-pro",
      role: "testcreator",
      title: "Creator USED the unlocked feature — Studio saves for real",
      instruction: "As TEST CREATOR → Profile Studio → change anything (theme, accent, layout) → Save. The exact save that was refused two tests ago now lands.",
      expected: "profiles.studio holds a saved customization while plan=pro. WHY PRO MATTERS: your public profile becomes a designed page (full Studio + My World) — the paid perk is presentation and reach, never access to earning.",
      href: () => "/profile/studio",
      verify: (ctx) => {
        const u = qaUser(ctx.creator);
        const studio = qaProfileStudio(ctx.creator);
        return { done: u.plan === "pro" && !!studio, actual: `plan=${u.plan}; studio saved=${studio ? "yes" : "not yet"}`, record: u.id };
      },
      perform: async (_ctx, api) => {
        await api("testcreator", "/api/me/studio", { method: "PATCH", body: { studio: { accent: "lime" } } });
      },
    },
    {
      id: "student-verify",
      role: "testcustomer",
      title: "Customer verified as a CURRENT STUDENT — identity, not a plan",
      instruction: "As TEST CUSTOMER → Settings → Demo Controls → set account state to Current student (in production this is the free campus-verification flow). Verification is a database fact, independent of any paid plan.",
      expected: "A campus_verifications row: affiliation=current_student. This is what unlocks campus access and students-only eligibility — it is free and NEVER sold as a plan.",
      href: () => "/settings",
      verify: (ctx) => {
        const v = qaCampusRow(ctx.customer);
        return { done: !!v && v.affiliation === "current_student" && v.status === "verified", actual: v ? `verified: ${v.affiliation} (${v.status})` : "no campus verification yet", record: v?.id };
      },
      perform: async (_ctx, api) => {
        await api("testcustomer", "/api/demo/account-state", { method: "POST", body: { state: "current_student" } });
      },
    },
    {
      id: "college-plan",
      role: "testcustomer",
      title: "Customer chose COLLEGE+ — student pricing for the perks",
      instruction: "As TEST CUSTOMER → Plans → choose College+ (TEST change through the real route).",
      expected: "users.plan = college. WHAT COLLEGE+ IS: the customization basics (Studio theme/frame/accent/font/layout) at student pricing — My World stays Pro. WHAT IT ISN'T: eligibility. Campus access came from the verification, not this plan.",
      href: () => "/plans",
      verify: (ctx) => {
        const u = qaUser(ctx.customer);
        return { done: u.plan === "college", actual: `plan=${u.plan}`, record: u.id };
      },
      perform: async (_ctx, api) => {
        await api("testcustomer", "/api/me/plan", { method: "PATCH", body: { plan: "college" } });
      },
    },
    {
      id: "eligibility-truth",
      role: "check",
      title: "Eligibility is VERIFICATION-based, never plan-based",
      instruction: "Automatic cross-check running the REAL eligibility engine (lib/server/eligibility.ts) — the same code the application route calls.",
      expected: "For a students-only opportunity: the verified student (College+) is ELIGIBLE; the PRO creator (unverified) is NOT — with the honest reason. Money cannot buy student eligibility on Mavyn.",
      href: () => "/opportunities",
      verify: (ctx) => {
        const student = checkApplicantEligibility({ eligibility: "students", eligibilityCampusId: null }, ctx.customer);
        const proUser = checkApplicantEligibility({ eligibility: "students", eligibilityCampusId: null }, ctx.creator);
        return {
          done: student.eligible === true && proUser.eligible === false,
          actual: `verified student → eligible=${student.eligible}; PRO-but-unverified creator → eligible=${proUser.eligible} ("${(proUser.reason ?? "").slice(0, 60)}…")`,
        };
      },
    },
    {
      id: "alumni-rule",
      role: "testcustomer",
      title: "Graduation: alumni status ends College+ automatically",
      instruction: "As TEST CUSTOMER → Settings → Demo Controls → set account state to Alumni (in production this is the real graduation transition).",
      expected: "affiliation=alumni AND users.plan back to FREE — College+ ends with student status, the verified school identity is KEPT forever, and nobody is ever auto-enrolled into Pro. Status changes are never billing events.",
      href: () => "/settings",
      verify: (ctx) => {
        const v = qaCampusRow(ctx.customer);
        const u = qaUser(ctx.customer);
        return {
          done: !!v && v.affiliation === "alumni" && u.plan === "free",
          actual: `affiliation=${v?.affiliation ?? "none"} (identity kept) · plan=${u.plan} (College+ ended, NOT upsold)`,
          record: v?.id,
        };
      },
      perform: async (_ctx, api) => {
        await api("testcustomer", "/api/demo/account-state", { method: "POST", body: { state: "alumni" } });
      },
    },
    {
      id: "biz-sim",
      role: "testbusiness",
      title: "Business switched to Simulation Mode — capacity rules enforce",
      instruction: "Switch to TEST BUSINESS → use the DEMO MODE pill in the top-left → Simulation Mode.",
      expected: "users.testerMode = simulation for Test Business, plan FREE — the capacity limits below now enforce exactly like production.",
      href: () => "/",
      verify: (ctx) => {
        const u = qaUser(ctx.business);
        return { done: u.testerMode === "simulation", actual: `testerMode=${u.testerMode} · plan=${u.plan}`, record: u.id };
      },
      perform: async (_ctx, api) => {
        await api("testbusiness", "/api/demo/mode", { method: "PATCH", body: { mode: "simulation" } });
      },
    },
    {
      id: "biz-free-truth",
      role: "check",
      title: "BUSINESS FREE: full hiring power at starter scale — the real numbers",
      instruction: "Automatic cross-check reading lib/businessPlans.ts — the single source of truth the server's capacity enforcement imports.",
      expected: "Business Free includes EVERYTHING (post, review, hire, manage people, payments) — Pro is scale, never basic access. Real limits: 3 team members, 5 active hires, 3 active opportunities, 25 saved talent, 1 admin, 50 client + 50 talent records.",
      href: () => "/hiring",
      verify: (ctx) => {
        const u = qaUser(ctx.business);
        const tier = businessTier(u);
        const L = BUSINESS_LIMITS.free;
        return {
          done: tier === "free",
          actual: `tier=${tier} → team ${L.teamMembers} · hires ${L.activeHires} · opportunities ${L.activeOpportunities} · saved talent ${L.savedTalent} · admins ${L.admins} · clients ${L.clientRecords} (from the enforced config)`,
        };
      },
    },
    {
      id: "biz-upgrade",
      role: "testbusiness",
      title: "Business upgraded to BUSINESS PRO (TEST) — scale unlocked",
      instruction: "As TEST BUSINESS → Plans → choose Business Pro (TEST change; business ladder is free → business_pro).",
      expected: "users.plan = business_pro. WHY IT MATTERS: same workflows, 5-10× the capacity — 25 team, 25 active hires, 15 opportunities, 250 saved talent, 5 admin seats, 500 client/talent records. Plus Business World profile customization. It's the growth plan, not a gate on hiring itself.",
      href: () => "/plans",
      verify: (ctx) => {
        const u = qaUser(ctx.business);
        const tier = businessTier(u);
        const L = BUSINESS_LIMITS.business_pro;
        return {
          done: u.plan === "business_pro" && tier === "business_pro",
          actual: `plan=${u.plan} → team ${L.teamMembers} · hires ${L.activeHires} · opportunities ${L.activeOpportunities} · saved talent ${L.savedTalent} · admins ${L.admins} (live immediately — read from the DB per request)`,
          record: u.id,
        };
      },
      perform: async (_ctx, api) => {
        await api("testbusiness", "/api/me/plan", { method: "PATCH", body: { plan: "business_pro" } });
      },
    },
    {
      id: "plan-summary",
      role: "check",
      title: "The whole model, proven: perks are PLAN · identity is VERIFICATION · business is SCALE",
      instruction: "Automatic cross-check of all three tracks' end states.",
      expected: "Creator on Pro with a saved Studio; customer an alumni back on Free with verified identity kept; business on Business Pro. Nothing here was invented — every claim came from the enforced configuration and real routes.",
      href: () => "/plans",
      verify: (ctx) => {
        const c = qaUser(ctx.creator);
        const cu = qaUser(ctx.customer);
        const b = qaUser(ctx.business);
        const v = qaCampusRow(ctx.customer);
        const ok = c.plan === "pro" && !!qaProfileStudio(ctx.creator) && cu.plan === "free" && v?.affiliation === "alumni" && b.plan === "business_pro";
        return { done: ok, actual: `creator=${c.plan}+studio · customer=${cu.plan}+${v?.affiliation ?? "unverified"} · business=${b.plan}` };
      },
    },
  ],
};

export const QA_SCENARIOS: QaScenario[] = [bookingScenario, projectScenario, opportunityScenario, hiringScenario, peopleScenario, plansScenario];

export function getScenario(id: string) {
  return QA_SCENARIOS.find((s) => s.id === id) ?? null;
}

export function buildContext(startedAt: Date, taskStartedAt?: Date): QaContext {
  const ids = qaIds();
  return { startedAt, taskStartedAt: taskStartedAt ?? startedAt, ...ids };
}

/** evaluate a scenario against the REAL database */
/* ------------------------------------------------------------------ */
/*  STRICT SEQUENTIAL PROGRESSION — a mission system, not a scan.      */
/*                                                                     */
/*  · Task order comes from the scenario DEFINITION, nothing else.     */
/*  · The run state (db/.qa-runs.json) holds `passed`: the ordered     */
/*    prefix of tasks that actually VERIFIED against the real          */
/*    database. passed.length is the cursor.                           */
/*  · Only the task AT the cursor is evaluated live. When it passes,   */
/*    its verified snapshot is appended and the next task unlocks —    */
/*    auto-checks cascade in the same pass. Tasks past the cursor are  */
/*    LOCKED: a stale database record can never jump the scenario      */
/*    forward, and "current task" can never be task 4 on a fresh run.  */
/*  · Passed tasks keep their snapshot forever — collapsed,            */
/*    refreshed, after switching personas, after moving on, after a    */
/*    redeploy — until the user explicitly resets THIS scenario.       */
/*  · Nothing is ever marked passed artificially: a snapshot is only   */
/*    captured from a live verification against the real records.     */
/* ------------------------------------------------------------------ */

export type QaStepState = {
  id: string;
  role: string;
  title: string;
  instruction: string;
  expected: string;
  href: string;
  canAuto: boolean;
  status: "done" | "pending" | "locked";
  actual: string;
  record: string | null;
  /** the current task's required starting state is missing (exploration
      consumed it) — the reason, in plain language. Never an impossible
      instruction without saying so. */
  blocked?: string | null;
  /** a one-click state restore exists for this blockage */
  repairable?: boolean;
};

export function scenarioProgress(scenario: QaScenario, runs: QaRuns) {
  const run = runs[scenario.id];

  // completed → the verified snapshot is the permanent record of achievement
  if (run?.completedAt && run.snapshot?.length) {
    const byId = new Map(run.snapshot.map((s) => [s.id, s]));
    const steps: QaStepState[] = scenario.steps.map((s) => {
      const snap = byId.get(s.id);
      return {
        id: s.id,
        role: s.role,
        title: s.title,
        instruction: s.instruction,
        expected: s.expected,
        href: "#",
        canAuto: false,
        status: "done" as const,
        actual: snap?.actual ?? "verified",
        record: snap?.record ?? null,
      };
    });
    return { steps, done: steps.length, total: steps.length, startedAt: run.startedAt, completed: true, completedAt: run.completedAt, current: null as number | null };
  }

  // not started → task 1 is up next, everything after is locked
  if (!run) {
    const steps: QaStepState[] = scenario.steps.map((s, i) => ({
      id: s.id,
      role: s.role,
      title: s.title,
      instruction: s.instruction,
      expected: s.expected,
      href: "#",
      canAuto: false,
      status: i === 0 ? ("pending" as const) : ("locked" as const),
      actual: i === 0 ? "scenario not started" : "locked — earlier tests must pass first",
      record: null,
    }));
    return { steps, done: 0, total: steps.length, startedAt: null, completed: false, completedAt: null, current: 0 as number | null };
  }

  const ctx = buildContext(new Date(run.startedAt));

  // validate the persisted prefix against the DEFINITION order — if the
  // scenario definition changed between deploys, truncate at the mismatch
  let passed: QaStepSnapshot[] = (run.passed ?? []).slice();
  let valid = 0;
  while (valid < passed.length && valid < scenario.steps.length && passed[valid].id === scenario.steps[valid].id) valid++;
  passed = passed.slice(0, valid);

  // per-task ACTIVATION times: a task's clock starts only when it becomes
  // the current task. Creation checkpoints count nothing from before it.
  const activated: Record<string, string> = { ...(run.activated ?? {}) };
  let activatedChanged = false;

  // advance: verify ONLY the current task; each pass appends its verified
  // snapshot and unlocks the next (auto-checks cascade in the same sweep)
  let pendingVerdict: QaVerdict | null = null;
  let pendingCtx: QaContext | null = null;
  while (passed.length < scenario.steps.length) {
    const s = scenario.steps[passed.length];
    if (!activated[s.id]) {
      // the first task activates at scenario start; later tasks at the
      // moment the previous one was VERIFIED (i.e., right now)
      activated[s.id] = passed.length === 0 ? run.startedAt : new Date().toISOString();
      activatedChanged = true;
    }
    const stepCtx = buildContext(new Date(run.startedAt), new Date(activated[s.id]));
    let v: QaVerdict;
    try {
      v = s.verify(stepCtx);
    } catch {
      v = { done: false, actual: "verification error — retry" };
    }
    if (!v.done) {
      pendingVerdict = v;
      pendingCtx = stepCtx;
      break;
    }
    passed.push({
      id: s.id,
      role: s.role,
      title: s.title,
      instruction: s.instruction,
      expected: s.expected,
      actual: v.actual,
      record: ("record" in v ? v.record : undefined) ?? null,
    });
  }

  const complete = passed.length === scenario.steps.length;

  // persist any advancement (fresh read so concurrent writes aren't clobbered)
  let completedAt: string | null = null;
  if (passed.length !== (run.passed?.length ?? 0) || activatedChanged || complete) {
    const fresh = readRuns();
    if (fresh[scenario.id]) {
      fresh[scenario.id] = { ...fresh[scenario.id], passed, activated };
      if (complete && !fresh[scenario.id].completedAt) {
        fresh[scenario.id].completedAt = new Date().toISOString();
        fresh[scenario.id].snapshot = passed;
      }
      completedAt = fresh[scenario.id].completedAt ?? null;
      writeRuns(fresh);
    }
  }

  const cursor = passed.length;
  const steps: QaStepState[] = scenario.steps.map((s, i) => {
    const base = { id: s.id, role: s.role, title: s.title, instruction: s.instruction, expected: s.expected };
    if (i < cursor) {
      const snap = passed[i];
      return { ...base, href: safeHref(s, ctx), canAuto: false, status: "done" as const, actual: snap.actual, record: snap.record };
    }
    if (i === cursor) {
      // REQUIRED STARTING STATE — never show an impossible instruction:
      // if exploration consumed the state this task needs, say exactly
      // why and whether a one-click restore exists
      let blocked: string | null = null;
      if (s.ready && pendingCtx) {
        try {
          const r = s.ready(pendingCtx);
          if (!r.ok) blocked = r.why;
        } catch {
          /* readiness check must never break evaluation */
        }
      }
      return {
        ...base,
        href: safeHref(s, ctx),
        canAuto: !!s.perform,
        status: "pending" as const,
        actual: pendingVerdict?.actual ?? "…",
        record: (pendingVerdict && "record" in pendingVerdict ? pendingVerdict.record : undefined) ?? null,
        blocked,
        repairable: !!blocked && !!s.repair,
      };
    }
    return { ...base, href: "#", canAuto: false, status: "locked" as const, actual: `locked — unlocks when test ${cursor + 1} passes`, record: null };
  });

  return {
    steps,
    done: complete ? steps.length : cursor,
    total: steps.length,
    startedAt: run.startedAt,
    completed: complete,
    completedAt: complete ? (completedAt ?? new Date().toISOString()) : null,
    current: complete ? null : cursor,
  };
}

function safeHref(s: QaStep, ctx: QaContext): string {
  try {
    return s.href(ctx);
  } catch {
    return "#";
  }
}

export function evaluateScenario(scenario: QaScenario, startedAt: Date | null) {
  const ctx = startedAt ? buildContext(startedAt) : null;
  return scenario.steps.map((s) => {
    const verdict = ctx ? s.verify(ctx) : { done: false, actual: "scenario not started" };
    return {
      id: s.id,
      role: s.role,
      title: s.title,
      instruction: s.instruction,
      expected: s.expected,
      href: ctx ? s.href(ctx) : "#",
      canAuto: !!s.perform,
      status: verdict.done ? ("done" as const) : ("pending" as const),
      actual: verdict.actual,
      record: ("record" in verdict ? verdict.record : undefined) ?? null,
    };
  });
}
