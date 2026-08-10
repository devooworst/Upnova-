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
import { and, eq, inArray } from "drizzle-orm";
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
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000);
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

    // communities must go before their seed creators (createdById has no
    // cascade) — including non-seed communities a seed user created
    db.delete(t.communities).where(eq(t.communities.isSeed, true)).run();
    db.delete(t.communities).where(inArray(t.communities.createdById, ids)).run();

    // PRESERVE LIVE LOGINS: deleting seed users cascade-kills their session
    // rows, which silently signed the demo user out on every reseed.
    // Remember sessions by HANDLE and restore them after seeding.
    const liveSessions = db
      .select({ token: t.sessions.token, expiresAt: t.sessions.expiresAt, userId: t.sessions.userId })
      .from(t.sessions)
      .all()
      .map((srow) => {
        const u = db.select({ handle: t.users.handle }).from(t.users).where(eq(t.users.id, srow.userId)).get();
        return u ? { token: srow.token, expiresAt: srow.expiresAt, handle: u.handle } : null;
      })
      .filter(Boolean) as { token: string; expiresAt: Date; handle: string }[];
    try {
      require("fs").writeFileSync(
        require("path").join(__dirname, ".preserved-sessions.json"),
        JSON.stringify(liveSessions.map((x) => ({ ...x, expiresAt: new Date(x.expiresAt).getTime() })))
      );
    } catch {}

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
        // seeded accounts are established members — the first-run tour
        // only greets genuinely new signups
        onboarding: JSON.stringify({ completedAt: new Date().toISOString(), seeded: true }),
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
      .values({
        id: id(), userId: uid[handle], campusId, status: "verified", program, gradYear: "2027",
        affiliation: "current_student",
        // school + class year is the public academic identity (default on;
        // each member can hide the year in Settings). The major is a
        // visibility choice AND never public regardless — nia opted in for
        // owner-facing surfaces.
        showGradYear: true, showProgram: handle === "nia",
        verifiedAt: new Date(),
      })
      .run();
  }

  // tj graduated in 2022 — verified ALUMNI: the alumni environment is his,
  // student-only areas (Marketplace, Student Groups) are not
  db.insert(t.campusVerifications)
    .values({
      id: id(), userId: uid["tj"], campusId, status: "verified", affiliation: "alumni",
      program: "Music Technology", gradYear: "2022", showGradYear: true, showProgram: true,
      verifiedAt: new Date(),
    })
    .run();

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
  /* Identity modes are per-community: social rooms can allow alias/anonymous
     participation; professional rooms stay real-name. Aliases and anon codes
     live on the membership — random per community, never correlated. */
  const communityDefs: {
    slug: string; name: string; desc: string; owner: string; category: string;
    access?: string; modes: string[]; rules?: string[]; campus?: boolean;
    kind?: string; joinApproval?: boolean; audience?: string;
  }[] = [
    { slug: "baltimore-creators", name: "Baltimore Creators", desc: "Creators building in and around Baltimore.", owner: "devin", category: "General", modes: ["real", "alias"], rules: ["Keep it constructive", "No spam or self-promo floods"] },
    { slug: "music-producers", name: "Music Producers", desc: "Production, mixing, placements, and feedback.", owner: "jordanmiles", category: "Music", modes: ["real"], rules: ["Feedback stays about the work, not the person"] },
    { slug: "photo-video", name: "Photo & Video", desc: "Shoots, gear, edits, and collabs.", owner: "ava", category: "Photography", modes: ["real"] },
    {
      slug: "late-night-conversations", name: "Late Night Conversations",
      desc: "The stuff you actually think about after midnight. Say it however you're comfortable — profile, alias, or anonymous.",
      owner: "imani", category: "Campus Social", modes: ["real", "alias", "anonymous"], campus: true,
      rules: ["Be kind — someone trusted this room enough to be honest in it", "No screenshots, no guessing who anonymous posters are", "Harassment gets you removed, anonymous or not"],
    },
    {
      slug: "bowie-cybersecurity-study-group", name: "Bowie State Cybersecurity Study Group",
      desc: "Weekly problem sets, cert prep, and lecture notes. Real names or aliases — we study together.",
      owner: "devin", category: "Study Groups", access: "private", modes: ["real", "alias"], campus: true, joinApproval: true,
      rules: ["Members share notes, not exam answers"],
    },
    {
      slug: "bowie-anime", name: "Bowie State Anime Community",
      desc: "Seasonal watchlists, manga trades, and watch parties in the student center.",
      owner: "nia", category: "Anime", modes: ["real", "alias"], campus: true,
    },
    {
      slug: "bowie-alumni-network", name: "Bowie State Alumni Network",
      desc: "Alumni careers, referrals, homecoming plans, and giving back. Verified Bowie State alumni.",
      owner: "tj", category: "Career", modes: ["real"], campus: true, audience: "alumni",
      rules: ["Referrals and intros are the whole point — make them generously"],
    },
    {
      slug: "lenas-design-lab", name: "Lena's Design Lab — Inner Circle",
      desc: "Weekly design critiques, working files, and portfolio teardowns from a working brand designer. Membership keeps it small and serious.",
      owner: "lena", category: "Career", modes: ["real"], rules: ["Post work to get work critiqued", "What's shared here stays here"],
    },
    {
      slug: "bsu-digital-media-association", name: "Digital Media Student Association",
      desc: "Bowie State's student org for video, design, and content careers. Meetings every other Wednesday.",
      owner: "nia", category: "Student Organizations", modes: ["real"], campus: true,
      rules: ["Meetings are member-led — sign up to present"],
    },
    {
      slug: "bsu-math-tutoring-circle", name: "Math Tutoring Circle",
      desc: "Peer tutoring for calc, stats, and linear algebra. Bring problems, leave with answers.",
      owner: "omar", category: "Academic Groups", modes: ["real", "alias"], campus: true,
    },
    {
      slug: "bsu-chess-board-games", name: "Chess & Board Games Club",
      desc: "Casual games in the student center every Friday. All skill levels.",
      owner: "imani", category: "Interest Groups", modes: ["real", "alias"], campus: true,
    },
    {
      slug: "bowie-campus-questions", name: "Campus Questions — Bowie State",
      desc: "Questions, advice & info for Bowie State. Ask with your profile, an alias, or anonymously.",
      owner: "devin", category: "Academic", modes: ["real", "alias", "anonymous"], campus: true, kind: "campus_questions",
      rules: ["Answers > dunks — help people out", "Anonymous questions are welcome; anonymous harassment is not"],
    },
  ];
  const cid: Record<string, string> = {};
  for (const c of communityDefs) {
    const communityId = id();
    cid[c.slug] = communityId;
    db.insert(t.communities)
      .values({
        id: communityId, slug: c.slug, name: c.name, description: c.desc,
        access: c.access ?? "public", category: c.category, kind: c.kind ?? "standard",
        identityModes: JSON.stringify(c.modes), rules: JSON.stringify(c.rules ?? []),
        joinApproval: !!c.joinApproval, campusId: c.campus ? campusId : null,
        audience: c.audience ?? "everyone",
        mode: c.kind === "campus_questions" ? "qa" : "discussion",
        createdById: uid[c.owner], isSeed: true,
      })
      .run();
    db.insert(t.communityMembers).values({ communityId, userId: uid[c.owner], role: "owner", status: "active" }).run();
  }
  const memberships: [string, string][] = [
    ["baltimore-creators", "ava"], ["baltimore-creators", "nia"], ["baltimore-creators", "marcusj"],
    ["music-producers", "devin"], ["photo-video", "devin"], ["photo-video", "marcusj"],
    // campus rooms — campus-verified members only (devin, nia, imani, omar)
    ["late-night-conversations", "devin"], ["late-night-conversations", "nia"], ["late-night-conversations", "omar"],
    ["bowie-cybersecurity-study-group", "omar"], ["bowie-cybersecurity-study-group", "imani"],
    ["bowie-anime", "devin"], ["bowie-anime", "imani"], ["bowie-anime", "omar"],
    ["bowie-campus-questions", "nia"], ["bowie-campus-questions", "imani"], ["bowie-campus-questions", "omar"],
    ["bsu-digital-media-association", "devin"], ["bsu-digital-media-association", "imani"],
    ["bsu-math-tutoring-circle", "nia"],
    ["bsu-chess-board-games", "omar"], ["bsu-chess-board-games", "nia"],
  ];
  for (const [slug, handle] of memberships)
    db.insert(t.communityMembers).values({ communityId: cid[slug], userId: uid[handle], status: "active" }).run();

  // paid community economics: $8/month, capacity 60, standard 3-day grace.
  // Devin's membership expires in ~2 days → the "renews soon" notice fires
  // on his next visit, and the renew button is live.
  db.update(t.communities)
    .set({ price: 8, billingPeriod: "monthly", capacity: 60, graceDays: 3 })
    .where(eq(t.communities.id, cid["lenas-design-lab"]))
    .run();
  db.insert(t.communityMembers)
    .values({ communityId: cid["lenas-design-lab"], userId: uid["devin"], status: "active", memberUntil: new Date(Date.now() + 2 * 86400_000) })
    .run();
  db.insert(t.communityMembers)
    .values({ communityId: cid["lenas-design-lab"], userId: uid["ava"], status: "active", memberUntil: new Date(Date.now() + 20 * 86400_000) })
    .run();

  // nia asked to join the private study group — a pending request for the
  // protagonist (owner) to approve
  db.insert(t.communityMembers).values({ communityId: cid["bowie-cybersecurity-study-group"], userId: uid["nia"], status: "pending" }).run();

  // per-community aliases + anon codes (random per community — imani is 482
  // in Late Night and a different number anywhere else)
  const setMember = (slug: string, handle: string, patch: Record<string, unknown>) =>
    db.update(t.communityMembers)
      .set(patch)
      .where(and(eq(t.communityMembers.communityId, cid[slug]), eq(t.communityMembers.userId, uid[handle])))
      .run();
  setMember("late-night-conversations", "nia", { alias: "CampusQueen", lastIdentity: "alias" });
  setMember("late-night-conversations", "imani", { anonCode: "482", lastIdentity: "anonymous" });
  setMember("late-night-conversations", "omar", { anonCode: "917", lastIdentity: "anonymous" });
  setMember("late-night-conversations", "devin", { anonCode: "358" });
  setMember("bowie-anime", "nia", { alias: "CampusQueen" });
  setMember("bowie-campus-questions", "imani", { anonCode: "274" });

  /* ---- community discussion (identity chosen per post) ---- */
  const cpid: Record<string, string> = {};
  const communityPostDefs: { key: string; slug: string; author: string; identity: string; body: string; hoursAgo: number; pinned?: boolean }[] = [
    { key: "lonely", slug: "late-night-conversations", author: "omar", identity: "anonymous", hoursAgo: 20,
      body: "Does anybody else feel lonely at this school? Feels like everyone already has their friend group locked and it's only October." },
    { key: "biol", slug: "late-night-conversations", author: "nia", identity: "alias", hoursAgo: 8,
      body: "Anybody else struggling with BIOL 101 this semester? The pacing is genuinely brutal." },
    { key: "notes", slug: "bowie-cybersecurity-study-group", author: "omar", identity: "real", hoursAgo: 30,
      body: "Dropping my notes from the cryptography lecture in here tonight — the Diffie-Hellman walkthrough finally clicked." },
    { key: "anime", slug: "bowie-anime", author: "nia", identity: "real", hoursAgo: 12,
      body: "What anime are y'all watching this semester? Building the watch-party schedule for the student center." },
    { key: "braids", slug: "bowie-campus-questions", author: "nia", identity: "real", hoursAgo: 26,
      body: "Does anybody know a good place to get braids near campus?" },
    { key: "professor", slug: "bowie-campus-questions", author: "imani", identity: "anonymous", hoursAgo: 15,
      body: "Has anyone else had a bad experience with a certain intro-stats professor? Thinking about switching sections before the drop deadline." },
    { key: "print", slug: "bowie-campus-questions", author: "omar", identity: "real", hoursAgo: 5,
      body: "Where can I print something after 10 PM?" },
  ];
  for (const p of communityPostDefs) {
    const pId = id();
    cpid[p.key] = pId;
    db.insert(t.communityPosts)
      .values({
        id: pId, communityId: cid[p.slug], authorId: uid[p.author], identity: p.identity,
        body: p.body, pinned: !!p.pinned, isSeed: true,
        createdAt: new Date(Date.now() - p.hoursAgo * 3_600_000),
      })
      .run();
  }
  const communityCommentDefs: { post: string; author: string; identity: string; body: string; hoursAgo: number }[] = [
    { post: "lonely", author: "imani", identity: "anonymous", hoursAgo: 18, body: "You're definitely not the only one. Half this room is probably in the same boat — that's kind of why it exists." },
    { post: "lonely", author: "nia", identity: "real", hoursAgo: 16, body: "Game night in the student center Thursdays is lowkey the easiest place to meet people. Come through." },
    { post: "biol", author: "omar", identity: "anonymous", hoursAgo: 6, body: "Office hours Tuesday saved my grade. Go early, the line gets long." },
    { post: "anime", author: "imani", identity: "alias", hoursAgo: 10, body: "Frieren rewatch, no contest. Would show up to a watch party for that." },
    { post: "braids", author: "imani", identity: "real", hoursAgo: 24, body: "Crown & Glory on Route 197 — ask for Tasha, tell her you're a student." },
    { post: "print", author: "imani", identity: "real", hoursAgo: 4, body: "Library first floor is 24/7 with your student ID. The lab printers upstairs close at 10." },
  ];
  for (const cdef of communityCommentDefs) {
    // seed aliases need to exist for alias comments
    if (cdef.identity === "alias" && cdef.author === "imani")
      setMember("bowie-anime", "imani", { alias: "MoonlitPages" });
    db.insert(t.communityComments)
      .values({
        id: id(), postId: cpid[cdef.post], authorId: uid[cdef.author], identity: cdef.identity,
        body: cdef.body, isSeed: true, createdAt: new Date(Date.now() - cdef.hoursAgo * 3_600_000),
      })
      .run();
  }
  // reactions so the For You surfacing has something popular to pick
  for (const [post, who] of [["lonely", "nia"], ["lonely", "devin"], ["anime", "devin"], ["anime", "omar"], ["print", "nia"]] as const)
    db.insert(t.communityReactions).values({ postId: cpid[post], userId: uid[who] }).run();

  /* ---- identity reveals: gradual trust, demonstrated ----
     · Anonymous • 482 (imani) asked DEVIN to reveal — pending, his call.
     · devin ↔ omar already revealed; omar's setting is "always show to
       people I've revealed to", so devin privately sees who Anonymous • 917
       is on omar's masked posts. The rest of the room still sees the mask. */
  db.insert(t.identityReveals)
    .values({
      id: id(), requesterId: uid["imani"], targetId: uid["devin"], communityId: cid["late-night-conversations"],
      requesterLabel: "Anonymous • 482", targetLabel: "Anonymous • 358", status: "pending", isSeed: true,
      createdAt: new Date(Date.now() - 3 * 3_600_000),
    })
    .run();
  db.insert(t.identityReveals)
    .values({
      id: id(), requesterId: uid["devin"], targetId: uid["omar"], communityId: cid["late-night-conversations"],
      requesterLabel: "Anonymous • 358", targetLabel: "Anonymous • 917", status: "accepted", isSeed: true,
      respondedAt: new Date(Date.now() - 40 * 3_600_000), createdAt: new Date(Date.now() - 42 * 3_600_000),
    })
    .run();
  db.update(t.profiles).set({ revealIdentityMode: "always_profile" }).where(eq(t.profiles.userId, uid["omar"])).run();

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
    { owner: "sofia", title: "Custom Crochet Pieces", price: 85, desc: "Made-to-order crochet tops, bags, and accessories. Two-week turnaround.", reach: "Baltimore · ships", ai: "no-ai", category: "crochet" },
    { owner: "sofia", title: "Shoot Styling", price: 220, desc: "Full wardrobe styling for your shoot — pull, fit, on-set.", reach: "Baltimore · 20 mi", ai: "no-ai", category: "fashion" },
    { owner: "sofia", title: "Custom Piece", price: 350, desc: "One-of-one garment designed and made for your event or video.", reach: "Baltimore · 20 mi", ai: "no-ai", category: "fashion" },
    { owner: "tj", title: "Event DJ — 4 Hours", price: 400, desc: "Open format, full rig, MC-ready. Books 2 weeks out.", reach: "DMV · 40 mi", ai: "no-ai", category: "events" },
    { owner: "imani", title: "Acrylic Full Set", price: 45, desc: "Classic acrylic full set. Retired — see Gel Nail Set for current bookings.", reach: "Bowie · 5 mi", ai: "no-ai", category: "beauty", inactive: true },
    { owner: "imani", title: "Gel Nail Set", price: 55, desc: "Full gel set with custom design. On campus or nearby.", reach: "Bowie · 5 mi", ai: "no-ai", category: "beauty" },
    { owner: "imani", title: "Loc Retwist", price: 60, desc: "Full retwist for locs. Includes retwisting and basic styling — build your visit with add-ons and packages.", reach: "Bowie · 5 mi", ai: "no-ai", category: "beauty" },
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
        // Imani's own nail menu — add-ons change price AND chair time
        menu: {
          addons: [
            { id: "art", name: "Nail Art", priceMode: "fixed", price: 15, timeMin: 20 },
            { id: "chrome", name: "Chrome Finish", priceMode: "fixed", price: 12, timeMin: 10 },
            { id: "soak", name: "Soak-off Removal", priceMode: "fixed", price: 10, timeMin: 15 },
          ],
          packages: [{ id: "pk_art", name: "Gel Set + Art", price: 65, includes: ["art"] }],
        },
      },
      // the canonical menu example: a loc stylist's real price structure —
      // base $60, add-ons with their own price + time, creator-priced bundles,
      // a "starting at" repair, and a quote-only reattachment
      "imani:Loc Retwist": {
        locationMode: "my_location",
        travel: { mode: "none" },
        scheduling: { durationMin: 60, maxPerDay: 5 },
        policies: { cancellation: "free_24h", reschedule: "one_free", lateGraceMin: 10, lateFee: 10, noShow: "partial" },
        requirements: [],
        menu: {
          addons: [
            { id: "wash", name: "Wash", priceMode: "fixed", price: 10, timeMin: 20 },
            { id: "style", name: "Style", priceMode: "fixed", price: 20, timeMin: 30 },
            { id: "deep", name: "Deep Clean", priceMode: "fixed", price: 15, timeMin: 15 },
            { id: "detangle", name: "Detangling", priceMode: "fixed", price: 30, timeMin: 30 },
            { id: "repair", name: "Loc Repair", priceMode: "starting", price: 25, timeMin: 30 },
            { id: "reattach", name: "Loc Reattachment", priceMode: "quote", price: 0, timeMin: 0 },
            { id: "sameday", name: "Emergency / Same-day", priceMode: "fixed", price: 20, timeMin: 0 },
          ],
          packages: [
            { id: "pk_wash", name: "Retwist + Wash", price: 70, includes: ["wash"] },
            { id: "pk_style", name: "Retwist + Style", price: 80, includes: ["style"] },
            { id: "pk_full", name: "Full Package — Wash + Retwist + Style", price: 90, includes: ["wash", "style"] },
          ],
        },
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
        menu: {
          addons: [
            { id: "hour", name: "Extra Hour", priceMode: "fixed", price: 75, timeMin: 60 },
            { id: "rush", name: "Rush Edit (48h)", priceMode: "fixed", price: 40, timeMin: 0 },
            { id: "second", name: "Second Shooter", priceMode: "quote", price: 0, timeMin: 0 },
          ],
          packages: [],
        },
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
        // deactivated seed service — proves history is kept, not erased
        active: !(s as { inactive?: boolean }).inactive,
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

  /* --------------------------------- works --------------------------------- */
  // Licensable creative works — each creator's OWN license ladder. Kofi's
  // beat carries a playable demo tone standing in for the tagged preview.
  const workBeat = id();
  db.insert(t.works).values({
    id: workBeat, creatorId: uid["kofi"], title: '"Midnight Run" — 140bpm Dark Trap',
    kind: "beat", description: "140bpm, F minor. Dark keys, hard 808s. Untagged WAV + stems on license.",
    previewUrl: "data:audio/wav;base64,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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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c/9y/3j/g/+U/6r/wv/d//f/DwAkADUAQQBIAEoARwBCADoAMAAnAB4AFgAPAAoABgADAAEAAAD//wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    previewLength: 30, watermarked: true,
    licenseOptions: JSON.stringify([
      { id: "free", type: "free", name: "Free demo use", price: 0, attribution: true, usage: "Non-monetized demos and freestyles.", restrictions: "No releases, no monetization, no resale." },
      { id: "lease", type: "non_commercial", name: "MP3 Lease", price: 30, attribution: true, usage: "Non-monetized release, up to 10k streams.", restrictions: "No paid placements or broadcast." },
      { id: "comm", type: "commercial", name: "Commercial Lease (WAV + stems)", price: 75, attribution: false, usage: "Monetized release up to 100k streams, one video.", restrictions: "Non-exclusive — the beat stays on the market." },
      { id: "excl", type: "exclusive", name: "Exclusive", price: 400, attribution: false, usage: "Unlimited commercial use; licensing to others stops.", restrictions: "Kofi retains authorship credit." },
      { id: "sync", type: "custom", name: "Sync / film license", price: null, attribution: false, usage: "Negotiated per project.", restrictions: "Per agreement." },
    ]), isSeed: true,
  }).run();
  db.insert(t.works).values({
    id: id(), creatorId: uid["maya"], title: "Vocal Chops Pack Vol. 1",
    kind: "sample_pack", description: "40 wet/dry vocal chops, 24-bit. Cleared for use per license.",
    previewLength: 20, watermarked: true,
    licenseOptions: JSON.stringify([
      { id: "nc", type: "non_commercial", name: "Bedroom license", price: 15, attribution: true, usage: "Non-monetized tracks.", restrictions: "No resale as samples." },
      { id: "comm", type: "commercial", name: "Producer license", price: 45, attribution: false, usage: "Monetized releases, unlimited streams.", restrictions: "No resale as a competing pack." },
    ]), isSeed: true,
  }).run();
  db.insert(t.works).values({
    id: id(), creatorId: uid["ava"], title: "Harbor Series — Editorial Frame 03",
    kind: "photo", description: "Baltimore harbor at golden hour. Licensed per use.",
    previewUrl: "/images/studio-post.jpg", previewLength: 30, watermarked: true,
    licenseOptions: JSON.stringify([
      { id: "edit", type: "non_commercial", name: "Editorial use", price: 40, attribution: true, usage: "One editorial placement, print or web.", restrictions: "No advertising or merch." },
      { id: "comm", type: "commercial", name: "Commercial use", price: 120, attribution: false, usage: "One brand campaign, 12 months.", restrictions: "No resale or sublicensing." },
    ]), isSeed: true,
  }).run();
  // one COMPLETED license on record: TJ leased Kofi's beat commercially
  const licTj = id();
  db.insert(t.licenses).values({
    id: licTj, workId: workBeat, creatorId: uid["kofi"], licenseeId: uid["tj"],
    workTitle: '"Midnight Run" — 140bpm Dark Trap', licenseType: "commercial",
    optionName: "Commercial Lease (WAV + stems)",
    permittedUsage: "Monetized release up to 100k streams, one video.",
    restrictions: "Non-exclusive — the beat stays on the market.",
    attribution: false, price: 75, status: "completed", isSeed: true, createdAt: hoursAgo(24 * 6),
  }).run();
  db.insert(t.payments).values({
    id: id(), licenseId: licTj, payerId: uid["tj"], payeeId: uid["kofi"],
    amountCents: 7500, feeCents: 375, status: "released",
  }).run();

  // linked feed posts — ONE canonical object each, the post is its feed
  // presence (CTA opens the real thing). Same machinery every category.
  db.insert(t.posts).values({
    id: id(), authorId: uid["kofi"], kind: "announcement", category: "Work",
    body: '"Midnight Run" is up — 140bpm dark trap.\nLicenses from $30, exclusive available.',
    refType: "work", refId: workBeat, isSeed: true, createdAt: hoursAgo(8),
  }).run();

  /* -------------------------------- products -------------------------------- */
  // PRODUCT = "buy this" — the sixth entity. UpNova checkout listings,
  // a one-time sale, a digital good, and an HONEST external listing.
  const prodTote = id();
  db.insert(t.products).values({
    id: prodTote, sellerId: uid["sofia"], title: "Hand-Dyed Canvas Tote",
    description: "Heavyweight canvas, hand-dyed in small batches. Every one is slightly different — that's the point.",
    price: 28, category: "handmade", condition: "new", quantity: 15, sold: 1,
    variants: JSON.stringify([{ name: "Color", options: ["Rust", "Indigo", "Moss"] }]),
    fulfillment: JSON.stringify(["shipping", "pickup"]), isSeed: true,
  }).run();
  db.insert(t.products).values({
    id: id(), sellerId: uid["kofi"], title: "Drum Kit Vol. 2 — 300 Sounds",
    description: "300 originals: drums, 808s, textures. Royalty-free, instant download.",
    price: 25, category: "music", condition: "new", quantity: 9999,
    fulfillment: JSON.stringify(["digital"]), isSeed: true,
  }).run();
  db.insert(t.products).values({
    id: id(), sellerId: uid["marcusj"], title: "Vintage Denim Jacket",
    returnPolicy: JSON.stringify({ accepts: false }),
    description: "Size L. Like new — worn twice. Heavy 90s denim, no stains or repairs.",
    price: 35, category: "clothing", condition: "like_new", quantity: 1,
    variants: JSON.stringify([]),
    fulfillment: JSON.stringify(["pickup", "shipping"]), isSeed: true,
  }).run();
  db.insert(t.products).values({
    id: id(), sellerId: uid["lena"], title: "Studio Print — 'Harbor Nights'",
    description: "18×24 giclée print from the Harbor Nights series. Sold through my print shop.",
    price: 45, category: "art", condition: "new", quantity: 50,
    fulfillment: JSON.stringify(["shipping"]), externalUrl: "https://lenaortiz.shop/harbor-nights", isSeed: true,
  }).run();
  // one COMPLETED order → Sofia's seller history reads "1 completed order"
  const orderNia = id();
  db.insert(t.orders).values({
    id: orderNia, productId: prodTote, buyerId: uid["nia"], sellerId: uid["sofia"],
    title: "Hand-Dyed Canvas Tote", price: 28, qty: 1, variant: "Color: Rust",
    fulfillment: "shipping", status: "completed",
    tracking: JSON.stringify({ carrier: "USPS", code: "9400111899223197428339", eta: hoursAgo(24 * 3).toISOString() }),
    isSeed: true, createdAt: hoursAgo(24 * 9),
  }).run();
  db.insert(t.payments).values({
    id: id(), orderId: orderNia, payerId: uid["nia"], payeeId: uid["sofia"],
    amountCents: 2800, feeCents: 140, status: "released",
  }).run();
  db.insert(t.posts).values({
    id: id(), authorId: uid["sofia"], kind: "announcement", category: "Product",
    body: "Hand-dyed canvas totes are live — $28, three colorways, small batches.",
    refType: "product", refId: prodTote, isSeed: true, createdAt: hoursAgo(12),
  }).run();

  /* ---------- THE PS5 TEST CASE: contested dispute, under review ---------- */
  // Tracking says delivered. Buyer says the box held books. Seller filed a
  // serial + pre-ship photos. Nobody wins automatically — the case sits in
  // platform review with BOTH sides' evidence for the admin to decide.
  const prodPs5 = id();
  db.insert(t.products).values({
    id: prodPs5, sellerId: uid["marcusj"], title: "Game Console — 1TB (Disc Edition)",
    description: "Adult-owned, barely used. Original box, two controllers.",
    price: 500, category: "electronics", condition: "like_new", quantity: 1, sold: 1, status: "sold_out",
    returnPolicy: JSON.stringify({ accepts: false }),
    fulfillment: JSON.stringify(["shipping"]), isSeed: true,
  }).run();
  const orderPs5 = id();
  db.insert(t.orders).values({
    id: orderPs5, productId: prodPs5, buyerId: uid["rachel"], sellerId: uid["marcusj"],
    title: "Game Console — 1TB (Disc Edition)", price: 500, qty: 1, fulfillment: "shipping",
    status: "delivered",
    tracking: JSON.stringify({ carrier: "UPS", code: "1Z999AA10123456784", eta: hoursAgo(30).toISOString() }),
    protectionEndsAt: daysFromNow(3),
    sellerEvidence: JSON.stringify({ serial: "CFI-1215A-889021743", weightLb: 9.8, note: "Boxed with both controllers, taped and labeled.", photos: [] }),
    isSeed: true, createdAt: hoursAgo(24 * 5),
  }).run();
  db.insert(t.payments).values({
    id: id(), orderId: orderPs5, payerId: uid["rachel"], payeeId: uid["marcusj"],
    amountCents: 50000, feeCents: 2500, status: "held",
  }).run();
  const dispPs5 = id();
  db.insert(t.disputes).values({
    id: dispPs5, orderId: orderPs5, openedById: uid["rachel"], kind: "problem",
    reason: "wrong_package_contents", status: "under_review",
    evidence: JSON.stringify([
      { by: uid["rachel"], at: hoursAgo(20).toISOString(), note: "The box weight matched but it was full of hardcover books — no console. Photos of the opened package and the shipping label attached.", photos: [] },
      { by: uid["marcusj"], at: hoursAgo(16).toISOString(), note: "I packed the console myself — serial recorded before shipping, weight matches the console + accessories. Requesting review of the label photos: the tape pattern in the buyer's photo doesn't match mine.", photos: [] },
    ]),
    isSeed: true, createdAt: hoursAgo(22),
  }).run();
  const evPs5 = (kind: string, note: string, h: number, actor: string | null) =>
    db.insert(t.orderEvents).values({ id: id(), orderId: orderPs5, actorId: actor, kind, note, createdAt: hoursAgo(h) }).run();
  evPs5("created", "Game Console — 1TB (Disc Edition) ×1 · listing price $500", 24 * 5, uid["rachel"]);
  evPs5("paid", "$525.00 secured (incl. fee) — held until completion", 24 * 5 - 1, uid["rachel"]);
  evPs5("shipped", "UPS 1Z999AA10123456784 · serial recorded (private) · 9.8 lb (weight is context, not proof of contents)", 24 * 4, uid["marcusj"]);
  evPs5("delivered", "Carrier confirmed delivery", 30, null);
  evPs5("protection_started", "96h buyer-protection window", 30, null);
  evPs5("disputed", "wrong_package_contents", 22, uid["rachel"]);
  evPs5("evidence", "Buyer: box of books, photos attached", 20, uid["rachel"]);
  evPs5("evidence", "Seller: serial + packing evidence, tape mismatch claim", 16, uid["marcusj"]);
  evPs5("escalated", "Seller contested — sent to platform review", 16, uid["marcusj"]);

  /* ---------- eligibility demo: visible to all, apply gated ---------- */
  db.insert(t.opportunities).values({
    id: id(), posterId: uid["nia"],
    title: "Paid Campus Photographer — Bowie State University",
    description: "Shoot two campus events per month for the student activities board. Gear provided if needed. VISIBLE to everyone on UpNova; applications are limited to verified Bowie State students — verification is free.",
    budget: 120, type: "campus", location: "Bowie, MD", remote: false,
    studentFriendly: true,
    eligibility: "my_school", eligibilityCampusId: campusId,
    applyConfig: JSON.stringify({ requireMessage: true, notifyUnselected: true }),
    lat: defs.find((d) => d.handle === "nia")!.lat, lng: defs.find((d) => d.handle === "nia")!.lng,
    isSeed: true,
  }).run();

  /* ---------- ongoing engagement: the "hire an editor" demo ---------- */
  // Devin (content creator) hires an ONGOING video editor — engagement
  // type + comp schedule are configuration, and the human drives the
  // whole hiring flow (interview → offer → active → paid cycles).
  const editorOppId = id();
  db.insert(t.opportunities).values({
    id: editorOppId, posterId: uid["devin"],
    title: "Ongoing Video Editor — 2 videos/week",
    description: "Looking for an editor to own my weekly uploads long-term. You get raw footage Mondays, cuts due Thursdays. Consistent style, fast comms. Paid weekly through UpNova.",
    budget: 150, type: "gig", location: "Baltimore, MD", remote: true,
    engagement: JSON.stringify({
      type: "ongoing", workload: "≈10 hrs/week", schedule: "2 videos/week, cuts due Thursdays",
      duration: "3 months to start", compModel: "weekly", rate: 150,
      classification: "upnova_freelance", interviewMode: "upnova",
    }),
    applyConfig: JSON.stringify({ requireMessage: true, question: "Link two edits that show your pacing.", notifyUnselected: true }),
    lat: defs.find((d) => d.handle === "devin")!.lat, lng: defs.find((d) => d.handle === "devin")!.lng,
    isSeed: true,
  }).run();
  for (const [handle, msg] of [
    ["marcusj", "I cut multicam and short-form daily — pacing is my whole thing. Two links on my profile."],
    ["rachel", "I edit fashion films but my YouTube pacing work is stronger than my reel suggests."],
    ["darius", "I batch-edit for two creators already — room for one more weekly slot."],
  ] as const) {
    db.insert(t.applications).values({
      id: id(), opportunityId: editorOppId, applicantId: uid[handle],
      message: msg, availability: "yes", status: "submitted",
      answers: JSON.stringify({ question: "Link two edits that show your pacing.", answer: "On my profile — pinned." }),
      createdAt: hoursAgo(20),
    }).run();
  }

  /* --------------------------- campus marketplace --------------------------- */
  // Students helping students at Bowie State: sale, free (FCFS), auction,
  // borrowable calculator, and a "need to borrow" request — plus one LIVE
  // loan (Omar has Devin's calculator, due soon → reminder demo).
  const bowieId = db.select().from(t.campuses).all().find((c) => c.name.includes("Bowie"))!.id;
  const mkListing = (v: Record<string, unknown>) => {
    const lid = id();
    db.insert(t.campusListings).values({ id: lid, campusId: bowieId, isSeed: true, ...v } as never).run();
    return lid;
  };
  mkListing({ sellerId: uid["omar"], title: "Calc I & II Textbook (Stewart, 9th ed.)", type: "fixed", price: 25, category: "textbooks", condition: "good", description: "Highlighting in ch. 3-5, otherwise clean. Campus pickup at the library.", meetSpot: "Thurgood Marshall Library lobby" });
  mkListing({ sellerId: uid["imani"], title: "Mini fridge — moving out", type: "free", price: null, category: "dorm & housing", condition: "good", description: "Works perfectly, just can't take it home. First come first served.", meetSpot: "Towers Hall front desk" });
  const auctionId = mkListing({ sellerId: uid["omar"], title: "Dorm futon, barely used", type: "auction", price: 20, category: "dorm & housing", condition: "like_new", description: "Folds flat, dark gray. Auction ends this week — pickup only.", bidIncrement: 5, auctionEndsAt: daysFromNow(3), meetSpot: "Christa McAuliffe Hall" });
  db.insert(t.bids).values({ id: id(), listingId: auctionId, bidderId: uid["nia"], amount: 20, createdAt: hoursAgo(10) }).run();
  db.insert(t.bids).values({ id: id(), listingId: auctionId, bidderId: uid["imani"], amount: 25, createdAt: hoursAgo(4) }).run();
  const calcListing = mkListing({ sellerId: uid["devin"], title: "TI-84 Plus CE — available to borrow", type: "borrow", price: null, category: "electronics", condition: "like_new", description: "Exam season special: borrow it, pass, bring it back. Charger included.", maxBorrowDays: 7, meetSpot: "Student Center" });
  mkListing({ sellerId: uid["nia"], title: "MacBook charger (USB-C) for tonight", type: "need_borrow", price: null, category: "electronics", description: "Mine died and my essay is due at midnight. Need it just for tonight — I'll return it first thing tomorrow." });
  // live loan: Omar borrowed Devin's calculator, due in ~20h → due-soon
  // reminder fires on the next loans fetch
  db.insert(t.loans).values({
    id: id(), listingId: calcListing, lenderId: uid["devin"], borrowerId: uid["omar"],
    itemTitle: "TI-84 Plus CE", message: "Calc II midterm Thursday — lifesaver.",
    status: "borrowed", startAt: hoursAgo(28), dueAt: new Date(Date.now() + 20 * 3600_000),
    neededAt: hoursAgo(28), exchangeMethod: "campus_meetup", exchangeNote: "Library front desk",
    conditionBefore: JSON.stringify({ note: "Like new, small scuff on the back, charger + case included.", photos: [], at: hoursAgo(28).toISOString() }),
    conversationId: makeConversation("devin", "omar", [
      ["omar", "Picked up the calculator — thanks again! Back to you Thursday after the exam.", 27],
    ]), isSeed: true, createdAt: hoursAgo(30),
  }).run();

  // borrowing HISTORY: omar once returned devin's HDMI adapter two days
  // late — completed, factual record, no punishment. It shows up in his
  // borrowing record when he asks to borrow again.
  db.insert(t.loans).values({
    id: id(), listingId: null, lenderId: uid["devin"], borrowerId: uid["omar"],
    itemTitle: "HDMI Adapter", message: "Presentation in Comm 210.",
    status: "completed", startAt: daysAgo(21), dueAt: daysAgo(19),
    neededAt: daysAgo(21), exchangeMethod: "pickup",
    returnedAt: daysAgo(17), returnedLate: true,
    conditionBefore: JSON.stringify({ note: "Works fine.", photos: [], at: daysAgo(21).toISOString() }),
    conditionAfter: JSON.stringify({ note: "Back in one piece — two days late but all good.", photos: [], at: daysAgo(17).toISOString() }),
    isSeed: true, createdAt: daysAgo(22),
  }).run();

  // a PENDING borrowing request for the protagonist to accept/decline —
  // structured agreement: needed when, back when, exchange method
  db.insert(t.loans).values({
    id: id(), listingId: calcListing, lenderId: uid["devin"], borrowerId: uid["imani"],
    itemTitle: "TI-84 Plus CE", message: "Stats quiz next week — only need it for the afternoon.",
    status: "requested",
    neededAt: new Date(Date.now() + 5 * 86400_000 + 13 * 3600_000),
    dueAt: new Date(Date.now() + 5 * 86400_000 + 19 * 3600_000),
    exchangeMethod: "campus_meetup", exchangeNote: "Student Center, between classes",
    conversationId: makeConversation("devin", "imani", [
      ["imani", "Hey! Sent a borrow request for the calculator — just for Tuesday afternoon.", 2],
    ]), isSeed: true, createdAt: hoursAgo(3),
  }).run();

  /* -------- role opportunity: TEAM & OPENINGS, the flagship demo -------- */
  // Sofia's clothing-brand shoot: one opportunity, four roles. Marcus is
  // CONFIRMED as photographer (accepted -> booking on both calendars),
  // Imani's MUA offer is out (awaiting acceptance), the rest are in review.
  const shootId = id();
  const shootRoles = [
    { id: "photo", title: "Photographer", count: 1, pay: 500, description: "Shoot the campaign — 4 hours on set." },
    { id: "model", title: "Model", count: 3, pay: 200, description: "Three looks each, all sizes welcome." },
    { id: "mua", title: "Makeup Artist", count: 1, pay: 200 },
    { id: "stylist", title: "Stylist", count: 1, pay: 300, description: "Pull list handled — you run the racks." },
  ];
  db.insert(t.opportunities).values({
    id: shootId, posterId: uid["sofia"],
    title: "Clothing Brand Photoshoot — Models, Photographer & MUA",
    description: "Small creative team for an upcoming clothing brand photoshoot. Experienced models, one photographer, a makeup artist, and a stylist. Paid shoot — details and references go to selected applicants.",
    budget: 1500, type: "gig", location: "Baltimore, MD",
    applyBy: daysFromNow(7), eventDate: daysFromNow(14),
    roles: JSON.stringify(shootRoles),
    applyConfig: JSON.stringify({ requireMessage: true, selection: "manual", notifyUnselected: true }),
    lat: defs.find((d) => d.handle === "sofia")!.lat, lng: defs.find((d) => d.handle === "sofia")!.lng,
    isSeed: true,
  }).run();
  const shootApp = (handle: string, roleId: string, status: string, message: string) => {
    db.insert(t.applications).values({
      id: id(), opportunityId: shootId, applicantId: uid[handle], roleId,
      message, availability: "yes", status, createdAt: hoursAgo(30),
    }).run();
  };
  shootApp("marcusj", "photo", "confirmed", "Campaign work is my bread and butter — recent brand shoots on my profile.");
  shootApp("omar", "photo", "submitted", "Portfolio has two lookbooks from campus brands. Would love the shot.");
  shootApp("maya", "model", "submitted", "Runway and print experience — comp card on request.");
  shootApp("nia", "model", "shortlisted", "Modeled for two local brands last season — flexible on time.");
  shootApp("tj", "model", "submitted", "New to modeling but very comfortable on camera.");
  shootApp("imani", "mua", "selected", "Beauty is my whole business — bridal and editorial kits ready.");
  shootApp("lena", "stylist", "submitted", "I art-direct brand identities — styling the racks would be fun.");
  db.insert(t.posts).values({
    id: id(), authorId: uid["sofia"], kind: "announcement", category: "Opportunity",
    body: "Building a small team for a clothing brand shoot — photographer, 3 models, MUA, stylist. Paid.\n$1,500 total · Baltimore, MD",
    refType: "opportunity", refId: shootId, isSeed: true, createdAt: hoursAgo(10),
  }).run();

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
  const postDefs: { author: string; body: string; hours: number; image?: string; likes: string[]; comments: [string, string][]; kind?: string; cat?: string; sub?: string; disclosure?: string; attested?: boolean; credit?: string }[] = [
    { author: "ava", body: "Golden hour session from Saturday's rooftop shoot. Baltimore skies never miss. 📸", hours: 5, image: "/images/studio-post.jpg", likes: ["devin", "nia", "lena", "marcusj", "sofia"], comments: [["devin", "These are unreal. That third frame 🔥"], ["lena", "The color grading on this set >>>"]], kind: "work", cat: "Photography", sub: "Golden hour", disclosure: "original", attested: true },
    { author: "jordanmiles", body: "New loop pack drops Friday. 40 originals, all clearable. Producers — tags off, stems included.", hours: 9, likes: ["devin", "marcusj"], comments: [["devin", "Need that. Sending you something Monday."]], kind: "announcement", cat: "Beats" },
    { author: "devin", body: "Wrapped mixing on an EP for an artist I found ON this app. From DM to delivered masters in 12 days. This is what the platform is for.", hours: 14, likes: ["ava", "jordanmiles", "nia", "lena"], comments: [["ava", "This is the way it should work."], ["jordanmiles", "12 days is crazy turnaround 🔥"]], disclosure: "original", attested: true },
    { author: "nia", body: "Anyone on campus need event coverage during homecoming week? Booking now, student rates. DM me.", hours: 22, likes: ["devin", "ava"], comments: [], kind: "promotion", cat: "Content" },
    { author: "marcusj", body: "Color graded 4 music videos this week. If your footage looks flat, it's not your camera — it's your grade. Happy to consult.", hours: 30, likes: ["devin"], comments: [["jordanmiles", "Facts. Grade makes the video."]], disclosure: "ai_assisted", attested: true },
    { author: "lena", body: "Brand identity delivered for a Baltimore coffee brand today. Logo, palette, menus, cups. Small brands deserve big design.", hours: 44, image: "/images/portfolio-spotify.jpg", likes: ["ava", "devin", "nia", "darius"], comments: [["ava", "The cup design is so clean"]], kind: "work", cat: "Brand Identity" },
    { author: "maya", body: "Cut vocals for three records this week. If your hook feels empty, it's not the melody — it's the stacks. Layer, then layer again.", hours: 3, likes: ["devin", "jordanmiles", "kofi"], comments: [["jordanmiles", "Stacks are everything 💯"]], kind: "work", cat: "Vocals" },
    { author: "kofi", body: "Sold my first exclusive through UpNova today. Buyer found me through the 25-mile feed. Local-first actually works.", hours: 7, likes: ["devin", "jordanmiles", "maya", "tj"], comments: [["devin", "This is exactly the point. Congrats!"]] },
    { author: "sofia", body: "Styled a 12-look editorial in one day. Pull list, steamer, three racks, zero panic. Ask me about shoot styling.", hours: 11, image: "/images/community-streetwear.jpg", likes: ["ava", "rachel", "lena"], comments: [["rachel", "The silhouettes in look 7 😍"]], kind: "work", cat: "Styling", sub: "Editorial" },
    { author: "tj", body: "Rooftop set this Friday. Bringing the full rig. If you're a photographer who wants event shots for your portfolio, pull up — trade content.", hours: 16, likes: ["devin", "nia", "omar"], comments: [["omar", "I might pull up with the 35mm"]] },
    { author: "imani", body: "Booked out for homecoming week already 💅 Waitlist is open — campus people get priority.", hours: 20, likes: ["nia", "omar"], comments: [], kind: "announcement", cat: "Nails" },
    { author: "darius", body: "Shipped a creator site in 9 days. Portfolio, booking, and a merch page. Your link-in-bio deserves better than a list of links.", hours: 27, likes: ["lena", "devin", "kofi"], comments: [["lena", "The type choices on this one are great"]], kind: "work", cat: "Websites" , disclosure: "ai_assisted" },
    { author: "rachel", body: "Fashion film premiere next month. Two years of learning color inside one 90-second cut.", hours: 33, image: "/images/community-film.jpg", likes: ["sofia", "marcusj", "ava"], comments: [["marcusj", "Can't wait to see the grade"]], kind: "bts", cat: "Fashion Film" },
    { author: "omar", body: "Grad season is coming. Booking portrait slots for April now — campus rate stays $90.", hours: 38, likes: ["nia", "imani", "devin"], comments: [["imani", "Booking for my sister 🙌"]] },
    { author: "jordanmiles", body: "Placement news I can finally share: two records on a major project this fall. Everything routed through verified UpNova work. Keep your history clean.", hours: 50, image: "/images/beat-cover.jpg", likes: ["devin", "kofi", "maya", "marcusj", "ava"], comments: [["kofi", "Inspiring fr"], ["maya", "Huge!! 🎉"]] },
    { author: "ava", body: "PSA for new photographers: your rate is not just the shoot. It's the edit, the gear, the years. Price the whole thing.", hours: 55, likes: ["omar", "sofia", "devin", "rachel"], comments: [["omar", "Needed this today"]] },
    { author: "nia", body: "Dog sitting this weekend booked through my UpNova listing. Verified profile made the difference — the client said so directly.", hours: 60, likes: ["devin", "ava"], comments: [] },
    { author: "marcusj", body: "Three-camera live session edit delivered. Multicam is a cheat code for artists who hate reshoots.", hours: 70, image: "/images/event-afterdark.jpg", likes: ["jordanmiles", "devin", "rachel"], comments: [], kind: "work", cat: "Video", sub: "Multicam" , disclosure: "credited", credit: "Live stills: Rachel Kim" },
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
        // trust & authenticity demo states (disclosure = claim, never proof)
        disclosure: p.disclosure ?? "unspecified", attested: p.attested ?? false, credit: p.credit ?? "",
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

  // Trust & authenticity demo: Devin's "wrapped an EP" post is backed by the
  // completed Nia project (Verified Work) and Nia confirmed it happened
  // (Client Confirmed). The link is the same server-validated path real
  // posts use — postIds[2] is that post.
  db.update(t.posts)
    .set({ projectId: projNia, clientConfirmed: true })
    .where(eq(t.posts.id, postIds[2]))
    .run();

  // one report sits in the moderation queue: suspected stolen work, with
  // advisory automated signals attached — pending HUMAN review, no action
  db.insert(t.reports).values({
    id: id(), reporterId: uid["rachel"], targetType: "post", targetId: postIds[7],
    category: "stolen_work",
    details: "The artwork on this drop looks like a still from my fashion film — I have the original RAW files and timestamps.",
    signals: JSON.stringify([
      "No linked UpNova transaction backs this post (context, not proof)",
      "No identical image file found among other accounts' posts",
    ]),
    status: "open",
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

  // Marcus's confirmed shoot role — the Team-view engagement: a REAL
  // booking (payment pending; Sofia pays through the normal flow)
  const shootConv = makeConversation("sofia", "marcusj", [
    ["marcusj", "Locked in for the shoot — send the shot list whenever it's ready.", 26],
  ]);
  db.insert(t.bookings).values({
    id: id(), serviceId: null, clientId: uid["sofia"], providerId: uid["marcusj"],
    title: "Photographer — Clothing Brand Photoshoot",
    startsAt: at(14, 14), durationMin: 240, price: 500,
    items: JSON.stringify([{ label: "Photographer · Clothing Brand Photoshoot", amount: 500 }]),
    location: "Baltimore, MD", status: "accepted", conversationId: shootConv, isSeed: true,
  }).run();
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
  /* PUBLIC events — the wider world: city coordinates power the nearby
     filters (server-side only). Campus events are seeded separately below
     and NEVER appear in this section. */
  const BALT = { lat: 39.2904, lng: -76.6122, state: "MD" };
  const DC = { lat: 38.9072, lng: -77.0369, state: "DC" };
  const eventDefs = [
    { slug: "meetup", host: "devin", title: "UpNova Creator Meetup", time: "7:00 PM", loc: "The Assembly Room", city: "Baltimore, MD", days: 15, price: null, cap: 150, att: 84, img: "/images/event-meetup.jpg", kind: "rsvp", cat: "Networking", geo: BALT, desc: "Meet the creators you keep seeing in your feed. Demos, collabs, and a live showcase." },
    { slug: "networking", host: "tj", title: "DMV Music Networking Night", time: "8:00 PM", loc: "Union Stage", city: "Washington, DC", days: 21, price: 15, cap: 200, att: 132, img: "/images/event-networking.jpg", kind: "ticket", cat: "Networking", geo: DC, desc: "Producers, artists, engineers, and managers in one room. Bring business cards." },
    { slug: "photo-walk", host: "ava", title: "Golden Hour Photo Walk", time: "6:30 PM", loc: "Federal Hill Park", city: "Baltimore, MD", days: 9, price: null, cap: 40, att: 27, img: "/images/event-photowalk.jpg", kind: "registration", cat: "Creative / Art", geo: BALT, desc: "All levels. Bring any camera — we shoot the skyline at golden hour, then compare edits." },
    { slug: "after-dark", host: "tj", title: "After Dark — Rooftop Set", time: "10:00 PM", loc: "Rooftop at The Crown", city: "Baltimore, MD", days: 12, price: 25, cap: 180, att: 164, img: "/images/event-afterdark.jpg", kind: "ticket", age: "21+", cat: "Party / Nightlife", geo: BALT, desc: "Full rig on the roof. Photographers welcome — trade content for entry." },
    { slug: "workshop", host: "lena", title: "Brand Design Workshop", time: "1:00 PM", loc: "Open Works", city: "Baltimore, MD", days: 18, price: 40, cap: 30, att: 22, img: "/images/event-workshop.jpg", kind: "registration", cat: "Workshop", geo: BALT, desc: "Hands-on: build a one-page brand system in three hours. Laptops required." },
  ];
  for (const e of eventDefs) {
    db.insert(t.events)
      .values({
        id: e.slug, // slug ids so the existing /events/[slug] detail pages resolve
        slug: e.slug,
        hostId: uid[e.host],
        title: e.title,
        description: e.desc,
        category: e.cat,
        startsAt: daysFromNow(e.days),
        timeLabel: e.time,
        location: `${e.loc}, ${e.city}`,
        city: e.city,
        state: e.geo.state,
        lat: e.geo.lat,
        lng: e.geo.lng,
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

  /* CAMPUS events — strictly on-campus or directly school-associated,
     stamped with campusId: they live in Your Campus and never surface in
     the public Events section. */
  const campusEventDefs = [
    { slug: "bsu-homecoming-kickback", host: "nia", publicVisibility: true, title: "Homecoming Kickback — Student Center", time: "8:00 PM", venue: "Student Center Ballroom", days: 6, cap: 250, att: 118, kind: "rsvp", cat: "Campus Social", desc: "Music, food, and the whole yard in one room. Bring your student ID." },
    { slug: "bsu-creator-fair", host: "imani", title: "Bowie State Creator Fair", time: "12:00 PM", venue: "Fine Arts Quad", days: 13, cap: 400, att: 96, kind: "registration", cat: "Career / Networking", desc: "Student businesses, photographers, designers, and musicians table on the quad. Free to attend, table registration for student vendors." },
    { slug: "bsu-finals-study-night", host: "omar", title: "Late Night Study Jam — Library", time: "9:00 PM", venue: "Thurgood Marshall Library, Floor 2", days: 20, cap: 80, att: 34, kind: "rsvp", cat: "Study / Academic", desc: "Quiet floors, group rooms, and free coffee from the math club. Finals are coming — suffer together." },
  ];
  for (const e of campusEventDefs) {
    db.insert(t.events)
      .values({
        id: e.slug,
        slug: e.slug,
        hostId: uid[e.host],
        title: e.title,
        description: e.desc,
        campusId,
        category: e.cat,
        startsAt: daysFromNow(e.days),
        timeLabel: e.time,
        location: `${e.venue}, Bowie State University`,
        city: "Bowie, MD",
        state: "MD",
        capacity: e.cap,
        attending: e.att,
        kind: e.kind,
        // VISIBILITY ≠ ELIGIBILITY: opt-in public listing, RSVP stays campus-gated
        publicVisibility: !!(e as { publicVisibility?: boolean }).publicVisibility,
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

  // restore live logins preserved across the wipe (sessions by handle)
  try {
    const fs = require("fs");
    const path = require("path");
    const f = path.join(__dirname, ".preserved-sessions.json");
    if (fs.existsSync(f)) {
      const preserved: { token: string; expiresAt: number; handle: string }[] = JSON.parse(fs.readFileSync(f, "utf8"));
      let restored = 0;
      for (const p of preserved) {
        if (p.expiresAt < Date.now()) continue;
        const u = db.select({ id: t.users.id }).from(t.users).where(eq(t.users.handle, p.handle)).get();
        if (!u) continue;
        db.insert(t.sessions).values({ id: id(), token: p.token, userId: u.id, expiresAt: new Date(p.expiresAt) }).run();
        restored++;
      }
      fs.unlinkSync(f);
      if (restored) console.log(`Restored ${restored} live session(s) across the reseed — nobody got signed out.`);
    }
  } catch {}

  /* --------------------- QA Lab test personas ---------------------
     Clearly-labeled TEST accounts for the Test Center's interactive
     scenarios. isSeed = FALSE on purpose: no demo auto-behaviors —
     the tester personally plays both sides. The QA API also creates
     these lazily (ensureQaPersonas), this just makes a fresh database
     lab-ready immediately. */
  const qaDefs = [
    { handle: "testcustomer", name: "Test Customer", type: "individual", role: "Client (QA)", desc: "Books services, hires creators, applies to opportunities" },
    { handle: "testcreator", name: "Test Creator", type: "individual", role: "Service provider (QA)", desc: "Offers a service, receives bookings, delivers projects" },
    { handle: "testbusiness", name: "Test Business Co.", type: "business", role: "Local business", desc: "Posts opportunities, reviews applicants" },
  ] as const;
  for (const q of qaDefs) {
    if (db.select().from(t.users).where(eq(t.users.handle, q.handle)).get()) continue;
    const qid = id();
    db.insert(t.users)
      .values({
        id: qid,
        email: `${q.handle}@upnova.dev`,
        passwordHash: PASSWORD,
        handle: q.handle,
        accountType: q.type,
        testerMode: "demo",
        onboarding: JSON.stringify({ completedAt: new Date().toISOString(), qa: true }),
        isSeed: false,
      })
      .run();
    db.insert(t.profiles)
      .values({
        id: id(),
        userId: qid,
        displayName: q.name,
        bio: `QA test account — not a real person. ${q.desc}. Managed by the Test Center; all its transactions are test records.`,
        primaryRole: q.role,
        city: "Baltimore",
        state: "MD",
        openToWork: q.handle === "testcreator",
      })
      .run();
    if (q.handle === "testcreator")
      db.insert(t.services)
        .values({
          id: id(),
          ownerId: qid,
          title: "QA Test Session",
          description: "A test service owned by the TEST CREATOR account. Book it from the Test Center to walk the real booking + TEST payment flow end to end. No real money ever moves.",
          price: 100,
          category: "creative",
          fulfillment: "appointment",
          reach: "Remote",
        })
        .run();
    if (q.handle === "testbusiness")
      db.insert(t.services)
        .values({
          id: id(),
          ownerId: qid,
          title: "QA Studio Rental",
          description: "A test service owned by the TEST BUSINESS account, so customer→business bookings can be tested. All payments are TEST payments.",
          price: 80,
          category: "creative",
          fulfillment: "appointment",
          reach: "Baltimore, MD",
        })
        .run();
  }

  console.log("Seeded:", defs.length, "users · password: upnova123 · admin: devin@upnova.dev");
}

const args = process.argv.slice(2);
// CLI dispatch — ONLY when executed directly (tsx db/seed.ts …).
// The server imports { seed } from this file for dev auto-seeding and
// must never trigger a run at import time.
const runDirectly = !!process.argv[1] && /seed\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (runDirectly) {
  if (args.includes("--wipe")) wipe();
  else if (args.includes("--fresh")) {
    wipe();
    seed();
  } else seed();
}

export { seed, wipe };
