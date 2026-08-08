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

export interface ServiceConfig {
  locationMode: LocationMode;
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
    };
  } catch {
    return DEFAULT_CONFIG;
  }
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
