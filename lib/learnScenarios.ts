/* ------------------------------------------------------------------ */
/*  Scenario-based learning — LEVEL 2 of the tutorial system.          */
/*                                                                     */
/*  Level 1 (the New Member Tour + per-page FeatureTours) introduces   */
/*  the platform; THESE guides teach complicated features through      */
/*  realistic situations — named people, real flows, visual step       */
/*  chains — instead of definitions.                                   */
/*                                                                     */
/*  Isomorphic on purpose: the test suite imports this registry        */
/*  server-side and asserts every scenario is complete. Icons are      */
/*  lucide names resolved client-side (design law: icons, no emojis).  */
/* ------------------------------------------------------------------ */

export interface FlowStep {
  icon: string; // lucide icon name (see LearnGuide's icon map)
  label: string;
  note?: string;
}

export interface LearnScenario {
  id: string;
  title: string;
  tagline: string; // one friendly sentence
  what: string; // "What is this?"
  why: string; // "Why would I use it?"
  how: string; // "How does it work?"
  who: string; // "Who uses it?"
  /** the real-world example — a short story with named people */
  story: string;
  /** the visual chain — rendered as a step diagram */
  flow: FlowStep[];
  /** which page's ?-tour relates (deep link for "open that page") */
  href?: string;
}

export const LEARN_SCENARIOS: LearnScenario[] = [
  {
    id: "clients",
    title: "Clients",
    tagline: "Your private customer history.",
    what: "All Clients is everyone who has ever booked or hired you — with completed engagements, total spending, and last booking.",
    why: "You can't take care of regulars you can't see. This is your book of business, private to you.",
    how: "The list builds itself from real bookings and projects. Nothing to maintain — complete work, and the history is there.",
    who: "Every provider: stylists, producers, photographers, tutors, businesses.",
    story: "Tasha is a hairstylist. After six months on Mavyn she opens Clients and sees 32 people, sorted by their last visit — including Aaliyah, who's booked five times. That's her next Preferred Client.",
    flow: [
      { icon: "CalendarCheck", label: "Someone books you" },
      { icon: "CheckCircle2", label: "Work completes" },
      { icon: "BookUser", label: "They appear in All Clients", note: "history, spending, last visit" },
      { icon: "Star", label: "Loyal ones stand out", note: "3 completed in 12 months = eligible" },
    ],
    href: "/clients",
  },
  {
    id: "preferred-clients",
    title: "Preferred Clients",
    tagline: "Recognize your loyal customers — on your terms.",
    what: "A private loyalty status you give to clients you choose, with benefits you pick per person.",
    why: "Regulars keep your business alive. Preferred status lets you treat them like it — without giving anyone unlimited access.",
    how: "Pick a client, choose their benefits (priority booking, preferred pricing, early access, upgrades…). Benefits apply automatically — pricing even appears itemized on their receipt. Status never bypasses your availability.",
    who: "Providers with repeat customers.",
    story: "Aaliyah has booked Tasha five times. Tasha adds her to Preferred Clients with 10% preferred pricing and early access. Aaliyah gets a private notification — and from now on her receipts show the discount automatically.",
    flow: [
      { icon: "Repeat", label: "Aaliyah books again and again" },
      { icon: "UserCheck", label: "Tasha marks her Preferred", note: "benefits chosen per client" },
      { icon: "BadgePercent", label: "Benefits apply automatically", note: "itemized on receipts" },
      { icon: "ShieldCheck", label: "Capacity still rules", note: "loyalty ≠ unlimited bookings" },
    ],
    href: "/clients",
  },
  {
    id: "booking-horizon",
    title: "Booking Horizon",
    tagline: "How far ahead people can book you.",
    what: "A per-service setting: customers can book up to N days into the future (7, 14, 30, 60, or custom).",
    why: "A barber plans a week out; a wedding photographer plans a year. Your calendar, your horizon — Mavyn never assumes one schedule.",
    how: "Set it on the service. Anyone trying to book past it is told exactly when that date becomes bookable. It binds everyone — Preferred Clients included.",
    who: "Every provider who takes appointments.",
    story: "Tasha opens appointments 30 days ahead. Marcus, her barber friend, opens just 7. Both are right — each runs their own book.",
    flow: [
      { icon: "CalendarRange", label: "Tasha sets 30 days" },
      { icon: "CalendarX", label: "Day 31 request → refused", note: "\"bookable from Oct 2\"" },
      { icon: "CalendarClock", label: "The window rolls forward daily" },
    ],
    href: "/services",
  },
  {
    id: "early-access",
    title: "Preferred Early Access",
    tagline: "Your loyal clients book first — for a window you choose.",
    what: "A temporary head start: when you release availability, Preferred Clients can book before the public (12–72h or custom).",
    why: "Reward loyalty with first pick — without overbooking, and without locking the public out of what's left.",
    how: "Choose the service, optional slot cap, the early-access length, and an optional per-client limit. When the window ends, remaining appointments open to everyone automatically. Capacity binds every phase.",
    who: "Providers with Preferred Clients and demand.",
    story: "Tasha releases 10 appointments with 24h early access and a 1-per-client limit. Four Preferred Clients book four slots. At hour 24, the other six open to the public. Nobody overbooked; nobody swept the release.",
    flow: [
      { icon: "Layers", label: "10 slots released" },
      { icon: "Star", label: "Preferred Clients book first", note: "24 hours · 1 per client" },
      { icon: "Users", label: "4 booked → 6 remain" },
      { icon: "Globe", label: "Public opening", note: "the 6 go to everyone" },
      { icon: "ShieldCheck", label: "Full is full — for all" },
    ],
    href: "/clients",
  },
  {
    id: "scheduled-releases",
    title: "Scheduled Releases",
    tagline: "\"September opens August 25 at 9 AM.\"",
    what: "An alternative to the rolling horizon: you open batches of dates at a specific moment.",
    why: "Monthly books, seasonal dates, limited drops — some businesses release availability in batches, not day by day.",
    how: "Pick when the release opens and which dates it covers; optionally give Preferred Clients the first hours. Before the moment, nobody can book those dates — after it, normal rules apply.",
    who: "Stylists with monthly books, photographers with seasonal dates.",
    story: "Tasha switches to scheduled releases: September's book opens August 25 at 9 AM, Preferred Clients first for 24 hours. Until the 25th, September is closed to everyone — including Preferred Clients.",
    flow: [
      { icon: "CalendarPlus", label: "Release scheduled", note: "opens Aug 25, 9 AM" },
      { icon: "Lock", label: "Before: closed to ALL" },
      { icon: "Star", label: "9 AM: Preferred first", note: "24 hours" },
      { icon: "Globe", label: "Aug 26: everyone" },
    ],
    href: "/clients",
  },
  {
    id: "services",
    title: "Services",
    tagline: "Your offer, your menu, your rules.",
    what: "A listing people can book: price, packages, add-ons, travel policy, schedule, and booking rules.",
    why: "It turns \"DM me for prices\" into a real storefront with enforced rules and protected payment.",
    how: "Create the service, set the menu and scheduling. Every rule you set is enforced server-side when someone books — prices can't be tampered with.",
    who: "Anyone offering work: stylists, producers, designers, tutors.",
    story: "Tasha lists \"Silk Press — $85\" with two add-ons and Saturday hours. A stranger can't book Sunday, can't underpay, can't skip the travel fee — the service enforces itself.",
    flow: [
      { icon: "Store", label: "List the service" },
      { icon: "SlidersHorizontal", label: "Menu + rules", note: "packages, hours, travel" },
      { icon: "CalendarCheck", label: "Bookings follow YOUR rules" },
      { icon: "Wallet", label: "Payment protected" },
    ],
    href: "/services",
  },
  {
    id: "bookings",
    title: "Bookings",
    tagline: "From request to done — one clean lifecycle.",
    what: "The appointment record: request → accept → pay (secured) → complete → released payment.",
    why: "Both sides always know exactly where things stand — and money moves only when it should.",
    how: "A client requests a time that fits your rules. You accept; they pay; funds are secured. When the work completes, payment is released to you.",
    who: "Everyone — clients on one side, providers on the other.",
    story: "Jordan books Tasha for Friday 2 PM. She accepts; he pays $85 — secured, not yet hers. Friday evening she marks it complete, and the payment releases.",
    flow: [
      { icon: "CalendarPlus", label: "Request", note: "fits schedule + horizon" },
      { icon: "ThumbsUp", label: "Provider accepts" },
      { icon: "Lock", label: "Payment secured" },
      { icon: "CheckCircle2", label: "Completed" },
      { icon: "Banknote", label: "Payment released" },
    ],
    href: "/calendar",
  },
  {
    id: "cancellations",
    title: "Cancellations",
    tagline: "Plans change — slots come back.",
    what: "Ending a booking before it happens, under the provider's stated policy.",
    why: "Life happens. What matters is that the calendar heals: a cancelled slot is instantly bookable again.",
    how: "Cancel from the booking. The provider's cancellation policy (shown before booking) applies; the time slot and any capacity it held are freed automatically.",
    who: "Both sides, occasionally.",
    story: "Jordan cancels Tuesday's appointment. The 2 PM slot reopens immediately — and Aaliyah, watching for an opening, takes it an hour later.",
    flow: [
      { icon: "CalendarX", label: "Booking cancelled" },
      { icon: "RefreshCw", label: "Slot + capacity freed", note: "instantly" },
      { icon: "CalendarCheck", label: "Someone else books it" },
    ],
    href: "/calendar",
  },
  {
    id: "payments",
    title: "Payments",
    tagline: "Secured first. Released when it's done.",
    what: "Every payment on Mavyn, tied to its real booking or project, with a frozen receipt.",
    why: "Clients don't pay strangers and hope; providers don't work and chase invoices.",
    how: "The client pays up front — funds are secured. Completion releases them to the provider. A 5% buyer-side fee is always shown before paying. (In this environment, payments are clearly labeled TEST/DEMO.)",
    who: "Everyone who books, hires, or gets hired.",
    story: "Jordan pays $89.25 ($85 + 5% fee, shown up front). Tasha sees \"secured.\" After Friday's appointment: \"released.\" Both keep the same receipt forever.",
    flow: [
      { icon: "CreditCard", label: "Client pays", note: "fee disclosed first" },
      { icon: "Lock", label: "Funds secured" },
      { icon: "CheckCircle2", label: "Work completes" },
      { icon: "Banknote", label: "Funds released" },
      { icon: "Receipt", label: "Frozen receipt for both" },
    ],
    href: "/payments",
  },
  {
    id: "opportunities",
    title: "Opportunities",
    tagline: "Real work, posted openly.",
    what: "Gigs, roles, collaborations, and events posted by creators and businesses.",
    why: "Work should find you — and when you post, applicants come with real profiles and history.",
    how: "Browse and filter; apply with your profile. Posters review applicants, select, and the engagement flows into projects and payments.",
    who: "Creators seeking work; anyone hiring.",
    story: "Harbor Oak Studio posts \"Wedding photographer — Oct 12, $600.\" Imani applies with her profile; her verified work speaks. She's selected by Thursday.",
    flow: [
      { icon: "Megaphone", label: "Opportunity posted" },
      { icon: "FileText", label: "Applications arrive", note: "profiles, not resumes" },
      { icon: "UserCheck", label: "Someone is selected" },
      { icon: "Briefcase", label: "Work + payment on-platform" },
    ],
    href: "/opportunities",
  },
  {
    id: "applications",
    title: "Applications",
    tagline: "Apply once — your profile does the talking.",
    what: "Your submission to an opportunity, tracked through every status.",
    why: "No re-typing your history into forms. And no silence: you see selected, confirmed, or closed — honestly.",
    how: "Apply from the opportunity. Watch the status; if you're selected, the conversation and project start right there.",
    who: "Anyone pursuing opportunities.",
    story: "Imani applies to three shoots in one afternoon. One says \"selected\" the next morning — the other two close with an honest notification, not a void.",
    flow: [
      { icon: "Send", label: "Apply", note: "profile attached" },
      { icon: "Clock", label: "Status visible", note: "never a black hole" },
      { icon: "UserCheck", label: "Selected → it begins" },
    ],
    href: "/opportunities",
  },
  {
    id: "messaging",
    title: "Messaging",
    tagline: "One thread per relationship — with everything in it.",
    what: "Direct conversations that carry your bookings, offers, payments, and progress updates inline.",
    why: "Context never scatters: the negotiation, the booking, and the receipt live in the same thread.",
    how: "Message anyone. When a booking or project starts between you, its updates post into that same conversation automatically.",
    who: "Everyone.",
    story: "Jordan messages Tasha about Friday. The booking card, his payment, and her \"all done!\" all land in that one thread — a month later, the whole story is still there.",
    flow: [
      { icon: "MessageCircle", label: "Conversation starts" },
      { icon: "CalendarCheck", label: "Booking joins the thread" },
      { icon: "Wallet", label: "Payment updates inline" },
      { icon: "History", label: "The whole story, one place" },
    ],
    href: "/messages",
  },
  {
    id: "hiring",
    title: "Hiring",
    tagline: "For businesses: from post to hire, one pipeline.",
    what: "The business dashboard for posting opportunities, reviewing applicants, and tracking engagements.",
    why: "Hiring creators shouldn't live in spreadsheets and DMs.",
    how: "Post roles, watch applicants arrive, select, and manage the engagement — team capacity and saved talent included.",
    who: "Business accounts.",
    story: "Harbor Oak needs three photographers for wedding season. One post, eleven applicants, three selected — the whole pipeline visible on one page.",
    flow: [
      { icon: "Megaphone", label: "Post the role" },
      { icon: "Users", label: "Applicants arrive" },
      { icon: "UserCheck", label: "Select + engage" },
      { icon: "LineChart", label: "Track it all", note: "one dashboard" },
    ],
    href: "/hiring",
  },
  {
    id: "team",
    title: "Employees & Team",
    tagline: "Team is who works FOR you — talent is who works WITH you.",
    what: "Your organization's people: employees and admin seats — separate from hired creators.",
    why: "A photographer you hired once isn't an employee. Mavyn keeps the difference honest.",
    how: "Add team members under People → Team; mark admins. Creators you engage appear under Talent — hire them again in one click.",
    who: "Business accounts.",
    story: "Harbor Oak adds its two full-time coordinators as Team. Imani — hired for one wedding — shows under Talent, not Employees. Exactly right.",
    flow: [
      { icon: "Building2", label: "Your business" },
      { icon: "Users", label: "Team = employees", note: "+ admin seats" },
      { icon: "Handshake", label: "Talent = hired creators", note: "one hire ≠ employee" },
    ],
    href: "/people",
  },
  {
    id: "business",
    title: "Business Accounts",
    tagline: "The same Mavyn, organized for an organization.",
    what: "An account type with hiring tools, people management, team capacity, and business payments.",
    why: "Businesses juggle many relationships at once — the sidebar reorganizes around that.",
    how: "Sign up as (or convert to) a business. You get Hiring, People, and Payments views; Free covers the essentials, Business Pro raises capacity.",
    who: "Studios, venues, brands, agencies.",
    story: "Harbor Oak Studio runs bookings, three open roles, and six hired creators — from one account, with one payment trail.",
    flow: [
      { icon: "Building2", label: "Business account" },
      { icon: "Megaphone", label: "Hiring tools" },
      { icon: "Users", label: "People: team · clients · talent" },
      { icon: "Wallet", label: "One payment trail" },
    ],
    href: "/hiring",
  },
  {
    id: "myworld",
    title: "My World",
    tagline: "Your page, arranged like YOU.",
    what: "A free design canvas over your profile: drag cards, resize, rotate, layer images — per device.",
    why: "Your page should feel like you, not a template. And what you design is exactly what visitors see.",
    how: "Open the editor (Pro), arrange desktop, tablet, and phone independently, add image layers, save. The published profile uses the very same layout engine.",
    who: "Pro members who want a signature page.",
    story: "Imani puts her hero card beside her portfolio, floats a film-grain texture behind everything, and stacks it all cleanly for phones. Visitors see precisely what she built.",
    flow: [
      { icon: "LayoutTemplate", label: "Open the canvas" },
      { icon: "Move", label: "Arrange freely", note: "guides help, never force" },
      { icon: "Smartphone", label: "Per-device designs" },
      { icon: "Eye", label: "Visitors see exactly that" },
    ],
    href: "/profile/studio/world",
  },
  {
    id: "profile",
    title: "Profile Customization",
    tagline: "Make the first impression yours.",
    what: "Your identity: bio, roles, skills, portfolio, services, reviews — plus Studio themes and banners.",
    why: "People decide in seconds. A complete profile books more and gets selected more.",
    how: "Fill the essentials free; Profile Studio adds themes, frames, and decorations; My World (Pro) unlocks full layout freedom.",
    who: "Everyone — it's the front door.",
    story: "Jordan completes his profile the day he joins. Two weeks later a producer finds him through search — the portfolio did the talking.",
    flow: [
      { icon: "UserCircle2", label: "The essentials", note: "bio, roles, skills" },
      { icon: "Images", label: "Show the work" },
      { icon: "Paintbrush", label: "Studio style", note: "themes, banners" },
      { icon: "Sparkles", label: "My World", note: "full canvas (Pro)" },
    ],
    href: "/profile",
  },
  {
    id: "subscriptions",
    title: "Subscriptions",
    tagline: "Pro is scale and style — never a paywall on earning.",
    what: "Free, College+, and Pro plans (business: Free and Business Pro).",
    why: "Booking, applying, messaging, and getting paid are free forever. Pro raises capacity and unlocks design tools.",
    how: "Upgrade in Plans; the plan lives on your account. Campus access always comes from student verification, never from paying.",
    who: "Members who outgrow the free limits or want the design tools.",
    story: "Tasha earns on the free plan for months. She upgrades to Pro for My World and higher capacity — her income never depended on it.",
    flow: [
      { icon: "Gift", label: "Free: earn fully" },
      { icon: "GraduationCap", label: "College+: student style", note: "access = verification" },
      { icon: "Rocket", label: "Pro: scale + canvas" },
    ],
    href: "/plans",
  },
  {
    id: "notifications",
    title: "Notifications",
    tagline: "Everything important — nothing else.",
    what: "Alerts for messages, bookings, payments, applications, progress, and preferred-client events.",
    why: "You shouldn't refresh five pages to know if something happened.",
    how: "Each notification links to its record. Email/SMS per category is yours to set in Settings; in-app is always on.",
    who: "Everyone.",
    story: "Tasha wakes to three: a booking request, a released payment, and Aaliyah's early-access booking. Three taps, fully caught up.",
    flow: [
      { icon: "Bell", label: "Something real happens" },
      { icon: "Link2", label: "Alert links to the record" },
      { icon: "Settings2", label: "Channels are your choice" },
    ],
    href: "/notifications",
  },
  {
    id: "progress",
    title: "Project Progress",
    tagline: "Clients never have to ask \"how's it going?\"",
    what: "Status updates on active work: percent done, notes, ETAs — visible to both sides.",
    why: "Silence kills trust. A 30-second update keeps the client calm and the record honest.",
    how: "The provider posts updates on the project or booking; the client sees the identical state and is notified of ETA changes — always.",
    who: "Providers with multi-day work.",
    story: "Kofi is mixing Jordan's EP. \"25% — drums done, ETA 3 days\" … \"70% — vocals in.\" Jordan never wonders; the timeline shows every step.",
    flow: [
      { icon: "Hammer", label: "Work in progress" },
      { icon: "TrendingUp", label: "Updates posted", note: "25% → 70% → done" },
      { icon: "Eye", label: "Client sees the same state" },
      { icon: "BellRing", label: "ETA changes notify", note: "never silent" },
    ],
    href: "/projects",
  },
  {
    id: "extensions",
    title: "Extensions & Deadlines",
    tagline: "Ask for more time — honestly, on the record.",
    what: "A formal request to move a deadline, which the client approves or declines.",
    why: "Deadlines slip. What ruins relationships is the silence, not the slip.",
    how: "Request an extension with the new date and reason. The client decides; either way it's recorded and both sides are notified.",
    who: "Providers on deadline work.",
    story: "Kofi's mix needs two more days — a sample-clearance issue. He requests +2; Jordan approves in a tap. The project shows exactly what changed and why.",
    flow: [
      { icon: "CalendarClock", label: "Deadline approaching" },
      { icon: "FileQuestion", label: "Extension requested", note: "+2 days, with reason" },
      { icon: "ThumbsUp", label: "Client decides" },
      { icon: "History", label: "On the record, both notified" },
    ],
    href: "/projects",
  },
  {
    id: "reviews",
    title: "Reviews",
    tagline: "Reputation earned from real work only.",
    what: "Ratings and reviews attached to completed bookings and projects.",
    why: "A review that anyone can leave means nothing. Ours require a completed transaction.",
    how: "After completion, the client reviews. It appears on your profile and feeds your rating — it can't be bought or faked.",
    who: "Everyone: clients write them, providers earn them.",
    story: "After Friday's silk press, Jordan leaves Tasha five stars. It sits on her profile next to 40 others — every one from a real appointment.",
    flow: [
      { icon: "CheckCircle2", label: "Real work completes" },
      { icon: "Star", label: "Client reviews", note: "transaction required" },
      { icon: "TrendingUp", label: "Reputation compounds" },
    ],
    href: "/profile",
  },
  {
    id: "loyalty",
    title: "Loyalty & Repeat Customers",
    tagline: "The whole loop: great work → regulars → rewards → more great work.",
    what: "How Mavyn's pieces combine into a loyalty engine: history → eligibility → Preferred status → benefits → early access.",
    why: "Repeat customers are the business. The platform notices them so you can keep them.",
    how: "Completed work builds client history; 3 completions in 12 months flags eligibility; you add them as Preferred with benefits; releases give them first access — while capacity keeps everything fair.",
    who: "Providers building a base; clients who show up.",
    story: "Aaliyah's fifth booking flags her eligible. Tasha adds her as Preferred with pricing + early access. Next month's release: Aaliyah books first, pays her preferred price, and Tasha's book still opens to the public with slots left. Everyone won.",
    flow: [
      { icon: "Repeat", label: "Repeat bookings" },
      { icon: "BadgeCheck", label: "Eligible", note: "3 in 12 months" },
      { icon: "UserCheck", label: "Preferred status", note: "chosen benefits" },
      { icon: "Star", label: "Early access + pricing" },
      { icon: "ShieldCheck", label: "Capacity keeps it fair" },
    ],
    href: "/clients",
  },
];

/* ---- interactive learning paths: "How would you like to learn?" ---- */
export interface LearnPath {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  scenarioIds: string[]; // the lifecycle, in teaching order
}

export const LEARN_PATHS: LearnPath[] = [
  {
    id: "client",
    label: "I'm here to book & find people",
    icon: "UserSearch",
    blurb: "Find providers, book services, pay safely, become a valued regular.",
    scenarioIds: ["services", "bookings", "payments", "messaging", "cancellations", "reviews", "loyalty", "notifications"],
  },
  {
    id: "provider",
    label: "I provide services",
    icon: "Scissors",
    blurb: "List your service, take bookings, get paid, build a loyal client base.",
    scenarioIds: ["services", "bookings", "payments", "clients", "preferred-clients", "booking-horizon", "early-access", "scheduled-releases", "progress", "reviews"],
  },
  {
    id: "business",
    label: "I'm a business",
    icon: "Building2",
    blurb: "Hire talent, manage your team and clients, run payments in one place.",
    scenarioIds: ["business", "hiring", "opportunities", "applications", "team", "clients", "payments", "notifications"],
  },
  {
    id: "creator",
    label: "I'm a creator",
    icon: "Palette",
    blurb: "Build your presence, find opportunities, deliver work, grow your name.",
    scenarioIds: ["profile", "myworld", "opportunities", "applications", "progress", "extensions", "payments", "reviews", "subscriptions"],
  },
];

export function scenarioById(id: string): LearnScenario | null {
  return LEARN_SCENARIOS.find((s) => s.id === id) ?? null;
}

/** FeatureTour pages → the deeper scenario their "Learn more" opens. */
export const TOUR_TO_SCENARIO: Record<string, string> = {
  clients: "preferred-clients",
  services: "services",
  bookings: "bookings",
  payments: "payments",
  messages: "messaging",
  notifications: "notifications",
  opportunities: "opportunities",
  hiring: "hiring",
  people: "team",
  myworld: "myworld",
  profile: "profile",
  subscriptions: "subscriptions",
  analytics: "reviews",
};
