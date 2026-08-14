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

/* ------------------- fine-grained type preferences -------------------
   The user-facing taxonomy: seven groups, each item its own switch.
   Default ON for everything except motivation (strictly OPT-IN).
   Stored inside the same users.notifyPrefs JSON under "types" — the
   channel parser above ignores unknown keys, writers must merge (see
   mergeNotifyPrefsRaw). system.security can never be turned off.
   These gates work for EVERY delivery channel — in-app today, and the
   same single check point serves real push (iOS/Android/web) later:
   a push transport plugs into deliver(), preferences already decide. */
export const NOTIF_TYPE_GROUPS: { group: string; items: { key: string; label: string; hint: string }[] }[] = [
  { group: "Social", items: [
    { key: "social.likes", label: "Likes", hint: "Someone likes your post" },
    { key: "social.comments", label: "Comments", hint: "Comments on your posts" },
    { key: "social.follows", label: "Follows", hint: "New followers" },
    { key: "social.messages", label: "Messages", hint: "New direct messages" },
    { key: "social.mentions", label: "Mentions", hint: "Someone mentions you" },
  ]},
  { group: "Creators", items: [
    { key: "creators.posts", label: "New posts", hint: "From creators you subscribed to" },
    { key: "creators.live", label: "Live streams", hint: "A subscribed creator goes live" },
    { key: "creators.updates", label: "Creator updates", hint: "Important updates from subscribed creators" },
  ]},
  { group: "Opportunities", items: [
    { key: "opportunities.new", label: "New opportunities", hint: "From creators/businesses you subscribed to" },
    { key: "opportunities.applications", label: "Application updates", hint: "Shortlisted, selected, status changes" },
    { key: "opportunities.deadlines", label: "Deadline reminders", hint: "Closing dates on saved/applied opportunities" },
  ]},
  { group: "Services & Bookings", items: [
    { key: "bookings.availability", label: "Booking availability", hint: "Bookings open, release windows, spots free up" },
    { key: "bookings.updates", label: "Booking updates", hint: "Requests, confirmations, changes, reminders" },
    { key: "bookings.services", label: "Service updates", hint: "A service you follow changes" },
  ]},
  { group: "Shop", items: [
    { key: "shop.orders", label: "Orders", hint: "Order placed, paid, completed" },
    { key: "shop.shipping", label: "Shipping & delivery", hint: "Dispatch and delivery updates" },
    { key: "shop.sellers", label: "Seller updates", hint: "Updates from sellers you bought from" },
  ]},
  { group: "Motivation", items: [
    { key: "motivation.mavyn", label: "Mavyn Motivation", hint: "Occasional encouragement — off unless you turn it on" },
    { key: "motivation.followed", label: "From creators you follow", hint: "Motivational posts by people you chose to follow" },
  ]},
  { group: "System", items: [
    { key: "system.security", label: "Security", hint: "Sign-ins, password changes — always on in-app" },
    { key: "system.account", label: "Account", hint: "Plan, verification, account changes" },
    { key: "system.announcements", label: "Platform announcements", hint: "Important Mavyn news only" },
  ]},
];

const TYPE_KEYS = new Set(NOTIF_TYPE_GROUPS.flatMap((g) => g.items.map((i) => i.key)));
/** keys that are OPT-IN (default false) — motivation never assumes consent */
const OPT_IN_KEYS = new Set(["motivation.mavyn", "motivation.followed"]);

/** which fine-grained switch governs each notification type */
export const TYPE_KEY_BY_TYPE: Record<string, string> = {
  like: "social.likes",
  comment: "social.comments",
  follow: "social.follows",
  message: "social.messages",
  mention: "social.mentions",
  creator_post: "creators.posts",
  post_activity: "creators.posts",
  creator_live: "creators.live",
  creator_update: "creators.updates",
  opportunity_new: "opportunities.new",
  opportunity_update: "opportunities.new",
  application: "opportunities.applications",
  application_shortlisted: "opportunities.applications",
  application_selected: "opportunities.applications",
  deadline_reminder: "opportunities.deadlines",
  booking_available: "bookings.availability",
  release_open: "bookings.availability",
  preferred_window: "bookings.availability",
  booking: "bookings.updates",
  booking_reminder: "bookings.updates",
  rebook_nudge: "bookings.updates",
  review_nudge: "bookings.updates",
  service_update: "bookings.services",
  order: "shop.orders",
  order_shipped: "shop.shipping",
  seller_update: "shop.sellers",
  motivation: "motivation.mavyn",
  motivation_followed: "motivation.followed",
  security: "system.security",
  account: "system.account",
  announcement: "system.announcements",
};

export function parseTypePrefs(raw: string | null | undefined): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  TYPE_KEYS.forEach((k) => { out[k] = !OPT_IN_KEYS.has(k); });
  try {
    const o = JSON.parse(raw || "{}") as { types?: Record<string, unknown> };
    if (o.types && typeof o.types === "object")
      TYPE_KEYS.forEach((k) => { if (typeof o.types![k] === "boolean") out[k] = o.types![k] as boolean; });
  } catch {}
  // motivation has ONE source of truth — the motivation prefs (master
  // switch + per-source). The type view DERIVES from it so the group
  // switches, the panel, and the dispatch gate can never disagree.
  const m = parseMotivationPrefs(raw);
  out["motivation.mavyn"] = m.enabled && m.general;
  out["motivation.followed"] = m.enabled && m.fromFollowed;
  out["system.security"] = true; // security can never be silenced
  return out;
}

/* --------------------------- motivation prefs ---------------------------
   Strictly opt-in, never excessive: on/off, frequency, time window,
   and which sources (general Mavyn motivation / followed creators). */
export interface MotivationPrefs {
  enabled: boolean;
  frequency: "daily" | "few-week" | "weekly";
  window: "any" | "morning" | "afternoon" | "evening";
  general: boolean;
  fromFollowed: boolean;
}
export const DEFAULT_MOTIVATION: MotivationPrefs = { enabled: false, frequency: "few-week", window: "morning", general: true, fromFollowed: true };

export function parseMotivationPrefs(raw: string | null | undefined): MotivationPrefs {
  const out = { ...DEFAULT_MOTIVATION };
  try {
    const m = (JSON.parse(raw || "{}") as { motivation?: Partial<MotivationPrefs> }).motivation;
    if (m && typeof m === "object") {
      if (typeof m.enabled === "boolean") out.enabled = m.enabled;
      if (["daily", "few-week", "weekly"].includes(String(m.frequency))) out.frequency = m.frequency as MotivationPrefs["frequency"];
      if (["any", "morning", "afternoon", "evening"].includes(String(m.window))) out.window = m.window as MotivationPrefs["window"];
      if (typeof m.general === "boolean") out.general = m.general;
      if (typeof m.fromFollowed === "boolean") out.fromFollowed = m.fromFollowed;
    }
  } catch {}
  return out;
}

/** The ONE writer for users.notifyPrefs: merges a partial update into the
    existing JSON without dropping the other sections (channels / types /
    motivation live in the same blob — a channel save must never wipe the
    type switches, and vice versa). */
export function mergeNotifyPrefsRaw(
  existingRaw: string | null | undefined,
  patch: { channels?: unknown; types?: Record<string, unknown>; motivation?: unknown }
): string {
  let base: Record<string, unknown> = {};
  try { base = JSON.parse(existingRaw || "{}") ?? {}; } catch {}
  if (patch.channels !== undefined) {
    const clean = parsePrefs(JSON.stringify(patch.channels));
    for (const cat of PREF_CATEGORIES) base[cat] = clean[cat];
  }
  if (patch.types !== undefined && patch.types !== null) {
    const prevTypes = (typeof base.types === "object" && base.types !== null ? base.types : {}) as Record<string, unknown>;
    const mot = parseMotivationPrefs(JSON.stringify(base));
    let motTouched = false;
    for (const [k, v] of Object.entries(patch.types)) {
      if (typeof v !== "boolean" || !TYPE_KEYS.has(k)) continue;
      // motivation group switches WRITE THROUGH to the motivation prefs
      // (one source of truth — see parseTypePrefs)
      if (k === "motivation.mavyn") { mot.general = v; motTouched = true; continue; }
      if (k === "motivation.followed") { mot.fromFollowed = v; motTouched = true; continue; }
      prevTypes[k] = v;
    }
    if (motTouched) {
      mot.enabled = mot.general || mot.fromFollowed;
      base.motivation = mot;
    }
    prevTypes["system.security"] = true;
    base.types = prevTypes;
  }
  if (patch.motivation !== undefined) {
    base.motivation = parseMotivationPrefs(JSON.stringify({ motivation: patch.motivation }));
  }
  return JSON.stringify(base);
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
export async function deliver(userId: string, channel: "sms" | "email", to: string, body: string, kind: string) {
  if (kind !== "security" && kind !== "otp") {
    const hourAgo = new Date(Date.now() - 3600_000);
    const recent = (
        await db
        .select()
        .from(tables.outbox)
        .where(and(eq(tables.outbox.userId, userId), eq(tables.outbox.channel, channel), gt(tables.outbox.createdAt, hourAgo)))
          .all()
      ).length;
    if (recent >= (channel === "sms" ? 8 : 20)) return; // grouped/limited, never spam
  }
  await db.insert(tables.outbox)
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

export async function notify(input: NotifyInput) {
  // never notify yourself
  if (input.actorId && input.actorId === input.userId) return;

  const prefCat = PREF_BY_TYPE[input.type];
  const recipient = await db.select().from(tables.users).where(eq(tables.users.id, input.userId)).get();
  const prefs = parsePrefs(recipient?.notifyPrefs);

  // respect the in-app toggle (security can never be silenced in-app)
  if (prefCat && prefCat !== "security" && !prefs[prefCat].inapp) return;

  // fine-grained type switch: if the user turned this KIND off, it does
  // not get sent — anywhere, on any channel. Security is exempt.
  const typeKey = TYPE_KEY_BY_TYPE[input.type];
  if (typeKey && typeKey !== "system.security" && parseTypePrefs(recipient?.notifyPrefs)[typeKey] === false) return;

  await db.insert(tables.notifications)
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
    await deliver(
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
    await deliver(input.userId, "sms", recipient.phone!, `Mavyn: ${input.title}. Open Mavyn to review.${manage}`, prefCat);
  }
}

/* ------------------------- subscription fanout -------------------------
   "Notify me about THIS" — rows in notify_subscriptions, written by
   /api/me/subscriptions, consumed ONLY here. Creator subscriptions carry
   a level; content subscriptions are on-rows. Every send still funnels
   through notify(), so category/type/channel preferences and self-skip
   all apply on top. Fanout is deliberately opt-in: following someone
   does NOT subscribe you to their content — the bell does. */

export const CREATOR_SUB_MODES = ["all", "posts", "live", "bookings", "opportunities", "important", "off"] as const;
export type CreatorSubMode = (typeof CREATOR_SUB_MODES)[number];
export const CONTENT_SUB_TYPES = ["post", "opportunity", "service"] as const;

/** creator event kinds map onto the subscription levels */
export type CreatorEventKind = "posts" | "live" | "bookings" | "opportunities" | "important";

export async function notifySubscribers(input: {
  targetType: "creator" | "post" | "opportunity" | "service";
  targetId: string;
  /** creator targets only: which level this event belongs to */
  eventKind?: CreatorEventKind;
  actorId?: string | null;
  type: string;
  title: string;
  body?: string;
  href: string;
}): Promise<number> {
  const subs = (await db
    .select()
    .from(tables.notifySubscriptions)
    .where(and(eq(tables.notifySubscriptions.targetType, input.targetType), eq(tables.notifySubscriptions.targetId, input.targetId)))
    .all())
    .filter((s) =>
      input.targetType === "creator"
        ? s.mode === "all" || s.mode === input.eventKind || (input.eventKind === "important" && s.mode !== "off")
        : s.mode !== "off"
    );
  let sent = 0;
  for (const s of subs) {
    if (s.userId === input.actorId) continue;
    await notify({ userId: s.userId, actorId: input.actorId ?? null, type: input.type, title: input.title, body: input.body, href: input.href });
    sent++;
  }
  return sent;
}
