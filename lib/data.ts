/* ------------------------------------------------------------------ */
/*  Mavyn — typed mock data                                           */
/*  Every entity mirrors the future database model: User, Service,     */
/*  Post, Opportunity, Community, Event, Application, Review…          */
/* ------------------------------------------------------------------ */

export type Reach =
  | "Nearby"
  | "Local"
  | "City"
  | "Regional"
  | "National"
  | "Global"
  | "Remote";

export interface ReachInfo {
  location: string;
  reach: Reach;
  radius?: string; // e.g. "10 mi"
}

export interface Creator {
  id: string;
  name: string;
  handle: string;
  role: string;
  emoji: string;
  avatar: string | null; // image path or null → initials tile
  initials: string;
  gradient: string; // tailwind gradient classes for initials tiles
  verified: boolean;
  location: string;
  rating: number;
  reviews: number;
  skills: string[];
  startingAt?: number;
  availability: "Available Now" | "Available This Week" | "Open to Work" | "Accepting Clients";
  reach: ReachInfo;
  bio?: string;
  /** miles from the current user — powers the radius/ring UI */
  distanceMi?: number;
  /** live activity line for the "Live near you" strip */
  activity?: string;
  online?: boolean;
  /** follower count baseline (includes your follow if you already follow them) */
  followers: number;
  /** public reliability summary — details stay private to the owner */
  onTimeRate?: number;
  trustLevel?: TrustLevel;
}

/* ------------------------------ current user ------------------------------ */

export const currentUser: Creator = {
  id: "devin",
    followers: 1200,
  name: "Devin Carter",
  handle: "devin",
  role: "Music Producer • Content Creator • Entrepreneur",
  emoji: "🎧",
  avatar: "/images/devin.jpg",
  initials: "D",
  gradient: "from-lime-400 to-emerald-600",
  verified: true,
  location: "Baltimore, MD",
  rating: 4.9,
  reviews: 63,
  skills: [
    "Music Producer",
    "Audio Engineer",
    "Songwriter",
    "Video Editing",
    "Content Creator",
    "Brand Collaborations",
  ],
  availability: "Open to Work",
  reach: { location: "Baltimore, MD", reach: "Regional", radius: "50 mi" },
  bio: "Building opportunities for creators through music, content, and collaboration. I help artists and brands connect and make things people remember.",
};

/* -------------------------------- creators -------------------------------- */

export const creators: Creator[] = [
  {
    id: "jordan",
    trustLevel: "standard",
    onTimeRate: 96,
    followers: 12400,
    name: "Jordan Miles",
    handle: "jordanmiles",
    role: "Music Producer",
    emoji: "🎵",
    avatar: "/images/jordan.jpg",
    initials: "J",
    gradient: "from-violet-500 to-fuchsia-600",
    verified: true,
    location: "Atlanta, GA",
    rating: 4.9,
    reviews: 118,
    skills: ["Music Production", "Mixing", "Songwriting"],
    startingAt: 300,
    availability: "Open to Work",
    reach: { location: "United States", reach: "Remote" },
    distanceMi: 612,
    activity: "Dropped a beat preview 2h ago",
  },
  {
    id: "ava",
    trustLevel: "identity",
    onTimeRate: 100,
    followers: 3260,
    name: "Ava Chen",
    handle: "ava",
    role: "Photographer",
    emoji: "📸",
    avatar: "/images/ava.jpg",
    initials: "A",
    gradient: "from-sky-500 to-indigo-600",
    verified: true,
    location: "Baltimore, MD",
    rating: 4.8,
    reviews: 86,
    skills: ["Portrait Photography", "Event Coverage", "Retouching"],
    startingAt: 250,
    availability: "Available Now",
    reach: { location: "Baltimore, MD", reach: "Nearby", radius: "5 mi" },
    distanceMi: 2.4,
    activity: "Booking shoots this week",
    online: true,
  },
  {
    id: "marcus",
    trustLevel: "identity",
    onTimeRate: 92,
    followers: 1840,
    name: "Marcus Johnson",
    handle: "marcusj",
    role: "Videographer",
    emoji: "🎥",
    avatar: "/images/marcus.jpg",
    initials: "M",
    gradient: "from-amber-500 to-orange-600",
    verified: false,
    location: "Washington, DC",
    rating: 4.7,
    reviews: 54,
    skills: ["Video Editing", "Music Videos", "Color Grading"],
    startingAt: 200,
    availability: "Available This Week",
    reach: { location: "Maryland", reach: "Local", radius: "25 mi" },
    distanceMi: 18,
    activity: "Grading a client film",
  },
  {
    id: "nia",
    trustLevel: "high-trust",
    followers: 2610,
    name: "Nia Brooks",
    handle: "nia",
    role: "Fashion & Beauty Creator",
    emoji: "💄",
    avatar: "/images/nia.jpg",
    initials: "N",
    gradient: "from-rose-500 to-pink-600",
    verified: true,
    location: "Washington, DC",
    rating: 4.9,
    reviews: 143,
    skills: ["Nail Art", "Styling", "UGC Content"],
    startingAt: 90,
    availability: "Accepting Clients",
    reach: { location: "Baltimore, MD", reach: "Nearby", radius: "10 mi" },
    distanceMi: 4.8,
    activity: "Open to collabs",
    online: true,
  },
  {
    id: "tre",
    followers: 940,
    name: "Trell Watson",
    handle: "trellbeats",
    role: "Beat Maker",
    emoji: "🎹",
    avatar: null,
    initials: "T",
    gradient: "from-emerald-500 to-teal-600",
    verified: false,
    location: "Philadelphia, PA",
    rating: 4.6,
    reviews: 31,
    skills: ["Trap Beats", "Lo-Fi", "Sound Design"],
    startingAt: 150,
    availability: "Open to Work",
    reach: { location: "Global", reach: "Global" },
    distanceMi: 102,
    activity: "Selling new loop kits",
  },
  {
    id: "lena",
    onTimeRate: 97,
    followers: 4120,
    name: "Lena Ortiz",
    handle: "lena",
    role: "Graphic Designer",
    emoji: "🎨",
    avatar: null,
    initials: "L",
    gradient: "from-cyan-500 to-blue-600",
    verified: true,
    location: "Remote",
    rating: 5.0,
    reviews: 77,
    skills: ["Brand Identity", "Cover Art", "Motion Graphics"],
    startingAt: 180,
    availability: "Available This Week",
    reach: { location: "United States", reach: "Remote" },
    activity: "2 slots open for cover art",
    online: true,
  },
];

/* ------------------------------ opportunities ------------------------------ */

export interface Opportunity {
  id: string;
  title: string;
  poster: string;
  posterAvatar?: string;
  posterInitials: string;
  posterGradient: string;
  verifiedPoster: boolean;
  category:
    | "Brand Collaboration"
    | "Gig"
    | "Collaboration"
    | "Freelance"
    | "Event Staff"
    | "Full-time";
  description: string;
  budget: string;
  deadline: string;
  roles: string;
  applicants: number;
  featured?: boolean;
  paid: boolean;
  tags: string[];
  reach: ReachInfo;
  distanceMi?: number;
  /** fits around student life: weekend/evening/flexible/no-experience */
  studentFriendly?: boolean;
  /** when the work actually happens — availability questions reference this */
  projectDates?: string;
  /** auto-categorized: applicants must meet this verification level */
  trustLevel?: TrustLevel;
}

export const opportunities: Opportunity[] = [
  {
    id: "nike-fall",
    projectDates: "Sep 5–7 (two-day shoot)",
    title: "Nike Fall Campaign",
    poster: "Nike",
    posterInitials: "N",
    posterGradient: "from-zinc-800 to-zinc-950",
    verifiedPoster: true,
    category: "Brand Collaboration",
    description:
      "Looking for 2 models and 1 videographer for our Fall campaign. Shoot spans two days in Atlanta with full creative direction provided.",
    budget: "$2,400",
    deadline: "Aug 18",
    roles: "Models • Videographer",
    applicants: 23,
    featured: true,
    paid: true,
    tags: ["Brand Deals", "Paid"],
    reach: { location: "Atlanta, GA", reach: "Local", radius: "25 mi" },
    distanceMi: 612,
  },
  {
    id: "photo-gig",
    projectDates: "Aug 24 (half-day)",
    studentFriendly: true,
    title: "Product Shoot Photography",
    poster: "Harbor & Oak",
    posterInitials: "H",
    posterGradient: "from-teal-600 to-emerald-700",
    verifiedPoster: false,
    category: "Gig",
    description:
      "Local lifestyle brand needs 20 product shots for our fall lookbook. Studio provided, half-day shoot.",
    budget: "$600",
    deadline: "Aug 24",
    roles: "Photographer",
    applicants: 9,
    paid: true,
    tags: ["Paid", "Freelance"],
    reach: { location: "Baltimore, MD", reach: "Nearby", radius: "5 mi" },
    distanceMi: 2.1,
  },
  {
    id: "dog-sitter",
    trustLevel: "high-trust",
    projectDates: "Sat Aug 23 – Sun Aug 24",
    title: "Weekend Dog Sitter Needed",
    poster: "Harbor & Oak",
    posterInitials: "H",
    posterGradient: "from-teal-600 to-emerald-700",
    verifiedPoster: false,
    category: "Gig",
    description:
      "Our shop dog Biscuit needs a sitter for one weekend — feeding, two walks a day, and company. Keys handed over Friday.",
    budget: "$120",
    deadline: "Aug 21",
    roles: "Pet Sitter",
    applicants: 4,
    paid: true,
    tags: ["Paid", "Weekend"],
    reach: { location: "Baltimore, MD", reach: "Nearby", radius: "5 mi" },
    distanceMi: 2.1,
    studentFriendly: true,
  },
  {
    id: "campus-web",
    projectDates: "flexible — 2-3 weeks",
    title: "Student Web Designer Needed",
    poster: "Student Government Association",
    posterInitials: "S",
    posterGradient: "from-violet-500 to-purple-800",
    verifiedPoster: true,
    category: "Freelance",
    description:
      "SGA needs a redesign of our organization site — new layout, mobile-friendly, easy for next year's board to update.",
    budget: "$300",
    deadline: "Aug 25",
    roles: "Web Designer",
    applicants: 8,
    paid: true,
    tags: ["Paid", "Campus"],
    reach: { location: "Bowie, MD", reach: "Nearby", radius: "5 mi" },
    distanceMi: 3.4,
    studentFriendly: true,
  },
  {
    id: "campus-mv-collab",
    projectDates: "one evening, week of Aug 25",
    title: "Music Video Collaboration",
    poster: "K. Boateng",
    posterInitials: "K",
    posterGradient: "from-emerald-500 to-teal-600",
    verifiedPoster: false,
    category: "Collaboration",
    description:
      "Student artist shooting a visual for my new single. Unpaid collab — you keep the footage for your reel and get full credit.",
    budget: "Collab",
    deadline: "Aug 24",
    roles: "Videographer • Model",
    applicants: 6,
    paid: false,
    tags: ["Collaborations", "Campus"],
    reach: { location: "Bowie, MD", reach: "Nearby", radius: "5 mi" },
    distanceMi: 3.4,
    studentFriendly: true,
  },
  {
    id: "org-promo",
    projectDates: "one afternoon, week of Sep 1",
    title: "Org Promo Videographer",
    poster: "BSU Photography Club",
    posterInitials: "P",
    posterGradient: "from-sky-500 to-blue-700",
    verifiedPoster: true,
    category: "Collaboration",
    description:
      "We're shooting promotional content for the club — one afternoon, campus locations. Small budget from SGA funding, big portfolio piece.",
    budget: "$150",
    deadline: "Sep 05",
    roles: "Videographer",
    applicants: 5,
    paid: true,
    tags: ["Paid", "Campus"],
    reach: { location: "Bowie, MD", reach: "Nearby", radius: "5 mi" },
    distanceMi: 3.4,
    studentFriendly: true,
  },
  {
    id: "social-video",
    projectDates: "weekend of Aug 22–23",
    title: "Social Media Videographer",
    poster: "Charm City Threads",
    posterInitials: "C",
    posterGradient: "from-rose-600 to-pink-800",
    verifiedPoster: false,
    category: "Gig",
    description:
      "Local clothing brand needs 3 short-form videos for our fall drop. One weekend shoot, we provide the fits and the location.",
    budget: "$250",
    deadline: "Aug 23",
    roles: "Videographer",
    applicants: 11,
    paid: true,
    tags: ["Paid", "Weekend"],
    reach: { location: "Baltimore, MD", reach: "Local", radius: "25 mi" },
    distanceMi: 4.2,
    studentFriendly: true,
  },
  {
    id: "crew-call",
    projectDates: "Aug 18 (full day)",
    studentFriendly: true,
    title: "Short Film Crew Call",
    poster: "Marcus Reed",
    posterAvatar: "/images/marcus.jpg",
    posterInitials: "M",
    posterGradient: "from-amber-500 to-orange-600",
    verifiedPoster: true,
    category: "Gig",
    description:
      "Camera operator needed for a one-day short film shoot in Baltimore on August 18. Meals covered, credit + footage for your reel.",
    budget: "$400",
    deadline: "Aug 16",
    roles: "Camera Operator",
    applicants: 6,
    paid: true,
    tags: ["Paid", "Film"],
    reach: { location: "Baltimore, MD", reach: "Local", radius: "25 mi" },
    distanceMi: 6.5,
  },
  {
    id: "music-video",
    projectDates: "flexible — editing is remote",
    title: "Music Video Shoot",
    poster: "Jordan Miles",
    posterAvatar: "/images/jordan.jpg",
    posterInitials: "J",
    posterGradient: "from-violet-500 to-fuchsia-600",
    verifiedPoster: true,
    category: "Collaboration",
    description:
      "Shooting a visual for the new single. Need a videographer and an editor — remote editing totally fine.",
    budget: "$1,200",
    deadline: "Sep 02",
    roles: "Videographer • Editor",
    applicants: 14,
    paid: true,
    tags: ["Paid", "Collaborations", "Remote"],
    reach: { location: "Atlanta, GA", reach: "Remote" },
    distanceMi: 612,
  },
  {
    id: "brand-collab",
    title: "Brand Collaboration — Streetwear Drop",
    poster: "Vaulted Co.",
    posterInitials: "V",
    posterGradient: "from-amber-500 to-orange-600",
    verifiedPoster: true,
    category: "Brand Collaboration",
    description:
      "Seeking 3 content creators to style and post our new capsule. Deliverables: 2 reels + 3 stories each.",
    budget: "$3,000",
    deadline: "Aug 30",
    roles: "Content Creators",
    applicants: 41,
    paid: true,
    tags: ["Brand Deals", "Paid", "Remote"],
    reach: { location: "United States", reach: "Remote" },
  },
  {
    id: "vocalist",
    title: "Looking for Vocalist",
    poster: "Devin Carter",
    posterAvatar: "/images/devin.jpg",
    posterInitials: "D",
    posterGradient: "from-lime-400 to-emerald-600",
    verifiedPoster: true,
    category: "Collaboration",
    description:
      "Got a melodic R&B/trap record that needs a hook. Royalty split + credit. Remote submissions welcome.",
    budget: "Royalty Split",
    deadline: "Sep 10",
    roles: "Vocalist",
    applicants: 6,
    paid: false,
    tags: ["Collaborations"],
    reach: { location: "Global", reach: "Global" },
  },
  {
    id: "event-staff",
    studentFriendly: true,
    title: "Creator Meetup — Photo & Video Team",
    poster: "Mavyn Events",
    posterInitials: "U",
    posterGradient: "from-lime-500 to-emerald-600",
    verifiedPoster: true,
    category: "Event Staff",
    description:
      "Cover the Mavyn Creator Meetup in Baltimore. 3 hours, recap reel due within 48 hours.",
    budget: "$350",
    deadline: "Aug 20",
    roles: "Photographer • Videographer",
    applicants: 12,
    paid: true,
    tags: ["Events", "Paid"],
    reach: { location: "Baltimore, MD", reach: "City" },
    distanceMi: 3.1,
  },
];

/* ---------------------------------- events --------------------------------- */

export type EventCategory =
  | "Party / Nightlife" | "Concert" | "Creative / Art" | "Networking"
  | "Photoshoot" | "Workshop" | "Competition" | "Sports" | "Gaming"
  | "Pop-up / Market" | "Other";

export type AgeRestriction = "all" | "16+" | "18+" | "21+";

/** The organizer picks the model; the UI adapts. */
export type RegistrationModel = "rsvp" | "registration" | "ticket" | "approval";

export interface TicketType {
  id: string;
  name: string;
  price: number;
}

export interface UpEvent {
  id: string;
  title: string;
  location: string;
  date: string;
  time: string;
  endTime?: string;
  attending: number;
  price: string;
  image?: string;
  gradient: string;
  emoji: string;
  description: string;
  reach: ReachInfo;
  host: string;
  /** true when the current user organizes this event → dashboard access */
  organizedByYou?: boolean;
  category: EventCategory;
  age: AgeRestriction;
  registration: RegistrationModel;
  capacity: number;
  waitlist: boolean;
  /** fields the organizer requires at registration */
  requiredFields: string[];
  rules: string[];
  ticketTypes?: TicketType[];
  schedule?: { time: string; item: string }[];
}

export const events: UpEvent[] = [
  {
    id: "meetup",
    title: "Mavyn Creator Meetup",
    location: "Baltimore, MD",
    date: "Saturday, August 22",
    time: "7:00 PM",
    endTime: "10:00 PM",
    attending: 84,
    price: "Free",
    gradient: "from-lime-500/70 to-emerald-800",
    emoji: "🤝",
    image: "/images/event-meetup.jpg",
    description: "Connect with creators in the DMV. Lightning talks, open networking, and free pizza.",
    reach: { location: "Baltimore, MD", reach: "City" },
    host: "Mavyn Events",
    category: "Networking",
    age: "all",
    registration: "rsvp",
    capacity: 100,
    waitlist: true,
    requiredFields: ["Full name"],
    rules: ["No harassment", "Photography permitted", "Check-in required"],
    schedule: [
      { time: "7:00 PM", item: "Doors + open networking" },
      { time: "7:45 PM", item: "Lightning talks (5 creators, 5 min each)" },
      { time: "8:30 PM", item: "Collab matchmaking" },
      { time: "9:30 PM", item: "Wind down + pizza" },
    ],
  },
  {
    id: "networking",
    title: "DMV Music Networking Night",
    location: "Washington, DC",
    date: "Friday, August 28",
    time: "8:00 PM",
    endTime: "11:30 PM",
    attending: 129,
    price: "$15",
    gradient: "from-violet-600/70 to-fuchsia-900",
    emoji: "🎤",
    image: "/images/event-networking.jpg",
    description: "Artists, producers, and A&Rs in one room. Bring your cards and your best 30 seconds.",
    reach: { location: "DMV", reach: "Local", radius: "25 mi" },
    host: "DMV Creators",
    category: "Networking",
    age: "18+",
    registration: "ticket",
    capacity: 150,
    waitlist: true,
    requiredFields: ["Full name", "Email", "Date of birth"],
    rules: ["18+ only — ID may be checked at entry", "No harassment", "Industry conduct expected"],
    ticketTypes: [
      { id: "ga", name: "General Admission", price: 15 },
      { id: "early", name: "Early Bird", price: 10 },
    ],
  },
  {
    id: "photo-walk",
    title: "Golden Hour Photo Walk",
    location: "Federal Hill Park, Baltimore",
    date: "Sunday, August 16",
    time: "6:30 PM",
    endTime: "8:30 PM",
    attending: 22,
    price: "Free",
    gradient: "from-sky-600/70 to-indigo-900",
    emoji: "📷",
    image: "/images/event-photowalk.jpg",
    description: "Casual shoot walk along the waterfront. All skill levels and cameras welcome.",
    reach: { location: "Baltimore, MD", reach: "Nearby", radius: "5 mi" },
    host: "Ava Chen",
    category: "Photoshoot",
    age: "all",
    registration: "rsvp",
    capacity: 40,
    waitlist: false,
    requiredFields: ["Full name"],
    rules: ["All skill levels welcome", "Respect people who don't want to be photographed"],
  },
  {
    id: "after-dark",
    title: "After Dark Baltimore",
    location: "Baltimore, MD",
    date: "Saturday, August 30",
    time: "9:00 PM",
    endTime: "2:00 AM",
    attending: 137,
    price: "$30",
    gradient: "from-red-600/70 to-rose-950",
    emoji: "🔥",
    image: "/images/event-afterdark.jpg",
    description: "Music, creators, networking, DJs and photography. The DMV creator scene after hours.",
    reach: { location: "Baltimore, MD", reach: "City" },
    host: "Devin Carter",
    organizedByYou: true,
    category: "Party / Nightlife",
    age: "21+",
    registration: "ticket",
    capacity: 200,
    waitlist: true,
    requiredFields: ["Full name", "Email", "Date of birth"],
    rules: [
      "21+ only — valid government-issued ID required at entry",
      "No outside alcohol",
      "No weapons",
      "No harassment",
      "Photography permitted",
    ],
    ticketTypes: [
      { id: "early", name: "Early Bird", price: 20 },
      { id: "ga", name: "General Admission", price: 30 },
      { id: "vip", name: "VIP", price: 50 },
    ],
    schedule: [
      { time: "9:00 PM", item: "Doors" },
      { time: "10:00 PM", item: "DJ sets" },
      { time: "12:00 AM", item: "Creator showcase" },
    ],
  },
  {
    id: "workshop",
    title: "Mixing Masterclass",
    location: "Station North, Baltimore",
    date: "Wednesday, September 3",
    time: "6:00 PM",
    endTime: "9:00 PM",
    attending: 14,
    price: "$50",
    gradient: "from-emerald-600/70 to-teal-950",
    emoji: "🎚️",
    image: "/images/event-workshop.jpg",
    description: "Hands-on mixing session for 20 producers. Bring a rough mix — leave with a finished one.",
    reach: { location: "Baltimore, MD", reach: "Local", radius: "25 mi" },
    host: "Devin Carter",
    organizedByYou: true,
    category: "Workshop",
    age: "18+",
    registration: "approval",
    capacity: 20,
    waitlist: true,
    requiredFields: ["Full name", "Email", "What do you want to improve?"],
    rules: ["Bring headphones + a laptop with your DAW", "18+ only", "Recording the session is fine"],
  },
];

/* ------------------------------ trust levels -------------------------------- */
/* Trust scales with what the job involves. The question: does the
   customer trust the worker with a person, child, pet, home, property,
   vehicle, or private access while they're not present?
   Verification runs through an identity-verification provider — Mavyn
   never stores licenses/passports, and profiles show status only,
   never legal name / ID number / DOB / address.                        */

export type TrustLevel = "standard" | "identity" | "high-trust";

/* --------------------------- campus organizations --------------------------- */
/* V1: organization pages — another type of community, not a separate
   product. Two statuses, deliberately distinct:
   - Verified Organization ✓  = "this organization is legitimate"
   - Community Group          = unofficial, still useful
   Membership verification ("this person is a member") is V2 and is
   approved by org admins — Mavyn never guesses fraternity rosters.
   Branding colors are just branding, not proof of membership.          */

export interface CampusOrg {
  id: string;
  name: string;
  emoji: string;
  /** org branding gradient — cosmetic only */
  gradient: string;
  verified: boolean;
  category: "Student Organization" | "Sports" | "Greek Life" | "Campus Business" | "Community Group";
  school: string;
  members: number;
  about: string;
  leadership: string[];
  posts: { id: string; author: string; time: string; text: string }[];
  orgEvents: { id: string; title: string; when: string; where: string; going: number }[];
  opportunityId?: string;
}

export const campusOrgs: CampusOrg[] = [
  {
    id: "photo-club",
    name: "BSU Photography Club",
    emoji: "📸",
    gradient: "from-sky-500 to-blue-700",
    verified: true,
    category: "Student Organization",
    school: "Bowie State University",
    members: 84,
    about:
      "Student photographers at every level. Weekly shoots, gear shares, critique nights, and paid campus gigs sourced for members.",
    leadership: ["Toni Alvarez (President)", "Devon Price (Events)"],
    posts: [
      { id: "pc-1", author: "Toni Alvarez", time: "3h", text: "Critique night moved to Thursday — bring your three best from the quad shoot. 📷" },
      { id: "pc-2", author: "Devon Price", time: "1d", text: "The bookstore promo gig went to two of our members. Paid work through Mavyn — this is the point of the club." },
    ],
    orgEvents: [
      { id: "pce-1", title: "Photography Club Meetup", when: "Thursday · 6:00 PM", where: "Student Center", going: 31 },
      { id: "pce-2", title: "Golden Hour Campus Walk", when: "Sunday · 6:30 PM", where: "Main Quad", going: 18 },
    ],
    opportunityId: "org-promo",
  },
  {
    id: "sga",
    name: "Student Government Association",
    emoji: "🏛️",
    gradient: "from-violet-500 to-purple-800",
    verified: true,
    category: "Student Organization",
    school: "Bowie State University",
    members: 210,
    about:
      "Your student government. Campus initiatives, budget decisions, event funding, and the people to talk to when something needs fixing.",
    leadership: ["Sasha Green (President)", "K. Boateng (Treasurer)"],
    posts: [
      { id: "sga-1", author: "Sasha Green", time: "5h", text: "Homecoming creative showcase budget approved — performers and designers, applications open Friday. 🎉" },
    ],
    orgEvents: [
      { id: "sga-1e", title: "Town Hall: Student Activity Fees", when: "Tuesday · 5:00 PM", where: "Auditorium B", going: 64 },
    ],
  },
  {
    id: "late-night",
    name: "Late Night Creatives",
    emoji: "🌙",
    gradient: "from-zinc-600 to-zinc-800",
    verified: false,
    category: "Community Group",
    school: "Bowie State University",
    members: 47,
    about:
      "Unofficial crew for people who make things after midnight. Beat sessions, edit marathons, late food runs. Not a registered org — just us.",
    leadership: ["Maya Reyes (started it)"],
    posts: [
      { id: "ln-1", author: "Maya Reyes", time: "2h", text: "Media lab open till 2am tonight. Who's pulling up? 🌙" },
    ],
    orgEvents: [
      { id: "ln-1e", title: "Midnight Edit Marathon", when: "Friday · 11:00 PM", where: "Media Lab 2", going: 12 },
    ],
  },
];

