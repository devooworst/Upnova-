/* ------------------------------------------------------------------ */
/*  Onboarding personalization — the four light-touch questions.       */
/*                                                                     */
/*    Interests   = what I like                                        */
/*    Goals       = what I want to do                                  */
/*    Vibe        = how I describe myself                              */
/*    Want more   = what I want Mavyn to give me                       */
/*                                                                     */
/*  Canonical lists live HERE (client + server import the same file)   */
/*  so the flow, the Settings editor, and the API validate against     */
/*  one source of truth. Everything is multi-select and optional.      */
/*                                                                     */
/*  PRIVACY LINE (do not cross): these are taste/intent signals only.  */
/*  Never ask for sensitive personal information, mental-health data,  */
/*  diagnoses, or anything resembling a psychological assessment.      */
/*  Selections are INITIAL recommendation signals, not permanent       */
/*  labels — real behavior outweighs them over time (see recsys).      */
/* ------------------------------------------------------------------ */

/* Interests are stored as their labels in profiles.interests — the same
   field the profile editor curates, so "edit later" is already true. */
export const INTEREST_OPTIONS = [
  "Music",
  "Entertainment",
  "Sports",
  "Art & Design",
  "Photography",
  "Fashion",
  "Gaming",
  "Technology",
  "Business",
  "Entrepreneurship",
  "Education",
  "Food",
  "Travel",
  "Content Creation",
  "Events & Culture",
  "Fitness",
  "Community",
  "Freelancing & Opportunities",
] as const;

export const GOAL_OPTIONS = [
  { id: "discover-people", label: "Discover people" },
  { id: "create-share", label: "Create and share" },
  { id: "make-money", label: "Make money" },
  { id: "find-opportunities", label: "Find opportunities" },
  { id: "hire-people", label: "Hire people" },
  { id: "find-clients", label: "Find clients" },
  { id: "sell-something", label: "Sell something" },
  { id: "build-brand", label: "Build my brand" },
  { id: "network", label: "Network" },
  { id: "learn", label: "Learn" },
  { id: "explore", label: "Explore" },
] as const;

export const VIBE_OPTIONS = [
  { id: "creative", label: "Creative" },
  { id: "ambitious", label: "Ambitious" },
  { id: "curious", label: "Curious" },
  { id: "innovative", label: "Innovative" },
  { id: "social", label: "Social" },
  { id: "goal-oriented", label: "Goal-oriented" },
  { id: "independent", label: "Independent" },
  { id: "expressive", label: "Expressive" },
  { id: "hands-on", label: "Hands-on" },
  { id: "always-learning", label: "Always learning" },
  { id: "trying-new-things", label: "Always trying something new" },
  { id: "low-key", label: "Low-key" },
] as const;

export const WANT_MORE_OPTIONS = [
  { id: "inspiration", label: "Inspiration" },
  { id: "opportunities", label: "Opportunities" },
  { id: "people", label: "People to connect with" },
  { id: "learning", label: "Things to learn" },
  { id: "entertainment", label: "Entertainment" },
  { id: "creative-ideas", label: "Creative ideas" },
  { id: "local-events", label: "Local events" },
  { id: "jobs-projects", label: "Jobs & projects" },
  { id: "products", label: "Products" },
  { id: "services", label: "Services" },
  { id: "conversations", label: "Conversations" },
] as const;

export interface OnboardingPrefs {
  goals: string[];
  vibe: string[];
  wantMore: string[];
  savedAt?: string;
  skipped?: boolean;
}

export const EMPTY_PREFS: OnboardingPrefs = { goals: [], vibe: [], wantMore: [] };

export function parsePrefs(raw: string | null | undefined): OnboardingPrefs {
  try {
    const p = JSON.parse(raw || "{}") as Partial<OnboardingPrefs>;
    return {
      goals: Array.isArray(p.goals) ? p.goals : [],
      vibe: Array.isArray(p.vibe) ? p.vibe : [],
      wantMore: Array.isArray(p.wantMore) ? p.wantMore : [],
      savedAt: typeof p.savedAt === "string" ? p.savedAt : undefined,
      skipped: !!p.skipped,
    };
  } catch {
    return { ...EMPTY_PREFS };
  }
}

/** Keep only known ids/labels — the API never stores free-form input here. */
export const sanitizeIds = (input: unknown, valid: readonly { id: string }[]): string[] =>
  Array.isArray(input) ? valid.map((v) => v.id).filter((id) => input.includes(id)) : [];

export const sanitizeInterests = (input: unknown): string[] =>
  Array.isArray(input) ? INTEREST_OPTIONS.filter((l) => input.includes(l)) : [];
