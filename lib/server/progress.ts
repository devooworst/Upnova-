/* ------------------------------------------------------------------ */
/*  Progress updates — the single authority for provider/creator       */
/*  progress on PROJECTS and BOOKINGS.                                 */
/*                                                                     */
/*  Every update is a REAL row in progress_updates (status, percent,   */
/*  message, ETA, timestamp, author). ETA changes are their own rows   */
/*  that record the PREVIOUS estimate — a deadline can never move      */
/*  silently. The timeline is generated from these rows plus the       */
/*  other real records (payments, extension requests, reviews),        */
/*  never hard-coded.                                                  */
/*                                                                     */
/*  Progress is informational: it never mutates the project/booking    */
/*  state machines, which stay the only transition authorities.        */
/* ------------------------------------------------------------------ */

import { randomBytes } from "crypto";
import { and, asc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { ApiError } from "./auth";
import { notify } from "./notify";

export const PROGRESS_STATUSES = [
  "not_started",
  "preparing",
  "in_progress",
  "waiting_on_client",
  "revision",
  "finalizing",
  "ready_for_review",
  "completed",
] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

export const PROGRESS_STATUS_LABEL: Record<ProgressStatus, string> = {
  not_started: "Not started",
  preparing: "Preparing",
  in_progress: "In progress",
  waiting_on_client: "Waiting on client",
  revision: "Revision",
  finalizing: "Finalizing",
  ready_for_review: "Ready for review",
  completed: "Completed",
};

type Target =
  | { kind: "project"; row: typeof tables.projects.$inferSelect }
  | { kind: "booking"; row: typeof tables.bookings.$inferSelect };

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

function loadTarget(kind: "project" | "booking", id: string, userId: string): Target {
  if (kind === "project") {
    const row = db.select().from(tables.projects).where(eq(tables.projects.id, id)).get();
    if (!row) throw new ApiError(404, "Project not found");
    if (row.clientId !== userId && row.creatorId !== userId) throw new ApiError(403, "Not a party to this project");
    return { kind, row };
  }
  const row = db.select().from(tables.bookings).where(eq(tables.bookings.id, id)).get();
  if (!row) throw new ApiError(404, "Booking not found");
  if (row.clientId !== userId && row.providerId !== userId) throw new ApiError(403, "Not your booking");
  return { kind, row };
}

const workerOf = (t: Target) => (t.kind === "project" ? t.row.creatorId : t.row.providerId);
const clientOf = (t: Target) => t.row.clientId;
const titleOf = (t: Target) => t.row.title;
const convOf = (t: Target) => t.row.conversationId;
const hrefOf = (t: Target) => (t.kind === "project" ? `/projects/${t.row.id}` : `/activity?focus=booking:${t.row.id}`);

function displayName(userId: string): string {
  const p = db.select().from(tables.profiles).where(eq(tables.profiles.userId, userId)).get();
  return p?.displayName ?? "Someone";
}

function systemMessage(t: Target, senderId: string, body: string) {
  const conversationId = convOf(t);
  if (!conversationId) return;
  db.insert(tables.messages)
    .values({ id: randomBytes(12).toString("hex"), conversationId, senderId, body, kind: "system" })
    .run();
  db.update(tables.conversations).set({ updatedAt: new Date() }).where(eq(tables.conversations.id, conversationId)).run();
}

function whereTarget(t: Target) {
  return t.kind === "project"
    ? eq(tables.progressUpdates.projectId, t.row.id)
    : eq(tables.progressUpdates.bookingId, t.row.id);
}

function listRows(t: Target) {
  return db.select().from(tables.progressUpdates).where(whereTarget(t)).orderBy(asc(tables.progressUpdates.createdAt)).all();
}

/** Latest known estimated completion: the most recent row carrying an
    ETA, falling back to the project deadline (bookings fall back to
    their scheduled end). */
export function currentEta(t: Target): Date | null {
  const rows = listRows(t);
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].etaAt) return rows[i].etaAt!;
  if (t.kind === "project") return t.row.deadline ?? null;
  return new Date(t.row.startsAt.getTime() + t.row.durationMin * 60_000);
}

/* ------------------------------ post update ------------------------------ */

const PROJECT_UPDATE_STATES = ["in_progress", "extension_requested", "submitted", "approved"];
const BOOKING_UPDATE_STATUSES = ["accepted", "confirmed"];

export function postProgressUpdate(
  kind: "project" | "booking",
  id: string,
  userId: string,
  input: { status?: string; percent?: number | null; message?: string; etaAt?: string | null; attachmentUrl?: string }
) {
  const t = loadTarget(kind, id, userId);
  if (workerOf(t) !== userId)
    throw new ApiError(403, kind === "project" ? "Only the creator posts progress updates" : "Only the provider posts progress updates");
  if (kind === "project" && !PROJECT_UPDATE_STATES.includes((t.row as typeof tables.projects.$inferSelect).state))
    throw new ApiError(409, "Progress updates open once the project is in progress");
  if (kind === "booking" && !BOOKING_UPDATE_STATUSES.includes((t.row as typeof tables.bookings.$inferSelect).status))
    throw new ApiError(409, "Progress updates open once the booking is accepted");

  const status = String(input.status ?? "in_progress") as ProgressStatus;
  if (!PROGRESS_STATUSES.includes(status)) throw new ApiError(400, "Unknown progress status");
  const percent = input.percent == null ? null : Math.max(0, Math.min(100, Math.round(Number(input.percent))));
  if (input.percent != null && !Number.isFinite(Number(input.percent))) throw new ApiError(400, "Percent must be a number");
  const message = String(input.message ?? "").trim().slice(0, 600);
  const etaAt = input.etaAt ? new Date(input.etaAt) : null;
  if (etaAt && isNaN(etaAt.getTime())) throw new ApiError(400, "Invalid estimated completion date");
  const attachmentUrl = String(input.attachmentUrl ?? "").trim().slice(0, 400);

  const rowId = randomBytes(12).toString("hex");
  db.insert(tables.progressUpdates)
    .values({
      id: rowId,
      projectId: kind === "project" ? t.row.id : null,
      bookingId: kind === "booking" ? t.row.id : null,
      authorId: userId,
      kind: "update",
      status,
      percent,
      message,
      etaAt,
      attachmentUrl,
    })
    .run();

  // keep the booking's lightweight stage chip in sync with the real update
  if (kind === "booking") {
    const chip = status === "preparing" || status === "not_started" ? "preparing" : "in_progress";
    db.update(tables.bookings).set({ progress: chip }).where(eq(tables.bookings.id, t.row.id)).run();
  }
  if (kind === "project")
    db.update(tables.projects).set({ updatedAt: new Date() }).where(eq(tables.projects.id, t.row.id)).run();

  const actor = displayName(userId);
  const bits = [
    percent != null ? `${percent}%` : null,
    PROGRESS_STATUS_LABEL[status],
    etaAt ? `est. completion ${fmtDate(etaAt)}` : null,
  ].filter(Boolean);
  systemMessage(t, userId, `Progress update — ${bits.join(" · ")}.${message ? ` "${message}"` : ""}`);
  notify({
    userId: clientOf(t),
    actorId: userId,
    type: "progress_update",
    title: `${actor} posted an update on ${titleOf(t)}`,
    body: [percent != null ? `${percent}%` : null, message || PROGRESS_STATUS_LABEL[status]].filter(Boolean).join(" — "),
    href: hrefOf(t),
  });

  return db.select().from(tables.progressUpdates).where(eq(tables.progressUpdates.id, rowId)).get()!;
}

/* -------------------------------- update ETA -------------------------------- */

export function postEtaChange(
  kind: "project" | "booking",
  id: string,
  userId: string,
  input: { etaAt: string; reason?: string }
) {
  const t = loadTarget(kind, id, userId);
  if (workerOf(t) !== userId) throw new ApiError(403, "Only the person doing the work updates the estimate");
  const etaAt = new Date(input.etaAt);
  if (isNaN(etaAt.getTime())) throw new ApiError(400, "Pick a valid estimated completion date");
  const prev = currentEta(t);
  const reason = String(input.reason ?? "").trim().slice(0, 400);

  const rowId = randomBytes(12).toString("hex");
  db.insert(tables.progressUpdates)
    .values({
      id: rowId,
      projectId: kind === "project" ? t.row.id : null,
      bookingId: kind === "booking" ? t.row.id : null,
      authorId: userId,
      kind: "eta",
      message: reason,
      etaAt,
      prevEtaAt: prev,
    })
    .run();

  const actor = displayName(userId);
  systemMessage(
    t,
    userId,
    `${actor} updated the estimated completion date${prev ? ` — ${fmtDate(prev)} → ${fmtDate(etaAt)}` : ` to ${fmtDate(etaAt)}`}.${reason ? ` "${reason}"` : ""}`
  );
  notify({
    userId: clientOf(t),
    actorId: userId,
    type: "eta_changed",
    title: `${actor} updated the estimated completion date for ${titleOf(t)}`,
    body: `${prev ? `${fmtDate(prev)} → ` : ""}${fmtDate(etaAt)}${reason ? ` — ${reason}` : ""}`,
    href: hrefOf(t),
  });

  return db.select().from(tables.progressUpdates).where(eq(tables.progressUpdates.id, rowId)).get()!;
}

/* ------------------------------- summaries ------------------------------- */

export function progressPayload(kind: "project" | "booking", id: string, userId: string) {
  const t = loadTarget(kind, id, userId);
  const rows = listRows(t);
  const updates = rows.filter((r) => r.kind === "update");
  const latest = updates.length ? updates[updates.length - 1] : null;
  const eta = currentEta(t);
  return {
    latest: latest
      ? {
          status: latest.status,
          statusLabel: PROGRESS_STATUS_LABEL[latest.status as ProgressStatus] ?? latest.status,
          percent: latest.percent,
          message: latest.message,
          at: latest.createdAt.toISOString(),
        }
      : null,
    etaAt: eta?.toISOString() ?? null,
    updates: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      status: r.status,
      statusLabel: PROGRESS_STATUS_LABEL[r.status as ProgressStatus] ?? r.status,
      percent: r.percent,
      message: r.message,
      etaAt: r.etaAt?.toISOString() ?? null,
      prevEtaAt: r.prevEtaAt?.toISOString() ?? null,
      attachmentUrl: r.attachmentUrl,
      mine: r.authorId === userId,
      at: r.createdAt.toISOString(),
    })),
  };
}

/* ------------------------------- timeline -------------------------------
   Generated from the REAL records: project creation, payments,
   progress rows, extension requests (+decisions), and reviews —
   sorted by their actual timestamps. Nothing here is synthesized. */

export type TimelineEvent = { at: string; label: string; detail?: string; tone: "zinc" | "lime" | "amber" | "violet" };

export function projectTimeline(projectId: string, viewerId: string): TimelineEvent[] {
  const p = db.select().from(tables.projects).where(eq(tables.projects.id, projectId)).get();
  if (!p) return [];
  const name = (uid: string) => (uid === viewerId ? "You" : displayName(uid));
  const events: TimelineEvent[] = [{ at: p.createdAt.toISOString(), label: "Project created", tone: "zinc" }];

  for (const pay of db.select().from(tables.payments).where(eq(tables.payments.projectId, projectId)).all()) {
    events.push({
      at: pay.createdAt.toISOString(),
      label: `Payment secured — $${(pay.amountCents / 100).toFixed(2)} (TEST)`,
      tone: "lime",
    });
    if (pay.status === "released")
      events.push({ at: p.updatedAt.toISOString(), label: `Payment released — $${(pay.amountCents / 100).toFixed(2)} (TEST)`, tone: "lime" });
    if (pay.status === "refunded")
      events.push({ at: p.updatedAt.toISOString(), label: `Payment refunded — $${(pay.amountCents / 100).toFixed(2)} (TEST)`, tone: "zinc" });
  }

  for (const r of db
    .select()
    .from(tables.progressUpdates)
    .where(eq(tables.progressUpdates.projectId, projectId))
    .orderBy(asc(tables.progressUpdates.createdAt))
    .all()) {
    if (r.kind === "eta") {
      events.push({
        at: r.createdAt.toISOString(),
        label: `${name(r.authorId)} updated the estimated completion${r.prevEtaAt ? ` — ${fmtDate(r.prevEtaAt)} → ${fmtDate(r.etaAt!)}` : r.etaAt ? ` to ${fmtDate(r.etaAt)}` : ""}`,
        detail: r.message || undefined,
        tone: "amber",
      });
    } else {
      events.push({
        at: r.createdAt.toISOString(),
        label: `Progress update${r.percent != null ? ` — ${r.percent}%` : ""} · ${PROGRESS_STATUS_LABEL[r.status as ProgressStatus] ?? r.status}`,
        detail: r.message || undefined,
        tone: "violet",
      });
    }
  }

  for (const e of db.select().from(tables.extensionRequests).where(eq(tables.extensionRequests.projectId, projectId)).all()) {
    events.push({
      at: e.createdAt.toISOString(),
      label: `${name(e.requestedById)} requested a ${e.days}-day extension`,
      detail: e.reason || undefined,
      tone: "amber",
    });
    if (e.decidedAt)
      events.push({
        at: e.decidedAt.toISOString(),
        label: e.status === "approved" ? `Extension approved — deadline moved +${e.days} days` : "Extension declined — original deadline stands",
        tone: e.status === "approved" ? "lime" : "zinc",
      });
  }

  for (const r of db.select().from(tables.reviews).where(and(eq(tables.reviews.projectId, projectId))).all())
    events.push({ at: r.createdAt.toISOString(), label: `${name(r.authorId)} left a ${r.rating.toFixed(1)}-star review`, detail: r.body || undefined, tone: "violet" });

  events.sort((a, b) => a.at.localeCompare(b.at));
  return events;
}
