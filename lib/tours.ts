/* ------------------------------------------------------------------ */
/*  Contextual tutorials — the registry.                               */
/*                                                                     */
/*  Each major area gets a short guided tour that runs ON the page,    */
/*  spotlighting real UI elements (steps with `sel` anchor to a        */
/*  [data-tut="…"] element; steps without render as a centered card    */
/*  so a missing anchor never breaks the walkthrough).                 */
/*                                                                     */
/*  Copy discipline: teach the CONCEPTS — especially the three         */
/*  separate booking dials (horizon = how far ahead · early access =   */
/*  who's first · capacity = how many) and that Preferred Client is    */
/*  a loyalty status, not an access hack.                              */
/* ------------------------------------------------------------------ */

export interface TourStep {
  sel?: string; // [data-tut] anchor on the page; omitted → centered card
  title: string;
  body: string;
}

export interface FeatureTourDef {
  id: string; // storage key — per user, per feature
  title: string;
  steps: TourStep[];
}

/** Longest-prefix match wins; exact paths listed first. */
export const TOURS: { prefix: string; tour: FeatureTourDef }[] = [
  {
    prefix: "/clients",
    tour: {
      id: "clients",
      title: "Clients & Preferred Clients",
      steps: [
        { sel: "clients-all", title: "All Clients", body: "Your private history of everyone who has booked or hired you — completed engagements, spending, and last booking. Only you can see this." },
        { sel: "clients-preferred", title: "Preferred Clients", body: "Clients you intentionally select for loyalty benefits. It's a relationship status — it never grants unlimited bookings or bypasses your availability." },
        { sel: "clients-preferred", title: "Preferred benefits", body: "Each benefit does one thing: Priority booking (first pick of open services) · Preferred pricing (auto-applied, itemized on receipts) · Priority response · Recurring booking priority (repeat appointments) · Complimentary upgrades — all your call, per client." },
        { sel: "clients-early-access", title: "Preferred Early Access", body: "A temporary access mechanism: when you release new availability, Preferred Clients get first access for a window you choose (12–72h or custom). When it ends, remaining appointments open to everyone automatically." },
        { sel: "clients-horizon", title: "Booking horizon", body: "How far into the future customers can book — set per service (7, 14, 30, 60 days or custom). Completely separate from early access: horizon says HOW FAR AHEAD, early access says WHO'S FIRST." },
        { title: "Availability is the hard limit", body: "Capacity (your slots, schedule, and buffers) controls how many people can actually book. Nobody — Preferred Clients included — can ever book beyond it, and cancellations free their slot automatically." },
      ],
    },
  },
  {
    prefix: "/profile/studio/world",
    tour: {
      id: "myworld",
      title: "My World",
      steps: [
        { title: "Your world, your layout", body: "My World is a free design canvas over your real profile. Drag cards, resize them, rotate, layer — the published profile renders exactly what you see here." },
        { title: "Three device layouts", body: "Desktop, tablet, and phone are separate designs. Switch devices in the toolbar to arrange each one — editing one never touches the others." },
        { title: "Images & layers", body: "Add decorative images as free visual layers: behind cards, between them, or in front. Move, resize, rotate, set opacity, lock, and reorder — they never break the layout." },
        { title: "Guides help, never restrict", body: "Rose guides appear when edges, centers, or spacing line up, with live px distances. Hold Alt to bypass snapping entirely." },
      ],
    },
  },
  {
    prefix: "/profile",
    tour: {
      id: "profile",
      title: "Your profile",
      steps: [
        { title: "Your public face", body: "Your profile is what clients, collaborators, and businesses see: bio, roles, skills, services, reviews, and verified work." },
        { title: "Trust is earned, not claimed", body: "Badges and verified work come from real completed transactions on UpNova — nobody can buy them." },
        { title: "Make it yours", body: "Profile Studio (Pro) adds themes, banners, decorations — and My World, a free-layout canvas with per-device designs." },
      ],
    },
  },
  {
    prefix: "/services",
    tour: {
      id: "services",
      title: "Services",
      steps: [
        { title: "Your menu, your rules", body: "Each service carries its own pricing, packages, add-ons, travel policy, and scheduling rules — all enforced server-side when someone books." },
        { sel: "service-horizon", title: "Booking horizon", body: "How far into the future customers can book this service — 7, 14, 30, 60 days or custom. Every provider sets their own; UpNova never assumes one universal schedule." },
        { title: "Availability is the hard limit", body: "Working days, hours, buffers, daily caps, and slot capacity decide how many bookings exist. Preferred Early Access only decides who gets access first — never how many." },
      ],
    },
  },
  {
    prefix: "/calendar",
    tour: {
      id: "bookings",
      title: "Bookings",
      steps: [
        { title: "The calendar is the source of truth", body: "Every booking lives here with its real status: pending → accepted → paid (secured) → completed → released. No double-booking is possible — conflicts are checked server-side." },
        { title: "Money is protected", body: "Payments are secured when the client pays and released when work completes. TEST/DEMO payments are labeled everywhere." },
        { title: "Progress you can see", body: "Providers post progress updates and ETA changes; clients see the same state, always. Cancellations free their slot automatically." },
      ],
    },
  },
  {
    prefix: "/opportunities",
    tour: {
      id: "opportunities",
      title: "Opportunities & applications",
      steps: [
        { title: "Real work, posted openly", body: "Opportunities are gigs, collabs, and roles posted by creators and businesses. Filter by type, budget, and location." },
        { title: "Your profile is your application", body: "Apply once — your UpNova profile carries your work, reviews, and verified history. Track every application's status from here." },
        { title: "Posting your own", body: "Anyone can post an opportunity. Business accounts get hiring tools on top: applicant pipelines, team capacity, and saved talent." },
      ],
    },
  },
  {
    prefix: "/payments",
    tour: {
      id: "payments",
      title: "Payments",
      steps: [
        { title: "Every dollar, accounted", body: "All payments in and out live here — bookings, projects, subscriptions — each tied to its real record with a frozen receipt." },
        { title: "Secured, then released", body: "Client money is secured up front and released on completion. A 5% buyer-side fee is always disclosed before paying. TEST/DEMO payments are labeled." },
      ],
    },
  },
  {
    prefix: "/messages",
    tour: {
      id: "messages",
      title: "Messages",
      steps: [
        { title: "One thread per relationship", body: "Bookings, offers, payments, and progress updates all land in the same conversation with that person — context never scatters." },
        { title: "Real people only", body: "Replies come from real accounts. Nothing here is scripted or auto-generated on your behalf." },
      ],
    },
  },
  {
    prefix: "/notifications",
    tour: {
      id: "notifications",
      title: "Notifications",
      steps: [
        { title: "Signal, not noise", body: "Bookings, payments, applications, progress updates, preferred-client events — each links straight to its record." },
        { title: "You control the channels", body: "Per-category email and SMS preferences live in Settings. In-app is always on so nothing is silently lost." },
      ],
    },
  },
  {
    prefix: "/hiring",
    tour: {
      id: "hiring",
      title: "Hiring (business)",
      steps: [
        { title: "Your hiring dashboard", body: "Post opportunities, review applicants, and track active engagements in one place." },
        { title: "Capacity, honestly", body: "Free and Pro tiers cap ACTIVE work (open roles, active hires) — never your history, and never incoming bookings. Existing records are never deleted." },
      ],
    },
  },
  {
    prefix: "/people",
    tour: {
      id: "people",
      title: "People (business)",
      steps: [
        { title: "Four relationships", body: "Team (your employees) · Clients (who you serve) · Talent (creators you've hired or saved) · Contacts. A creator hired for one project is TALENT, not an employee." },
        { title: "Admin seats", body: "Team members can be marked as admins for capacity purposes — Pro raises the seat count." },
      ],
    },
  },
  {
    prefix: "/analytics",
    tour: {
      id: "analytics",
      title: "Analytics",
      steps: [
        { title: "Your numbers, real ones", body: "Views, bookings, earnings, follower growth — computed from actual records, never estimated." },
      ],
    },
  },
  {
    prefix: "/plans",
    tour: {
      id: "subscriptions",
      title: "Plans & subscriptions",
      steps: [
        { title: "Pro is scale, not access", body: "Earning is never paywalled: booking, applying, and getting hired are free forever. Pro raises capacity and unlocks design tools like My World." },
        { title: "Campus access is verification", body: "Student features come from campus verification — never from a paid plan." },
      ],
    },
  },
];

export function tourForPath(pathname: string): FeatureTourDef | null {
  let best: { prefix: string; tour: FeatureTourDef } | null = null;
  for (const t of TOURS)
    if (pathname === t.prefix || pathname.startsWith(t.prefix + "/") || pathname.startsWith(t.prefix))
      if (!best || t.prefix.length > best.prefix.length) best = t;
  return best?.tour ?? null;
}
