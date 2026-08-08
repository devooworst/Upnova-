/* ------------------------------------------------------------------ */
/*  Creator-defined service policies — the vocabulary of the           */
/*  configurable service engine. UpNova never dictates "every stylist  */
/*  charges a $20 travel fee"; the creator picks the rules and UpNova  */
/*  compiles them into the customer-facing flow, always disclosed      */
/*  BEFORE payment. Shared by the creation form, the services API,     */
/*  the booking wizard, and the booking record.                        */
/* ------------------------------------------------------------------ */

export type LocationMode = "my_location" | "client_location" | "both" | "remote" | "flexible";
export type TravelMode = "none" | "free" | "flat" | "per_mile" | "quote";
export type CancellationPolicy = "anytime" | "free_24h" | "partial_48h" | "custom";
export type ReschedulePolicy = "free" | "one_free" | "fee" | "approval";
export type NoShowPolicy = "none" | "partial" | "full";

/* ----------------------------- categories ----------------------------- */
/* Official categories provide smart defaults and site-wide organization.
   Creators can add a CUSTOM category when nothing fits — it works
   immediately for their service (filters, search, profile) but does NOT
   become a global category. Usage of custom categories is tracked in the
   admin overview so frequent ones can be promoted to official later. */

export const OFFICIAL_CATEGORIES = [
  "creative", "music", "photography", "video", "design",
  "beauty", "care", "fashion", "events", "education",
] as const;

export function normalizeCategory(raw: unknown): string {
  return String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 &+-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 24);
}

/* ----------------------------- visibility ----------------------------- */

export type ServiceVisibility = "public" | "followers" | "unlisted" | "draft";

export const VISIBILITY_OPTIONS: { id: ServiceVisibility; label: string; hint: string }[] = [
  { id: "public", label: "Public", hint: "Directory, category pages, search, feed, and your profile." },
  { id: "followers", label: "Followers only", hint: "Only people who follow you see it on your profile and in the directory." },
  { id: "unlisted", label: "Unlisted / link only", hint: "Anyone with the link can view and book — it isn't listed anywhere." },
  { id: "draft", label: "Private draft", hint: "Only you. Publish it later from your profile." },
];

/* ----------------------------- service menu ----------------------------- */
/* The creator builds their own menu — UpNova never forces one price on a
   business that actually sells "Retwist $60 · Wash +$10 · Style +$20".
   Add-ons can change the price AND the appointment length; packages bundle
   the base service with add-ons at the creator's own bundle price. */

export type AddonPriceMode = "fixed" | "starting" | "quote";

export interface MenuAddon {
  id: string;
  name: string;
  /** fixed = exact add-on price · starting = "from $X" · quote = priced in conversation */
  priceMode: AddonPriceMode;
  price: number; // creator payout dollars (ignored for quote)
  timeMin: number; // minutes added to the appointment
  required?: boolean; // auto-included on every booking
}

export interface MenuPackage {
  id: string;
  name: string; // e.g. "Full Package — Wash + Retwist + Style"
  price: number; // the bundle price replaces base + included add-ons
  includes: string[]; // add-on ids bundled in (base service always included)
}

export interface ServiceMenu {
  addons: MenuAddon[];
  packages: MenuPackage[];
}

export const EMPTY_MENU: ServiceMenu = { addons: [], packages: [] };

export interface ServiceConfig {
  locationMode: LocationMode;
  /** the creator's own menu — optional; a single-price service simply has none */
  menu?: ServiceMenu;
  travel: {
    mode: TravelMode;
    flatFee?: number;
    perMile?: number;
    freeMiles?: number;
    radiusMi?: number;
  };
  scheduling: {
    durationMin: number;
    maxPerDay?: number;
    /** 0=Sun … 6=Sat — days the creator takes appointments */
    days?: number[];
    startHour?: number; // 0–23
    endHour?: number;
    bufferMin?: number; // gap enforced between appointments
    sameDayBooking?: boolean;
    advanceNoticeHours?: number;
  };
  pricing?: {
    type: "fixed" | "starting" | "hourly" | "quote";
    deposit?: number;
  };
  policies: {
    cancellation: CancellationPolicy;
    cancellationNote?: string;
    reschedule: ReschedulePolicy;
    rescheduleFee?: number;
    lateGraceMin: number;
    lateFee: number;
    noShow: NoShowPolicy;
  };
  requirements: string[]; // what the customer provides up front
}

export const DEFAULT_CONFIG: ServiceConfig = {
  locationMode: "flexible",
  travel: { mode: "none" },
  scheduling: {
    durationMin: 60,
    days: [1, 2, 3, 4, 5, 6],
    startHour: 9,
    endHour: 17,
    bufferMin: 0,
    sameDayBooking: true,
    advanceNoticeHours: 2,
  },
  pricing: { type: "starting" },
  policies: {
    cancellation: "free_24h",
    reschedule: "free",
    lateGraceMin: 15,
    lateFee: 0,
    noShow: "none",
  },
  requirements: [],
};

export function parseConfig(raw: string | null | undefined): ServiceConfig {
  try {
    const p = JSON.parse(raw || "{}");
    return {
      ...DEFAULT_CONFIG,
      ...p,
      travel: { ...DEFAULT_CONFIG.travel, ...(p.travel ?? {}) },
      scheduling: { ...DEFAULT_CONFIG.scheduling, ...(p.scheduling ?? {}) },
      pricing: { ...DEFAULT_CONFIG.pricing, ...(p.pricing ?? {}) },
      policies: { ...DEFAULT_CONFIG.policies, ...(p.policies ?? {}) },
      requirements: Array.isArray(p.requirements) ? p.requirements : [],
      menu: normalizeMenu(p.menu),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function normalizeMenu(raw: unknown): ServiceMenu | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const m = raw as { addons?: unknown; packages?: unknown };
  const addons: MenuAddon[] = (Array.isArray(m.addons) ? m.addons : [])
    .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
    .slice(0, 12)
    .map((a, i) => ({
      id: String(a.id || `a${i}`).slice(0, 24),
      name: String(a.name || "").slice(0, 60),
      priceMode: (["fixed", "starting", "quote"] as const).includes(a.priceMode as AddonPriceMode)
        ? (a.priceMode as AddonPriceMode)
        : "fixed",
      price: Math.min(10_000, Math.max(0, Math.round(Number(a.price) || 0))),
      timeMin: Math.min(480, Math.max(0, Math.round(Number(a.timeMin) || 0))),
      required: a.required === true || undefined,
    }))
    .filter((a) => a.name);
  const ids = new Set(addons.map((a) => a.id));
  const packages: MenuPackage[] = (Array.isArray(m.packages) ? m.packages : [])
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .slice(0, 6)
    .map((p, i) => ({
      id: String(p.id || `p${i}`).slice(0, 24),
      name: String(p.name || "").slice(0, 80),
      price: Math.min(10_000, Math.max(0, Math.round(Number(p.price) || 0))),
      includes: (Array.isArray(p.includes) ? p.includes : []).map(String).filter((x) => ids.has(x)),
    }))
    .filter((p) => p.name && p.price > 0);
  if (!addons.length && !packages.length) return undefined;
  return { addons, packages };
}

/* ------------------------- selection → price/time ------------------------- */
/* ONE calculator, shared by the booking wizard (live totals) and the
   bookings API (the amounts that are actually charged). The server never
   trusts a client-computed number — it recomputes from the creator's menu. */

export interface SelectionLine {
  label: string;
  /** creator-payout dollars — null when the item is quote-priced */
  amount: number | null;
  quoted?: boolean;
}

export interface SelectionResult {
  lines: SelectionLine[];
  /** total creator payout for priced lines (travel and platform fee excluded) */
  payout: number;
  /** total reserved appointment time */
  durationMin: number;
  /** true when any selected line still needs a quote in the conversation */
  hasQuoted: boolean;
  /** the resolved title, e.g. "Loc Retwist — Full Package" */
  title: string;
}

export function computeSelection(
  config: ServiceConfig,
  service: { title: string; price: number },
  selection: { packageId?: string | null; addonIds?: string[] }
): SelectionResult {
  const menu = config.menu ?? EMPTY_MENU;
  const baseDuration = config.scheduling.durationMin || 60;
  const pkg = selection.packageId ? menu.packages.find((p) => p.id === selection.packageId) : undefined;
  const chosen = new Set(selection.addonIds ?? []);
  for (const a of menu.addons) if (a.required) chosen.add(a.id); // required = always included
  if (pkg) for (const id of pkg.includes) chosen.delete(id); // bundled into the package price

  const lines: SelectionLine[] = [];
  let durationMin = baseDuration;

  if (pkg) {
    const included = menu.addons.filter((a) => pkg.includes.includes(a.id));
    durationMin = baseDuration + included.reduce((s, a) => s + a.timeMin, 0);
    lines.push({ label: pkg.name, amount: pkg.price });
  } else {
    lines.push({ label: service.title, amount: service.price });
  }

  for (const id of Array.from(chosen)) {
    const a = menu.addons.find((x) => x.id === id);
    if (!a) continue;
    if (a.priceMode === "quote") {
      // priced in the conversation — never silently added to the charge
      lines.push({ label: `${a.name} — quote required`, amount: null, quoted: true });
      continue;
    }
    lines.push({ label: a.priceMode === "starting" ? `${a.name} (from)` : a.name, amount: a.price });
    durationMin += a.timeMin;
  }

  return {
    lines,
    payout: lines.reduce((s, l) => s + (l.amount ?? 0), 0),
    durationMin: Math.min(720, durationMin),
    hasQuoted: lines.some((l) => l.quoted),
    title: pkg ? `${service.title} — ${pkg.name}` : service.title,
  };
}

/** Short customer-facing menu summary for listing cards. */
export function menuSummary(menu: ServiceMenu | undefined): string | null {
  if (!menu) return null;
  const bits: string[] = [];
  for (const a of menu.addons.slice(0, 3))
    bits.push(`${a.name} ${a.priceMode === "quote" ? "· quote" : `+$${a.price}`}`);
  if (menu.addons.length > 3) bits.push(`+${menu.addons.length - 3} more`);
  if (menu.packages.length) bits.push(`${menu.packages.length} package${menu.packages.length > 1 ? "s" : ""}`);
  return bits.length ? bits.join(" · ") : null;
}

/* ------------------------------- labels ------------------------------- */

export const LOCATION_LABEL: Record<LocationMode, string> = {
  my_location: "At my location",
  client_location: "Client's location",
  both: "My place or yours",
  remote: "Remote",
  flexible: "Flexible",
};

export function travelLabel(t: ServiceConfig["travel"]): string {
  switch (t.mode) {
    case "none":
      return "No travel offered";
    case "free":
      return `Travel included — no additional fee${t.radiusMi ? ` (within ${t.radiusMi} mi)` : ""}`;
    case "flat":
      return `Travel fee $${t.flatFee ?? 0}${t.radiusMi ? ` within ${t.radiusMi} mi` : ""}`;
    case "per_mile":
      return `$${t.perMile ?? 0}/mile${t.freeMiles ? ` after ${t.freeMiles} mi` : ""}${t.radiusMi ? ` · up to ${t.radiusMi} mi` : ""}`;
    case "quote":
      return "Travel quoted before booking";
  }
}

export function cancellationLabel(p: ServiceConfig["policies"]): string {
  switch (p.cancellation) {
    case "anytime":
      return "Free cancellation anytime before the appointment";
    case "free_24h":
      return "Free cancellation up to 24 hours before";
    case "partial_48h":
      return "Full refund up to 48 hours before · 50% after that";
    case "custom":
      return p.cancellationNote || "Custom cancellation policy — ask before booking";
  }
}

export function rescheduleLabel(p: ServiceConfig["policies"]): string {
  switch (p.reschedule) {
    case "free":
      return "Free rescheduling";
    case "one_free":
      return "One free reschedule, then requires approval";
    case "fee":
      return `Rescheduling fee $${p.rescheduleFee ?? 0}`;
    case "approval":
      return "Rescheduling requires approval";
  }
}

export function lateLabel(p: ServiceConfig["policies"]): string {
  if (p.lateFee > 0) return `${p.lateGraceMin}-minute grace period · $${p.lateFee} late fee after`;
  return `${p.lateGraceMin}-minute grace period · no late fee`;
}

export function noShowLabel(p: ServiceConfig["policies"]): string {
  switch (p.noShow) {
    case "none":
      return "No-show: no charge";
    case "partial":
      return "No-show: 50% charge";
    case "full":
      return "No-show: full charge";
  }
}

/** Every policy line a customer must see before paying. */
export function policyLines(c: ServiceConfig): string[] {
  return [cancellationLabel(c.policies), rescheduleLabel(c.policies), lateLabel(c.policies), noShowLabel(c.policies)];
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function priceLabel(c: ServiceConfig, price: number): string {
  switch (c.pricing?.type) {
    case "fixed":
      return `$${price}`;
    case "hourly":
      return `$${price}/hr`;
    case "quote":
      return "Custom quote";
    default:
      return `From $${price}`;
  }
}

export function availabilityLabel(s: ServiceConfig["scheduling"]): string {
  const days = s.days ?? [];
  const daysTxt =
    days.length === 7
      ? "Every day"
      : days.length
        ? days
            .slice()
            .sort()
            .map((d) => DAY_LABELS[d])
            .join(" · ")
        : "By arrangement";
  const fmt = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" });
  return `${daysTxt} · ${fmt(s.startHour ?? 9)}–${fmt(s.endHour ?? 17)}`;
}

/** Travel fee for a given distance — the same math server and client use. */
export function travelFeeFor(t: ServiceConfig["travel"], distanceMi: number | null): { fee: number; note: string | null } {
  switch (t.mode) {
    case "none":
    case "free":
      return { fee: 0, note: null };
    case "flat":
      return { fee: t.flatFee ?? 0, note: null };
    case "per_mile": {
      if (distanceMi == null) return { fee: 0, note: "Travel is charged per mile — set your location so it can be calculated" };
      const billable = Math.max(0, distanceMi - (t.freeMiles ?? 0));
      return { fee: Math.round(billable * (t.perMile ?? 0)), note: null };
    }
    case "quote":
      return { fee: 0, note: "Travel is quoted separately in the conversation" };
  }
}
