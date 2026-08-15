/* ------------------------------------------------------------------ */
/*  Opportunity roles — TEAM & OPENINGS as configuration, never as a   */
/*  separate system. One "Clothing Brand Photoshoot" opportunity can   */
/*  need Photographer ×1 $500 + Model ×3 $200 + MUA ×1 $200; a concert */
/*  can need Security ×6 + Stagehands ×4. Same architecture:           */
/*  Opportunity → Roles → Capacity → Applications → Selection →        */
/*  Acceptance → Booking → Payment → Completion → History.             */
/*  Shared by the poster form, the apply modal, the applicant review,  */
/*  and the server routes that enforce capacity.                       */
/* ------------------------------------------------------------------ */

export interface OppRole {
  id: string;
  title: string; // "Photographer", "Model", "Event Staff", "Cashier" — free text
  count: number; // openings
  pay: number | null; // per person; null = unpaid/collab role
  description?: string;
}

export function parseRoles(raw: string | null | undefined): OppRole[] {
  try {
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? normalizeRoles(arr) : [];
  } catch {
    return [];
  }
}

export function normalizeRoles(raw: unknown): OppRole[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .slice(0, 10)
    .map((r, i) => ({
      id: String(r.id || `r${i}`).slice(0, 24),
      title: String(r.title || "").trim().slice(0, 40),
      count: Math.min(50, Math.max(1, Math.round(Number(r.count) || 1))),
      pay: r.pay == null || r.pay === "" ? null : Math.min(100_000, Math.max(0, Math.round(Number(r.pay) || 0))),
      description: String(r.description || "").trim().slice(0, 200) || undefined,
    }))
    .filter((r) => r.title);
}

/** Openings still available: capacity minus offers out + confirmed. */
export function openingsLeft(role: OppRole, apps: { roleId: string | null; status: string }[]): number {
  const taken = apps.filter((a) => a.roleId === role.id && ["selected", "confirmed"].includes(a.status)).length;
  return Math.max(0, role.count - taken);
}

/** "Photographer 1 · Model 3 · MUA 1" — card summary line. */
export function rolesSummary(roles: OppRole[]): string | null {
  if (!roles.length) return null;
  return roles.map((r) => `${r.title} ×${r.count}`).join(" · ");
}
