/* ------------------------------------------------------------------ */
/*  Project lifecycle — THE single transition authority.               */
/*                                                                     */
/*  draft → offer_sent → accepted → in_progress →                      */
/*  (extension_requested ⇄ in_progress) → submitted → approved →       */
/*  completed → reviewed                                               */
/*                                                                     */
/*  Each transition names who may perform it. Extension requests are   */
/*  persistent rows — a pending request survives reloads and can       */
/*  never be silently recreated: one pending request per project.     */
/* ------------------------------------------------------------------ */

import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { ApiError } from "./auth";
import { notify } from "./notify";

export const PROJECT_STATES = [
  "draft",
  "offer_sent",
  "accepted",
  "in_progress",
  "extension_requested",
  "submitted",
  "approved",
  "completed",
  "reviewed",
  "cancelled",
] as const;

export type ProjectState = (typeof PROJECT_STATES)[number];
type Party = "client" | "creator" | "either";

/** action → { from, to, by }. The server enforces the sequence — the UI
    only ever renders what the current state permits (OWASP business-logic
    protection: no skipping accepted → payment → work → delivery). */
const TRANSITIONS: Record<string, { from: ProjectState[]; to: ProjectState; by: Party }> = {
  send_offer: { from: ["draft"], to: "offer_sent", by: "creator" },
  accept_offer: { from: ["offer_sent"], to: "accepted", by: "client" },
  // client authorizes payment (secured) — work begins
  start: { from: ["accepted"], to: "in_progress", by: "client" },
  submit: { from: ["in_progress"], to: "submitted", by: "creator" },
  request_changes: { from: ["submitted"], to: "in_progress", by: "client" },
  approve: { from: ["submitted"], to: "approved", by: "client" },
  // approval releases payment → completed
  complete: { from: ["approved"], to: "completed", by: "client" },
  cancel_offer: { from: ["offer_sent"], to: "draft", by: "creator" },
  // the client can send an offer back for changes before anything is paid
  decline_offer: { from: ["offer_sent"], to: "draft", by: "client" },
  // either side can cancel before payment is secured — never after
  cancel: { from: ["draft", "offer_sent", "accepted"], to: "cancelled", by: "either" },
};

type Proj = typeof tables.projects.$inferSelect;

function partyOf(project: Proj, userId: string): "client" | "creator" {
  if (project.clientId === userId) return "client";
  if (project.creatorId === userId) return "creator";
  throw new ApiError(403, "Not a party to this project");
}

function counterpart(project: Proj, userId: string): string {
  return project.clientId === userId ? project.creatorId : project.clientId;
}

function displayName(userId: string): string {
  const p = db.select().from(tables.profiles).where(eq(tables.profiles.userId, userId)).get();
  return p?.displayName ?? "Someone";
}

/** Project events appear inside the conversation as system messages —
    the thread literally shows the transaction progressing. */
function systemMessage(project: Proj, senderId: string, body: string) {
  if (!project.conversationId) return;
  db.insert(tables.messages)
    .values({
      id: randomBytes(12).toString("hex"),
      conversationId: project.conversationId,
      senderId,
      body,
      kind: "system",
    })
    .run();
  db.update(tables.conversations)
    .set({ updatedAt: new Date() })
    .where(eq(tables.conversations.id, project.conversationId))
    .run();
}

const money = (n: number) => `$${n}`;

/**
 * Creator updates the terms BEFORE payment (draft / offer_sent only).
 * The change is announced in the thread and the client is notified —
 * terms can never change silently (see expectedAmount in transition()).
 */
export function updateTerms(
  projectId: string,
  userId: string,
  patch: { amount?: number; deadline?: string | null }
) {
  const project = db.select().from(tables.projects).where(eq(tables.projects.id, projectId)).get();
  if (!project) throw new ApiError(404, "Project not found");
  if (partyOf(project, userId) !== "creator") throw new ApiError(403, "Only the creator can update terms");
  if (!["draft", "offer_sent"].includes(project.state))
    throw new ApiError(409, "Terms are locked once the offer is accepted — cancel and re-offer instead");

  const changes: string[] = [];
  const set: Partial<typeof tables.projects.$inferInsert> = { updatedAt: new Date() };
  if (patch.amount != null) {
    const amount = Math.round(Number(patch.amount));
    if (!Number.isFinite(amount) || amount < 1) throw new ApiError(400, "Amount must be at least $1");
    if (amount !== project.amount) {
      changes.push(`price ${money(project.amount)} → ${money(amount)}`);
      set.amount = amount;
    }
  }
  if (patch.deadline !== undefined) {
    const d = patch.deadline ? new Date(patch.deadline) : null;
    changes.push(`deadline → ${d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "none"}`);
    set.deadline = d;
  }
  if (changes.length === 0) return project;

  db.update(tables.projects).set(set).where(eq(tables.projects.id, projectId)).run();
  systemMessage(project, userId, `Project updated — ${changes.join(", ")}. Review the terms before continuing.`);
  notify({
    userId: counterpart(project, userId),
    actorId: userId,
    type: "project_offer",
    title: `Project terms updated — ${project.title}`,
    body: changes.join(", "),
    href: `/messages?project=${project.id}`,
    priority: "high",
  });
  return db.select().from(tables.projects).where(eq(tables.projects.id, projectId)).get()!;
}

export function transition(
  projectId: string,
  action: string,
  userId: string,
  opts: { expectedAmount?: number | null; note?: string } = {}
): Proj {
  const project = db.select().from(tables.projects).where(eq(tables.projects.id, projectId)).get();
  if (!project) throw new ApiError(404, "Project not found");
  const role = partyOf(project, userId);

  const t = TRANSITIONS[action];
  if (!t) throw new ApiError(400, `Unknown action: ${action}`);
  if (!t.from.includes(project.state as ProjectState))
    throw new ApiError(409, `Cannot ${action} from state ${project.state}`);
  if (t.by !== "either" && t.by !== role)
    throw new ApiError(403, `Only the ${t.by} can ${action}`);

  // Transaction-authorization integrity (OWASP): what the client saw is
  // what gets authorized. If the terms changed since they loaded the
  // screen, the action is refused and they must review the update.
  if (["accept_offer", "start"].includes(action) && opts.expectedAmount != null) {
    if (Math.round(opts.expectedAmount) !== project.amount)
      throw new ApiError(409, "The project terms changed since you viewed them — review the updated offer before continuing.");
  }

  db.update(tables.projects)
    .set({ state: t.to, updatedAt: new Date() })
    .where(eq(tables.projects.id, projectId))
    .run();

  const other = counterpart(project, userId);
  const actor = displayName(userId);
  const href = `/messages?project=${project.id}`;
  const note = (opts.note ?? "").trim().slice(0, 300);

  // side effects per transition — notification + a system message in the
  // thread, so the conversation shows the transaction progressing
  if (action === "send_offer") {
    systemMessage(project, userId, `${actor} sent the project offer — ${project.title} · ${money(project.amount)}. Review it in the project panel.`);
    notify({ userId: other, actorId: userId, type: "project_offer", title: `${actor} sent you a project offer`, body: `${project.title} · ${money(project.amount)}`, href });
  } else if (action === "accept_offer") {
    systemMessage(project, userId, `${actor} accepted the offer — ${money(project.amount)}. Next step: secure the payment.`);
    notify({ userId: other, actorId: userId, type: "project_accepted", title: `${actor} accepted your offer`, body: project.title, href });
  } else if (action === "decline_offer") {
    systemMessage(project, userId, `${actor} sent the offer back for changes.${note ? ` "${note}"` : ""}`);
    notify({ userId: other, actorId: userId, type: "project_offer", title: `${actor} asked for changes to the offer`, body: note || project.title, href });
  } else if (action === "start") {
    // payment secured — the Stripe Connect PaymentIntent slots in here.
    // (Deliberately not called "escrow": that's a specific legal service.)
    const amountCents = project.amount * 100;
    db.insert(tables.payments)
      .values({
        id: randomBytes(12).toString("hex"),
        projectId: project.id,
        payerId: project.clientId,
        payeeId: project.creatorId,
        amountCents,
        feeCents: Math.round(amountCents * 0.05),
        status: "held",
      })
      .run();
    systemMessage(project, userId, `Payment secured — ${money(project.amount)}. ${displayName(project.creatorId)} can begin work. Funds release when the delivery is approved.`);
    notify({ userId: other, actorId: userId, type: "payment", title: `Payment confirmed for ${project.title}`, body: `${money(project.amount)} secured — you can begin working`, href, category: "payments" });
  } else if (action === "submit") {
    systemMessage(project, userId, `${actor} delivered work for review.${note ? ` ${note}` : ""}`);
    notify({ userId: other, actorId: userId, type: "project_submitted", title: `${actor} delivered — review it`, body: note || project.title, href });
  } else if (action === "approve") {
    systemMessage(project, userId, `${actor} approved the delivery.`);
    notify({ userId: other, actorId: userId, type: "project_approved", title: `${actor} approved your delivery`, body: project.title, href });
  } else if (action === "complete") {
    db.update(tables.payments)
      .set({ status: "released" })
      .where(and(eq(tables.payments.projectId, project.id), eq(tables.payments.status, "held")))
      .run();
    systemMessage(project, userId, `Project complete — ${money(project.amount)} released to ${displayName(project.creatorId)}.`);
    notify({ userId: other, actorId: userId, type: "payment", title: `Payment released — ${money(project.amount)}`, body: project.title, href, category: "payments" });
  } else if (action === "request_changes") {
    systemMessage(project, userId, `${actor} requested a revision.${note ? ` "${note}"` : ""} The project stays active.`);
    notify({ userId: other, actorId: userId, type: "project_submitted", title: `${actor} requested a revision`, body: note || project.title, href });
  } else if (action === "cancel") {
    systemMessage(project, userId, `${actor} cancelled the project before payment. No money moved.`);
    notify({ userId: other, actorId: userId, type: "project_offer", title: `${actor} cancelled ${project.title}`, body: "Cancelled before payment — nothing was charged", href, priority: "normal" });
  }

  return db.select().from(tables.projects).where(eq(tables.projects.id, projectId)).get()!;
}

/* ------------------------------ extensions ------------------------------ */

export function requestExtension(projectId: string, userId: string, days: number, reason: string) {
  const project = db.select().from(tables.projects).where(eq(tables.projects.id, projectId)).get();
  if (!project) throw new ApiError(404, "Project not found");
  if (partyOf(project, userId) !== "creator") throw new ApiError(403, "Only the creator can request an extension");
  if (project.state !== "in_progress") throw new ApiError(409, "Extensions can only be requested while in progress");
  if (!Number.isInteger(days) || days < 1 || days > 30) throw new ApiError(400, "Days must be 1–30");

  // idempotent: one pending request per project, never silently recreated
  const pending = db
    .select()
    .from(tables.extensionRequests)
    .where(and(eq(tables.extensionRequests.projectId, projectId), eq(tables.extensionRequests.status, "pending")))
    .get();
  if (pending) throw new ApiError(409, "An extension request is already pending");

  const id = randomBytes(12).toString("hex");
  db.insert(tables.extensionRequests).values({ id, projectId, requestedById: userId, days, reason }).run();
  db.update(tables.projects)
    .set({ state: "extension_requested", updatedAt: new Date() })
    .where(eq(tables.projects.id, projectId))
    .run();

  systemMessage(
    project,
    userId,
    `${displayName(userId)} requested a ${days}-day extension.${reason ? ` "${reason}"` : ""}${
      project.deadline
        ? ` Current deadline ${project.deadline.toLocaleDateString("en-US", { month: "short", day: "numeric" })} → new deadline ${new Date(project.deadline.getTime() + days * 86400_000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`
        : ""
    }`
  );
  notify({
    userId: counterpart(project, userId),
    actorId: userId,
    type: "extension_requested",
    title: `${displayName(userId)} requested a ${days}-day extension`,
    body: reason || project.title,
    href: `/messages?project=${project.id}`,
  });

  return db.select().from(tables.extensionRequests).where(eq(tables.extensionRequests.id, id)).get()!;
}

export function decideExtension(extensionId: string, userId: string, approve: boolean) {
  const ext = db.select().from(tables.extensionRequests).where(eq(tables.extensionRequests.id, extensionId)).get();
  if (!ext) throw new ApiError(404, "Extension request not found");
  if (ext.status !== "pending") throw new ApiError(409, "Extension request already decided");

  const project = db.select().from(tables.projects).where(eq(tables.projects.id, ext.projectId)).get()!;
  if (partyOf(project, userId) !== "client") throw new ApiError(403, "Only the client can decide extensions");

  db.update(tables.extensionRequests)
    .set({ status: approve ? "approved" : "denied", decidedAt: new Date() })
    .where(eq(tables.extensionRequests.id, extensionId))
    .run();

  const patch: Partial<typeof tables.projects.$inferInsert> = { state: "in_progress", updatedAt: new Date() };
  if (approve && project.deadline)
    patch.deadline = new Date(project.deadline.getTime() + ext.days * 86400_000);
  db.update(tables.projects).set(patch).where(eq(tables.projects.id, project.id)).run();

  const updated = db.select().from(tables.projects).where(eq(tables.projects.id, project.id)).get()!;
  systemMessage(
    updated,
    userId,
    approve
      ? `Extension approved · +${ext.days} days.${updated.deadline ? ` New deadline: ${updated.deadline.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.` : ""}`
      : "Extension declined — the original deadline stands."
  );
  notify({
    userId: ext.requestedById,
    actorId: userId,
    type: approve ? "extension_approved" : "extension_denied",
    title: approve ? `Extension approved · +${ext.days} days` : "Extension declined",
    body: project.title,
    href: `/messages?project=${project.id}`,
  });

  return db.select().from(tables.extensionRequests).where(eq(tables.extensionRequests.id, extensionId)).get()!;
}

/* -------------------------------- reviews -------------------------------- */

export function addReview(projectId: string, authorId: string, rating: number, body: string) {
  const project = db.select().from(tables.projects).where(eq(tables.projects.id, projectId)).get();
  if (!project) throw new ApiError(404, "Project not found");
  partyOf(project, authorId);
  if (!["completed", "reviewed"].includes(project.state))
    throw new ApiError(409, "Reviews open after completion");
  if (rating < 1 || rating > 5) throw new ApiError(400, "Rating must be 1–5");

  const existing = db
    .select()
    .from(tables.reviews)
    .where(and(eq(tables.reviews.projectId, projectId), eq(tables.reviews.authorId, authorId)))
    .get();
  if (existing) throw new ApiError(409, "You already reviewed this project");

  const subjectId = counterpart(project, authorId);
  db.insert(tables.reviews)
    .values({ id: randomBytes(12).toString("hex"), projectId, authorId, subjectId, rating, body })
    .run();

  // both sides reviewed → reviewed (terminal)
  const count = db.select().from(tables.reviews).where(eq(tables.reviews.projectId, projectId)).all().length;
  if (count >= 2)
    db.update(tables.projects)
      .set({ state: "reviewed", updatedAt: new Date() })
      .where(eq(tables.projects.id, projectId))
      .run();

  notify({
    userId: subjectId,
    actorId: authorId,
    type: "project_approved",
    title: `${displayName(authorId)} left you a ${rating.toFixed(1)}★ review`,
    body,
    href: `/messages?project=${projectId}`,
    category: "work",
    priority: "low",
  });
}
