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
    avatar: string;
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
  for (const [handle, program] of [["devin", "Cybersecurity"], ["nia", "Communications"]] as const) {
    db.insert(t.campusVerifications)
      .values({ id: id(), userId: uid[handle], campusId, status: "verified", program, gradYear: "2027", verifiedAt: new Date() })
      .run();
  }

  /* ------------------------------ follows ------------------------------ */
  const followPairs: [string, string][] = [
    ["devin", "jordanmiles"], ["devin", "ava"], ["devin", "marcusj"],
    ["ava", "devin"], ["jordanmiles", "devin"], ["nia", "devin"],
    ["marcusj", "devin"], ["lena", "devin"], ["ava", "lena"], ["nia", "ava"],
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
    { owner: "ava", title: "Event Photography", price: 250, desc: "Events, portraits, and content shoots in the Baltimore area.", reach: "Baltimore · 10 mi", ai: "no-ai" },
    { owner: "jordanmiles", title: "Mixing & Mastering", price: 180, desc: "Radio-ready mixes with two rounds of revisions.", reach: "Remote", ai: "disclosure" },
    { owner: "lena", title: "Brand Identity", price: 180, desc: "Logo, palette, and brand guide for creators and small brands.", reach: "Remote", ai: "client-decides" },
    { owner: "marcusj", title: "Music Video Production", price: 450, desc: "Concept-to-delivery music videos in the DMV.", reach: "DMV · 40 mi", ai: "no-ai" },
    { owner: "nia", title: "Dog Walking", price: 25, desc: "Weekday walks in Towson and North Baltimore.", reach: "Towson · 5 mi", ai: "no-ai", category: "care", trust: "high-trust" },
  ];
  const sid: Record<string, string> = {};
  for (const s of serviceDefs) {
    const serviceId = id();
    sid[`${s.owner}:${s.title}`] = serviceId;
    db.insert(t.services)
      .values({
        id: serviceId, ownerId: uid[s.owner], title: s.title, description: s.desc,
        price: s.price, reach: s.reach, aiPolicy: s.ai,
        category: (s as { category?: string }).category ?? "creative",
        trustRequired: (s as { trust?: string }).trust ?? "standard",
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
  const postDefs: { author: string; body: string; hours: number; image?: string; likes: string[]; comments: [string, string][] }[] = [
    { author: "ava", body: "Golden hour session from Saturday's rooftop shoot. Baltimore skies never miss. 📸", hours: 5, image: "/images/post-photo.jpg", likes: ["devin", "nia", "lena", "marcusj"], comments: [["devin", "These are unreal. That third frame 🔥"], ["lena", "The color grading on this set >>>"]] },
    { author: "jordanmiles", body: "New loop pack drops Friday. 40 originals, all clearable. Producers — tags off, stems included.", hours: 9, likes: ["devin", "marcusj"], comments: [["devin", "Need that. Sending you something Monday."]] },
    { author: "devin", body: "Wrapped mixing on an EP for an artist I found ON this app. From DM to delivered masters in 12 days. This is what the platform is for.", hours: 14, likes: ["ava", "jordanmiles", "nia", "lena"], comments: [["ava", "This is the way it should work."], ["jordanmiles", "12 days is crazy turnaround 🔥"]] },
    { author: "nia", body: "Anyone on campus need event coverage during homecoming week? Booking now, student rates. DM me.", hours: 22, likes: ["devin", "ava"], comments: [] },
    { author: "marcusj", body: "Color graded 4 music videos this week. If your footage looks flat, it's not your camera — it's your grade. Happy to consult.", hours: 30, likes: ["devin"], comments: [["jordanmiles", "Facts. Grade makes the video."]] },
    { author: "lena", body: "Brand identity delivered for a Baltimore coffee brand today. Logo, palette, menus, cups. Small brands deserve big design.", hours: 44, image: "/images/post-design.jpg", likes: ["ava", "devin", "nia"], comments: [["ava", "The cup design is so clean"]] },
  ];
  for (const p of postDefs) {
    const postId = id();
    db.insert(t.posts)
      .values({ id: postId, authorId: uid[p.author], body: p.body, imageUrl: p.image ?? null, isSeed: true, createdAt: hoursAgo(p.hours) })
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

  /* ------------------------------ bookings ------------------------------ */
  db.insert(t.bookings).values({
    id: id(), serviceId: sid["ava:Event Photography"], clientId: uid["devin"], providerId: uid["ava"],
    title: "Event Photography", startsAt: daysFromNow(3), durationMin: 180, price: 250,
    location: "Rooftop — Fells Point", status: "confirmed", isSeed: true,
  }).run();
  db.insert(t.bookings).values({
    id: id(), serviceId: sid["devin:Music Production"], clientId: uid["marcusj"], providerId: uid["devin"],
    title: "Music Production", startsAt: daysFromNow(5), durationMin: 240, price: 300,
    location: "Devin's studio", status: "pending", isSeed: true,
  }).run();

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
