import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { parseConfig } from "@/lib/servicePolicies";
import {
  hasEarlyAccess,
  readEarlyAccess,
  readRelease,
  activeBookingsForService,
  SLOT_HOLDING_STATUSES,
} from "@/lib/server/preferred";

/* ------------------------------------------------------------------ */
/*  AVAILABILITY CALENDAR — one honest status per future date.         */
/*                                                                     */
/*  The customer's calendar never just says "unavailable": each state  */
/*  means ONE thing and explains itself.                               */
/*                                                                     */
/*   available        — released, inside the horizon, capacity open    */
/*   limited          — bookable, but the day already has bookings     */
/*   early_access     — released to Preferred Clients first; public    */
/*                      time attached (bookable NOW for preferred)     */
/*   not_released     — the provider hasn't opened this date yet;      */
/*                      opensAt attached when a release is scheduled   */
/*   outside_horizon  — beyond the provider's max advance window;      */
/*                      opensAt = when the rolling window reaches it   */
/*   booking_closed   — the provider doesn't take bookings then        */
/*                      (closed weekday, paused, or not accepting)     */
/*   fully_booked     — released and open, but capacity is TAKEN       */
/*                                                                     */
/*  This is a VIEW of the same rules the booking route enforces —      */
/*  the API can never show "available" for a date the POST would       */
/*  refuse for release/horizon/capacity reasons.                       */
/* ------------------------------------------------------------------ */

export type DayStatus =
  | "available"
  | "limited"
  | "early_access"
  | "not_released"
  | "outside_horizon"
  | "booking_closed"
  | "fully_booked";

export interface DayAvailability {
  date: string; // YYYY-MM-DD
  status: DayStatus;
  /** when this date becomes bookable (release moment or horizon arrival) */
  opensAt?: string;
  /** when an early-access phase opens to everyone */
  publicAt?: string;
  note?: string;
}

export async function serviceAvailability(serviceId: string, viewerId: string | null, daysAhead = 60): Promise<{ days: DayAvailability[] } | null > {
  const svc = await db.select().from(tables.services).where(eq(tables.services.id, serviceId)).get();
  if (!svc || !svc.active || svc.visibility === "draft") return null;
  const profile = await db.select().from(tables.profiles).where(eq(tables.profiles.userId, svc.ownerId)).get();
  const cfg = parseConfig(svc.config);
  const sched = cfg.scheduling;
  const n = Math.min(90, Math.max(7, daysAhead));

  const acceptsAtAll = !!profile?.hiringEnabled && !!profile?.acceptBookings && !svc.paused;
  const isPreferred = viewerId ? await hasEarlyAccess(svc.ownerId, viewerId) : false;

  // capacity (service-wide slot cap)
  const ea = readEarlyAccess(svc.config);
  const slotsFull = ea?.slots != null && await activeBookingsForService(svc.id) >= ea.slots;

  // rolling-mode preferred window (the "drop")
  const windowOpen = !!svc.preferredUntil && svc.preferredUntil.getTime() > Date.now();

  // scheduled-release state
  const rel = sched.releaseMode === "scheduled" ? readRelease(svc.config) : null;
  const relAt = rel?.releaseAt ? Date.parse(rel.releaseAt) : null;
  const relUntil = rel?.releaseUntil ? Date.parse(rel.releaseUntil) : null;
  const publicAtTs = relAt != null ? relAt + (rel?.eaHours ?? 0) * 3600_000 : null;
  let releasedThrough = rel?.releasedUntil ? Date.parse(rel.releasedUntil) : 0;
  if (relAt != null && relUntil != null && publicAtTs != null && Date.now() >= publicAtTs)
    releasedThrough = Math.max(releasedThrough, relUntil);

  // per-day booking load (slot-holding only)
  const dayLoad = new Map<string, number>();
  for (const b of await db.select().from(tables.bookings).where(eq(tables.bookings.providerId, svc.ownerId)).all()) {
    if (!(SLOT_HOLDING_STATUSES as readonly string[]).includes(b.status)) continue;
    const key = b.startsAt.toISOString().slice(0, 10);
    dayLoad.set(key, (dayLoad.get(key) ?? 0) + 1);
  }

  const days: DayAvailability[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(today.getTime() + i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    const endOfDay = new Date(d);
    endOfDay.setHours(23, 59, 59, 999);
    const dayTs = endOfDay.getTime();

    // 1) the provider doesn't take bookings then
    if (!acceptsAtAll) {
      days.push({ date: key, status: "booking_closed", note: "This provider isn't accepting bookings right now." });
      continue;
    }
    if (sched.days && sched.days.length && !sched.days.includes(d.getDay())) {
      days.push({ date: key, status: "booking_closed", note: `Closed on ${d.toLocaleDateString("en-US", { weekday: "long" })}s.` });
      continue;
    }

    // 2) release layer — is this date OPEN yet?
    if (sched.releaseMode === "scheduled") {
      if (d.getTime() > releasedThrough) {
        const inPending = relAt != null && relUntil != null && d.getTime() <= relUntil;
        if (inPending && Date.now() < relAt!) {
          days.push({
            date: key,
            status: "not_released",
            opensAt: new Date(relAt!).toISOString(),
            publicAt: publicAtTs ? new Date(publicAtTs).toISOString() : undefined,
            note: rel?.eaHours ? `Preferred Clients book first for ${rel.eaHours}h.` : undefined,
          });
          continue;
        }
        if (inPending && publicAtTs != null && Date.now() < publicAtTs) {
          // early-access phase of the release
          if (isPreferred) {
            days.push({ date: key, status: slotsFull ? "fully_booked" : (dayLoad.get(key) ?? 0) > 0 ? "limited" : "available", note: "You have Preferred Early Access." });
          } else {
            days.push({ date: key, status: "early_access", publicAt: new Date(publicAtTs).toISOString(), note: "Preferred Clients book first — then everyone." });
          }
          continue;
        }
        days.push({ date: key, status: "not_released", note: "This date hasn't been released for booking yet." });
        continue;
      }
    } else {
      // rolling horizon
      const horizon = sched.horizonDays ?? 60;
      const horizonEdge = Date.now() + horizon * 86400_000;
      if (d.getTime() > horizonEdge) {
        days.push({
          date: key,
          status: "outside_horizon",
          opensAt: new Date(dayTs - horizon * 86400_000).toISOString(),
          note: `Bookings open ${horizon} days ahead.`,
        });
        continue;
      }
    }

    // 3) rolling-mode preferred window covers all released dates
    if (windowOpen && !isPreferred) {
      days.push({ date: key, status: "early_access", publicAt: svc.preferredUntil!.toISOString(), note: "Preferred Clients book first — then everyone." });
      continue;
    }

    // 4) capacity
    if (slotsFull) {
      days.push({ date: key, status: "fully_booked", note: "All slots are taken — a cancellation reopens booking automatically." });
      continue;
    }
    const load = dayLoad.get(key) ?? 0;
    if (sched.maxPerDay && load >= sched.maxPerDay) {
      days.push({ date: key, status: "fully_booked", note: "This day is fully booked." });
      continue;
    }
    days.push({ date: key, status: load > 0 ? "limited" : "available" });
  }
  return { days };
}

/* ------------------------------------------------------------------ */
/*  TIME-SLOT LAYER — the second half of the booking flow.             */
/*                                                                     */
/*  The calendar picks the DATE; this picks the TIME. Slots are        */
/*  derived from the same rules the booking POST enforces (schedule,   */
/*  conflicts + buffer, advance notice, same-day policy, day caps,     */
/*  release/horizon/early-access gates) — a slot is only "available"   */
/*  if the actual booking API would accept it. One source of truth.    */
/* ------------------------------------------------------------------ */

export interface TimeSlot {
  hour: number;
  label: string; // "9:00 AM"
  status: "available" | "booked" | "too_soon" | "past";
  reason?: string;
}

export interface DaySlots {
  date: string;
  /** the day-level state (same enum as the calendar) */
  dayStatus: DayStatus;
  reason?: string;
  opensAt?: string;
  publicAt?: string;
  slots: TimeSlot[];
}

export async function serviceDaySlots(serviceId: string, viewerId: string | null, dateStr: string): Promise<DaySlots | null> {
  const svc = await db.select().from(tables.services).where(eq(tables.services.id, serviceId)).get();
  if (!svc || !svc.active || svc.visibility === "draft") return null;
  const cfg = parseConfig(svc.config);
  const sched = cfg.scheduling;

  // day-level verdict comes from the SAME calendar engine
  const target = new Date(dateStr + "T00:00:00");
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const idx = Math.round((target.getTime() - today.getTime()) / 86400_000);
  const cal = await serviceAvailability(serviceId, viewerId, Math.min(90, Math.max(7, idx + 1)));
  const day = cal?.days.find((d) => d.date === dateStr) ?? (idx < 0 ? { date: dateStr, status: "booking_closed" as DayStatus, note: "This date is in the past." } : undefined);
  if (!day) return { date: dateStr, dayStatus: "not_released", reason: "This date is beyond the visible calendar.", slots: [] };

  const blocked = !["available", "limited"].includes(day.status);
  if (blocked)
    return { date: dateStr, dayStatus: day.status, reason: day.note, opensAt: day.opensAt, publicAt: day.publicAt, slots: [] };

  // per-slot: real conflicts with the provider's calendar (buffer included)
  const durationMin = sched.durationMin || 60;
  const bufferMs = (sched.bufferMin ?? 0) * 60_000;
  const noticeMs = (sched.advanceNoticeHours ?? 0) * 3600_000;
  const taken = (await db
    .select()
    .from(tables.bookings)
    .where(eq(tables.bookings.providerId, svc.ownerId))
    .all())
    .filter((b) => (SLOT_HOLDING_STATUSES as readonly string[]).includes(b.status));

  const sameDayBlocked = sched.sameDayBooking === false && dateStr === new Date().toISOString().slice(0, 10);
  const slots: TimeSlot[] = [];
  const startH = sched.startHour ?? 9;
  const endH = sched.endHour ?? 17;
  for (let h = startH; h < endH; h++) {
    const start = new Date(`${dateStr}T${String(h).padStart(2, "0")}:00:00`);
    const end = new Date(start.getTime() + durationMin * 60_000);
    const label = start.toLocaleTimeString("en-US", { hour: "numeric" });
    if (start.getTime() <= Date.now()) {
      slots.push({ hour: h, label, status: "past", reason: "This time has passed." });
      continue;
    }
    if (sameDayBlocked) {
      slots.push({ hour: h, label, status: "too_soon", reason: "Same-day booking isn't available for this service." });
      continue;
    }
    if (start.getTime() - Date.now() < noticeMs) {
      slots.push({ hour: h, label, status: "too_soon", reason: `Needs at least ${sched.advanceNoticeHours} hours advance notice.` });
      continue;
    }
    const conflict = taken.some((b) => {
      const aStart = start.getTime() - bufferMs;
      const aEnd = end.getTime() + bufferMs;
      const bStart = b.startsAt.getTime();
      const bEnd = bStart + b.durationMin * 60_000;
      return aStart < bEnd && bStart < aEnd;
    });
    slots.push(conflict ? { hour: h, label, status: "booked", reason: "Already booked." } : { hour: h, label, status: "available" });
  }
  return { date: dateStr, dayStatus: day.status, reason: day.note, slots };
}
