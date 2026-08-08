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
] as const;

export type ProjectState = (typeof PROJECT_STATES)[number];
type Party = "client" | "creator" | "either";

/** action → { from, to, by } */
const TRANSITIONS: Record<string, { from: ProjectState[]; to: ProjectState; by: Party }> = {
  send_offer: { from: ["draft"], to: "offer_sent", by: "creator" },
  accept_offer: { from: ["offer_sent"], to: "accepted", by: "client" },
  // client funds the project (payment held) — work begins
  start: { from: ["accepted"], to: "in_progress", by: "client" },
  submit: { from: ["in_progress"], to: "submitted", by: "creator" },
  request_changes: { from: ["submitted"], to: "in_progress", by: "client" },
  approve: { from: ["submitted"], to: "approved", by: "client" },
  // approval releases payment → completed
  complete: { from: ["approved"], to: "completed", by: "client" },
  cancel_offer: { from: ["offer_sent"], to: "draft", by: "creator" },
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

export function transition(projectId: string, action: string, userId: string): Proj {
  const project = db.select().from(tables.projects).where(eq(tables.projects.id, projectId)).get();
  if (!project) throw new ApiError(404, "Project not found");
  const role = partyOf(project, userId);

  const t = TRANSITIONS[action];
  if (!t) throw new ApiError(400, `Unknown action: ${action}`);
  if (!t.from.includes(project.state as ProjectState))
    throw new ApiError(409, `Cannot ${action} from state ${project.state}`);
  if (t.by !== "either" && t.by !== role)
    throw new ApiError(403, `Only the ${t.by} can ${action}`);

  db.update(tables.projects)
    .set({ state: t.to, updatedAt: new Date() })
    .where(eq(tables.projects.id, projectId))
    .run();

  const other = counterpart(project, userId);
  const actor = displayName(userId);
  const href = `/messages?project=${project.id}`;

  // side effects per transition
  if (action === "send_offer") {
    notify({ userId: other, actorId: userId, type: "project_offer", title: `${actor} sent you a project offer`, body: `${project.title} · $${project.amount}`, href });
  } else if (action === "accept_offer") {
    notify({ userId: other, actorId: userId, type: "project_accepted", title: `${actor} accepted your offer`, body: project.title, href });
  } else if (action === "start") {
    // payment held in escrow — the Stripe Connect PaymentIntent slots in here
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
    notify({ userId: other, actorId: userId, type: "payment", title: `Payment secured for ${project.title}`, body: `$${project.amount} held — you're clear to start`, href, category: "payments" });
  } else if (action === "submit") {
    notify({ userId: other, actorId: userId, type: "project_submitted", title: `${actor} submitted work for review`, body: project.title, href });
  } else if (action === "approve") {
    notify({ userId: other, actorId: userId, type: "project_approved", title: `${actor} approved your delivery`, body: project.title, href });
  } else if (action === "complete") {
    db.update(tables.payments)
      .set({ status: "released" })
      .where(and(eq(tables.payments.projectId, project.id), eq(tables.payments.status, "held")))
      .run();
    notify({ userId: other, actorId: userId, type: "payment", title: `Payment released — $${project.amount}`, body: project.title, href, category: "payments" });
  } else if (action === "request_changes") {
    notify({ userId: other, actorId: userId, type: "project_submitted", title: `${actor} requested changes`, body: project.title, href });
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
