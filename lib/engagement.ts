/* ------------------------------------------------------------------ */
/*  Engagement configuration — one-time work AND ongoing professional  */
/*  relationships on the SAME universal Opportunity system.            */
/*                                                                     */
/*  · The poster configures the type; Mavyn never auto-classifies     */
/*    anyone as employee vs contractor.                                */
/*  · classification distinguishes work FACILITATED through Mavyn     */
/*    (freelance/contract, native payment workflow) from EMPLOYMENT    */
/*    handled by an external employer (clearly labeled, no Mavyn      */
/*    payment pretense).                                               */
/*  · Compensation schedules are configuration: hourly, per-project,   */
/*    milestone, weekly, biweekly, monthly, custom. Ongoing Mavyn     */
/*    engagements are paid in CYCLES through the existing secured →    */
/*    released payment machinery — one cycle, one visible payment.     */
/* ------------------------------------------------------------------ */

export const ENGAGEMENT_TYPES = [
  { id: "one_time", label: "One-time project" },
  { id: "short_term", label: "Short-term contract" },
  { id: "ongoing", label: "Ongoing freelance" },
  { id: "part_time", label: "Part-time" },
  { id: "full_time", label: "Full-time" },
  { id: "temporary", label: "Temporary" },
  { id: "collab", label: "Collaboration" },
  { id: "custom", label: "Other / custom" },
] as const;
export type EngagementType = (typeof ENGAGEMENT_TYPES)[number]["id"];

export const COMP_MODELS = [
  { id: "per_project", label: "Per project", cycle: "project" },
  { id: "hourly", label: "Hourly", cycle: "invoiced block" },
  { id: "milestone", label: "Per milestone", cycle: "milestone" },
  { id: "weekly", label: "Weekly", cycle: "week" },
  { id: "biweekly", label: "Biweekly", cycle: "2-week cycle" },
  { id: "monthly", label: "Monthly", cycle: "month" },
  { id: "custom", label: "Custom", cycle: "cycle" },
] as const;
export type CompModel = (typeof COMP_MODELS)[number]["id"];

export function cycleLabel(model: string): string {
  return COMP_MODELS.find((c) => c.id === model)?.cycle ?? "cycle";
}

export interface EngagementConfig {
  type: EngagementType;
  customLabel?: string; // when type=custom
  workload?: string; // "≈10 hrs/week"
  schedule?: string; // "2 videos/week, weekday turnaround"
  startDate?: string; // ISO date
  duration?: string; // "3 months", "until filled", ""
  compModel: CompModel;
  rate?: number; // dollars per cycle/unit (poster payout basis)
  rateNote?: string; // "per finished video", custom arrangements
  classification: "mavyn_freelance" | "external_employment";
  interviewMode: "none" | "mavyn" | "external";
  externalNote?: string; // how the external process works
}

export function parseEngagement(raw: string | null | undefined): EngagementConfig | null {
  try {
    const p = JSON.parse(raw || "{}");
    if (!p || typeof p !== "object" || !p.type) return null;
    return normalizeEngagement(p);
  } catch {
    return null;
  }
}

export function normalizeEngagement(p: Record<string, unknown>): EngagementConfig | null {
  const type = ENGAGEMENT_TYPES.find((t) => t.id === p.type)?.id;
  if (!type) return null;
  return {
    type,
    customLabel: String(p.customLabel || "").slice(0, 40) || undefined,
    workload: String(p.workload || "").slice(0, 80) || undefined,
    schedule: String(p.schedule || "").slice(0, 120) || undefined,
    startDate: p.startDate ? String(p.startDate).slice(0, 24) : undefined,
    duration: String(p.duration || "").slice(0, 60) || undefined,
    compModel: (COMP_MODELS.find((c) => c.id === p.compModel)?.id ?? "per_project") as CompModel,
    rate: p.rate == null || p.rate === "" ? undefined : Math.min(1_000_000, Math.max(0, Math.round(Number(p.rate) || 0))),
    rateNote: String(p.rateNote || "").slice(0, 120) || undefined,
    classification: p.classification === "external_employment" ? "external_employment" : "mavyn_freelance",
    interviewMode: ["none", "mavyn", "external"].includes(String(p.interviewMode)) ? (p.interviewMode as EngagementConfig["interviewMode"]) : "none",
    externalNote: String(p.externalNote || "").slice(0, 200) || undefined,
  };
}

export function engagementTypeLabel(e: EngagementConfig): string {
  if (e.type === "custom" && e.customLabel) return e.customLabel;
  return ENGAGEMENT_TYPES.find((t) => t.id === e.type)?.label ?? e.type;
}

export function compLabel(e: EngagementConfig): string {
  const model = COMP_MODELS.find((c) => c.id === e.compModel)?.label ?? e.compModel;
  if (e.rate == null) return model;
  const suffix =
    e.compModel === "hourly" ? "/hr" : ["weekly", "biweekly", "monthly"].includes(e.compModel) ? `/${cycleLabel(e.compModel)}` : "";
  return `$${e.rate}${suffix}${e.compModel === "per_project" ? " per project" : e.compModel === "milestone" ? " per milestone" : ""}`;
}

/* ------------------------------- the offer ------------------------------- */

export interface EngagementOffer {
  title: string; // role/position
  engagementType: EngagementType;
  customLabel?: string;
  compModel: CompModel;
  amount: number; // per cycle/unit — the payout each payment secures
  schedule?: string;
  startDate?: string;
  duration?: string;
  classification: "mavyn_freelance" | "external_employment";
  note?: string; // other agreed terms
  cycles?: number; // paid cycles started so far (Mavyn-native only)
}

export function parseOffer(raw: string | null | undefined): EngagementOffer | null {
  try {
    const p = JSON.parse(raw || "{}");
    if (!p || typeof p !== "object" || !p.title) return null;
    return p as EngagementOffer;
  } catch {
    return null;
  }
}

export interface InterviewInfo {
  mode: "mavyn" | "external";
  at?: string; // ISO — Mavyn-scheduled
  note?: string;
}

export function parseInterview(raw: string | null | undefined): InterviewInfo | null {
  try {
    const p = JSON.parse(raw || "{}");
    if (!p || typeof p !== "object" || !p.mode) return null;
    return p as InterviewInfo;
  } catch {
    return null;
  }
}
