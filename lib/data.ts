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
}

/* ------------------------------ current user ------------------------------ */

export const currentUser: Creator = {
  id: "devin",
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
}

export const opportunities: Opportunity[] = [
  {
    id: "nike-fall",
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
    id: "music-video",
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

export interface UpEvent {
  id: string;
  title: string;
  location: string;
  date: string;
  time: string;
  attending: number;
  price: string;
  image?: string;
  gradient: string;
  emoji: string;
  description: string;
  reach: ReachInfo;
  host: string;
}

export const events: UpEvent[] = [
  {
    id: "meetup",
    title: "UpNova Creator Meetup",
    location: "Baltimore, MD",
    date: "Saturday, August 22",
    time: "7:00 PM",
    attending: 84,
    price: "Free",
    gradient: "from-lime-500/70 to-emerald-800",
    emoji: "🤝",
    image: "/images/event-meetup.jpg",
    description: "Connect with creators in the DMV. Lightning talks, open networking, and free pizza.",
    reach: { location: "Baltimore, MD", reach: "City" },
    host: "UpNova Events",
  },
  {
    id: "networking",
    title: "DMV Music Networking Night",
    location: "Washington, DC",
    date: "Friday, August 28",
    time: "8:00 PM",
    attending: 129,
    price: "$15",
    gradient: "from-violet-600/70 to-fuchsia-900",
    emoji: "🎤",
    image: "/images/event-networking.jpg",
    description: "Artists, producers, and A&Rs in one room. Bring your cards and your best 30 seconds.",
    reach: { location: "DMV", reach: "Local", radius: "25 mi" },
    host: "DMV Creators",
  },
  {
    id: "photo-walk",
    title: "Golden Hour Photo Walk",
    location: "Federal Hill Park, Baltimore",
    date: "Sunday, August 16",
    time: "6:30 PM",
    attending: 22,
    price: "Free",
    gradient: "from-sky-600/70 to-indigo-900",
    emoji: "📷",
    image: "/images/event-photowalk.jpg",
    description: "Casual shoot walk along the waterfront. All skill levels and cameras welcome.",
    reach: { location: "Baltimore, MD", reach: "Nearby", radius: "5 mi" },
    host: "Ava Chen",
  },
];

/* -------------------------------- communities ------------------------------ */

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
}

export const communities: Community[] = [
  {
    id: "dmv",
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
];

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
}

export const conversations: Conversation[] = [
  {
    id: "ava",
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
}

export const portfolio: PortfolioProject[] = [
  {
    id: "p1",
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

export const opportunityFilters = ["Nearby", "Remote", "Paid", "Collaborations", "Brand Deals", "Freelance", "Events", "Full-time"];

/* --------------------------------- radius UI -------------------------------- */

export const radiusOptions = [
  { id: "5", label: "5 mi" },
  { id: "25", label: "25 mi" },
  { id: "city", label: "City +" },
] as const;

export type RadiusId = (typeof radiusOptions)[number]["id"];
