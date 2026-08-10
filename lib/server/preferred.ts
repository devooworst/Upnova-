/* ------------------------------------------------------------------ */
/*  Preferred Clients — a PRIVATE provider↔client loyalty relationship. */
/*                                                                     */
/*  Rules enforced here:                                               */
/*   · Only the provider who OWNS a relationship can add / edit /      */
/*     remove it — a client can never modify their own status.         */
/*   · Scoped per provider: preferred with A implies nothing with B.   */
/*   · Never public: nothing in publicUser, search, or profiles.       */
/*   · Removal keeps the row (status "removed") so history survives.   */
/*   · Eligibility = 3 completed engagements with the SAME provider    */
/*     inside 12 months — a signal for the provider, never automatic.  */
/*   · Benefits are the provider's choice; discounts optional.         */
/* ------------------------------------------------------------------ */

import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { ApiError } from "./auth";

export const BENEFIT_KEYS = [
  "priority_booking",
  "early_access",
  "discount",
  "free_addon",
  "upgrade",
  "recurring_priority",
  "priority_response",
  "exclusive_windows",
  "custom",
] as const;
export type BenefitKey = (typeof BENEFIT_KEYS)[number];

export const BENEFIT_LABEL: Record<BenefitKey, string> = {
  priority_booking: "Priority booking",
  early_access: "Early access to appointments",
  discount: "Preferred pricing",
  free_addon: "Free add-on",
  upgrade: "Complimentary upgrade",
  recurring_priority: "Recurring booking priority",
  priority_response: "Priority response",
  exclusive_windows: "Exclusive early-access windows",
  custom: "Custom reward",
};

export type Benefit = { key: BenefitKey; percent?: number; label?: string };

export function sanitizeBenefits(raw: unknown): Benefit[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Benefit[] = [];
  for (const item of raw.slice(0, 12)) {
    const key = String((item as { key?: string })?.key ?? "") as BenefitKey;
    if (!BENEFIT_KEYS.includes(key) || seen.has(key)) continue;
    seen.add(key);
    const b: Benefit = { key };
    if (key === "discount") {
      const pct = Math.round(Number((item as { percent?: number }).percent));
      if (!Number.isFinite(pct) || pct < 1 || pct > 50) throw new ApiError(400, "Preferred pricing must be a 1–50% discount");
      b.percent = pct;
    }
    const label = String((item as { label?: string })?.label ?? "").trim().slice(0, 80);
    if (label) b.label = label;
    if (key === "custom" && !label) throw new ApiError(400, "Describe the custom reward");
    out.push(b);
  }
  return out;
}

export function parseBenefits(raw: string | null | undefined): Benefit[] {
  try {
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.filter((b) => BENEFIT_KEYS.includes(b?.key)) : [];
  } catch {
    return [];
  }
}

export function benefitSummary(benefits: Benefit[]): string {
  return benefits
    .map((b) => (b.key === "discount" ? `${b.percent}% preferred pricing` : b.key === "custom" ? b.label ?? "Custom reward" : BENEFIT_LABEL[b.key]))
    .join(" · ");
}

/* ------------------------------ relationship ------------------------------ */

export function getRelationship(providerId: string, clientId: string) {
  return db
    .select()
    .from(tables.preferredClients)
    .where(and(eq(tables.preferredClients.providerId, providerId), eq(tables.preferredClients.clientId, clientId)))
    .get();
}

export function activeRelationship(providerId: string, clientId: string) {
  const r = getRelationship(providerId, clientId);
  return r && r.status === "active" ? r : null;
}

/** Preferred-pricing percent this client gets from this provider (0 = none). */
export function discountPercent(providerId: string, clientId: string): number {
  const r = activeRelationship(providerId, clientId);
  if (!r) return 0;
  const d = parseBenefits(r.benefits).find((b) => b.key === "discount");
  return d?.percent ?? 0;
}

/** Whether this client may book during the provider's preferred-only window. */
export function hasEarlyAccess(providerId: string, clientId: string): boolean {
  const r = activeRelationship(providerId, clientId);
  if (!r) return false;
  return parseBenefits(r.benefits).some((b) => b.key === "priority_booking" || b.key === "early_access");
}

/* ------------------------------- statistics -------------------------------
   Loyalty is grounded in COMPLETED work, not raw spend: completed
   bookings + completed projects with the same provider. Spend is shown
   privately to the provider as context only. */

export function clientStats(providerId: string, clientId: string) {
  const yearAgo = Date.now() - 365 * 86400_000;
  const bookings = db
    .select()
    .from(tables.bookings)
    .where(and(eq(tables.bookings.providerId, providerId), eq(tables.bookings.clientId, clientId)))
    .all();
  const completedBookings = bookings.filter((b) => b.status === "completed");
  const projects = db
    .select()
    .from(tables.projects)
    .where(and(eq(tables.projects.creatorId, providerId), eq(tables.projects.clientId, clientId)))
    .all();
  const completedProjects = projects.filter((p) => ["completed", "reviewed"].includes(p.state));
  const completed12mo =
    completedBookings.filter((b) => b.startsAt.getTime() >= yearAgo).length +
    completedProjects.filter((p) => p.updatedAt.getTime() >= yearAgo).length;
  const spentCents = db
    .select()
    .from(tables.payments)
    .where(and(eq(tables.payments.payerId, clientId), eq(tables.payments.payeeId, providerId), eq(tables.payments.status, "released")))
    .all()
    .reduce((n, p) => n + p.amountCents + p.feeCents, 0);
  const lastCompleted = [...completedBookings.map((b) => b.startsAt), ...completedProjects.map((p) => p.updatedAt)]
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const history = [
    ...completedBookings.map((b) => ({ kind: "booking" as const, title: b.title, at: b.startsAt.toISOString() })),
    ...completedProjects.map((p) => ({ kind: "project" as const, title: p.title, at: p.updatedAt.toISOString() })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return {
    completedBookings: completedBookings.length,
    completedProjects: completedProjects.length,
    completedTotal: completedBookings.length + completedProjects.length,
    completed12mo,
    eligible: completed12mo >= 3,
    totalSpent: Math.round(spentCents / 100),
    lastCompletedAt: lastCompleted?.toISOString() ?? null,
    history,
  };
}

/** Everyone who has ever booked / hired this provider (real records only). */
export function clientIdsOf(providerId: string): string[] {
  const ids = new Set<string>();
  for (const b of db.select().from(tables.bookings).where(eq(tables.bookings.providerId, providerId)).all()) ids.add(b.clientId);
  for (const p of db.select().from(tables.projects).where(eq(tables.projects.creatorId, providerId)).all()) ids.add(p.clientId);
  return Array.from(ids);
}

/** Has any real interaction happened between the two? (Anti-spam guard on
    manual adds — providers add people they actually work with.) */
export function hasRelationshipBasis(providerId: string, clientId: string): boolean {
  const b = db
    .select({ id: tables.bookings.id })
    .from(tables.bookings)
    .where(and(eq(tables.bookings.providerId, providerId), eq(tables.bookings.clientId, clientId)))
    .get();
  if (b) return true;
  const p = db
    .select({ id: tables.projects.id })
    .from(tables.projects)
    .where(and(eq(tables.projects.creatorId, providerId), eq(tables.projects.clientId, clientId)))
    .get();
  if (p) return true;
  // a shared conversation counts — the provider may want to reward a
  // long-time client whose earlier work predates UpNova
  const convs = db.select().from(tables.conversationMembers).where(eq(tables.conversationMembers.userId, providerId)).all();
  for (const c of convs) {
    const other = db
      .select()
      .from(tables.conversationMembers)
      .where(and(eq(tables.conversationMembers.conversationId, c.conversationId), eq(tables.conversationMembers.userId, clientId)))
      .get();
    if (other) return true;
  }
  return false;
}

export function upsertPreferred(providerId: string, clientId: string, benefits: Benefit[], note: string) {
  const existing = getRelationship(providerId, clientId);
  if (existing) {
    db.update(tables.preferredClients)
      .set({
        status: "active",
        benefits: JSON.stringify(benefits),
        note: note.slice(0, 300),
        addedAt: existing.status === "active" ? existing.addedAt : new Date(),
        removedAt: null,
      })
      .where(eq(tables.preferredClients.id, existing.id))
      .run();
    return db.select().from(tables.preferredClients).where(eq(tables.preferredClients.id, existing.id)).get()!;
  }
  const id = randomBytes(12).toString("hex");
  db.insert(tables.preferredClients)
    .values({ id, providerId, clientId, status: "active", benefits: JSON.stringify(benefits), note: note.slice(0, 300) })
    .run();
  return db.select().from(tables.preferredClients).where(eq(tables.preferredClients.id, id)).get()!;
}

/** Active preferred clients of a provider who hold a booking-priority benefit. */
export function preferredWithEarlyAccess(providerId: string): string[] {
  return db
    .select()
    .from(tables.preferredClients)
    .where(and(eq(tables.preferredClients.providerId, providerId), eq(tables.preferredClients.status, "active")))
    .all()
    .filter((r) => parseBenefits(r.benefits).some((b) => b.key === "priority_booking" || b.key === "early_access"))
    .map((r) => r.clientId);
}

/* ------------------------------------------------------------------ */
/*  PREFERRED EARLY ACCESS — who gets access FIRST.                    */
/*                                                                     */
/*  The window (services.preferredUntil) controls WHO can book first;  */
/*  the provider's real availability controls HOW MANY can book.       */
/*  The optional slot cap and preferred-allocation limit below are     */
/*  enforced at the booking route for EVERYONE — a Preferred Client    */
/*  can never book beyond the provider's available slots.              */
/* ------------------------------------------------------------------ */

export interface EarlyAccessSetup {
  /** total bookable slots for this drop (active bookings cap), 1–50 */
  slots: number | null;
  /** PER-CLIENT limit during the window: how many appointments each
      Preferred Client can claim during early access (1–50, or null =
      no limit). Capacity still binds everyone regardless. */
  preferredLimit: number | null;
  /** when the current window was opened (ISO) — the allocation counts from here */
  startedAt: string | null;
}

/** Read the early-access setup stored inside the service's config JSON.
    Tolerant: unknown/invalid shapes read as "no setup". */
export function readEarlyAccess(rawConfig: string | null | undefined): EarlyAccessSetup | null {
  try {
    const o = JSON.parse(rawConfig || "{}");
    const ea = o?.earlyAccess;
    if (!ea || typeof ea !== "object") return null;
    const num = (v: unknown) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n >= 1 ? Math.min(50, n) : null;
    };
    const slots = num((ea as Record<string, unknown>).slots);
    const preferredLimit = num((ea as Record<string, unknown>).preferredLimit);
    const startedAt = typeof (ea as Record<string, unknown>).startedAt === "string" ? String((ea as Record<string, unknown>).startedAt) : null;
    if (slots == null && preferredLimit == null) return null;
    return { slots, preferredLimit, startedAt };
  } catch {
    return null;
  }
}

/** Write (or clear) the early-access setup, preserving every other config key. */
export function writeEarlyAccess(rawConfig: string | null | undefined, setup: EarlyAccessSetup | null): string {
  let o: Record<string, unknown> = {};
  try {
    o = JSON.parse(rawConfig || "{}") ?? {};
  } catch {}
  if (setup == null) delete o.earlyAccess;
  else o.earlyAccess = setup;
  return JSON.stringify(o);
}

/** Booking statuses that HOLD a slot. Cancelled/declined/completed free it. */
export const SLOT_HOLDING_STATUSES = ["pending", "accepted", "confirmed", "reschedule_requested"] as const;

/** How many active bookings currently hold slots on this service. */
export function activeBookingsForService(serviceId: string): number {
  return db
    .select()
    .from(tables.bookings)
    .where(eq(tables.bookings.serviceId, serviceId))
    .all()
    .filter((b) => (SLOT_HOLDING_STATUSES as readonly string[]).includes(b.status)).length;
}

/** How many slot-holding bookings a specific client has made since the
    window opened — the per-client early-access limit is measured against
    THIS, so a cancelled booking frees that client's allocation too. */
export function clientBookingsSinceWindowStart(serviceId: string, clientId: string, startedAtIso: string | null): number {
  if (!startedAtIso) return 0;
  const t0 = new Date(startedAtIso).getTime();
  if (!Number.isFinite(t0)) return 0;
  return db
    .select()
    .from(tables.bookings)
    .where(eq(tables.bookings.serviceId, serviceId))
    .all()
    .filter((b) => b.clientId === clientId && (SLOT_HOLDING_STATUSES as readonly string[]).includes(b.status) && b.createdAt.getTime() >= t0).length;
}

/* ------------------------------------------------------------------ */
/*  SCHEDULED RELEASES — the optional alternative to a rolling horizon.*/
/*                                                                     */
/*  "September bookings open August 25 at 9 AM." Dates up to           */
/*  releasedUntil are already open; the pending release (releaseAt →   */
/*  releaseUntil) opens at its moment — Preferred Clients first when   */
/*  eaHours is set, everyone once the early-access phase ends.         */
/*  Capacity and per-client limits keep binding exactly as before.     */
/* ------------------------------------------------------------------ */

export interface ReleaseSetup {
  /** dates up to here are already released (ISO) */
  releasedUntil: string | null;
  /** when the pending release opens (ISO) */
  releaseAt: string | null;
  /** the pending release covers dates up to here (ISO) */
  releaseUntil: string | null;
  /** Preferred Early Access length at the release moment, hours (0 = none) */
  eaHours: number | null;
}

export function readRelease(rawConfig: string | null | undefined): ReleaseSetup | null {
  try {
    const o = JSON.parse(rawConfig || "{}");
    const r = o?.release;
    if (!r || typeof r !== "object") return null;
    const iso = (v: unknown) => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null);
    const rr = r as Record<string, unknown>;
    const eaN = Math.round(Number(rr.eaHours));
    return {
      releasedUntil: iso(rr.releasedUntil),
      releaseAt: iso(rr.releaseAt),
      releaseUntil: iso(rr.releaseUntil),
      eaHours: Number.isFinite(eaN) && eaN >= 1 ? Math.min(168, eaN) : null,
    };
  } catch {
    return null;
  }
}

export function writeRelease(rawConfig: string | null | undefined, setup: ReleaseSetup | null): string {
  let o: Record<string, unknown> = {};
  try {
    o = JSON.parse(rawConfig || "{}") ?? {};
  } catch {}
  if (setup == null) delete o.release;
  else o.release = setup;
  return JSON.stringify(o);
}
