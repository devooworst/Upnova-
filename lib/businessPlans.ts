/* ------------------------------------------------------------------ */
/*  Business plan capacity — client-safe constants (single source of   */
/*  truth; the server enforcement in lib/server/businessLimits.ts      */
/*  imports THESE numbers). Pro is SCALE, never basic access: every    */
/*  economic action exists on Business Free.                           */
/* ------------------------------------------------------------------ */

export type BusinessTier = "free" | "business_pro";

export interface BusinessLimits {
  teamMembers: number;
  activeHires: number;
  activeOpportunities: number;
  savedTalent: number;
  admins: number; // total seats INCLUDING the owner
  clientRecords: number;
  talentRecords: number;
}

export const BUSINESS_LIMITS: Record<BusinessTier, BusinessLimits> = {
  free: {
    teamMembers: 3,
    activeHires: 5,
    activeOpportunities: 3,
    savedTalent: 25,
    admins: 1,
    clientRecords: 50,
    talentRecords: 50,
  },
  business_pro: {
    teamMembers: 25,
    activeHires: 25,
    activeOpportunities: 15,
    savedTalent: 250,
    admins: 5,
    clientRecords: 500,
    talentRecords: 500,
  },
};

export const LIMIT_LABEL: Record<keyof BusinessLimits, string> = {
  teamMembers: "internal team members",
  activeHires: "active hires/projects",
  activeOpportunities: "active opportunities",
  savedTalent: "saved talent profiles",
  admins: "business admins",
  clientRecords: "client records",
  talentRecords: "talent records",
};

/** row order for the comparison table */
export const LIMIT_ROWS: { key: keyof BusinessLimits; label: string }[] = [
  { key: "teamMembers", label: "Team members" },
  { key: "activeHires", label: "Active hires/projects" },
  { key: "activeOpportunities", label: "Active opportunities" },
  { key: "savedTalent", label: "Saved talent" },
  { key: "admins", label: "Admins" },
  { key: "clientRecords", label: "Clients" },
  { key: "talentRecords", label: "Talent records" },
];
