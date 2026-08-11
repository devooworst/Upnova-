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

export type QaApi = (
  handle: string,
  path: string,
  init?: { method?: string; body?: unknown }
) => Promise<{ status: number; data: Record<string, unknown> }>;

export interface QaContext {
  startedAt: Date;
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
      instruction: "As TEST CUSTOMER, open @testcreator's profile (search, Discover, or the button below).",
      expected: "A profile_view interaction by Test Customer on Test Creator, recorded after the scenario started.",
      href: () => "/creator/testcreator",
      verify: (ctx) => {
        const row = db
          .select()
          .from(tables.interactions)
          .where(and(eq(tables.interactions.userId, ctx.customer), eq(tables.interactions.targetId, ctx.creator), eq(tables.interactions.action, "profile_view")))
          .all()
          .find((r) => after(r.createdAt, ctx.startedAt));
        return { done: !!row, actual: row ? `profile_view recorded ${row.createdAt.toLocaleTimeString()}` : "no profile view recorded yet", record: row?.id };
      },
      perform: async (_ctx, api) => {
        await api("testcustomer", "/api/track", { method: "POST", body: { targetType: "user", targetId: _ctx.creator, action: "profile_view" } });
      },
    },
    {
      id: "message",
      role: "testcustomer",
      title: "Customer messaged the creator",
      instruction: "Send Test Creator a message about the QA Test Session.",
      expected: "A message from Test Customer exists in the testcustomer↔testcreator conversation.",
      href: () => "/messages?to=testcreator",
      verify: (ctx) => {
        const { conv, msgs } = messagesBetween(ctx, ctx.customer, ctx.creator);
        const mine = msgs.find((m) => m.senderId === ctx.customer);
        return { done: !!mine, actual: mine ? `"${mine.body.slice(0, 60)}"` : conv ? "conversation exists, no customer message yet" : "no conversation yet", record: conv ?? undefined };
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
      instruction: "Switch to TEST CREATOR (button below), open Messages, reply to Test Customer.",
      expected: "A message from Test Creator in the same two-person conversation.",
      href: () => "/messages?to=testcustomer",
      verify: (ctx) => {
        const { msgs } = messagesBetween(ctx, ctx.customer, ctx.creator);
        const theirs = msgs.find((m) => m.senderId === ctx.creator);
        return { done: !!theirs, actual: theirs ? `"${theirs.body.slice(0, 60)}"` : "no creator reply yet" };
      },
      perform: async (_ctx, api) => {
        await api("testcreator", "/api/conversations", { method: "POST", body: { toHandle: "testcustomer", firstMessage: "[QA] Happy to help — book any weekday slot." } });
      },
    },
    {
      id: "book",
      role: "testcustomer",
      title: "Customer requested the booking",
      instruction: "As TEST CUSTOMER, open the QA Test Session service and request a weekday slot.",
      expected: "A booking row: client=testcustomer, provider=testcreator, status pending (the creator has NOT auto-accepted — QA personas have no bots).",
      href: (ctx) => `/services/${ctx.serviceId}`,
      verify: (ctx) => {
        const b = qaBooking(ctx);
        return { done: !!b, actual: b ? `booking ${b.id.slice(0, 8)}… status=${b.status}` : "no booking created yet", record: b?.id };
      },
      perform: async (ctx, api) => {
        await api("testcustomer", "/api/bookings", { method: "POST", body: { serviceId: ctx.serviceId, startsAt: nextWeekday(10).toISOString(), durationMin: 60 } });
      },
    },
    {
      id: "accept",
      role: "testcreator",
      title: "Creator accepted the request",
      instruction: "Switch to TEST CREATOR → Bookings → open the request → Accept.",
      expected: "Booking status pending → accepted, and Test Customer notified.",
      href: () => "/calendar",
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
      instruction: "As TEST CUSTOMER → Bookings → open the booking → Pay (clearly labeled TEST — no real money exists here).",
      expected: "Booking confirmed + a payment row in HELD state (secured, releases on completion).",
      href: () => "/calendar",
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
      instruction: "As TEST CREATOR → Bookings → open the booking → Post progress update (status, %, message).",
      expected: "A real progress_updates row on this booking, authored by Test Creator.",
      href: () => "/calendar",
      verify: (ctx) => {
        const b = qaBooking(ctx);
        if (!b) return { done: false, actual: "no booking yet" };
        const row = db
          .select()
          .from(tables.progressUpdates)
          .where(eq(tables.progressUpdates.bookingId, b.id))
          .all()
          .find((r) => r.authorId === ctx.creator && r.kind === "update");
        return { done: !!row, actual: row ? `${row.percent ?? "—"}% · ${row.status} · "${row.message.slice(0, 40)}"` : "no progress update yet", record: row?.id };
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
      instruction: "As TEST CREATOR → Bookings → open the booking → Mark completed.",
      expected: "Booking completed + the held TEST payment flips to RELEASED.",
      href: () => "/calendar",
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
      instruction: "As TEST CUSTOMER → Messages → thread with Test Creator → project panel → Create project draft (any title, an amount, and a deadline).",
      expected: "A project row: client=testcustomer, creator=testcreator, state draft (no bot sends the offer — the creator must).",
      href: () => "/messages?to=testcreator",
      verify: (ctx) => {
        const p = qaProject(ctx);
        return { done: !!p, actual: p ? `project "${p.title}" state=${p.state}` : "no project yet", record: p?.id };
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
      instruction: "Switch to TEST CREATOR → same thread → project panel → Send offer.",
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
      instruction: "As TEST CUSTOMER → project panel → Accept offer → Pay to start (labeled TEST PAYMENT).",
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
      verify: (ctx) => {
        const p = qaProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const row = db.select().from(tables.progressUpdates).where(eq(tables.progressUpdates.projectId, p.id)).all().find((r) => r.kind === "update");
        return { done: !!row, actual: row ? `${row.percent ?? "—"}% · "${row.message.slice(0, 40)}"` : "no update yet", record: row?.id };
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
      verify: (ctx) => {
        const p = qaProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const row = db.select().from(tables.progressUpdates).where(eq(tables.progressUpdates.projectId, p.id)).all().find((r) => r.kind === "eta");
        return { done: !!row, actual: row ? `${fmtDate(row.prevEtaAt)} → ${fmtDate(row.etaAt)}${row.message ? ` — "${row.message.slice(0, 40)}"` : ""}` : "no ETA change yet", record: row?.id };
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
      verify: (ctx) => {
        const p = qaProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const ext = db.select().from(tables.extensionRequests).where(eq(tables.extensionRequests.projectId, p.id)).all()[0];
        return { done: !!ext, actual: ext ? `+${ext.days} days, status=${ext.status}` : `no extension request yet (state=${p.state})`, record: ext?.id };
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
      instruction: "On the completed project → leave a rating + review.",
      expected: "A review row by Test Customer about Test Creator on this project.",
      href: (ctx) => {
        const p = qaProject(ctx);
        return p ? `/projects/${p.id}` : "/calendar";
      },
      verify: (ctx) => {
        const p = qaProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const r = db.select().from(tables.reviews).where(eq(tables.reviews.projectId, p.id)).all().find((x) => x.authorId === ctx.customer);
        return { done: !!r, actual: r ? `${r.rating.toFixed(1)}★ "${r.body.slice(0, 40)}"` : "no review yet", record: r?.id };
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
      title: "Business posted the opportunity",
      instruction: "As TEST BUSINESS → Opportunities → Post an opportunity (any paid gig).",
      expected: "An opportunities row posted by Test Business after the scenario started.",
      href: () => "/opportunities/new",
      verify: (ctx) => {
        const o = qaOpportunity(ctx);
        return { done: !!o, actual: o ? `"${o.title}" (${o.status})` : "no opportunity yet", record: o?.id };
      },
      perform: async (_ctx, api) => {
        await api("testbusiness", "/api/opportunities", { method: "POST", body: { title: "[QA] Event photographer — test gig", description: "QA scenario opportunity.", budget: 250, type: "gig", location: "Baltimore, MD", remote: true } });
      },
    },
    {
      id: "apply",
      role: "testcustomer",
      title: "Applicant discovered it and applied",
      instruction: "Switch to TEST CUSTOMER → Opportunities → open the QA gig → Apply.",
      expected: "An applications row: applicant=testcustomer on the QA opportunity.",
      href: (ctx) => {
        const o = qaOpportunity(ctx);
        return o ? `/opportunities/${o.id}` : "/opportunities";
      },
      verify: (ctx) => {
        const o = qaOpportunity(ctx);
        if (!o) return { done: false, actual: "no opportunity yet" };
        const a = db.select().from(tables.applications).where(and(eq(tables.applications.opportunityId, o.id), eq(tables.applications.applicantId, ctx.customer))).get();
        return { done: !!a, actual: a ? `application status=${a.status}` : "no application yet", record: a?.id };
      },
      perform: async (ctx, api) => {
        const o = qaOpportunity(ctx);
        if (o) await api("testcustomer", `/api/opportunities/${o.id}/applications`, { method: "POST", body: { message: "[QA] I'd love this test gig." } });
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
        return { done: msgs.length > 0, actual: msgs.length ? `${msgs.length} message(s) in ${conv?.slice(0, 8)}…` : "no conversation between business and applicant yet", record: conv ?? undefined };
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
        const row = db
          .select()
          .from(tables.interactions)
          .where(and(eq(tables.interactions.userId, ctx.business), eq(tables.interactions.targetId, ctx.creator), eq(tables.interactions.action, "profile_view")))
          .all()
          .find((r) => after(r.createdAt, ctx.startedAt));
        return { done: !!row, actual: row ? `profile_view recorded ${row.createdAt.toLocaleTimeString()}` : "no profile view by the business yet", record: row?.id };
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
        const mine = msgs.find((m) => m.senderId === ctx.business);
        return { done: !!mine, actual: mine ? `"${mine.body.slice(0, 60)}"` : "no message from the business yet" };
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
        return { done: !!o, actual: o ? `"${o.title}" status=${o.status}` : "no opportunity yet", record: o?.id };
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
        return { done: !!a, actual: a ? `application status=${a.status}` : "no application yet", record: a?.id };
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
      instruction: "As TEST BUSINESS → Messages → thread with Test Creator → project panel → Create project draft (title, amount, deadline).",
      expected: "A project row: client=testbusiness, creator=testcreator.",
      href: () => "/messages?to=testcreator",
      verify: (ctx) => {
        const p = qaBizProject(ctx);
        return { done: !!p, actual: p ? `project "${p.title}" state=${p.state}` : "no business→creator project yet", record: p?.id };
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
      instruction: "Switch to TEST CREATOR → same thread → project panel → Send offer.",
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
      instruction: "As TEST BUSINESS → project panel → Accept offer → Pay to start (labeled TEST PAYMENT).",
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
      verify: (ctx) => {
        const p = qaBizProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const row = db.select().from(tables.progressUpdates).where(eq(tables.progressUpdates.projectId, p.id)).all().find((r) => r.kind === "update");
        const n = notif(ctx, ctx.business, "progress_update");
        return { done: !!row && !!n, actual: row ? `${row.percent ?? "—"}% · "${row.message.slice(0, 40)}"; business notified=${n ? "yes" : "no"}` : "no progress update yet", record: row?.id };
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
      verify: (ctx) => {
        const p = qaBizProject(ctx);
        if (!p) return { done: false, actual: "no project yet" };
        const ext = db.select().from(tables.extensionRequests).where(eq(tables.extensionRequests.projectId, p.id)).all()[0];
        const n = notif(ctx, ctx.business, "extension_requested");
        return { done: !!ext && !!n, actual: ext ? `+${ext.days} days, status=${ext.status}; business notified=${n ? "yes" : "no"}` : "no extension request yet", record: ext?.id };
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
        const r = db.select().from(tables.reviews).where(eq(tables.reviews.projectId, p.id)).all().find((x) => x.authorId === ctx.business && x.subjectId === ctx.creator);
        return { done: !!r, actual: r ? `${r.rating.toFixed(1)}★ "${r.body.slice(0, 40)}" — public on @testcreator` : "no business review yet", record: r?.id };
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
        if (msgs.length === 0) return { done: false, actual: "no conversation with the customer yet" };
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

export const QA_SCENARIOS: QaScenario[] = [bookingScenario, projectScenario, opportunityScenario, hiringScenario, peopleScenario];

export function getScenario(id: string) {
  return QA_SCENARIOS.find((s) => s.id === id) ?? null;
}

export function buildContext(startedAt: Date): QaContext {
  const ids = qaIds();
  return { startedAt, ...ids };
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

  // advance: verify ONLY the current task; each pass appends its verified
  // snapshot and unlocks the next (auto-checks cascade in the same sweep)
  let pendingVerdict: QaVerdict | null = null;
  while (passed.length < scenario.steps.length) {
    const s = scenario.steps[passed.length];
    let v: QaVerdict;
    try {
      v = s.verify(ctx);
    } catch {
      v = { done: false, actual: "verification error — retry" };
    }
    if (!v.done) {
      pendingVerdict = v;
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
  if (passed.length !== (run.passed?.length ?? 0) || complete) {
    const fresh = readRuns();
    if (fresh[scenario.id]) {
      fresh[scenario.id] = { ...fresh[scenario.id], passed };
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
    if (i === cursor)
      return {
        ...base,
        href: safeHref(s, ctx),
        canAuto: !!s.perform,
        status: "pending" as const,
        actual: pendingVerdict?.actual ?? "…",
        record: (pendingVerdict && "record" in pendingVerdict ? pendingVerdict.record : undefined) ?? null,
      };
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
