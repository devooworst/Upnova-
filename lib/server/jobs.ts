import { and, eq, like } from "drizzle-orm";
import { db, tables } from "@/db";
import { notify } from "@/lib/server/notify";
import { readRelease, SLOT_HOLDING_STATUSES, preferredWithEarlyAccess } from "@/lib/server/preferred";
import { parseConfig } from "@/lib/servicePolicies";

/* ------------------------------------------------------------------ */
/*  BACKGROUND JOBS — the platform's heartbeat.                        */
/*                                                                     */
/*  Four moment-driven jobs that no request naturally triggers:        */
/*                                                                     */
/*   · appointment reminders  — 24h before a confirmed booking,        */
/*     both sides (reminders measurably cut no-shows)                  */
/*   · review nudges          — completed work without a review,       */
/*     one gentle ask, never repeated                                  */
/*   · rebooking nudges       — THE growth loop: ~3 weeks after a      */
/*     completed booking with no upcoming one, invite the client back  */
/*   · release-open alerts    — the MOMENT a scheduled release opens,  */
/*     Preferred Clients get their "you book first, starting now"      */
/*                                                                     */
/*  Idempotency: every send is recorded as the notification itself —   */
/*  a job fires once per (type, record, recipient), verified against   */
/*  the notifications table, so restarts and repeated ticks are safe.  */
/*  The scheduler interval is unref'd: it never keeps a process alive  */
/*  (builds and scripts exit normally).                                */
/* ------------------------------------------------------------------ */

const HOUR = 3600_000;
const DAY = 24 * HOUR;

function alreadySent(userId: string, type: string, hrefLike: string): boolean {
  return !!db
    .select()
    .from(tables.notifications)
    .where(and(eq(tables.notifications.userId, userId), eq(tables.notifications.type, type), like(tables.notifications.href, `%${hrefLike}%`)))
    .get();
}

/** run one pass of every job; returns per-job send counts (for tests/ops) */
export function runJobsTick(now = new Date()) {
  const counts = { reminders: 0, reviewNudges: 0, rebookNudges: 0, releaseAlerts: 0 };
  const t = now.getTime();

  const bookings = db.select().from(tables.bookings).all();
  const profiles = new Map(db.select().from(tables.profiles).all().map((p) => [p.userId, p]));
  const nameOf = (id: string) => profiles.get(id)?.displayName?.split(" ")[0] ?? "them";

  /* ---- 1 · appointment reminders: 24h window, both sides ---- */
  for (const b of bookings) {
    if (!["accepted", "confirmed"].includes(b.status)) continue;
    const until = b.startsAt.getTime() - t;
    if (until <= 0 || until > DAY) continue;
    const when = b.startsAt.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
    for (const [uid, other] of [[b.clientId, b.providerId], [b.providerId, b.clientId]] as const) {
      if (alreadySent(uid, "booking_reminder", b.id)) continue;
      notify({
        userId: uid,
        actorId: null,
        type: "booking_reminder",
        title: `Reminder: ${b.title} ${when}`,
        body: `Tomorrow with ${nameOf(other)}.${b.location ? ` Location: ${b.location}.` : ""}`,
        href: `/calendar?booking=${b.id}`,
      });
      counts.reminders++;
    }
  }

  /* ---- 2 · review nudges: projects completed in the last 7 days that
     were never reviewed (state stays "completed" until the client
     reviews, then becomes "reviewed") — one gentle ask, ever ---- */
  const projects = db.select().from(tables.projects).all();
  for (const pr of projects) {
    if (pr.state !== "completed") continue;
    const age = t - pr.updatedAt.getTime();
    if (age < 0 || age > 7 * DAY) continue;
    if (alreadySent(pr.clientId, "review_nudge", pr.id)) continue;
    notify({
      userId: pr.clientId,
      actorId: null,
      type: "review_nudge",
      title: `How was "${pr.title}" with ${nameOf(pr.creatorId)}?`,
      body: "A quick review helps them — and everyone hiring after you. Reviews come only from real completed work.",
      href: `/projects/${pr.id}`,
    });
    counts.reviewNudges++;
  }

  /* ---- 3 · rebooking nudges: the repeat-booking engine ----
     last completed booking with a provider 21–35 days ago, nothing
     upcoming with them, one nudge per pair per cycle. */
  const lastCompleted = new Map<string, { at: number; b: (typeof bookings)[number] }>();
  const hasUpcoming = new Set<string>();
  for (const b of bookings) {
    const key = `${b.clientId}:${b.providerId}`;
    if (b.status === "completed") {
      const prev = lastCompleted.get(key);
      if (!prev || b.startsAt.getTime() > prev.at) lastCompleted.set(key, { at: b.startsAt.getTime(), b });
    }
    if ((SLOT_HOLDING_STATUSES as readonly string[]).includes(b.status) && b.startsAt.getTime() > t) hasUpcoming.add(key);
  }
  for (const [key, { at, b }] of Array.from(lastCompleted.entries())) {
    if (hasUpcoming.has(key)) continue;
    const age = t - at;
    if (age < 21 * DAY || age > 35 * DAY) continue;
    if (alreadySent(b.clientId, "rebook_nudge", `rebook=${b.id}`)) continue;
    notify({
      userId: b.clientId,
      actorId: null,
      type: "rebook_nudge",
      title: `Time to rebook with ${nameOf(b.providerId)}?`,
      body: `It's been about ${Math.round(age / DAY / 7)} weeks since ${b.title}. Their calendar fills up — grab your usual spot.`,
      href: b.serviceId ? `/services/${b.serviceId}?rebook=${b.id}` : `/calendar?rebook=${b.id}`,
    });
    counts.rebookNudges++;
  }

  /* ---- 4 · release-open alerts: the moment early access starts ---- */
  const services = db.select().from(tables.services).all();
  for (const s of services) {
    if (!s.active) continue;
    if (parseConfig(s.config).scheduling.releaseMode !== "scheduled") continue;
    const rel = readRelease(s.config);
    if (!rel?.releaseAt || !rel.eaHours) continue;
    const openAt = Date.parse(rel.releaseAt);
    // fire in the window [releaseAt, releaseAt + 6h] — late ticks still alert, ancient releases don't
    if (t < openAt || t - openAt > 6 * HOUR) continue;
    for (const clientId of preferredWithEarlyAccess(s.ownerId)) {
      if (alreadySent(clientId, "release_open", `${s.id}?open=${rel.releaseAt}`)) continue;
      notify({
        userId: clientId,
        actorId: s.ownerId,
        type: "release_open",
        title: `Early access is OPEN: ${s.title}`,
        body: `${nameOf(s.ownerId)}'s new availability just released — you book first for the next ${rel.eaHours} hours.`,
        href: `/services/${s.id}?open=${rel.releaseAt}`,
      });
      counts.releaseAlerts++;
    }
  }

  return counts;
}

/* ---- the scheduler: one interval per process, never blocks exit ---- */
const g = globalThis as unknown as { __mavynJobs?: ReturnType<typeof setInterval> };

export function startJobScheduler() {
  if (g.__mavynJobs) return;
  if (process.env.MAVYN_JOBS === "0") return;
  const timer = setInterval(() => {
    try {
      runJobsTick();
    } catch (err) {
      console.warn("[mavyn] job tick failed:", (err as Error).message);
    }
  }, 60_000);
  timer.unref?.(); // builds, scripts, and tests exit normally
  g.__mavynJobs = timer;
}
