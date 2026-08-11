/* ------------------------------------------------------------------ */
/*  Notifications — single creation path. Every notification has a     */
/*  specific actor, a category, a priority, and a real destination.    */
/* ------------------------------------------------------------------ */

import { randomBytes } from "crypto";
import { eq, gt, and } from "drizzle-orm";
import { db, tables } from "@/db";

/* ---------------- notification preferences (per user) ----------------
   Five spec categories × three channels. Stored as JSON on users.
   Defaults: in-app ON everywhere, email ON everywhere, SMS OFF except
   security (SMS additionally requires a verified phone + explicit
   consent — a number alone never opts anyone in). In-app SECURITY
   notifications can never be disabled. */
export const PREF_CATEGORIES = ["projects", "opportunities", "bookings", "messages", "security"] as const;
export type PrefCategory = (typeof PREF_CATEGORIES)[number];
export type ChannelPrefs = { inapp: boolean; email: boolean; sms: boolean };
export type NotifyPrefs = Record<PrefCategory, ChannelPrefs>;

export const DEFAULT_PREFS: NotifyPrefs = {
  projects: { inapp: true, email: true, sms: false },
  opportunities: { inapp: true, email: true, sms: false },
  bookings: { inapp: true, email: true, sms: false },
  messages: { inapp: true, email: false, sms: false },
  security: { inapp: true, email: true, sms: true },
};

export function parsePrefs(raw: string | null | undefined): NotifyPrefs {
  const out: NotifyPrefs = JSON.parse(JSON.stringify(DEFAULT_PREFS));
  if (!raw) return out;
  try {
    const o = JSON.parse(raw) as Record<string, Partial<ChannelPrefs>>;
    for (const cat of PREF_CATEGORIES) {
      const c = o[cat];
      if (c && typeof c === "object") {
        for (const ch of ["inapp", "email", "sms"] as const)
          if (typeof c[ch] === "boolean") out[cat][ch] = c[ch]!;
      }
    }
  } catch {
    /* corrupted prefs read as defaults */
  }
  out.security.inapp = true; // security is always visible in-app
  return out;
}

/* which pref category a notification type belongs to; unmapped types
   (social likes, campus chatter…) stay in-app only — never email/SMS */
const PREF_BY_TYPE: Record<string, PrefCategory> = {
  booking: "bookings",
  payment: "projects",
  project_offer: "projects",
  project_accepted: "projects",
  project_submitted: "projects",
  project_approved: "projects",
  extension_requested: "projects",
  extension_approved: "projects",
  extension_denied: "projects",
  progress_update: "projects",
  eta_changed: "projects",
  preferred_added: "bookings",
  preferred_removed: "bookings",
  preferred_window: "bookings",
  booking_reminder: "bookings",
  review_nudge: "bookings",
  rebook_nudge: "bookings",
  release_open: "bookings",
  order: "projects",
  application: "opportunities",
  application_shortlisted: "opportunities",
  application_selected: "opportunities",
  opportunity: "opportunities",
  message: "messages",
  security: "security",
};

/** Demo delivery: writes to the inspectable outbox table. Production
    swaps this writer for a real provider (Twilio/SES) — same call site.
    Anti-spam: hard cap per user/channel/hour; security is exempt. */
export function deliver(userId: string, channel: "sms" | "email", to: string, body: string, kind: string) {
  if (kind !== "security" && kind !== "otp") {
    const hourAgo = new Date(Date.now() - 3600_000);
    const recent = db
      .select()
      .from(tables.outbox)
      .where(and(eq(tables.outbox.userId, userId), eq(tables.outbox.channel, channel), gt(tables.outbox.createdAt, hourAgo)))
      .all().length;
    if (recent >= (channel === "sms" ? 8 : 20)) return; // grouped/limited, never spam
  }
  db.insert(tables.outbox)
    .values({ id: randomBytes(12).toString("hex"), userId, channel, to, body: body.slice(0, 320), kind })
    .run();
}

type NotifyInput = {
  userId: string;
  actorId?: string | null;
  type: string;
  title: string;
  body?: string;
  href: string;
  category?: "activity" | "work" | "messages" | "communities" | "campus" | "payments";
  priority?: "high" | "normal" | "low";
};

const CATEGORY_BY_TYPE: Record<string, NotifyInput["category"]> = {
  message: "messages",
  follow: "activity",
  like: "activity",
  project_offer: "work",
  project_accepted: "work",
  extension_requested: "work",
  extension_approved: "work",
  extension_denied: "work",
  project_submitted: "work",
  project_approved: "work",
  application: "work",
  application_shortlisted: "work",
  application_selected: "work",
  payment: "payments",
  community: "communities",
  campus: "campus",
  booking: "work",
};

const PRIORITY_BY_TYPE: Record<string, NotifyInput["priority"]> = {
  project_offer: "high",
  extension_requested: "high",
  payment: "high",
  booking: "high",
  application: "high",
  application_selected: "high",
  message: "normal",
  follow: "low",
  like: "low",
};

export function notify(input: NotifyInput) {
  // never notify yourself
  if (input.actorId && input.actorId === input.userId) return;

  const prefCat = PREF_BY_TYPE[input.type];
  const recipient = db.select().from(tables.users).where(eq(tables.users.id, input.userId)).get();
  const prefs = parsePrefs(recipient?.notifyPrefs);

  // respect the in-app toggle (security can never be silenced in-app)
  if (prefCat && prefCat !== "security" && !prefs[prefCat].inapp) return;

  db.insert(tables.notifications)
    .values({
      id: randomBytes(12).toString("hex"),
      userId: input.userId,
      actorId: input.actorId ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? "",
      href: input.href,
      category: input.category ?? CATEGORY_BY_TYPE[input.type] ?? "activity",
      priority: input.priority ?? PRIORITY_BY_TYPE[input.type] ?? "normal",
    })
    .run();

  /* channel fanout — only for mapped categories, only per the user's
     explicit preferences. SMS bodies are short, actionable, and carry
     NO sensitive detail: title + "open Mavyn", plus the managed-alerts
     line for non-essential messages. */
  if (!prefCat || !recipient) return;
  if (prefs[prefCat].email && recipient.email) {
    deliver(
      input.userId,
      "email",
      recipient.email,
      `${input.title}${input.body ? ` — ${input.body}` : ""} · Open Mavyn: ${input.href}`,
      prefCat
    );
  }
  const smsAllowed = recipient.phone && recipient.phoneVerified && recipient.smsConsent && prefs[prefCat].sms;
  if (smsAllowed) {
    const manage = prefCat === "security" ? "" : " Manage alerts in Mavyn Settings.";
    deliver(input.userId, "sms", recipient.phone!, `Mavyn: ${input.title}. Open Mavyn to review.${manage}`, prefCat);
  }
}
