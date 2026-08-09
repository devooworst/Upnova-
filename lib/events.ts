/* ------------------------------------------------------------------ */
/*  Events — shared vocabulary.                                        */
/*                                                                     */
/*  SCOPE RULE (server-enforced in every events API):                  */
/*    · Campus events (events.campusId set) live ONLY in Your Campus — */
/*      on-campus or directly associated with the school, visible to   */
/*      that campus's verified members.                                */
/*    · The public Events section is the wider world: parties, shows,  */
/*      workshops, markets — with categories, filters, and             */
/*      location-based discovery. Campus events never appear there.    */
/* ------------------------------------------------------------------ */

export const EVENT_CATEGORIES = [
  "Party / Nightlife",
  "Concert",
  "Creative / Art",
  "Networking",
  "Photoshoot",
  "Workshop",
  "Competition",
  "Sports",
  "Gaming",
  "Pop-up / Market",
  "Food & Social",
  "Other",
] as const;

/* campus events get their own campus-flavored set */
export const CAMPUS_EVENT_CATEGORIES = [
  "Campus Social",
  "Student Org",
  "Study / Academic",
  "Sports & Rec",
  "Arts & Performance",
  "Career / Networking",
  "Other",
] as const;

export const EVENT_KINDS = [
  { id: "rsvp", label: "One-click RSVP", desc: "Click Going, done. Best for casual meetups." },
  { id: "registration", label: "Registration", desc: "Attendees register with the info you choose." },
  { id: "ticket", label: "Paid ticket", desc: "Ticket checkout — QR entry." },
  { id: "approval", label: "Request to attend", desc: "The host approves every attendee." },
] as const;

export const kindLabel = (k: string) => EVENT_KINDS.find((x) => x.id === k)?.label ?? k;

export const AGE_RULES = ["all", "16+", "18+", "21+"] as const;

/* location scopes for the public Events section — mirrors the feed's
   distance model; coordinates stay server-side */
export const EVENT_SCOPES = [
  { id: "all", label: "Anywhere" },
  { id: "5mi", label: "Within 5 mi" },
  { id: "25mi", label: "Within 25 mi" },
  { id: "city", label: "My city" },
  { id: "state", label: "My state" },
] as const;

export const WHEN_FILTERS = [
  { id: "all", label: "Any time" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
] as const;
