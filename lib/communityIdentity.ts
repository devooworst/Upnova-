/* ------------------------------------------------------------------ */
/*  Communities & identity — the shared vocabulary (client + server).  */
/*                                                                     */
/*  Core philosophy: anonymity on UpNova means controlling what OTHER  */
/*  MEMBERS see — never hiding from the platform. UpNova always        */
/*  retains the underlying account for moderation, safety, and abuse   */
/*  prevention. Masked identities are anonymous to the crowd,          */
/*  accountable to the platform.                                       */
/*                                                                     */
/*  Identity rules by area:                                            */
/*    Communities / Campus Questions … Real · Alias · Anonymous        */
/*    (subject to each community's allowed modes)                      */
/*    Events, Organizations, Opportunities, Services, Marketplace,     */
/*    Messages ………………………………………… profile identity required             */
/*  Social conversation can be anonymous; professional, transactional, */
/*  employment, and organizational activity cannot.                    */
/* ------------------------------------------------------------------ */

export type IdentityMode = "real" | "alias" | "anonymous";

export const IDENTITY_MODES: { id: IdentityMode; label: string; desc: string }[] = [
  { id: "real", label: "Real profile", desc: "Your normal UpNova profile identity" },
  { id: "alias", label: "Alias", desc: "A chosen nickname — not linked to your profile" },
  { id: "anonymous", label: "Anonymous", desc: "Shown as Anonymous with a per-community number" },
];

export const identityModeLabel = (m: string) => IDENTITY_MODES.find((x) => x.id === m)?.label ?? m;

/** "Anonymous • 482" — distinguishable within a community, identifiable nowhere. */
export const anonLabel = (code: string) => `Anonymous • ${code}`;

export const COMMUNITY_ACCESS = [
  { id: "public", label: "Public", desc: "Anyone can discover and join per the community rules" },
  { id: "private", label: "Private", desc: "Visible, but content and membership are restricted — join by request" },
  { id: "invite", label: "Invite-only", desc: "Members need an invitation to join" },
] as const;

export const COMMUNITY_CATEGORIES = [
  "Academic",
  "Study Groups",
  "Gaming",
  "Anime",
  "Sports",
  "Fashion",
  "Music",
  "Photography",
  "Career",
  "Hobbies",
  "Student Organizations",
  "Academic Groups",
  "Interest Groups",
  "Campus Social",
  "General",
] as const;

/* Student Groups — a campus community in one of these categories belongs
   to the STUDENT GROUPS area of Your Campus, not the general Communities
   directory. General communities stay for broader social/interest
   conversation (Music Producers, Photo & Video, Late Night Conversations…). */
export const STUDENT_GROUP_CATEGORIES = [
  "Study Groups",
  "Student Organizations",
  "Academic Groups",
  "Interest Groups",
] as const;

export const isStudentGroup = (c: { campusId: string | null; kind: string; category: string }) =>
  !!c.campusId && c.kind === "standard" && (STUDENT_GROUP_CATEGORIES as readonly string[]).includes(c.category);

/* Alias rules — anti-impersonation is server-enforced on top of this:
   an alias may not match another user's handle or display name. */
export const ALIAS_RE = /^[a-zA-Z0-9_.\- ]{3,24}$/;
export const ALIAS_RULES = "3–24 characters: letters, numbers, spaces, _ . -";

/* Reveal pair states — a PRIVATE relationship between two users,
   independent of either party's public community identity. */
export type RevealStatus = "pending" | "accepted" | "declined" | "never";

/* "How should people I've revealed myself to see me in communities?" */
export const REVEAL_IDENTITY_MODES = [
  {
    id: "keep_anonymous",
    label: "Keep me anonymous",
    desc: "I stay anonymous in communities even to people who know my identity",
  },
  {
    id: "show_to_connections",
    label: "Show my identity to connections",
    desc: "People I've mutually revealed with AND mutually follow see who I am on my masked posts",
  },
  {
    id: "always_profile",
    label: "Always show to people I've revealed to",
    desc: "Anyone I've accepted a reveal with sees who I am on my masked posts",
  },
] as const;

/* Anonymous participation limits — anti-abuse, not punishment.
   New accounts get a smaller allowance until they've been around. */
export const ANON_LIMITS = {
  newAccountAgeH: 72, // accounts younger than this get the reduced cap
  newAccountPerDay: 3,
  standardPerDay: 20,
};

export const communityRefMeta: Record<string, { label: string; href: (id: string) => string }> = {
  service: { label: "SERVICE", href: (id) => `/services/${id}` },
  opportunity: { label: "OPPORTUNITY", href: (id) => `/opportunities/${id}` },
  product: { label: "PRODUCT", href: (id) => `/shop/${id}` },
  work: { label: "WORK", href: (id) => `/works/${id}` },
  campus: { label: "CAMPUS LISTING", href: (id) => `/campus/market/${id}` },
  event: { label: "EVENT", href: (id) => `/events/${id}` },
};

/* ------------------- access & membership economics ------------------- */
/* Generic by design: creator circles, educational groups, networking,
   hobby groups, exclusive communities — one configurable model, never a
   per-use-case build. */

export const ACCESS_MODELS = [
  { id: "public_free", label: "Public · Free", desc: "Anyone can join instantly", access: "public", paid: false, approval: false },
  { id: "private_free", label: "Private · Free", desc: "Join by request — you approve members", access: "private", paid: false, approval: true },
  { id: "paid", label: "Paid subscription", desc: "Members subscribe to join — recurring membership", access: "public", paid: true, approval: false },
  { id: "paid_approval", label: "Paid + approval", desc: "You approve each member, then they subscribe", access: "private", paid: true, approval: true },
  { id: "invite", label: "Invite-only", desc: "Members need an invitation (can also carry a price)", access: "invite", paid: false, approval: false },
] as const;

export const BILLING_PERIODS = [
  { id: "weekly", label: "Weekly", days: 7 },
  { id: "monthly", label: "Monthly", days: 30 },
  { id: "yearly", label: "Yearly", days: 365 },
  { id: "custom", label: "Custom", days: 0 },
] as const;

export const periodLabel = (period: string, customDays?: number | null) =>
  period === "custom" ? `every ${customDays ?? "?"} days` : `/${period.replace("ly", "").replace("week", "week").replace("month", "mo").replace("year", "yr")}`;

/** Buyer-side 5% platform fee on top; the creator's price is the payout. */
export function membershipQuote(price: number) {
  const fee = Math.round(price * 0.05 * 100) / 100;
  return { price, fee, total: Math.round((price + fee) * 100) / 100 };
}

export const MEMBERSHIP_STATE_LABEL: Record<string, string> = {
  active: "Active member",
  grace: "Payment due — grace period",
  inactive: "Membership inactive — renew to regain access",
  pending: "Awaiting approval",
  approved_unpaid: "Approved — complete your membership payment",
  invited: "Invited",
  banned: "Removed",
};
