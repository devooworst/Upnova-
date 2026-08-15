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

