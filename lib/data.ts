/* ------------------------------------------------------------------ */
/*  UpNova — typed mock data                                           */
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

/* --------------------------------- stories -------------------------------- */

export interface Story {
  id: string;
  name: string;
  image?: string;
  initials?: string;
  gradient: string;
  isSelf?: boolean;
  isBrand?: boolean;
}

export const stories: Story[] = [
  { id: "you", name: "Your Story", image: "/images/devin.jpg", isSelf: true, gradient: "" },
  { id: "jordan", name: "Jordan", image: "/images/jordan.jpg", gradient: "" },
  { id: "ava", name: "Ava", image: "/images/ava.jpg", gradient: "" },
  { id: "marcus", name: "Marcus", image: "/images/marcus.jpg", gradient: "" },
  { id: "nia", name: "Nia", image: "/images/nia.jpg", gradient: "" },
  { id: "sony", name: "Sony Music", initials: "S", gradient: "from-zinc-200 to-zinc-500", isBrand: true },
  { id: "nike", name: "Nike", initials: "N", gradient: "from-zinc-800 to-zinc-950", isBrand: true },
];

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
    handle: "avashoots",
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
    name: "Marcus Reed",
    handle: "marcusfilms",
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
    name: "Nia Carter",
    handle: "niastyled",
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
    handle: "lenadesigns",
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
    poster: "UpNova Events",
    posterInitials: "U",
    posterGradient: "from-lime-500 to-emerald-600",
    verifiedPoster: true,
    category: "Event Staff",
    description:
      "Cover the UpNova Creator Meetup in Baltimore. 3 hours, recap reel due within 48 hours.",
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

/* ----------------------------------- feed ---------------------------------- */

export type FeedItemType = "opportunity" | "post" | "audio" | "poll" | "event";

export interface Post {
  id: string;
  type: FeedItemType;
  creator: Creator;
  time: string;
  text: string;
  image?: string;
  imageAlt?: string;
  likes: number;
  comments: number;
  shares: number;
  liked?: boolean;
  saved?: boolean;
  tags?: string[];
  following?: boolean;
  trending?: boolean;
  audio?: { title: string; subtitle: string; duration: string; cover?: string };
  poll?: { question: string; options: { label: string; votes: number }[] };
  opportunityId?: string;
  eventId?: string;
  /** miles from the current user — powers the distance-ring grouping */
  distanceMi?: number;
}

export const feed: Post[] = [
  {
    id: "opp-nike",
    type: "opportunity",
    creator: creators[0],
    time: "4h",
    text: "",
    likes: 0,
    comments: 0,
    shares: 0,
    opportunityId: "nike-fall",
    trending: true,
    distanceMi: 612,
  },
  {
    id: "post-jordan-audio",
    type: "audio",
    creator: creators[0],
    time: "2h",
    text: "Late nights in the studio hit different when the beat is right. Preview of something new…",
    likes: 142,
    comments: 38,
    shares: 12,
    following: true,
    trending: true,
    audio: {
      title: "Late Nights Beat.mp3",
      subtitle: "Original Audio",
      duration: "0:30",
      cover: "/images/beat-cover.jpg",
    },
  },
  {
    id: "post-ava-photo",
    type: "post",
    creator: creators[1],
    time: "5h",
    text: "Behind the shot 🎞️ Golden hour session down at the harbor. Full gallery dropping this week — DM for bookings, I'm around this month. #BehindTheShot",
    image: "/images/studio-post.jpg",
    imageAlt: "Photographer reviewing shots at golden hour",
    likes: 486,
    comments: 64,
    shares: 41,
    saved: true,
    following: true,
    trending: true,
    distanceMi: 2.4,
    tags: ["#BehindTheShot", "#CreatorsUnited"],
  },
  {
    id: "opp-photo-gig",
    type: "opportunity",
    creator: creators[1],
    time: "3h",
    text: "",
    likes: 0,
    comments: 0,
    shares: 0,
    opportunityId: "photo-gig",
    distanceMi: 2.1,
  },
  {
    id: "poll-devin",
    type: "poll",
    creator: currentUser,
    time: "8h",
    text: "What content do you want to see more of?",
    likes: 58,
    comments: 22,
    shares: 4,
    distanceMi: 0,
    poll: {
      question: "What content do you want to see more of?",
      options: [
        { label: "Behind the Scenes", votes: 412 },
        { label: "Gear Reviews", votes: 139 },
        { label: "Tutorials", votes: 113 },
      ],
    },
  },
  {
    id: "event-meetup",
    type: "event",
    creator: currentUser,
    time: "1d",
    text: "",
    likes: 0,
    comments: 0,
    shares: 0,
    eventId: "meetup",
    distanceMi: 3.1,
  },
  {
    id: "post-marcus",
    type: "post",
    creator: creators[2],
    time: "1d",
    text: "Wrapped the color grade on this one at 2am. Client wanted \"warm but moody\" — I think we landed it. What do y'all think? #UpNovaCreate",
    image: "/images/portfolio-nike.jpg",
    imageAlt: "Behind the scenes of a brand campaign shoot",
    likes: 233,
    comments: 47,
    shares: 19,
    following: true,
    distanceMi: 18,
    tags: ["#UpNovaCreate"],
  },
  {
    id: "post-lena-covers",
    type: "post",
    creator: creators[5],
    time: "6h",
    text: "Three cover-art commissions out the door this week. Two slots left for August \u2014 grab one before they're gone. #CoverArt",
    image: "/images/portfolio-spotify.jpg",
    imageAlt: "Album cover art designs on a screen",
    likes: 611,
    comments: 89,
    shares: 57,
    trending: true,
    tags: ["#CoverArt", "#OpenForWork"],
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
    title: "UpNova Creator Meetup",
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
    host: "UpNova Events",
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

/* -------------------------------- communities ------------------------------ */

export type CommunityAccess = "public" | "private" | "invite" | "verified";
export type CommunityMode = "discussion" | "announcements" | "broadcast" | "collaboration" | "qa";

export const communityAccessInfo: Record<CommunityAccess, { label: string; desc: string }> = {
  public: { label: "Public", desc: "Anyone can discover and join." },
  private: { label: "Private", desc: "Discoverable — joining requires approval." },
  invite: { label: "Invite-only", desc: "Hidden. Invitation or link required." },
  verified: { label: "Verified-only", desc: "Only people who meet a requirement can join." },
};

export const communityModeInfo: Record<CommunityMode, { label: string; desc: string }> = {
  discussion: { label: "Discussion", desc: "Everyone can post and respond." },
  announcements: { label: "Announcements", desc: "Admins post; members read and react." },
  broadcast: { label: "Broadcast", desc: "Admin updates; replies limited." },
  collaboration: { label: "Collaboration", desc: "Built for finding partners and projects." },
  qa: { label: "Q&A", desc: "Members ask; others answer." },
};

export interface Community {
  id: string;
  name: string;
  members: string;
  online: number;
  description: string;
  emoji: string;
  gradient: string;
  image?: string;
  reach: ReachInfo;
  tags: string[];
  joined?: boolean;
  access: CommunityAccess;
  mode: CommunityMode;
  /** creator-controlled permissions */
  settings: {
    promotion: boolean;
    opportunities: boolean;
    events: boolean;
    links: boolean;
    approval: boolean;
  };
}

export const communities: Community[] = [
  {
    id: "dmv",
    access: "public",
    mode: "discussion",
    settings: { promotion: true, opportunities: true, events: true, links: true, approval: false },
    name: "DMV Creators",
    members: "2.4K",
    online: 61,
    description: "A community for creators in the DMV. Collabs, gigs, feedback, and meetups.",
    emoji: "🌊",
    gradient: "from-lime-500/70 to-emerald-900",
    image: "/images/community-dmv.jpg",
    reach: { location: "DMV", reach: "Local", radius: "25 mi" },
    tags: ["Collabs", "Meetups", "Gigs"],
    joined: true,
  },
  {
    id: "music-producers",
    access: "public",
    mode: "collaboration",
    settings: { promotion: true, opportunities: true, events: true, links: true, approval: false },
    name: "Music Producers",
    members: "5.1K",
    online: 143,
    description: "Beats, mixing tips, feedback threads, and weekly collab challenges.",
    emoji: "🎛️",
    gradient: "from-violet-600/70 to-purple-950",
    image: "/images/community-producers.jpg",
    reach: { location: "United States", reach: "Remote" },
    tags: ["Feedback", "Challenges", "Collabs"],
    joined: true,
  },
  {
    id: "film-makers",
    access: "public",
    mode: "collaboration",
    settings: { promotion: true, opportunities: true, events: true, links: true, approval: false },
    name: "Film Makers",
    members: "1.8K",
    online: 38,
    description: "Short films to commercial work: crew calls, gear talk, and premieres.",
    emoji: "🎬",
    gradient: "from-amber-500/70 to-orange-950",
    image: "/images/community-film.jpg",
    reach: { location: "Maryland", reach: "Regional" },
    tags: ["Crew Calls", "Premieres"],
    joined: true,
  },
  {
    id: "photographers",
    access: "public",
    mode: "qa",
    settings: { promotion: true, opportunities: true, events: true, links: false, approval: false },
    name: "Photographers",
    members: "3.3K",
    online: 87,
    description: "Portraits, events, product — share work, trade second-shooter gigs.",
    emoji: "📸",
    gradient: "from-sky-500/70 to-blue-950",
    image: "/images/community-photo.jpg",
    reach: { location: "Baltimore, MD", reach: "City" },
    tags: ["Critique", "Gigs"],
  },
  {
    id: "streetwear",
    access: "public",
    mode: "discussion",
    settings: { promotion: true, opportunities: true, events: true, links: true, approval: true },
    name: "Streetwear",
    members: "4.7K",
    online: 210,
    description: "Drops, fits, design breakdowns, and brand-building for independent labels.",
    emoji: "🧢",
    gradient: "from-rose-500/70 to-pink-950",
    image: "/images/community-streetwear.jpg",
    reach: { location: "Global", reach: "Global" },
    tags: ["Drops", "Design", "Brands"],
    joined: true,
  },
  {
    id: "daily-inspiration",
    access: "public",
    mode: "broadcast",
    settings: { promotion: false, opportunities: false, events: false, links: false, approval: true },
    name: "Daily Inspiration",
    members: "8.9K",
    online: 312,
    description: "One reminder every morning. No noise, no ads — just something to carry into the day.",
    emoji: "✨",
    gradient: "from-amber-500/70 to-orange-950",
    reach: { location: "Global", reach: "Global" },
    tags: ["Motivation", "Daily"],
    joined: true,
  },
  {
    id: "anime-creators",
    access: "public",
    mode: "discussion",
    settings: { promotion: true, opportunities: true, events: true, links: true, approval: false },
    name: "Anime Creators",
    members: "6.2K",
    online: 174,
    description: "Fan artists, AMV editors, cosplayers, and writers. Share work, find collab partners, plan con meetups.",
    emoji: "🍿",
    gradient: "from-rose-500/70 to-pink-950",
    image: "/images/community-anime.jpg",
    reach: { location: "Global", reach: "Global" },
    tags: ["Fan Art", "Cosplay", "Collabs"],
  },
  {
    id: "beauty-makeup",
    access: "public",
    mode: "qa",
    settings: { promotion: true, opportunities: true, events: true, links: false, approval: false },
    name: "Beauty & Makeup",
    members: "3.8K",
    online: 96,
    description: "MUAs, lash techs, and hair stylists. Technique threads, kit recs, and client-booking tips.",
    emoji: "💄",
    gradient: "from-fuchsia-500/70 to-purple-950",
    image: "/images/community-beauty.jpg",
    reach: { location: "DMV", reach: "Local", radius: "25 mi" },
    tags: ["MUA", "Lashes", "Booking"],
  },
  {
    id: "game-devs",
    access: "public",
    mode: "collaboration",
    settings: { promotion: true, opportunities: true, events: true, links: true, approval: false },
    name: "Game Developers",
    members: "2.9K",
    online: 88,
    description: "Indies building together — programmers, artists, composers, and writers looking for teams.",
    emoji: "🎮",
    gradient: "from-indigo-500/70 to-blue-950",
    image: "/images/community-gamedev.jpg",
    reach: { location: "United States", reach: "Remote" },
    tags: ["Indie", "Teams", "Jams"],
  },
];

/* ------------------------------ trust levels -------------------------------- */
/* Trust scales with what the job involves. The question: does the
   customer trust the worker with a person, child, pet, home, property,
   vehicle, or private access while they're not present?
   Verification runs through an identity-verification provider — UpNova
   never stores licenses/passports, and profiles show status only,
   never legal name / ID number / DOB / address.                        */

export type TrustLevel = "standard" | "identity" | "high-trust";

export const trustLevelInfo: Record<TrustLevel, { dot: string; label: string; desc: string; checks: string[] }> = {
  standard: {
    dot: "🟢",
    label: "Standard",
    desc: "Normal creative/digital work. Email + phone verification; ID optional.",
    checks: ["Email & phone verified", "Portfolio & reviews"],
  },
  identity: {
    dot: "🟡",
    label: "Identity Verified",
    desc: "In-person work or handling something valuable.",
    checks: ["Identity verification (via provider)", "Email & phone verified"],
  },
  "high-trust": {
    dot: "🔴",
    label: "High-Trust",
    desc: "Unsupervised access to a person, child, pet, home, or valuable property.",
    checks: [
      "Identity verification",
      "Age verification",
      "Background screening (where appropriate & legally permitted)",
    ],
  },
};

/* ------------------------------ service catalog ----------------------------- */
/* Services = clients are looking for a creator. Predefined offerings with
   clear starting prices. CTA is Hire Me. (Opportunities are the inverse.)  */

/* ---- Creative Integrity ----
   UpNova does not prohibit AI universally. UpNova prohibits
   misrepresentation. Every service and project carries an AI policy;
   disclosure is part of the agreement, and violations are disputable. */

export type AiPolicy = "no-ai" | "disclosure" | "assisted" | "client-decides";

export const aiPolicyInfo: Record<AiPolicy, { dot: string; label: string; desc: string }> = {
  "no-ai": {
    dot: "🔴",
    label: "No AI",
    desc: "Created by the creator without generative AI.",
  },
  disclosure: {
    dot: "🟡",
    label: "AI with disclosure",
    desc: "AI may be used; the creator must disclose how.",
  },
  assisted: {
    dot: "🟠",
    label: "AI-assisted",
    desc: "Limited AI assistance; the creator owns the creative work.",
  },
  "client-decides": {
    dot: "🟢",
    label: "Client decides",
    desc: "AI use is agreed per project before work begins.",
  },
};

export type AiInvolvement = "none" | "assisted" | "generative" | "full";

export const aiInvolvementInfo: Record<AiInvolvement, { dot: string; label: string }> = {
  none: { dot: "🔴", label: "No AI" },
  assisted: { dot: "🟡", label: "AI-assisted" },
  generative: { dot: "🟠", label: "Generative elements" },
  full: { dot: "🟢", label: "Fully AI-generated" },
};

export interface CatalogService {
  id: string;
  creatorId: string;
  title: string;
  category: "Music" | "Video" | "Photography" | "Design" | "Fashion" | "Writing" | "Care";
  startingAt: number;
  description: string;
  delivery: string;
  aiPolicy: AiPolicy;
  trustLevel: TrustLevel;
}

export const serviceCatalog: CatalogService[] = [
  {
    id: "svc-jordan-production",
    trustLevel: "standard",
    aiPolicy: "assisted",
    creatorId: "jordan",
    title: "Music Production",
    category: "Music",
    startingAt: 300,
    description: "Custom beat, arrangement, and a radio-ready mix. Two revisions included.",
    delivery: "5-7 days",
  },
  {
    id: "svc-marcus-editing",
    trustLevel: "standard",
    aiPolicy: "assisted",
    creatorId: "marcus",
    title: "Video Editing",
    category: "Video",
    startingAt: 200,
    description: "Cut, color grade, and sound polish for content up to 10 minutes.",
    delivery: "3-5 days",
  },
  {
    id: "svc-ava-photography",
    trustLevel: "identity",
    aiPolicy: "no-ai",
    creatorId: "ava",
    title: "Photography",
    category: "Photography",
    startingAt: 250,
    description: "Half-day shoot with an edited gallery of 40+ delivered shots.",
    delivery: "1 week",
  },
  {
    id: "svc-jordan-songwriting",
    trustLevel: "standard",
    aiPolicy: "no-ai",
    creatorId: "jordan",
    title: "Songwriting",
    category: "Writing",
    startingAt: 150,
    description: "Toplines, hooks, and full lyric sheets in your artist's voice.",
    delivery: "3 days",
  },
  {
    id: "svc-tre-beats",
    trustLevel: "standard",
    aiPolicy: "disclosure",
    creatorId: "tre",
    title: "Beat Licensing",
    category: "Music",
    startingAt: 150,
    description: "Exclusive licenses from a 200+ beat catalog. Trap, lo-fi, drill.",
    delivery: "Instant",
  },
  {
    id: "svc-lena-brand",
    trustLevel: "standard",
    aiPolicy: "client-decides",
    creatorId: "lena",
    title: "Brand Identity",
    category: "Design",
    startingAt: 180,
    description: "Logo, palette, and cover art system for artists and small brands.",
    delivery: "1-2 weeks",
  },
  {
    id: "svc-nia-petcare",
    trustLevel: "high-trust",
    creatorId: "nia",
    title: "Dog Walking & Pet Sitting",
    category: "Care",
    startingAt: 25,
    description: "30-minute walks or full-day sitting for your dog. Photo updates every visit.",
    delivery: "Scheduled",
    aiPolicy: "no-ai",
  },
  {
    id: "svc-nia-content",
    trustLevel: "identity",
    aiPolicy: "no-ai",
    creatorId: "nia",
    title: "Fashion Content",
    category: "Fashion",
    startingAt: 90,
    description: "Styled looks and short-form content for your product or drop.",
    delivery: "1 week",
  },
];

/* --------------------------- community content ----------------------------- */
/* Same framework for every community — the purpose determines the content. */

export interface CommunityPost {
  id: string;
  author: string;
  /** creator id when the author is a known creator — powers profile previews */
  authorId?: string;
  authorAvatar?: string | null;
  initials: string;
  gradient: string;
  role: string;
  time: string;
  text: string;
  likes: number;
  comments: number;
}

export interface Discussion {
  id: string;
  title: string;
  author: string;
  replies: number;
  lastActive: string;
  pinned?: boolean;
}

export interface CommunityContent {
  posts: CommunityPost[];
  discussions: Discussion[];
  opportunityIds: string[];
  eventIds: string[];
  memberIds: string[];
  created: string;
  createdBy: string;
}

export const communityContent: Record<string, CommunityContent> = {
  "daily-inspiration": {
    created: "November 2025",
    createdBy: "Devin Carter",
    memberIds: [],
    opportunityIds: [],
    eventIds: [],
    posts: [
      {
        id: "di-p1",
        author: "Daily Inspiration",
        initials: "✨",
        gradient: "from-amber-500 to-orange-700",
        role: "Admin",
        time: "6:00 AM",
        text: "🌅 Today's Reminder — Keep going even when nobody sees the work you're putting in.",
        likes: 1204,
        comments: 0,
      },
      {
        id: "di-p2",
        author: "Daily Inspiration",
        initials: "✨",
        gradient: "from-amber-500 to-orange-700",
        role: "Admin",
        time: "1d",
        text: "🌅 Yesterday's Reminder — The gig you didn't get was practice for the one you will.",
        likes: 987,
        comments: 0,
      },
    ],
    discussions: [],
  },
  dmv: {
    created: "March 2026",
    createdBy: "Devin Carter",
    memberIds: ["ava", "marcus", "nia", "jordan", "tre"],
    opportunityIds: ["photo-gig", "event-staff"],
    eventIds: ["meetup", "networking"],
    posts: [
      {
        id: "dmv-p1",
        authorId: "jordan",
        author: "Jordan Miles",
        authorAvatar: "/images/jordan.jpg",
        initials: "J",
        gradient: "from-violet-500 to-fuchsia-600",
        role: "Music Producer",
        time: "2h",
        text: "Looking for a photographer in Baltimore this Saturday for a music video. Paid, half-day. Drop your portfolio below 👇",
        likes: 34,
        comments: 12,
      },
      {
        id: "dmv-p2",
        authorId: "ava",
        author: "Ava Chen",
        authorAvatar: "/images/ava.jpg",
        initials: "A",
        gradient: "from-sky-500 to-indigo-600",
        role: "Photographer",
        time: "5h",
        text: "Shot three creators from this community last month. This is what UpNova is supposed to feel like. Book your slots for September now — August is gone.",
        likes: 87,
        comments: 21,
      },
      {
        id: "dmv-p3",
        authorId: "nia",
        author: "Nia Carter",
        initials: "N",
        gradient: "from-rose-500 to-pink-600",
        role: "Fashion Creator",
        time: "1d",
        text: "Who's going to the meetup on the 22nd? Trying to organize a fit-pic wall 📸",
        likes: 45,
        comments: 18,
      },
    ],
    discussions: [
      { id: "dmv-d1", title: "DMV Creator Meetup — August 22", author: "Devin Carter", replies: 48, lastActive: "1h", pinned: true },
      { id: "dmv-d2", title: "Anybody know a good studio in Baltimore?", author: "Tre Watkins", replies: 15, lastActive: "3h" },
      { id: "dmv-d3", title: "Looking for videographers in PG County", author: "Maya Reyes", replies: 9, lastActive: "6h" },
      { id: "dmv-d4", title: "Who's going to the creator meetup?", author: "Nia Carter", replies: 31, lastActive: "1d" },
    ],
  },
  "music-producers": {
    created: "January 2026",
    createdBy: "Jordan Miles",
    memberIds: ["jordan", "tre", "lena"],
    opportunityIds: ["music-video"],
    eventIds: ["networking"],
    posts: [
      {
        id: "mp-p1",
        authorId: "tre",
        author: "Tre Watkins",
        initials: "T",
        gradient: "from-emerald-500 to-teal-600",
        role: "Beat Maker",
        time: "3h",
        text: "Beat feedback thread 🎧 Drop your latest loop, give the person above you honest notes. No cap, no clout.",
        likes: 62,
        comments: 40,
      },
      {
        id: "mp-p2",
        authorId: "jordan",
        author: "Jordan Miles",
        authorAvatar: "/images/jordan.jpg",
        initials: "J",
        gradient: "from-violet-500 to-fuchsia-600",
        role: "Music Producer",
        time: "8h",
        text: "Mixing tip that changed my low end forever: mono your bass below 120Hz and stop fighting your kick. That's it. That's the post.",
        likes: 143,
        comments: 27,
      },
    ],
    discussions: [
      { id: "mp-d1", title: "Weekly collab challenge #31 — flip this sample", author: "Jordan Miles", replies: 56, lastActive: "2h", pinned: true },
      { id: "mp-d2", title: "Artists looking for producers — intro thread", author: "Lena Ortiz", replies: 88, lastActive: "4h" },
      { id: "mp-d3", title: "How do you price mixing vs mastering?", author: "Tre Watkins", replies: 22, lastActive: "1d" },
    ],
  },
  "film-makers": {
    created: "February 2026",
    createdBy: "Marcus Reed",
    memberIds: ["marcus", "ava", "jordan"],
    opportunityIds: ["crew-call"],
    eventIds: ["photo-walk"],
    posts: [
      {
        id: "fm-p1",
        authorId: "marcus",
        author: "Marcus Reed",
        authorAvatar: "/images/marcus.jpg",
        initials: "M",
        gradient: "from-amber-500 to-orange-600",
        role: "Videographer",
        time: "4h",
        text: "CREW NEEDED — camera operator for a short film in Baltimore, August 18. $400 for the day, meals covered. Apply on the opportunities tab.",
        likes: 51,
        comments: 16,
      },
      {
        id: "fm-p2",
        authorId: "ava",
        author: "Ava Chen",
        authorAvatar: "/images/ava.jpg",
        initials: "A",
        gradient: "from-sky-500 to-indigo-600",
        role: "Photographer",
        time: "1d",
        text: "Premiere night for 'Harbor Lines' went off. Full BTS gallery coming to my portfolio this week. Thanks to the six community members who crewed it 🎬",
        likes: 94,
        comments: 23,
      },
    ],
    discussions: [
      { id: "fm-d1", title: "Casting call board — post your roles here", author: "Marcus Reed", replies: 34, lastActive: "5h", pinned: true },
      { id: "fm-d2", title: "Best budget cinema lens for Sony?", author: "Devin Carter", replies: 19, lastActive: "9h" },
      { id: "fm-d3", title: "Local shoots this month — who needs hands?", author: "Ava Chen", replies: 27, lastActive: "1d" },
    ],
  },
  photographers: {
    created: "April 2026",
    createdBy: "Ava Chen",
    memberIds: ["ava", "nia", "marcus"],
    opportunityIds: ["photo-gig"],
    eventIds: ["photo-walk"],
    posts: [
      {
        id: "ph-p1",
        authorId: "ava",
        author: "Ava Chen",
        authorAvatar: "/images/ava.jpg",
        initials: "A",
        gradient: "from-sky-500 to-indigo-600",
        role: "Photographer",
        time: "6h",
        text: "Golden hour photo walk this Sunday at Federal Hill — all skill levels, all cameras. 22 going so far. Bring one lens only, that's the challenge.",
        likes: 66,
        comments: 14,
      },
    ],
    discussions: [
      { id: "ph-d1", title: "Critique thread — post one shot, get one note", author: "Ava Chen", replies: 73, lastActive: "2h", pinned: true },
      { id: "ph-d2", title: "Second-shooter exchange board", author: "Nia Carter", replies: 41, lastActive: "7h" },
    ],
  },
  streetwear: {
    created: "December 2025",
    createdBy: "Nia Carter",
    memberIds: ["nia", "lena", "ava"],
    opportunityIds: ["brand-collab"],
    eventIds: ["networking"],
    posts: [
      {
        id: "sw-p1",
        authorId: "nia",
        author: "Nia Carter",
        initials: "N",
        gradient: "from-rose-500 to-pink-600",
        role: "Fashion Creator",
        time: "1h",
        text: "Independent streetwear brand looking for a photographer for our next drop. $600, Baltimore, 5 miles. Check the opportunities tab — legit budget, real brief.",
        likes: 58,
        comments: 19,
      },
      {
        id: "sw-p2",
        authorId: "lena",
        author: "Lena Ortiz",
        initials: "L",
        gradient: "from-cyan-500 to-blue-600",
        role: "Graphic Designer",
        time: "10h",
        text: "Design breakdown: how we took the Vaulted capsule from moodboard to tech pack in 12 days. Full thread in discussions.",
        likes: 112,
        comments: 31,
      },
    ],
    discussions: [
      { id: "sw-d1", title: "Drop calendar — what's releasing this month", author: "Nia Carter", replies: 29, lastActive: "3h", pinned: true },
      { id: "sw-d2", title: "Manufacturer recs for small runs (50-200 pieces)?", author: "Lena Ortiz", replies: 44, lastActive: "8h" },
      { id: "sw-d3", title: "Models available for lookbooks — intro thread", author: "Maya Reyes", replies: 17, lastActive: "2d" },
    ],
  },
};

/* --------------------------- campus organizations --------------------------- */
/* V1: organization pages — another type of community, not a separate
   product. Two statuses, deliberately distinct:
   - Verified Organization ✓  = "this organization is legitimate"
   - Community Group          = unofficial, still useful
   Membership verification ("this person is a member") is V2 and is
   approved by org admins — UpNova never guesses fraternity rosters.
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
      { id: "pc-2", author: "Devon Price", time: "1d", text: "The bookstore promo gig went to two of our members. Paid work through UpNova — this is the point of the club." },
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

/* ------------------------------ work history -------------------------------- */
/* Every paid job creates a completed work record. Portfolio = "look
   what I can create." Experience = "look what I've actually done" —
   verified through UpNova, added to the public portfolio only with
   permission. Reviews only come from verified projects.               */

export interface WorkRecord {
  id: string;
  title: string;
  client: string;
  role: string;
  completed: string;
  rating: number;
  /** 🟢 on-time · 🟡 approved extension · 🟠 late, communicated · 🔴 late, silent */
  outcome: "on-time" | "extension" | "late-communicated" | "late-silent";
  /** creator chose to show this client work publicly */
  inPortfolio: boolean;
}

export const workRecords: WorkRecord[] = [
  { id: "wr-1", title: "Event Photography — Creator Meetup", client: "Ava Chen", role: "Client", completed: "Aug 22", rating: 5.0, outcome: "on-time", inPortfolio: true },
  { id: "wr-2", title: "Mixing Session", client: "Maya Reyes", role: "Producer", completed: "Aug 3", rating: 5.0, outcome: "on-time", inPortfolio: false },
  { id: "wr-3", title: "Brand Audio Package", client: "Harbor & Oak", role: "Producer", completed: "Jul 30", rating: 4.8, outcome: "extension", inPortfolio: false },
  { id: "wr-4", title: "Loop Kit — Exclusive License", client: "K. Boateng", role: "Beat Maker", completed: "Jul 18", rating: 5.0, outcome: "on-time", inPortfolio: true },
];

/* Private reliability record — visible to the account owner only.
   Public surface is just the summary: 🟢 Reliable Creator · on-time %. */
export const reliability = {
  onTimeRate: 98,
  completed: 24,
  onTime: 23,
  extensions: 1,
  lateCommunicated: 0,
  lateSilent: 0,
  cancelled: 0,
  disputes: 0,
  rating: 4.9,
  responseRate: 100,
};

/* -------------------------------- bookings --------------------------------- */
/* Service providers live off their calendar: who booked, when, for how much. */

export interface Booking {
  id: string;
  client: string;
  clientAvatar?: string;
  initials: string;
  gradient: string;
  service: string;
  /** day of month, August 2026 */
  day: number;
  time: string;
  duration: string;
  price: string;
  status: "confirmed" | "pending";
  location: string;
}

export const bookings: Booking[] = [
  {
    id: "bk-maya",
    client: "Maya Reyes",
    initials: "M",
    gradient: "from-rose-500 to-pink-600",
    service: "Mixing session",
    day: 9,
    time: "2:00 PM",
    duration: "3 hrs",
    price: "$200",
    status: "confirmed",
    location: "Your studio",
  },
  {
    id: "bk-harbor",
    client: "Harbor & Oak",
    initials: "H",
    gradient: "from-teal-600 to-emerald-700",
    service: "Brand audio package",
    day: 12,
    time: "10:00 AM",
    duration: "Half day",
    price: "$450",
    status: "confirmed",
    location: "On location, Fells Point",
  },
  {
    id: "bk-jordan",
    client: "Jordan Miles",
    clientAvatar: "/images/jordan.jpg",
    initials: "J",
    gradient: "from-violet-500 to-fuchsia-600",
    service: "Writing session (collab)",
    day: 15,
    time: "6:00 PM",
    duration: "4 hrs",
    price: "Split",
    status: "confirmed",
    location: "Remote",
  },
  {
    id: "bk-kwame",
    client: "K. Boateng",
    initials: "K",
    gradient: "from-amber-500 to-orange-600",
    service: "Full production day",
    day: 21,
    time: "11:00 AM",
    duration: "Full day",
    price: "$450",
    status: "pending",
    location: "Your studio",
  },
  {
    id: "bk-meetup",
    client: "UpNova Events",
    initials: "U",
    gradient: "from-lime-400 to-emerald-600",
    service: "Live set, Creator Meetup",
    day: 22,
    time: "7:00 PM",
    duration: "2 hrs",
    price: "$150",
    status: "confirmed",
    location: "Baltimore, MD",
  },
];

/* ------------------------------ trending / follow ------------------------------ */

export const trending = [
  { tag: "#UpNovaCreate", posts: "12.4K posts" },
  { tag: "#CreatorsUnited", posts: "9.1K posts" },
  { tag: "#NewCollab", posts: "6.7K posts" },
  { tag: "#BehindTheShot", posts: "4.2K posts" },
];

/* --------------------------------- messages -------------------------------- */

export interface Conversation {
  id: string;
  name: string;
  role: string;
  avatar: string | null;
  initials: string;
  gradient: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  messages: { from: "me" | "them"; text: string; time: string }[];
  /** when the participant is a hireable creator: powers Create Project */
  creatorId?: string;
  service?: string;
  startingAt?: number;
}

export const conversations: Conversation[] = [
  {
    id: "ava",
    creatorId: "ava",
    service: "Event Photography",
    startingAt: 250,
    name: "Ava Chen",
    role: "Photographer",
    avatar: "/images/ava.jpg",
    initials: "A",
    gradient: "from-sky-500 to-indigo-600",
    lastMessage: "I can do the 22nd — sending the shot list tonight.",
    time: "12m",
    unread: 2,
    online: true,
    messages: [
      { from: "me", text: "Hey! Saw your photography service on UpNova 👀", time: "10:02 AM" },
      { from: "me", text: "We need coverage for the Creator Meetup on Aug 22. Interested?", time: "10:03 AM" },
      { from: "them", text: "Hey Devin! Yes, that sounds like a blast.", time: "10:15 AM" },
      { from: "them", text: "I can do the 22nd — sending the shot list tonight.", time: "10:16 AM" },
    ],
  },
  {
    id: "nike",
    name: "Nike Creative",
    role: "Brand",
    avatar: null,
    initials: "N",
    gradient: "from-zinc-800 to-zinc-950",
    lastMessage: "Your application is under review. We'll update you by Friday.",
    time: "2h",
    unread: 1,
    online: false,
    messages: [
      { from: "them", text: "Thanks for applying to the Fall Campaign 🎉", time: "Yesterday" },
      { from: "them", text: "Your application is under review. We'll update you by Friday.", time: "Yesterday" },
    ],
  },
  {
    id: "jordan",
    creatorId: "jordan",
    service: "Music Production",
    startingAt: 300,
    name: "Jordan Miles",
    role: "Music Producer",
    avatar: "/images/jordan.jpg",
    initials: "J",
    gradient: "from-violet-500 to-fuchsia-600",
    lastMessage: "Send me the stems and I'll take a pass this weekend.",
    time: "1d",
    unread: 0,
    online: true,
    messages: [
      { from: "me", text: "That new beat is crazy 🔥 you mixing it yourself?", time: "Tue" },
      { from: "them", text: "Send me the stems and I'll take a pass this weekend.", time: "Tue" },
    ],
  },
  {
    id: "marcus",
    creatorId: "marcus",
    service: "Video Editing",
    startingAt: 200,
    name: "Marcus Reed",
    role: "Videographer",
    avatar: "/images/marcus.jpg",
    initials: "M",
    gradient: "from-amber-500 to-orange-600",
    lastMessage: "Send the raw footage whenever — I can start Monday.",
    time: "1d",
    unread: 0,
    online: false,
    messages: [
      { from: "me", text: "Yo Marcus — got a 6-min interview edit, interested?", time: "Mon 4:10 PM" },
      { from: "them", text: "For sure. My editing service starts at $200 for that length.", time: "Mon 4:32 PM" },
      { from: "them", text: "Send the raw footage whenever — I can start Monday.", time: "Mon 4:33 PM" },
    ],
  },
  {
    id: "dmv-creators",
    name: "DMV Creators",
    role: "Community",
    avatar: null,
    initials: "🌊",
    gradient: "from-lime-500 to-emerald-700",
    lastMessage: "Meetup tickets are live — 84 attending so far!",
    time: "2d",
    unread: 0,
    online: false,
    messages: [
      { from: "them", text: "Meetup tickets are live — 84 attending so far!", time: "Mon" },
    ],
  },
];

/* ---------------------------------- profile -------------------------------- */

export const profileStats = [
  { label: "Followers", value: "1.2K" },
  { label: "Following", value: "348" },
  { label: "Projects", value: "87" },
  { label: "Collaborations", value: "14" },
];

export interface PortfolioProject {
  id: string;
  title: string;
  client: string;
  role: string;
  type: string;
  status: "Completed" | "Published" | "In Progress";
  thumbnail?: string;
  gradient: string;
  emoji: string;
  aiInvolvement: AiInvolvement;
  aiDisclosure?: string;
}

export const portfolio: PortfolioProject[] = [
  {
    id: "p1",
    aiInvolvement: "none",
    title: "Nike Fall Campaign",
    client: "Nike",
    role: "Videographer",
    type: "Brand Campaign",
    status: "Completed",
    thumbnail: "/images/portfolio-nike.jpg",
    gradient: "from-zinc-700 to-zinc-950",
    emoji: "🎥",
  },
  {
    id: "p2",
    aiInvolvement: "none",
    title: "Spotify Album Shoot",
    client: "Spotify",
    role: "Photographer",
    type: "Editorial",
    status: "Completed",
    thumbnail: "/images/portfolio-spotify.jpg",
    gradient: "from-emerald-700 to-teal-950",
    emoji: "📸",
  },
  {
    id: "p3",
    aiInvolvement: "assisted",
    aiDisclosure: "AI used for reference moodboards; all production, mixing, and artwork done manually.",
    title: "Late Nights Beat",
    client: "Independent Artist",
    role: "Music Producer",
    type: "Audio",
    status: "Published",
    thumbnail: "/images/beat-cover.jpg",
    gradient: "from-violet-700 to-fuchsia-950",
    emoji: "🎵",
  },
];

export interface ProfileOpportunity {
  id: string;
  title: string;
  detail: string;
  status: "Applied • Under Review" | "Completed" | "Open" | "Accepting Clients";
  kind: "application" | "listing";
  emoji: string;
}

export const profileOpportunities: ProfileOpportunity[] = [
  {
    id: "o1",
    title: "Nike Fall Campaign",
    detail: "Videographer • Applied Aug 4",
    status: "Applied • Under Review",
    kind: "application",
    emoji: "🎥",
  },
  {
    id: "o2",
    title: "Spotify Album Shoot",
    detail: "Photographer • Delivered Jul 12",
    status: "Completed",
    kind: "application",
    emoji: "📸",
  },
  {
    id: "o3",
    title: "Looking for Vocalist",
    detail: "Collaboration • Royalty split",
    status: "Open",
    kind: "listing",
    emoji: "🎤",
  },
  {
    id: "o4",
    title: "Video Editing Available",
    detail: "Service • Starting at $200",
    status: "Accepting Clients",
    kind: "listing",
    emoji: "🎬",
  },
];

export const experience = [
  { title: "Music Production", detail: "80+ releases produced for independent artists since 2021.", years: "2021 — Now", emoji: "🎛️" },
  { title: "Brand Collaborations", detail: "Campaign work with Nike, Spotify, and 12 independent brands.", years: "2022 — Now", emoji: "🤝" },
  { title: "Video Editing", detail: "Reels, music videos, and recap films for creators and events.", years: "2020 — Now", emoji: "🎬" },
  { title: "Creative Direction", detail: "Concept-to-delivery direction for shoots and drops.", years: "2023 — Now", emoji: "🧭" },
];

export interface Service {
  id: string;
  emoji: string;
  title: string;
  startingAt: number;
  description: string;
  availability: string;
  reach: string;
}

export const services: Service[] = [
  {
    id: "s1",
    emoji: "🎵",
    title: "Music Production",
    startingAt: 300,
    description: "Custom production, recording, mixing and arrangement.",
    availability: "Accepting clients",
    reach: "Nationwide / Remote",
  },
  {
    id: "s2",
    emoji: "🎬",
    title: "Video Editing",
    startingAt: 200,
    description: "Reels, music videos, and long-form edits with color and sound design.",
    availability: "Accepting clients",
    reach: "Nationwide / Remote",
  },
  {
    id: "s3",
    emoji: "📸",
    title: "Photography",
    startingAt: 250,
    description: "Portraits, events, and content shoots in the Baltimore area.",
    availability: "Available this week",
    reach: "Baltimore • 10 mi",
  },
  {
    id: "s4",
    emoji: "✍️",
    title: "Songwriting",
    startingAt: 150,
    description: "Hooks, toplines, and full lyrics tailored to your record.",
    availability: "Accepting clients",
    reach: "Global / Remote",
  },
];

export const contact = {
  email: "devin@upnova.app",
  location: "Baltimore, MD",
  responseTime: "Usually responds within 2 hours",
  joined: "Joined March 2024",
};

/* --------------------------------- bookmarks ------------------------------- */

export const bookmarks = [
  { id: "b1", kind: "Opportunity", title: "Nike Fall Campaign", detail: "$2,400 • Atlanta, GA • Deadline Aug 18", emoji: "🔥" },
  { id: "b2", kind: "Post", title: "Ava Chen — Golden hour session", detail: "486 likes • 64 comments", emoji: "📸" },
  { id: "b3", kind: "Service", title: "Lena Ortiz — Brand Identity", detail: "Starting at $180 • Remote", emoji: "🎨" },
  { id: "b4", kind: "Event", title: "DMV Music Networking Night", detail: "Aug 28 • Washington, DC • $15", emoji: "🎤" },
  { id: "b5", kind: "Audio", title: "Late Nights Beat.mp3", detail: "Jordan Miles • Original Audio", emoji: "🎵" },
  { id: "b6", kind: "Community", title: "Streetwear", detail: "4.7K members • Global", emoji: "🧢" },
];

/* --------------------------------- analytics ------------------------------- */

export const analytics = {
  stats: [
    { label: "Profile Views", value: "1,842", delta: "+12.4%", up: true },
    { label: "Post Reach", value: "24.3K", delta: "+31.2%", up: true },
    { label: "New Followers", value: "128", delta: "+8.9%", up: true },
    { label: "Service Revenue", value: "$1,250", delta: "+$450", up: true },
  ],
  weeklyReach: [
    { day: "Mon", value: 42 },
    { day: "Tue", value: 58 },
    { day: "Wed", value: 47 },
    { day: "Thu", value: 74 },
    { day: "Fri", value: 96 },
    { day: "Sat", value: 81 },
    { day: "Sun", value: 63 },
  ],
  topPosts: [
    { title: "Behind the shot 🎞️", reach: "8.2K", engagement: "6.1%" },
    { title: "Late nights in the studio…", reach: "5.9K", engagement: "4.8%" },
    { title: "What content do you want more of?", reach: "3.4K", engagement: "9.2%" },
  ],
  audience: [
    { place: "Baltimore, MD", pct: 34 },
    { place: "Washington, DC", pct: 27 },
    { place: "Atlanta, GA", pct: 14 },
    { place: "Philadelphia, PA", pct: 9 },
    { place: "Other", pct: 16 },
  ],
};

/* ------------------------------ reach options ------------------------------ */

export const reachOptions: { value: Reach; label: string; hint: string }[] = [
  { value: "Nearby", label: "Nearby", hint: "5 miles" },
  { value: "Local", label: "Local", hint: "25 miles" },
  { value: "City", label: "City", hint: "Your city" },
  { value: "Regional", label: "Regional / State", hint: "Your state" },
  { value: "National", label: "National", hint: "Whole country" },
  { value: "Global", label: "Global", hint: "Everyone" },
  { value: "Remote", label: "Remote", hint: "Location doesn't matter" },
];

export const discoverCategories = ["Creators", "Services", "Opportunities", "Communities", "Events", "Businesses"];

export const locationFilters = ["Nearby • 5 mi", "Local • 25 mi", "City", "State", "Nationwide", "Global"];

export const categoryFilters = ["Music", "Photography", "Video", "Fashion", "Gaming", "Beauty", "Art", "Technology", "Business", "Fitness"];

export const availabilityFilters = ["Available Now", "Available This Week", "Open to Work", "Accepting Clients"];

export const opportunityFilters = ["Paid", "Collaborations", "Local", "Remote", "Creative Projects", "Events"];

/* --------------------------------- radius UI -------------------------------- */

export const radiusOptions = [
  { id: "5", label: "5 mi" },
  { id: "25", label: "25 mi" },
  { id: "city", label: "City +" },
] as const;

export type RadiusId = (typeof radiusOptions)[number]["id"];
