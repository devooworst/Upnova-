/* ------------------------------------------------------------------ */
/*  Development seed data.                                             */
/*                                                                     */
/*  Creates the demo world as REAL users (password: upnova123) so the  */
/*  whole platform is testable end-to-end. Every record is flagged     */
/*  isSeed=true and can be wiped without touching production users:    */
/*                                                                     */
/*    npm run db:seed            # idempotent — skips if already there */
/*    npm run db:seed -- --wipe  # remove ALL seed data                */
/*    npm run db:seed -- --fresh # wipe then reseed                    */
/* ------------------------------------------------------------------ */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import path from "path";
import * as t from "./schema";

const sqlite = new Database(path.join(process.cwd(), "db", "upnova.dev.db"));
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema: t });

const id = () => randomBytes(12).toString("hex");
const PASSWORD = bcrypt.hashSync("upnova123", 10);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
const daysFromNow = (d: number) => new Date(Date.now() + d * 86400_000);

function wipe() {
  // seed users cascade to nearly everything they own
  const seedUsers = db.select().from(t.users).where(eq(t.users.isSeed, true)).all();
  const ids = seedUsers.map((u) => u.id);
  if (ids.length) {
    const seedSet = new Set(ids);

    // records that reference users WITHOUT cascade must go first, in
    // dependency order: reviews/payments/extensions/milestones → projects
    // → bookings → reports → notifications
    const seedProjects = db
      .select()
      .from(t.projects)
      .all()
      .filter((p) => seedSet.has(p.clientId) || seedSet.has(p.creatorId))
      .map((p) => p.id);
    if (seedProjects.length) {
      db.delete(t.reviews).where(inArray(t.reviews.projectId, seedProjects)).run();
      db.delete(t.payments).where(inArray(t.payments.projectId, seedProjects)).run();
      db.delete(t.extensionRequests).where(inArray(t.extensionRequests.projectId, seedProjects)).run();
      db.delete(t.projectMilestones).where(inArray(t.projectMilestones.projectId, seedProjects)).run();
      db.delete(t.projects).where(inArray(t.projects.id, seedProjects)).run();
    }
    db.delete(t.payments).where(inArray(t.payments.payerId, ids)).run();
    db.delete(t.payments).where(inArray(t.payments.payeeId, ids)).run();
    db.delete(t.reviews).where(inArray(t.reviews.authorId, ids)).run();
    db.delete(t.reviews).where(inArray(t.reviews.subjectId, ids)).run();
    db.delete(t.bookings).where(inArray(t.bookings.clientId, ids)).run();
    db.delete(t.bookings).where(inArray(t.bookings.providerId, ids)).run();
    db.delete(t.reports).where(inArray(t.reports.reporterId, ids)).run();
    db.delete(t.notifications).where(inArray(t.notifications.userId, ids)).run();

    // conversations aren't owned — delete ones whose members are all seeds
    const convs = db.select().from(t.conversationMembers).all();
    const byConv = new Map<string, string[]>();
    for (const c of convs) {
      byConv.set(c.conversationId, [...(byConv.get(c.conversationId) ?? []), c.userId]);
    }
    const convIds = Array.from(byConv.entries())
      .filter(([, members]) => members.every((m) => seedSet.has(m)))
      .map(([cid]) => cid);
    if (convIds.length) db.delete(t.conversations).where(inArray(t.conversations.id, convIds)).run();

    // communities must go before their seed creators (createdById has no cascade)
    db.delete(t.communities).where(eq(t.communities.isSeed, true)).run();

    db.delete(t.users).where(inArray(t.users.id, ids)).run();
  } else {
    db.delete(t.communities).where(eq(t.communities.isSeed, true)).run();
  }
  db.delete(t.campuses).where(eq(t.campuses.isSeed, true)).run();
  console.log(`Wiped ${ids.length} seed users and their records.`);
}

function seed() {
  const existing = db.select().from(t.users).where(eq(t.users.handle, "devin")).get();
  if (existing) {
    console.log("Seed data already present — skipping. Use --fresh to reseed.");
    return;
  }

  /* ------------------------------- users ------------------------------- */
  type SeedUser = {
    handle: string;
    name: string;
    role: string;
    extraRoles?: string[];
    bio: string;
    avatar: string | null;
    city: string;
    state: string;
    county: string;
    lat: number;
    lng: number;
    skills: string[];
    interests: string[];
    verified?: boolean;
    trust?: string;
    admin?: boolean;
    business?: boolean;
    bizVerified?: boolean;
  };

  const defs: SeedUser[] = [
    {
      handle: "devin", name: "Devin Carter", role: "Music Producer",
      extraRoles: ["Content Creator", "Entrepreneur"],
      bio: "Building opportunities for creators through music, content, and collaboration. I help artists and brands connect and make things people remember.",
      avatar: "/images/devin.jpg", city: "Baltimore", state: "MD", county: "Baltimore City",
      lat: 39.2904, lng: -76.6122,
      skills: ["Mixing", "Mastering", "Beat Production", "Vocal Production", "Sound Design", "Video Editing"],
      interests: ["Music", "Photography", "Brands", "Events", "Technology"],
      verified: true, trust: "identity", admin: true,
    },
    {
      handle: "ava", name: "Ava Chen", role: "Photographer",
      bio: "Golden hour chaser. Events, portraits, and brand shoots across Baltimore.",
      avatar: "/images/ava.jpg", city: "Baltimore", state: "MD", county: "Baltimore City",
      lat: 39.3043, lng: -76.6163,
      skills: ["Photography", "Photo Editing", "Lightroom", "Event Coverage"],
      interests: ["Photography", "Events", "Fashion"], verified: true, trust: "identity",
    },
    {
      handle: "jordanmiles", name: "Jordan Miles", role: "Music Producer",
      bio: "Atlanta-based producer. 200+ placements. Open for mixing and production work.",
      avatar: "/images/jordan.jpg", city: "Atlanta", state: "GA", county: "Fulton",
      lat: 33.749, lng: -84.388,
      skills: ["Beat Production", "Mixing", "Trap", "R&B"],
      interests: ["Music", "Gaming"], verified: true,
    },
    {
      handle: "marcusj", name: "Marcus Johnson", role: "Videographer",
      bio: "DC-based video. Music videos, brand films, and event recaps.",
      avatar: "/images/marcus.jpg", city: "Washington", state: "DC", county: "District of Columbia",
      lat: 38.9072, lng: -77.0369,
      skills: ["Videography", "Video Editing", "Color Grading", "Drone"],
      interests: ["Film", "Music", "Brands"],
    },
    {
      handle: "nia", name: "Nia Brooks", role: "Student Creator",
      bio: "Bowie State junior. Pet care and campus content. Reliable, on time, always.",
      avatar: "/images/nia.jpg", city: "Towson", state: "MD", county: "Baltimore County",
      lat: 39.4015, lng: -76.6019,
      skills: ["Pet Care", "Content Creation", "Social Media"],
      interests: ["Events", "Photography"], trust: "high-trust",
    },
    {
      handle: "lena", name: "Lena Ortiz", role: "Graphic Designer",
      bio: "Brand identities and cover art. Fully remote, fast turnarounds.",
      avatar: "/images/lena.jpg", city: "New York", state: "NY", county: "Kings",
      lat: 40.6782, lng: -73.9442,
      skills: ["Brand Identity", "Logo Design", "Cover Art", "Typography"],
      interests: ["Art & Design", "Fashion", "Brands"], verified: true,
    },
    {
      handle: "maya", name: "Maya Reyes", role: "Vocalist",
      extraRoles: ["Songwriter"],
      bio: "Session vocals, hooks, and toplines. R&B and pop. Two-day turnarounds.",
      avatar: null, city: "Baltimore", state: "MD", county: "Baltimore City",
      lat: 39.2812, lng: -76.594,
      skills: ["Vocals", "Topline", "Harmonies", "Songwriting"],
      interests: ["Music", "Fashion"], verified: true,
    },
    {
      handle: "kofi", name: "Kofi Boateng", role: "Beat Maker",
      bio: "Drill, trap, and afrobeats. Exclusive licenses only — you own what you buy.",
      avatar: null, city: "Washington", state: "DC", county: "District of Columbia",
      lat: 38.92, lng: -77.02,
      skills: ["Beat Production", "Drill", "Afrobeats", "Sound Design"],
      interests: ["Music", "Gaming"],
    },
    {
      handle: "sofia", name: "Sofia Grant", role: "Stylist",
      extraRoles: ["Fashion Designer"],
      bio: "Editorial styling and custom pieces. Shoots, videos, and artists' looks.",
      avatar: null, city: "Baltimore", state: "MD", county: "Baltimore City",
      lat: 39.31, lng: -76.62,
      skills: ["Styling", "Fashion Design", "Wardrobe", "Editorial"],
      interests: ["Fashion", "Photography", "Art & Design"],
    },
    {
      handle: "tj", name: "TJ Rivers", role: "DJ",
      bio: "Open-format DJ for events, parties, and brand activations. Own full rig.",
      avatar: null, city: "Towson", state: "MD", county: "Baltimore County",
      lat: 39.39, lng: -76.6,
      skills: ["DJ Sets", "Event Audio", "Curation"],
      interests: ["Music", "Events"],
    },
    {
      handle: "imani", name: "Imani Cole", role: "Nail Artist",
      bio: "Bowie State senior. Nail sets on and around campus, book by DM.",
      avatar: null, city: "Bowie", state: "MD", county: "Prince George's",
      lat: 38.9784, lng: -76.7745,
      skills: ["Nail Art", "Gel Sets", "Design"],
      interests: ["Fashion", "Art & Design"], trust: "identity",
    },
    {
      handle: "darius", name: "Darius Webb", role: "Web Designer",
      extraRoles: ["Developer"],
      bio: "Sites for creators and small brands. Design + build, two-week delivery.",
      avatar: null, city: "Philadelphia", state: "PA", county: "Philadelphia",
      lat: 39.9526, lng: -75.1652,
      skills: ["Web Design", "Webflow", "Branding", "Development"],
      interests: ["Technology", "Brands"],
    },
    {
      handle: "rachel", name: "Rachel Kim", role: "Videographer",
      bio: "Fashion films and lookbooks. NYC, travel open for the right project.",
      avatar: null, city: "New York", state: "NY", county: "Kings",
      lat: 40.7128, lng: -74.006,
      skills: ["Videography", "Fashion Film", "Editing"],
      interests: ["Film", "Fashion"], verified: true,
    },
    {
      handle: "nikecreative", name: "Nike Creative", role: "Brand — Sports & Lifestyle",
      bio: "Creative team behind Nike's regional campaigns. We hire local creators for shoots, content, and events.",
      avatar: null, city: "Atlanta", state: "GA", county: "Fulton",
      lat: 33.749, lng: -84.388,
      skills: ["Campaigns", "Content Production", "Events"],
      interests: ["Brands", "Photography", "Film"],
      business: true, bizVerified: true,
    },
    {
      handle: "harboroak", name: "Harbor & Oak", role: "Brand — Coffee & Goods",
      bio: "Baltimore coffee and goods brand. We work with local photographers, designers, and musicians.",
      avatar: null, city: "Baltimore", state: "MD", county: "Baltimore City",
      lat: 39.287, lng: -76.607,
      skills: ["Retail", "Local Events"],
      interests: ["Brands", "Music", "Photography"],
      business: true, bizVerified: false,
    },
    {
      handle: "omar", name: "Omar Diallo", role: "Photographer",
      extraRoles: ["Tutor"],
      bio: "Bowie State junior — portraits, grad shoots, and calculus tutoring.",
      avatar: null, city: "Bowie", state: "MD", county: "Prince George's",
      lat: 38.98, lng: -76.77,
      skills: ["Photography", "Portraits", "Tutoring", "Math"],
      interests: ["Photography", "Education"],
    },
  ];

  const uid: Record<string, string> = {};
  for (const d of defs) {
    const userId = id();
    uid[d.handle] = userId;
    db.insert(t.users)
      .values({
        id: userId,
        email: `${d.handle}@upnova.dev`,
        passwordHash: PASSWORD,
        handle: d.handle,
        role: d.admin ? "admin" : "user",
        accountType: d.business ? "business" : "individual",
        businessVerified: !!d.bizVerified,
        isSeed: true,
      })
      .run();
    db.insert(t.profiles)
      .values({
        id: id(),
        userId,
        displayName: d.name,
        bio: d.bio,
        avatarUrl: d.avatar,
        coverUrl: d.handle === "devin" ? "/images/banner.jpg" : null,
        verified: !!d.verified,
        city: d.city,
        state: d.state,
        county: d.county,
        country: "United States",
        lat: d.lat,
        lng: d.lng,
        primaryRole: d.role,
        additionalRoles: JSON.stringify(d.extraRoles ?? []),
        skills: JSON.stringify(d.skills),
        interests: JSON.stringify(d.interests),
        trustLevel: d.trust ?? "standard",
      })
      .run();
  }

  /* ------------------------------- campus ------------------------------- */
  const campusId = id();
  db.insert(t.campuses)
    .values({ id: campusId, slug: "bowie-state", name: "Bowie State University", city: "Bowie", state: "MD", isSeed: true })
    .run();
  for (const [handle, program] of [["devin", "Cybersecurity"], ["nia", "Communications"], ["imani", "Business"], ["omar", "Mathematics"]] as const) {
    db.insert(t.campusVerifications)
      .values({ id: id(), userId: uid[handle], campusId, status: "verified", program, gradYear: "2027", verifiedAt: new Date() })
      .run();
  }

  /* ------------------------------ follows ------------------------------ */
  const followPairs: [string, string][] = [
    ["devin", "jordanmiles"], ["devin", "ava"], ["devin", "marcusj"],
    ["ava", "devin"], ["jordanmiles", "devin"], ["nia", "devin"],
    ["marcusj", "devin"], ["lena", "devin"], ["ava", "lena"], ["nia", "ava"],
    ["devin", "lena"], ["devin", "maya"], ["maya", "devin"], ["kofi", "jordanmiles"],
    ["sofia", "ava"], ["tj", "devin"], ["imani", "nia"], ["omar", "nia"],
    ["rachel", "sofia"], ["darius", "lena"], ["ava", "sofia"], ["jordanmiles", "maya"],
  ];
  for (const [a, b] of followPairs)
    db.insert(t.follows).values({ followerId: uid[a], followingId: uid[b] }).run();

  /* ----------------------------- communities ----------------------------- */
  const communityDefs = [
    { slug: "baltimore-creators", name: "Baltimore Creators", desc: "Creators building in and around Baltimore.", owner: "devin" },
    { slug: "music-producers", name: "Music Producers", desc: "Production, mixing, placements, and feedback.", owner: "jordanmiles" },
    { slug: "photo-video", name: "Photo & Video", desc: "Shoots, gear, edits, and collabs.", owner: "ava" },
  ];
  const cid: Record<string, string> = {};
  for (const c of communityDefs) {
    const communityId = id();
    cid[c.slug] = communityId;
    db.insert(t.communities)
      .values({ id: communityId, slug: c.slug, name: c.name, description: c.desc, createdById: uid[c.owner], isSeed: true })
      .run();
    db.insert(t.communityMembers).values({ communityId, userId: uid[c.owner], role: "owner" }).run();
  }
  const memberships: [string, string][] = [
    ["baltimore-creators", "ava"], ["baltimore-creators", "nia"], ["baltimore-creators", "marcusj"],
    ["music-producers", "devin"], ["photo-video", "devin"], ["photo-video", "marcusj"],
  ];
  for (const [slug, handle] of memberships)
    db.insert(t.communityMembers).values({ communityId: cid[slug], userId: uid[handle] }).run();

  /* ------------------------------ services ------------------------------ */
  const serviceDefs = [
    { owner: "devin", title: "Music Production", price: 300, desc: "Custom production, recording, mixing and arrangement.", reach: "Nationwide / Remote", ai: "disclosure" },
    { owner: "devin", title: "Video Editing", price: 200, desc: "Reels, music videos, and long-form edits with color and sound design.", reach: "Nationwide / Remote", ai: "assisted" },
    { owner: "devin", title: "Songwriting", price: 150, desc: "Hooks, toplines, and full lyrics tailored to your record.", reach: "Global / Remote", ai: "no-ai" },
    { owner: "ava", title: "Event Photography", price: 250, desc: "Events, portraits, and content shoots in the Baltimore area.", reach: "Baltimore · 10 mi", ai: "no-ai", category: "photography" },
    { owner: "jordanmiles", title: "Mixing & Mastering", price: 180, desc: "Radio-ready mixes with two rounds of revisions.", reach: "Remote", ai: "disclosure" },
    { owner: "lena", title: "Brand Identity", price: 180, desc: "Logo, palette, and brand guide for creators and small brands.", reach: "Remote", ai: "client-decides" },
    { owner: "marcusj", title: "Music Video Production", price: 450, desc: "Concept-to-delivery music videos in the DMV.", reach: "DMV · 40 mi", ai: "no-ai" },
    { owner: "nia", title: "Dog Walking", price: 25, desc: "Weekday walks in Towson and North Baltimore.", reach: "Towson · 5 mi", ai: "no-ai", category: "care", trust: "high-trust" },
    { owner: "nia", title: "Weekend Dog Sitter", price: 120, desc: "Overnight sitting at your place, daily photo updates.", reach: "Towson · 10 mi", ai: "no-ai", category: "care", trust: "high-trust" },
    { owner: "maya", title: "Session Vocals", price: 200, desc: "Lead vocals for your record — hook and one verse, comped and tuned.", reach: "Remote", ai: "no-ai", category: "music" },
    { owner: "maya", title: "Topline Writing", price: 160, desc: "Melody and lyrics written to your beat, demo vocal included.", reach: "Remote", ai: "no-ai", category: "music" },
    { owner: "kofi", title: "Custom Beat — Exclusive", price: 250, desc: "Made-to-order beat, exclusive license, stems included.", reach: "Remote", ai: "disclosure", category: "music", promoted: true },
    { owner: "kofi", title: "Drum Kit — Producer Pack", price: 40, desc: "300 originals: drums, 808s, textures. Royalty-free.", reach: "Remote", ai: "disclosure", category: "music" },
    { owner: "sofia", title: "Shoot Styling", price: 220, desc: "Full wardrobe styling for your shoot — pull, fit, on-set.", reach: "Baltimore · 20 mi", ai: "no-ai", category: "fashion" },
    { owner: "sofia", title: "Custom Piece", price: 350, desc: "One-of-one garment designed and made for your event or video.", reach: "Baltimore · 20 mi", ai: "no-ai", category: "fashion" },
    { owner: "tj", title: "Event DJ — 4 Hours", price: 400, desc: "Open format, full rig, MC-ready. Books 2 weeks out.", reach: "DMV · 40 mi", ai: "no-ai", category: "events" },
    { owner: "imani", title: "Gel Nail Set", price: 55, desc: "Full gel set with custom design. On campus or nearby.", reach: "Bowie · 5 mi", ai: "no-ai", category: "beauty" },
    { owner: "darius", title: "Creator Website", price: 300, desc: "One-page site: portfolio, booking link, socials. Live in 10 days.", reach: "Remote", ai: "assisted", category: "design" },
    { owner: "darius", title: "Full Brand Site", price: 750, desc: "Multi-page site with CMS, SEO basics, and analytics.", reach: "Remote", ai: "assisted", category: "design" },
    { owner: "rachel", title: "Fashion Film", price: 600, desc: "60–90s fashion film: concept, shoot, edit, color.", reach: "NYC · travel open", ai: "no-ai", category: "video" },
    { owner: "omar", title: "Portrait Session", price: 90, desc: "45-minute portrait or grad session, 15 edited photos.", reach: "Bowie · 15 mi", ai: "no-ai", category: "photography" },
    { owner: "omar", title: "Calculus Tutoring", price: 30, desc: "1-hour session, Calc I & II. Campus library or online.", reach: "Bowie / Remote", ai: "no-ai", category: "education" },
  ];
  const sid: Record<string, string> = {};
  for (const s of serviceDefs) {
    const serviceId = id();
    sid[`${s.owner}:${s.title}`] = serviceId;
    const cat = (s as { category?: string }).category ?? "creative";
    // creator-defined business rules — each provider operates differently
    const CONFIGS: Record<string, object> = {
      "imani:Gel Nail Set": {
        locationMode: "my_location",
        travel: { mode: "none" },
        scheduling: { durationMin: 90, maxPerDay: 4 },
        policies: { cancellation: "free_24h", reschedule: "one_free", lateGraceMin: 15, lateFee: 10, noShow: "partial" },
        requirements: ["Photos"],
      },
      "nia:Dog Walking": {
        locationMode: "client_location",
        travel: { mode: "free", radiusMi: 10 },
        scheduling: { durationMin: 60, maxPerDay: 6 },
        policies: { cancellation: "anytime", reschedule: "free", lateGraceMin: 10, lateFee: 0, noShow: "none" },
        requirements: ["Special instructions"],
      },
      "ava:Event Photography": {
        locationMode: "both",
        travel: { mode: "per_mile", perMile: 2, freeMiles: 5, radiusMi: 25 },
        scheduling: { durationMin: 180, maxPerDay: 2 },
        policies: { cancellation: "partial_48h", reschedule: "one_free", lateGraceMin: 15, lateFee: 25, noShow: "partial" },
        requirements: ["References", "Special instructions"],
      },
      "tj:Event DJ — 4 Hours": {
        locationMode: "client_location",
        travel: { mode: "flat", flatFee: 25, radiusMi: 40 },
        scheduling: { durationMin: 240, maxPerDay: 1 },
        policies: { cancellation: "partial_48h", reschedule: "approval", lateGraceMin: 0, lateFee: 0, noShow: "full" },
        requirements: ["Special instructions"],
      },
      "omar:Portrait Session": {
        locationMode: "both",
        travel: { mode: "free", radiusMi: 15 },
        scheduling: { durationMin: 45, maxPerDay: 5 },
        policies: { cancellation: "free_24h", reschedule: "free", lateGraceMin: 10, lateFee: 0, noShow: "none" },
        requirements: [],
      },
    };
    const cfg = CONFIGS[`${s.owner}:${s.title}`];
    db.insert(t.services)
      .values({
        id: serviceId, ownerId: uid[s.owner], title: s.title, description: s.desc,
        price: s.price, reach: s.reach, aiPolicy: s.ai,
        category: cat,
        trustRequired: (s as { trust?: string }).trust ?? "standard",
        // hair/nails/pet care/photo sessions/DJ sets book time slots;
        // design/production/builds stay project requests
        fulfillment: ["care", "beauty", "events", "photography", "education"].includes(cat) ? "appointment" : "project",
        config: cfg ? JSON.stringify(cfg) : "{}",
        promoted: !!(s as { promoted?: boolean }).promoted,
        isSeed: true,
      })
      .run();
  }

  /* ---------------------------- opportunities ---------------------------- */
  const oppDefs = [
    { poster: "ava", title: "Second Shooter — Creator Meetup", budget: 300, loc: "Baltimore, MD", type: "gig", event: 12, apply: 7, desc: "Need a second photographer for a 150-person creator meetup. 4 hours, gear provided if needed." },
    { poster: "jordanmiles", title: "Vocalist for R&B Single", budget: 250, loc: "Remote", type: "gig", remote: true, desc: "Cutting an R&B single — need a vocalist for the hook and one verse. Credits + payment." },
    { poster: "marcusj", title: "BTS Videographer — Brand Shoot", budget: 400, loc: "Washington, DC", type: "gig", event: 9, apply: 5, desc: "Full-day brand shoot needs behind-the-scenes coverage and a 60-second recap." },
    { poster: "lena", title: "Collab: Zine Design + Photography", budget: null, loc: "Remote", type: "collab", remote: true, desc: "Designing a 24-page creator zine — looking for a photographer to co-create. Split ownership." },
    { poster: "nia", title: "Campus Event Photographer", budget: 120, loc: "Bowie, MD", type: "campus", event: 6, apply: 4, student: true, desc: "Homecoming week event needs a photographer for 3 hours. Student-friendly, flexible with class schedules." },
    { poster: "sofia", title: "Lookbook Photographer", budget: 350, loc: "Baltimore, MD", type: "gig", event: 14, apply: 8, desc: "12-piece capsule needs a clean lookbook. Studio booked, need the eye." },
    { poster: "tj", title: "Party Photographer + Recap", budget: 200, loc: "Towson, MD", type: "gig", event: 8, apply: 5, student: true, desc: "Photos during the set + a 30-second recap reel within 48 hours." },
    { poster: "maya", title: "Producer for EP — 3 Tracks", budget: 700, loc: "Remote", type: "gig", remote: true, desc: "R&B EP, three tracks. Send your strongest similar work when you apply." },
    { poster: "kofi", title: "Collab: Loop Pack Vol. 2", budget: null, loc: "Remote", type: "collab", remote: true, desc: "Splitting a 40-loop pack with one melodic producer. 50/50 on revenue." },
    { poster: "darius", title: "Logo Animation", budget: 150, loc: "Remote", type: "gig", remote: true, desc: "Animate a client's finished logo — 5s sting, After Effects or similar." },
    { poster: "rachel", title: "Fashion Film BTS Photographer", budget: 280, loc: "New York, NY", type: "gig", event: 11, apply: 6, desc: "Stills on set of a two-day fashion film shoot in Brooklyn." },
    { poster: "imani", title: "Campus Brand Ambassadors", budget: 80, loc: "Bowie, MD", type: "campus", student: true, apply: 6, desc: "Rep a student beauty brand at three campus events this month." },
    { poster: "omar", title: "Collab: Grad Season Mini-Sessions", budget: null, loc: "Bowie, MD", type: "collab", student: true, desc: "Pairing with a second photographer to run grad mini-sessions — split bookings." },
    { poster: "lena", title: "Icon Set — 24 Icons", budget: 240, loc: "Remote", type: "gig", remote: true, apply: 9, desc: "Custom icon set for a client dashboard, consistent 2px stroke style." },
    { poster: "marcusj", title: "Drone Operator — Music Video", budget: 300, loc: "Washington, DC", type: "gig", event: 10, apply: 6, desc: "Licensed drone op for three exterior shots. Half-day." },
    { poster: "nikecreative", title: "Nike Fall Campaign", budget: 2400, loc: "Atlanta, GA", type: "gig", event: 20, apply: 12, desc: "Regional fall campaign: models and videographers for a two-day shoot. Usage rights covered in the project terms. Travel not included." },
    { poster: "nikecreative", title: "Campaign BTS Photographer", budget: 600, loc: "Atlanta, GA", type: "gig", event: 20, apply: 12, desc: "Stills coverage across both shoot days for internal and social use." },
    { poster: "harboroak", title: "Fall Menu Content Shoot", budget: 450, loc: "Baltimore, MD", type: "gig", event: 13, apply: 8, desc: "Photograph the fall menu + 3 short verticals for social. Half-day at the Fells Point shop." },
  ];
  const oid: Record<string, string> = {};
  for (const o of oppDefs) {
    const oppId = id();
    oid[o.title] = oppId;
    db.insert(t.opportunities)
      .values({
        id: oppId, posterId: uid[o.poster], title: o.title, description: o.desc,
        budget: o.budget, type: o.type, location: o.loc,
        remote: !!(o as { remote?: boolean }).remote,
        studentFriendly: !!(o as { student?: boolean }).student,
        applyBy: (o as { apply?: number }).apply ? daysFromNow((o as { apply?: number }).apply!) : null,
        eventDate: (o as { event?: number }).event ? daysFromNow((o as { event?: number }).event!) : null,
        lat: uid[o.poster] ? defs.find((d) => d.handle === o.poster)!.lat : null,
        lng: uid[o.poster] ? defs.find((d) => d.handle === o.poster)!.lng : null,
        isSeed: true,
      })
      .run();
  }

  // applications to Ava's opportunity → powers the applicant-review screen
  db.insert(t.applications).values({
    id: id(), opportunityId: oid["Second Shooter — Creator Meetup"], applicantId: uid["marcusj"],
    message: "I shoot events weekly in the DMV — portfolio on my profile. Can bring a second body + flash.",
    availability: "yes",
  }).run();
  db.insert(t.applications).values({
    id: id(), opportunityId: oid["Second Shooter — Creator Meetup"], applicantId: uid["nia"],
    message: "I'd love this — I've covered three campus events this semester.",
    availability: "need_check",
  }).run();

  /* -------------------------------- posts -------------------------------- */
  const postDefs: { author: string; body: string; hours: number; image?: string; likes: string[]; comments: [string, string][]; kind?: string; cat?: string; sub?: string }[] = [
    { author: "ava", body: "Golden hour session from Saturday's rooftop shoot. Baltimore skies never miss. 📸", hours: 5, image: "/images/studio-post.jpg", likes: ["devin", "nia", "lena", "marcusj", "sofia"], comments: [["devin", "These are unreal. That third frame 🔥"], ["lena", "The color grading on this set >>>"]], kind: "work", cat: "Photography", sub: "Golden hour" },
    { author: "jordanmiles", body: "New loop pack drops Friday. 40 originals, all clearable. Producers — tags off, stems included.", hours: 9, likes: ["devin", "marcusj"], comments: [["devin", "Need that. Sending you something Monday."]], kind: "announcement", cat: "Beats" },
    { author: "devin", body: "Wrapped mixing on an EP for an artist I found ON this app. From DM to delivered masters in 12 days. This is what the platform is for.", hours: 14, likes: ["ava", "jordanmiles", "nia", "lena"], comments: [["ava", "This is the way it should work."], ["jordanmiles", "12 days is crazy turnaround 🔥"]] },
    { author: "nia", body: "Anyone on campus need event coverage during homecoming week? Booking now, student rates. DM me.", hours: 22, likes: ["devin", "ava"], comments: [], kind: "promotion", cat: "Content" },
    { author: "marcusj", body: "Color graded 4 music videos this week. If your footage looks flat, it's not your camera — it's your grade. Happy to consult.", hours: 30, likes: ["devin"], comments: [["jordanmiles", "Facts. Grade makes the video."]] },
    { author: "lena", body: "Brand identity delivered for a Baltimore coffee brand today. Logo, palette, menus, cups. Small brands deserve big design.", hours: 44, image: "/images/portfolio-spotify.jpg", likes: ["ava", "devin", "nia", "darius"], comments: [["ava", "The cup design is so clean"]], kind: "work", cat: "Brand Identity" },
    { author: "maya", body: "Cut vocals for three records this week. If your hook feels empty, it's not the melody — it's the stacks. Layer, then layer again.", hours: 3, likes: ["devin", "jordanmiles", "kofi"], comments: [["jordanmiles", "Stacks are everything 💯"]], kind: "work", cat: "Vocals" },
    { author: "kofi", body: "Sold my first exclusive through UpNova today. Buyer found me through the 25-mile feed. Local-first actually works.", hours: 7, likes: ["devin", "jordanmiles", "maya", "tj"], comments: [["devin", "This is exactly the point. Congrats!"]] },
    { author: "sofia", body: "Styled a 12-look editorial in one day. Pull list, steamer, three racks, zero panic. Ask me about shoot styling.", hours: 11, image: "/images/community-streetwear.jpg", likes: ["ava", "rachel", "lena"], comments: [["rachel", "The silhouettes in look 7 😍"]], kind: "work", cat: "Styling", sub: "Editorial" },
    { author: "tj", body: "Rooftop set this Friday. Bringing the full rig. If you're a photographer who wants event shots for your portfolio, pull up — trade content.", hours: 16, likes: ["devin", "nia", "omar"], comments: [["omar", "I might pull up with the 35mm"]] },
    { author: "imani", body: "Booked out for homecoming week already 💅 Waitlist is open — campus people get priority.", hours: 20, likes: ["nia", "omar"], comments: [], kind: "announcement", cat: "Nails" },
    { author: "darius", body: "Shipped a creator site in 9 days. Portfolio, booking, and a merch page. Your link-in-bio deserves better than a list of links.", hours: 27, likes: ["lena", "devin", "kofi"], comments: [["lena", "The type choices on this one are great"]], kind: "work", cat: "Websites" },
    { author: "rachel", body: "Fashion film premiere next month. Two years of learning color inside one 90-second cut.", hours: 33, image: "/images/community-film.jpg", likes: ["sofia", "marcusj", "ava"], comments: [["marcusj", "Can't wait to see the grade"]], kind: "bts", cat: "Fashion Film" },
    { author: "omar", body: "Grad season is coming. Booking portrait slots for April now — campus rate stays $90.", hours: 38, likes: ["nia", "imani", "devin"], comments: [["imani", "Booking for my sister 🙌"]] },
    { author: "jordanmiles", body: "Placement news I can finally share: two records on a major project this fall. Everything routed through verified UpNova work. Keep your history clean.", hours: 50, image: "/images/beat-cover.jpg", likes: ["devin", "kofi", "maya", "marcusj", "ava"], comments: [["kofi", "Inspiring fr"], ["maya", "Huge!! 🎉"]] },
    { author: "ava", body: "PSA for new photographers: your rate is not just the shoot. It's the edit, the gear, the years. Price the whole thing.", hours: 55, likes: ["omar", "sofia", "devin", "rachel"], comments: [["omar", "Needed this today"]] },
    { author: "nia", body: "Dog sitting this weekend booked through my UpNova listing. Verified profile made the difference — the client said so directly.", hours: 60, likes: ["devin", "ava"], comments: [] },
    { author: "marcusj", body: "Three-camera live session edit delivered. Multicam is a cheat code for artists who hate reshoots.", hours: 70, image: "/images/event-afterdark.jpg", likes: ["jordanmiles", "devin", "rachel"], comments: [], kind: "work", cat: "Video", sub: "Multicam" },
    { author: "devin", body: "Studio day. Two mixes, one master, and a rough for something special. The 'Open to Work' badge stays on for a reason.", hours: 80, likes: ["ava", "maya", "jordanmiles", "tj", "kofi"], comments: [["maya", "That rough better be ours 👀"]], kind: "bts", cat: "Production" },
  ];
  const postIds: string[] = [];
  for (const p of postDefs) {
    const postId = id();
    postIds.push(postId);
    db.insert(t.posts)
      .values({
        id: postId, authorId: uid[p.author], body: p.body, imageUrl: p.image ?? null,
        kind: p.kind ?? "post", category: p.cat ?? "", subcategory: p.sub ?? "",
        isSeed: true, createdAt: hoursAgo(p.hours),
      })
      .run();
    for (const liker of p.likes) db.insert(t.likes).values({ postId, userId: uid[liker] }).run();
    for (const [commenter, text] of p.comments)
      db.insert(t.comments).values({ id: id(), postId, authorId: uid[commenter], body: text, createdAt: hoursAgo(p.hours - 1) }).run();
  }

  /* --------------------------- conversations --------------------------- */
  function makeConversation(a: string, b: string, msgs: [string, string, number][]) {
    const convId = id();
    db.insert(t.conversations).values({ id: convId }).run();
    db.insert(t.conversationMembers).values([
      { conversationId: convId, userId: uid[a] },
      { conversationId: convId, userId: uid[b] },
    ]).run();
    for (const [sender, body, h] of msgs)
      db.insert(t.messages)
        .values({ id: id(), conversationId: convId, senderId: uid[sender], body, createdAt: hoursAgo(h) })
        .run();
    return convId;
  }

  const convAva = makeConversation("ava", "devin", [
    ["ava", "Hey Devin! I need audio for a brand video — 45 seconds, upbeat but not cheesy. Your Music Production service looks perfect.", 50],
    ["devin", "Hey Ava! Love that brief. I can have a first pass to you in 4 days. Listed rate covers two revisions.", 49],
    ["ava", "Perfect — send the offer through and let's do it.", 48],
    ["devin", "Offer sent. Once you accept and payment's secured I'll start same day.", 47],
    ["ava", "Accepted and funded! Excited for this one 🎵", 46],
  ]);
  const convJordan = makeConversation("jordanmiles", "devin", [
    ["jordanmiles", "Yo — got a single that needs your mix. R&B, 34 tracks, stems are clean.", 26],
    ["devin", "Send the reference and I'm in. My mixing runs through my Music Production listing.", 25],
    ["jordanmiles", "Reference sent. Offer me the usual.", 24],
  ]);
  makeConversation("lena", "devin", [
    ["devin", "Hi Lena! I'm interested in your Brand Identity service.", 5],
    ["lena", "Hey! Absolutely. What kind of brand are you building?", 5],
    ["devin", "I'm working on a creator platform called UpNova.", 4],
    ["lena", "That sounds interesting. I can definitely help with the visual identity.", 4],
    ["devin", "What would you need from me to get started?", 3],
    ["lena", "I'll send over a project proposal with the scope and price — or you can open a project right from this chat whenever you're ready.", 3],
  ]);
  const convNia = makeConversation("nia", "devin", [
    ["nia", "Hi! Saw you verified for Bowie State too — I'm covering homecoming and could use a hype track for the recap. Budget is small but real: $150.", 8],
    ["devin", "Student to student — done. Send me the vibe you want.", 7],
  ]);

  /* ------------------------------ projects ------------------------------ */
  // 1. Ava × Devin — in_progress with a PENDING extension request (persistent!)
  const projAva = id();
  db.insert(t.projects).values({
    id: projAva, clientId: uid["ava"], creatorId: uid["devin"], serviceId: sid["devin:Music Production"],
    conversationId: convAva, title: "Brand Video Audio — 45s", brief: "Upbeat 45-second track for a rooftop brand video. Two revisions included.",
    amount: 300, state: "in_progress", deadline: daysFromNow(4), isSeed: true,
  }).run();
  db.insert(t.payments).values({
    id: id(), projectId: projAva, payerId: uid["ava"], payeeId: uid["devin"],
    amountCents: 30000, feeCents: 1500, status: "held",
  }).run();
  db.insert(t.extensionRequests).values({
    id: id(), projectId: projAva, requestedById: uid["devin"], days: 2,
    reason: "Vocal comps took longer than planned — want the extra polish pass.", status: "pending",
  }).run();
  db.update(t.projects).set({ state: "extension_requested" }).where(eq(t.projects.id, projAva)).run();

  // 2. Jordan × Devin — offer_sent, waiting on Jordan
  db.insert(t.projects).values({
    id: id(), clientId: uid["jordanmiles"], creatorId: uid["devin"], serviceId: sid["devin:Music Production"],
    conversationId: convJordan, title: "Single Mix — R&B", brief: "Full mix on a 34-track session, one master included.",
    amount: 220, state: "offer_sent", deadline: daysFromNow(7), isSeed: true,
  }).run();

  // 3. Nia × Devin — completed + mutually reviewed
  const projNia = id();
  db.insert(t.projects).values({
    id: projNia, clientId: uid["nia"], creatorId: uid["devin"],
    conversationId: convNia, title: "Homecoming Recap Track", brief: "30-second hype track for the homecoming recap edit.",
    amount: 150, state: "reviewed", isSeed: true, createdAt: hoursAgo(24 * 20),
  }).run();
  db.insert(t.payments).values({
    id: id(), projectId: projNia, payerId: uid["nia"], payeeId: uid["devin"],
    amountCents: 15000, feeCents: 750, status: "released",
  }).run();
  db.insert(t.reviews).values({
    id: id(), projectId: projNia, authorId: uid["nia"], subjectId: uid["devin"],
    rating: 5, body: "Delivered early and it slaps. The whole recap is built around this track.",
  }).run();
  db.insert(t.reviews).values({
    id: id(), projectId: projNia, authorId: uid["devin"], subjectId: uid["nia"],
    rating: 5, body: "Clear brief, instant feedback, instant payment. Ideal client.",
  }).run();

  // 4. Ava (client) × Lena (creator) — completed & reviewed
  const projAvaLena = id();
  db.insert(t.projects).values({
    id: projAvaLena, clientId: uid["ava"], creatorId: uid["lena"],
    serviceId: sid["lena:Brand Identity"], title: "Photography Brand Refresh",
    brief: "Logo refinement + palette for Ava's photo brand.",
    amount: 180, state: "reviewed", isSeed: true, createdAt: hoursAgo(24 * 40),
  }).run();
  db.insert(t.payments).values({
    id: id(), projectId: projAvaLena, payerId: uid["ava"], payeeId: uid["lena"],
    amountCents: 18000, feeCents: 900, status: "released",
  }).run();
  db.insert(t.reviews).values({
    id: id(), projectId: projAvaLena, authorId: uid["ava"], subjectId: uid["lena"],
    rating: 5, body: "Lena understood the brand in one call. The refresh doubled my inquiry rate.",
  }).run();
  db.insert(t.reviews).values({
    id: id(), projectId: projAvaLena, authorId: uid["lena"], subjectId: uid["ava"],
    rating: 5, body: "Dream client — decisive and fast with feedback.",
  }).run();

  // 5. Marcus (client) × Jordan (creator) — completed & reviewed
  const projMJ = id();
  db.insert(t.projects).values({
    id: projMJ, clientId: uid["marcusj"], creatorId: uid["jordanmiles"],
    serviceId: sid["jordanmiles:Mixing & Mastering"], title: "Session Video Audio Mix",
    brief: "Mix and master the audio for a three-camera live session.",
    amount: 180, state: "reviewed", isSeed: true, createdAt: hoursAgo(24 * 25),
  }).run();
  db.insert(t.payments).values({
    id: id(), projectId: projMJ, payerId: uid["marcusj"], payeeId: uid["jordanmiles"],
    amountCents: 18000, feeCents: 900, status: "released",
  }).run();
  db.insert(t.reviews).values({
    id: id(), projectId: projMJ, authorId: uid["marcusj"], subjectId: uid["jordanmiles"],
    rating: 4.8, body: "Clean mix, one revision, delivered a day early.",
  }).run();
  db.insert(t.reviews).values({
    id: id(), projectId: projMJ, authorId: uid["jordanmiles"], subjectId: uid["marcusj"],
    rating: 5, body: "Stems were organized perfectly. Easy work.",
  }).run();

  // 6. Devin as CLIENT × Marcus (creator) — in progress, payment held
  const convMarcus = makeConversation("marcusj", "devin", [
    ["devin", "Marcus — need a 60-second recap video from the meetup footage. Same style as your last one.", 30],
    ["marcusj", "Got the drives already. Offer's up — once it's funded I'll start the cut.", 29],
    ["devin", "Funded. Take it away.", 28],
  ]);
  const projMarcus = id();
  db.insert(t.projects).values({
    id: projMarcus, clientId: uid["devin"], creatorId: uid["marcusj"],
    conversationId: convMarcus, title: "Meetup Recap Video — 60s",
    brief: "One-minute recap from the creator meetup, color graded, licensed music.",
    amount: 250, state: "in_progress", deadline: daysFromNow(6), isSeed: true,
  }).run();
  db.insert(t.payments).values({
    id: id(), projectId: projMarcus, payerId: uid["devin"], payeeId: uid["marcusj"],
    amountCents: 25000, feeCents: 1250, status: "held",
  }).run();

  /* ------------------------------ bookmarks ------------------------------ */
  db.insert(t.bookmarks).values([
    { userId: uid["devin"], targetType: "post", targetId: postIds[0] },
    { userId: uid["devin"], targetType: "opportunity", targetId: oid["Lookbook Photographer"] },
    { userId: uid["devin"], targetType: "service", targetId: sid["lena:Brand Identity"] },
  ]).run();

  /* ------------------------------ bookings ------------------------------ */
  /* A real calendar month: requested → accepted → confirmed → completed,
     plus a reschedule and a cancellation. Confirmed = payment secured.  */
  const at = (days: number, hour: number, min = 0) => {
    const d = daysFromNow(days);
    d.setHours(hour, min, 0, 0);
    return d;
  };
  const mkBooking = (o: {
    service?: string; client: string; provider: string; title: string;
    starts: Date; dur: number; price: number; loc: string; status: string; proposed?: Date;
  }) => {
    const bid = id();
    db.insert(t.bookings).values({
      id: bid, serviceId: o.service ? sid[o.service] : null, clientId: uid[o.client], providerId: uid[o.provider],
      title: o.title, startsAt: o.starts, durationMin: o.dur, price: o.price,
      location: o.loc, status: o.status, proposedStartsAt: o.proposed ?? null, isSeed: true,
    }).run();
    if (["confirmed", "completed"].includes(o.status)) {
      db.insert(t.payments).values({
        id: id(), bookingId: bid, payerId: uid[o.client], payeeId: uid[o.provider],
        amountCents: o.price * 100, feeCents: o.price * 5,
        status: o.status === "completed" ? "released" : "held",
      }).run();
    }
    return bid;
  };

  // devin as PROVIDER — his calendar fills up
  mkBooking({ service: "devin:Music Production", client: "maya", provider: "devin", title: "Music Production", starts: at(1, 14), dur: 180, price: 300, loc: "Devin's studio", status: "pending" });
  mkBooking({ service: "devin:Music Production", client: "marcusj", provider: "devin", title: "Music Production", starts: at(5, 10), dur: 240, price: 300, loc: "Devin's studio", status: "confirmed" });
  mkBooking({ service: "devin:Songwriting", client: "kofi", provider: "devin", title: "Songwriting", starts: at(8, 15), dur: 120, price: 150, loc: "Remote session", status: "accepted" });
  mkBooking({ service: "devin:Music Production", client: "jordanmiles", provider: "devin", title: "Music Production", starts: at(-4, 11), dur: 240, price: 300, loc: "Devin's studio", status: "completed" });
  mkBooking({ service: "devin:Songwriting", client: "tj", provider: "devin", title: "Songwriting", starts: at(-9, 13), dur: 120, price: 150, loc: "Remote session", status: "completed" });
  // devin as CLIENT
  mkBooking({ service: "ava:Event Photography", client: "devin", provider: "ava", title: "Event Photography", starts: at(3, 17), dur: 180, price: 250, loc: "Rooftop — Fells Point", status: "confirmed" });
  mkBooking({ service: "imani:Gel Nail Set", client: "devin", provider: "imani", title: "Gel Nail Set (gift booking)", starts: at(6, 10), dur: 90, price: 55, loc: "Bowie campus", status: "reschedule_requested", proposed: at(7, 10) });
  mkBooking({ service: "tj:Event DJ — 4 Hours", client: "devin", provider: "tj", title: "Event DJ — 4 Hours", starts: at(-2, 20), dur: 240, price: 400, loc: "The Assembly Room", status: "cancelled" });

  /* ------------------------- portfolio / experience ------------------------- */
  db.insert(t.portfolioItems).values([
    { id: id(), userId: uid["devin"], title: "Homecoming Recap Track", kind: "upnova_project", projectId: projNia, client: "Nia Brooks" },
    { id: id(), userId: uid["devin"], title: "Nike Fall Campaign", kind: "video", client: "Nike", aiInvolvement: "none" },
    { id: id(), userId: uid["ava"], title: "Rooftop Golden Hour Series", kind: "image", mediaUrl: "/images/post-photo.jpg" },
  ]).run();
  db.insert(t.experiences).values([
    { id: id(), userId: uid["devin"], position: "Music Producer", organization: "Independent", start: "2021", description: "80+ releases produced for independent artists.", location: "Baltimore, MD", order: 0 },
    { id: id(), userId: uid["devin"], position: "Brand Collaborations", organization: "Nike, Spotify & independent brands", start: "2022", description: "Campaign audio and content for 12+ brands.", order: 1 },
    { id: id(), userId: uid["devin"], position: "Freelance Video Editor", organization: "Self-employed", start: "2020", description: "Reels, music videos, and recap films.", order: 2 },
  ]).run();

  /* -------------------------------- events -------------------------------- */
  const eventDefs = [
    { slug: "meetup", host: "devin", title: "UpNova Creator Meetup", time: "7:00 PM", loc: "The Assembly Room", city: "Baltimore, MD", days: 15, price: null, cap: 150, att: 84, img: "/images/event-meetup.jpg", kind: "rsvp", desc: "Meet the creators you keep seeing in your feed. Demos, collabs, and a live showcase." },
    { slug: "networking", host: "tj", title: "DMV Music Networking Night", time: "8:00 PM", loc: "Union Stage", city: "Washington, DC", days: 21, price: 15, cap: 200, att: 132, img: "/images/event-networking.jpg", kind: "ticket", desc: "Producers, artists, engineers, and managers in one room. Bring business cards." },
    { slug: "photo-walk", host: "ava", title: "Golden Hour Photo Walk", time: "6:30 PM", loc: "Federal Hill Park", city: "Baltimore, MD", days: 9, price: null, cap: 40, att: 27, img: "/images/event-photowalk.jpg", kind: "registration", desc: "All levels. Bring any camera — we shoot the skyline at golden hour, then compare edits." },
    { slug: "after-dark", host: "tj", title: "After Dark — Rooftop Set", time: "10:00 PM", loc: "Rooftop at The Crown", city: "Baltimore, MD", days: 12, price: 25, cap: 180, att: 164, img: "/images/event-afterdark.jpg", kind: "ticket", age: "21+", desc: "Full rig on the roof. Photographers welcome — trade content for entry." },
    { slug: "workshop", host: "lena", title: "Brand Design Workshop", time: "1:00 PM", loc: "Open Works", city: "Baltimore, MD", days: 18, price: 40, cap: 30, att: 22, img: "/images/event-workshop.jpg", kind: "registration", desc: "Hands-on: build a one-page brand system in three hours. Laptops required." },
  ];
  for (const e of eventDefs) {
    db.insert(t.events)
      .values({
        id: e.slug, // slug ids so the existing /events/[slug] detail pages resolve
        slug: e.slug,
        hostId: uid[e.host],
        title: e.title,
        description: e.desc,
        startsAt: daysFromNow(e.days),
        timeLabel: e.time,
        location: `${e.loc}, ${e.city}`,
        city: e.city,
        price: e.price,
        capacity: e.cap,
        attending: e.att,
        imageUrl: e.img,
        kind: e.kind,
        ageRule: (e as { age?: string }).age ?? "all",
        isSeed: true,
      })
      .run();
  }

  /* ---------------------------- notifications ---------------------------- */
  // deterministic, each one pointing at a REAL record created above
  const notifs: { user: string; actor: string; type: string; title: string; body: string; href: string; cat: string; pri: string; h: number }[] = [
    { user: "devin", actor: "ava", type: "message", title: "New message from Ava Chen", body: "Accepted and funded! Excited for this one", href: `/messages?c=${convAva}`, cat: "messages", pri: "normal", h: 46 },
    { user: "devin", actor: "jordanmiles", type: "message", title: "New message from Jordan Miles", body: "Reference sent. Offer me the usual.", href: `/messages?c=${convJordan}`, cat: "messages", pri: "normal", h: 24 },
    { user: "devin", actor: "ava", type: "payment", title: "Payment secured for Brand Video Audio — 45s", body: "$300 held — you're clear to start", href: `/messages?c=${convAva}`, cat: "payments", pri: "high", h: 46 },
    { user: "devin", actor: "nia", type: "message", title: "New message from Nia Brooks", body: "Send me the vibe you want.", href: `/messages?c=${convNia}`, cat: "messages", pri: "normal", h: 7 },
    { user: "devin", actor: "marcusj", type: "booking", title: "Marcus Johnson requested a booking", body: "Music Production · $300", href: "/calendar", cat: "work", pri: "high", h: 3 },
    { user: "devin", actor: "nia", type: "follow", title: "Nia Brooks started following you", body: "", href: "/creator/nia", cat: "activity", pri: "low", h: 12 },
  ];
  for (const n of notifs)
    db.insert(t.notifications).values({
      id: id(), userId: uid[n.user], actorId: uid[n.actor], type: n.type, title: n.title,
      body: n.body, href: n.href, category: n.cat, priority: n.pri, createdAt: hoursAgo(n.h),
    }).run();

  console.log("Seeded:", defs.length, "users · password: upnova123 · admin: devin@upnova.dev");
}

const args = process.argv.slice(2);
if (args.includes("--wipe")) wipe();
else if (args.includes("--fresh")) {
  wipe();
  seed();
} else seed();
