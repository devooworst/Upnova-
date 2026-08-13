/* ------------------------------------------------------------------ */
/*  Mavyn — production data model (Drizzle ORM)                       */
/*                                                                     */
/*  POSTGRES schema (Drizzle pg-core). Production/preview run on Neon  */
/*  via DATABASE_URL; local dev runs the SAME schema on PGlite (WASM   */
/*  Postgres, zero-config in any sandbox). String "enum" columns can   */
/*  become real enums later; RLS policies live in db/rls.sql. Today    */
/*  every route handler enforces identical ownership rules in the      */
/*  app layer via lib/server/authz.ts — no mutation happens without    */
/*  an ownership check.                                                */
/*                                                                     */
/*  Seed separation: every seedable table carries isSeed so demo data  */
/*  can be wiped (npm run db:seed -- --wipe) without touching real     */
/*  user records.                                                      */
/* ------------------------------------------------------------------ */

import { pgTable, text, integer, doublePrecision, timestamp, boolean, primaryKey, uniqueIndex, index } from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey();
const ts = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date());
const bool = (name: string, def = false) => boolean(name).notNull().default(def);
const seed = () => bool("is_seed", false);

/* ------------------------------- identity ------------------------------- */

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  handle: text("handle").notNull().unique(),
  role: text("role").notNull().default("user"), // user | admin
  plan: text("plan").notNull().default("free"), // free | college | pro
  // DEMO DEPLOYMENT ONLY (db/DEMO_MODE): per-account tester mode.
  //   demo       — unrestricted developer testing: access gates bypass
  //   simulation — realistic user experience: every real gate applies
  // Ignored entirely in production (isDemoMode() false → always realistic).
  // This is feature-access state, NEVER auth state.
  testerMode: text("tester_mode").notNull().default("demo"),
  // AUTOMATION CLASSIFICATION — the authority for scripted behavior.
  //   simulated=true  → a DESIGNATED simulation participant (demo-world
  //                     characters): auto-replies, auto-accepts, and
  //                     Test-Center counterpart behaviors may act AS
  //                     this account.
  //   simulated=false → a REAL/PERSONAL account: the platform NEVER
  //                     sends messages or performs actions as it —
  //                     no auto-replies, no scripted responses, ever.
  // Never inferred from a username; set only by seed config (demo-world
  // characters) — signups and admin accounts are ALWAYS real. Distinct
  // from isSeed, which only marks rows as wipeable seed DATA.
  simulated: boolean("simulated").notNull().default(false),
  // PHONE LOGIN + SMS — sensitive account data, never public unless the
  // member explicitly opts in elsewhere. Verified via OTP (hashes only).
  phone: text("phone").unique(),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  // SMS requires EXPLICIT consent — a verified number alone never opts
  // anyone in. Notification prefs: JSON {category: {inapp,email,sms}}
  // per projects|opportunities|bookings|messages|security.
  smsConsent: boolean("sms_consent").notNull().default(false),
  notifyPrefs: text("notify_prefs").notNull().default(""),
  status: text("status").notNull().default("active"), // active | suspended
  // individual | business. businessVerified is EARNED through Mavyn's
  // business-verification process — it is never granted by a subscription.
  accountType: text("account_type").notNull().default("individual"),
  businessVerified: boolean("business_verified").notNull().default(false),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaSecret: text("mfa_secret"),
  // First-run onboarding state: "" = the guided tour has never been
  // completed (new accounts). JSON {completedAt, skipped} once done.
  // Education state only — NEVER gates any feature (the app is fully
  // usable whether or not the tour ran).
  onboarding: text("onboarding").notNull().default(""),
  isSeed: seed(),
  createdAt: ts("created_at"),
});

export const passwordResets = pgTable(
  "password_resets",
  {
    id: id(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
    createdAt: ts("created_at"),
  },
  (t) => [index("pwreset_user").on(t.userId)]
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: ts("created_at"),
  },
  (t) => [index("sessions_user").on(t.userId)]
);

export const profiles = pgTable("profiles", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull().default(""),
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),
  coverPos: integer("cover_pos").notNull().default(50),
  // Profile Studio (Pro): APPEARANCE-ONLY customization, stored as a
  // sanitized JSON pick from lib/profileStudio.ts's approved design
  // system. Preserved on downgrade; display is gated by plan at read
  // time. Never affects functionality, auth, or other systems.
  studio: text("studio").notNull().default(""),
  verified: bool("verified"),

  // location — lat/lng are used server-side for distance scoping and are
  // never returned by the public API. locationVisibility controls the
  // most precise level shown publicly: city | county | state | country | hidden.
  // Exact addresses/coordinates are NEVER public regardless of setting.
  locationVisibility: text("location_visibility").notNull().default("city"),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),
  county: text("county").notNull().default(""),
  country: text("country").notNull().default(""),
  // normalized geographic ids (db/geo.db reference data) — the text
  // columns above stay as canonical DISPLAY strings so nothing built on
  // them breaks; these ids are what the server validates relationally
  // (country → state → county → city, see lib/server/geo.ts).
  countryCode: text("country_code").notNull().default(""), // ISO 3166-1, e.g. "US"
  stateId: text("state_id").notNull().default(""),         // e.g. "US-MD"
  countyId: text("county_id").notNull().default(""),       // e.g. "US-24033"
  cityId: text("city_id").notNull().default(""),           // e.g. "g4346952"
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),

  // professional identity (JSON-encoded arrays — SQLite has no json type)
  primaryRole: text("primary_role").notNull().default(""),
  additionalRoles: text("additional_roles").notNull().default("[]"),
  skills: text("skills").notNull().default("[]"),
  interests: text("interests").notNull().default("[]"),
  serviceArea: text("service_area").notNull().default("25 miles"),

  // availability + hiring
  openToWork: bool("open_to_work", true),
  availableFor: text("available_for").notNull().default("[]"),
  availableFrom: text("available_from").notNull().default(""),
  workLocation: text("work_location").notNull().default("Hybrid"),
  minBudget: integer("min_budget"),
  collabPref: text("collab_pref").notNull().default("Either"),
  hiringEnabled: bool("hiring_enabled", true),
  acceptOffers: bool("accept_offers", true),
  acceptBookings: bool("accept_bookings", true),
  acceptCollabs: bool("accept_collabs", true),

  // contact + privacy
  whoCanMessage: text("who_can_message").notNull().default("everyone"),
  visibility: text("visibility").notNull().default("public"),
  // "How should people I've revealed myself to see me in communities?"
  // keep_anonymous (default) | show_to_connections | always_profile
  revealIdentityMode: text("reveal_identity_mode").notNull().default("keep_anonymous"),
  showLocation: bool("show_location", true),
  showEducation: bool("show_education", true),
  showFollowers: bool("show_followers", true),
  showFollowing: bool("show_following", true),
  showPortfolio: bool("show_portfolio", true),
  showCompletedProjects: bool("show_completed_projects", true),
  showWorkPerformance: bool("show_work_performance", true),
  showAvailability: bool("show_availability", true),

  links: text("links").notNull().default("[]"),
  education: text("education").notNull().default("[]"), // [{school,program,gradYear}]
  trustLevel: text("trust_level").notNull().default("standard"), // standard | identity | high-trust
});

/* -------------------------------- social -------------------------------- */

export const posts = pgTable(
  "posts",
  {
    id: id(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    imageUrl: text("image_url"),
    // a post is something you CHOOSE to share — distinct from Service
    // (what you offer), Booking (someone scheduled you), Project
    // (structured paid work), and Opportunity (you're asking for people).
    kind: text("kind").notNull().default("post"), // post | work | bts | announcement | promotion | content
    // creator-defined, never hard-coded — the profile grid learns its
    // filters from whatever categories this creator actually uses
    category: text("category").notNull().default(""),
    subcategory: text("subcategory").notNull().default(""),
    /* ---- Trust & Authenticity (lib/trust.ts) ----
       Disclosure replaces a bare "Original Work" claim; attestation is the
       creator's recorded claim (labeled as such, never as proof); the
       project/booking link is validated server-side at post time and is the
       ONLY path to a "Verified Work" chip; client_confirmed is set only by
       the linked counterparty. */
    // LINKED feed item: when a Service/Opportunity/Product/Work/Event is
    // published, ONE canonical record is created in its own table and ONE
    // post points at it (refType/refId). The post is the feed presence;
    // clicking opens the REAL object (book/apply/buy/license). Never a
    // duplicate copy of the content.
    refType: text("ref_type"), // service | opportunity | product | work | event
    refId: text("ref_id"),
    disclosure: text("disclosure").notNull().default("unspecified"), // original | ai_assisted | ai_generated | credited | unspecified
    attested: bool("attested", false),
    credit: text("credit").notNull().default(""), // who made it, when disclosure=credited
    projectId: text("project_id"), // completed Mavyn project this work came from
    bookingId: text("booking_id"), // completed Mavyn booking this work came from
    clientConfirmed: bool("client_confirmed", false),
    isSeed: seed(),
    createdAt: ts("created_at"),
  },
  (t) => [index("posts_author_created").on(t.authorId, t.createdAt)]
);

export const comments = pgTable(
  "comments",
  {
    id: id(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: ts("created_at"),
  },
  (t) => [index("comments_post").on(t.postId)]
);

export const likes = pgTable(
  "likes",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at"),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })]
);

export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at"),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followingId] })]
);

/* ------------------------------- messaging ------------------------------- */

export const conversations = pgTable("conversations", {
  id: id(),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
});

export const conversationMembers = pgTable(
  "conversation_members",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] }), index("conv_members_user").on(t.userId)]
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    kind: text("kind").notNull().default("text"), // text | system (project events)
    createdAt: ts("created_at"),
  },
  (t) => [index("messages_conv_created").on(t.conversationId, t.createdAt)]
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull(), // message | follow | like | project_offer | project_accepted | extension_requested | extension_approved | project_submitted | project_approved | payment | community | application
    category: text("category").notNull().default("activity"), // activity | work | messages | communities | campus | payments
    priority: text("priority").notNull().default("normal"), // high | normal | low
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href").notNull(), // every notification has somewhere meaningful to go
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    createdAt: ts("created_at"),
  },
  (t) => [index("notif_user_read").on(t.userId, t.readAt), index("notif_user_created").on(t.userId, t.createdAt)]
);

/* ------------------------------ communities ------------------------------ */

export const communities = pgTable("communities", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  access: text("access").notNull().default("public"), // public | private | invite
  mode: text("mode").notNull().default("discussion"), // discussion | announcements | broadcast | collaboration | qa
  // standard | campus_questions (the system Q&A community every campus gets)
  kind: text("kind").notNull().default("standard"),
  category: text("category").notNull().default("general"),
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),
  rules: text("rules").notNull().default("[]"), // JSON string[]
  joinApproval: boolean("join_approval").notNull().default(false),
  whoCanPost: text("who_can_post").notNull().default("members"), // members | mods
  whoCanInvite: text("who_can_invite").notNull().default("mods"), // mods | members
  // JSON subset of ["real","alias","anonymous"] — the creator decides which
  // identity modes this community permits. Server-enforced on every post.
  identityModes: text("identity_modes").notNull().default('["real"]'),
  // ---- access & membership economics (generic: creator circles, education,
  // networking, hobby groups — the model is the same) ----
  capacity: integer("capacity"), // max ACTIVE members; null = unlimited
  // price in whole dollars per period; 0 = free. Paid + private = approval
  // THEN payment. Members keep their history when access lapses — status
  // flips to inactive, nothing is deleted.
  price: integer("price").notNull().default(0),
  billingPeriod: text("billing_period").notNull().default("monthly"), // weekly | monthly | yearly | custom
  customPeriodDays: integer("custom_period_days"),
  graceDays: integer("grace_days").notNull().default(3), // unpaid grace before access pauses
  paused: bool("paused"), // pause NEW memberships; existing members unaffected
  campusId: text("campus_id").references(() => campuses.id, { onDelete: "set null" }),
  // campus rooms can scope WHO on campus may join: everyone verified at the
  // school, current students only, or alumni. Existing memberships survive
  // affiliation changes — audience gates NEW joins.
  audience: text("audience").notNull().default("everyone"), // everyone | students | alumni
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id),
  isSeed: seed(),
  createdAt: ts("created_at"),
});

export const communityMembers = pgTable(
  "community_members",
  {
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // member | moderator | owner
    // active | pending (awaiting approval) | invited | approved_unpaid
    // (approved for a paid community, payment not completed) | inactive
    // (paid membership lapsed — history kept, access restricted) | banned
    status: text("status").notNull().default("active"),
    // paid membership: access runs until this instant (+ grace period)
    memberUntil: timestamp("member_until", { withTimezone: true, mode: "date" }),
    expiryNotified: bool("expiry_notified"),
    graceNotified: bool("grace_notified"),
    // community-specific alias. Other members never get a link from the
    // alias back to the profile.
    alias: text("alias"),
    // stable per-community anonymous code ("Anonymous • 482") so a
    // conversation's participants are distinguishable without being
    // identifiable. Random per community — no cross-community correlation.
    anonCode: text("anon_code"),
    lastIdentity: text("last_identity").notNull().default("real"), // remembered composer default
    mutedUntil: timestamp("muted_until", { withTimezone: true, mode: "date" }),
    joinedAt: ts("joined_at"),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.userId] })]
);

/* Community discussion. authorId is NEVER serialized when identity is
   alias/anonymous — masking happens in lib/server/communities.ts, the only
   serializer for this content. */
export const communityPosts = pgTable(
  "community_posts",
  {
    id: id(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    identity: text("identity").notNull().default("real"), // real | alias | anonymous
    body: text("body").notNull(),
    media: text("media").notNull().default("[]"),
    // optional link to another Mavyn record (service, opportunity, event,
    // campus listing, product, work) — source preserved, never copied
    refType: text("ref_type"),
    refId: text("ref_id"),
    pinned: bool("pinned"),
    locked: bool("locked"),
    removedAt: timestamp("removed_at", { withTimezone: true, mode: "date" }),
    removedById: text("removed_by_id"),
    removedReason: text("removed_reason").notNull().default(""),
    isSeed: seed(),
    createdAt: ts("created_at"),
  },
  (t) => [index("community_posts_comm_created").on(t.communityId, t.createdAt)]
);

export const communityComments = pgTable(
  "community_comments",
  {
    id: id(),
    postId: text("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    identity: text("identity").notNull().default("real"),
    body: text("body").notNull(),
    removedAt: timestamp("removed_at", { withTimezone: true, mode: "date" }),
    removedById: text("removed_by_id"),
    isSeed: seed(),
    createdAt: ts("created_at"),
  },
  (t) => [index("community_comments_post").on(t.postId, t.createdAt)]
);

export const communityReactions = pgTable(
  "community_reactions",
  {
    postId: text("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at"),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })]
);

/* Append-only moderation log. Every mod action — including any identity
   reveal — leaves a permanent record. */
export const communityModLog = pgTable(
  "community_mod_log",
  {
    id: id(),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(), // remove_post | remove_comment | pin | unpin | lock | unlock | mute | unmute | ban | remove_member | approve_join | decline_join | promote | demote | reveal_author
    targetType: text("target_type").notNull().default(""), // post | comment | member
    targetId: text("target_id").notNull().default(""),
    note: text("note").notNull().default(""),
    isSeed: seed(),
    createdAt: ts("created_at"),
  },
  (t) => [index("community_mod_log_comm").on(t.communityId, t.createdAt)]
);

/* Private identity reveals — anonymous to the crowd, not to everyone.
   A pair state, independent of either party's public community identity:
   pending → accepted | declined | never ("don't ask again").
   The requester is shown to the target under their MASKED community
   identity; accepting reveals both sides to each other only. */
export const identityReveals = pgTable(
  "identity_reveals",
  {
    id: id(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetId: text("target_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    communityId: text("community_id").references(() => communities.id, { onDelete: "set null" }),
    // what the target saw when the request arrived (masked label snapshot)
    requesterLabel: text("requester_label").notNull().default(""),
    // what the requester was looking at when they asked (for their own list)
    targetLabel: text("target_label").notNull().default(""),
    status: text("status").notNull().default("pending"), // pending | accepted | declined | never
    respondedAt: timestamp("responded_at", { withTimezone: true, mode: "date" }),
    isSeed: seed(),
    createdAt: ts("created_at"),
  },
  (t) => [
    uniqueIndex("identity_reveals_pair").on(t.requesterId, t.targetId),
    index("identity_reveals_target").on(t.targetId, t.status),
  ]
);

/* Blocks. viaLabel preserves what the blocker was looking at (possibly a
   masked identity) so the block list never de-anonymizes anyone. */
export const blocks = pgTable(
  "blocks",
  {
    id: id(),
    blockerId: text("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    viaLabel: text("via_label").notNull().default(""),
    isSeed: seed(),
    createdAt: ts("created_at"),
  },
  (t) => [uniqueIndex("blocks_pair").on(t.blockerId, t.blockedId)]
);

/* --------------------------------- campus --------------------------------- */

export const campuses = pgTable("campuses", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),
  isSeed: seed(),
});

export const campusVerifications = pgTable(
  "campus_verifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    // Status only. Verification evidence/documents are NEVER stored in this
    // table or returned by any API. In production, evidenceRef points at a
    // private object-store key readable only by the verification service.
    status: text("status").notNull().default("pending"), // pending | verified | rejected
    // verified relationship with the institution. Student -> Alumni is a
    // TRANSITION, never a new account: connections, messages, portfolio,
    // history, and memberships all stay.
    affiliation: text("affiliation").notNull().default("current_student"), // current_student | alumni | faculty_staff
    evidenceRef: text("evidence_ref"),
    // optional academic profile. "Class of 2027" is an ATTRIBUTE (display +
    // discovery filter), never an auto-created community or group chat.
    program: text("program").notNull().default(""),
    gradYear: text("grad_year").notNull().default(""),
    // the member controls what the public profile shows; the verification
    // itself stays stored for trust/eligibility either way
    showSchool: boolean("show_school").notNull().default(true),
    showGradYear: boolean("show_grad_year").notNull().default(true), // school + class year is the public academic identity
    showProgram: boolean("show_program").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }),
    createdAt: ts("created_at"),
  },
  (t) => [uniqueIndex("campus_verif_user_campus").on(t.userId, t.campusId)]
);

/* ------------------------------ marketplace ------------------------------ */

export const services = pgTable("services", {
  id: id(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  // price is the creator's payout; the buyer pays the 5% platform fee on top
  price: integer("price").notNull(),
  category: text("category").notNull().default("creative"),
  aiPolicy: text("ai_policy").notNull().default("client-decides"), // no-ai | disclosure | assisted | client-decides
  trustRequired: text("trust_required").notNull().default("standard"), // standard | identity | high-trust
  reach: text("reach").notNull().default("Remote"),
  // fulfillment model — never force a calendar on project work:
  // "appointment" (hair, nails, photo sessions, events → time slots)
  // "project"     (design, production, builds → project request/quote)
  fulfillment: text("fulfillment").notNull().default("project"),
  // creator-defined business rules (JSON — see lib/servicePolicies.ts):
  // location mode, travel fees, service radius, scheduling limits, and
  // cancellation/reschedule/late/no-show policies. Mavyn provides the
  // infrastructure; the creator decides how their business operates.
  config: text("config").notNull().default("{}"),
  // "show your work" — up to 3 images attached to the listing (JSON array)
  media: text("media").notNull().default("[]"),
  // promoted listings are labeled and slotted separately — they NEVER
  // enter the organic ranking
  promoted: bool("promoted", false),
  // who can see the listing:
  //   public    — directory, category pages, search, feed, profile
  //   followers — profile + directory for followers only
  //   unlisted  — reachable ONLY via the share link (/services/<id>)
  //   draft     — owner only, not published anywhere
  visibility: text("visibility").notNull().default("public"),
  // active=false = deactivated: unbookable but PRESERVED — it stays in the
  // creator's public history instead of being erased
  active: bool("active", true),
  paused: bool("paused", false),
  // PREFERRED-CLIENT EARLY ACCESS: while set and in the future, ONLY the
  // owner's active Preferred Clients holding a priority-booking /
  // early-access benefit can book. Enforced in POST /api/bookings —
  // never a display-only window.
  preferredUntil: timestamp("preferred_until", { withTimezone: true, mode: "date" }),
  isSeed: seed(),
  createdAt: ts("created_at"),
});

export const opportunities = pgTable("opportunities", {
  id: id(),
  posterId: text("poster_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  budget: integer("budget"), // null = collaboration / unpaid
  type: text("type").notNull().default("gig"), // gig | collab | event | campus
  location: text("location").notNull().default(""),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  remote: bool("remote", false),
  studentFriendly: bool("student_friendly", false),
  // ELIGIBILITY ≠ VISIBILITY: everyone can SEE the listing; this rule
  // decides who can APPLY. anyone | students (any verified current
  // student) | my_school (current students at eligibilityCampusId) |
  // alumni (verified alumni). Enforced at application time, shown as a
  // badge on the card.
  eligibility: text("eligibility").notNull().default("anyone"),
  eligibilityCampusId: text("eligibility_campus_id"),
  trustRequired: text("trust_required").notNull().default("standard"),
  applyBy: timestamp("apply_by", { withTimezone: true, mode: "date" }),
  eventDate: timestamp("event_date", { withTimezone: true, mode: "date" }),
  // poster-defined application requirements:
  // { requireMessage?: boolean, question?: string } — availability is added
  // automatically when the opportunity has a date; portfolio/profile are
  // always auto-attached, never re-typed.
  applyConfig: text("apply_config").notNull().default("{}"),
  // configurable TEAM & OPENINGS (JSON, lib/opportunityRoles.ts):
  // [{id,title,count,pay,description}] — one opportunity can need
  // "Photographer ×1 $500, Model ×3 $200, MUA ×1 $200". Empty = simple
  // single-role opportunity. Roles are CONFIGURATION of the universal
  // system — never a separate casting/hiring/fashion system.
  roles: text("roles").notNull().default("[]"),
  // ENGAGEMENT configuration (JSON, lib/engagement.ts) — one-time work vs
  // ongoing relationships on the SAME system: {type: one_time|short_term|
  // ongoing|part_time|full_time|temporary|collab|custom, workload, schedule,
  // startDate, duration, compModel, rate, classification: mavyn_freelance|
  // external_employment, interviewMode: none|mavyn|external}. Mavyn never
  // classifies anyone as employee/contractor — the poster configures it and
  // external employment is labeled as handled OUTSIDE Mavyn.
  engagement: text("engagement").notNull().default("{}"),
  status: text("status").notNull().default("open"), // open | closed | filled
  isSeed: seed(),
  createdAt: ts("created_at"),
});

export const applications = pgTable(
  "applications",
  {
    id: id(),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    applicantId: text("applicant_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull().default(""),
    // which role this person applied for (role opportunities only)
    roleId: text("role_id"),
    // interview stage (JSON): {mode: "mavyn"|"external", at?, note?} —
    // external interviews are labeled as happening OUTSIDE Mavyn
    interview: text("interview").notNull().default("{}"),
    // the configurable OFFER the poster sent (JSON, lib/engagement.ts):
    // role, comp model + amount, schedule, start date, duration,
    // classification, terms — what the applicant actually agrees to
    offer: text("offer").notNull().default("{}"),
    availability: text("availability").notNull().default("yes"), // yes | no | need_check
    // answers to poster-defined questions + the optional "anything else"
    answers: text("answers").notNull().default("{}"),
    // submitted → shortlisted → interview → selected (offer out) →
    // confirmed (one-time; booking exists) | active (ongoing engagement;
    // paid in cycles) → completed · declined (poster) · offer_declined
    status: text("status").notNull().default("submitted"),
    createdAt: ts("created_at"),
  },
  (t) => [uniqueIndex("app_opp_applicant").on(t.opportunityId, t.applicantId)]
);

/* -------------------------------- projects -------------------------------- */

export const projects = pgTable(
  "projects",
  {
    id: id(),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id),
    creatorId: text("creator_id")
      .notNull()
      .references(() => users.id),
    serviceId: text("service_id").references(() => services.id, { onDelete: "set null" }),
    opportunityId: text("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
    conversationId: text("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    brief: text("brief").notNull().default(""),
    // amount = creator payout in whole dollars; fee computed at payment time
    amount: integer("amount").notNull(),
    aiRequirement: text("ai_requirement").notNull().default("client-decides"),
    deadline: timestamp("deadline", { withTimezone: true, mode: "date" }),
    // draft → offer_sent → accepted → in_progress → extension_requested →
    // submitted → approved → completed → reviewed
    // lib/server/projects.ts is the single transition authority.
    state: text("state").notNull().default("draft"),
    isSeed: seed(),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("projects_client").on(t.clientId), index("projects_creator").on(t.creatorId)]
);

export const projectMilestones = pgTable("project_milestones", {
  id: id(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
  status: text("status").notNull().default("pending"), // pending | done
  order: integer("order").notNull().default(0),
});

export const extensionRequests = pgTable(
  "extension_requests",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    requestedById: text("requested_by_id")
      .notNull()
      .references(() => users.id),
    days: integer("days").notNull(),
    reason: text("reason").notNull().default(""),
    status: text("status").notNull().default("pending"), // pending | approved | denied
    decidedAt: timestamp("decided_at", { withTimezone: true, mode: "date" }),
    createdAt: ts("created_at"),
  },
  (t) => [index("ext_project_status").on(t.projectId, t.status)]
);

/* ------------------------- progress updates -------------------------
   Real per-record progress history posted by the person DOING the work
   (project creator / booking provider). Each row is one event — a
   status + percent + message update, or an ETA change (kind "eta",
   which records the previous estimate so deadlines never move
   silently). The project/booking timeline is generated from these rows
   plus the other real records (payments, extensions, reviews) — never
   from one overwritten text field. */
export const progressUpdates = pgTable(
  "progress_updates",
  {
    id: id(),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    bookingId: text("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind").notNull().default("update"), // update | eta
    // not_started | preparing | in_progress | waiting_on_client |
    // revision | finalizing | ready_for_review | completed
    status: text("status").notNull().default(""),
    percent: integer("percent"), // 0–100, optional
    message: text("message").notNull().default(""),
    etaAt: timestamp("eta_at", { withTimezone: true, mode: "date" }), // new estimate
    prevEtaAt: timestamp("prev_eta_at", { withTimezone: true, mode: "date" }), // what it replaced (eta rows)
    attachmentUrl: text("attachment_url").notNull().default(""),
    createdAt: ts("created_at"),
  },
  (t) => [index("progress_project").on(t.projectId, t.createdAt), index("progress_booking").on(t.bookingId, t.createdAt)]
);

/* -------------------------- preferred clients --------------------------
   PRIVATE provider↔client loyalty relationship. Never public: no badge,
   no search surface, no cross-provider visibility, no platform score.
   One row per (provider, client); removal keeps the row (status
   "removed" + removedAt) so the relationship HISTORY survives.
   benefits = JSON array of {key, percent?, label?} chosen by the
   provider — discounts are optional, never mandatory. */
export const preferredClients = pgTable(
  "preferred_clients",
  {
    id: id(),
    providerId: text("provider_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"), // active | removed
    benefits: text("benefits").notNull().default("[]"),
    note: text("note").notNull().default(""),
    addedAt: timestamp("added_at", { withTimezone: true, mode: "date" }).notNull().$defaultFn(() => new Date()),
    removedAt: timestamp("removed_at", { withTimezone: true, mode: "date" }),
    createdAt: ts("created_at"),
  },
  (t) => [
    uniqueIndex("preferred_pair").on(t.providerId, t.clientId),
    index("preferred_client").on(t.clientId, t.status),
  ]
);

/* ---------------------------- business team ----------------------------
   EXPLICIT internal-team membership for business accounts — deliberately
   separate from derived relationships: a creator hired for one project
   is TALENT, a customer who booked is a CLIENT, and neither ever becomes
   "staff" implicitly. Team rows are created only by the business, are
   private to it, and removal keeps the row (endedAt) so history holds.
   compensation is a PRIVATE note for the business — never public. */
export const businessTeam = pgTable(
  "business_team",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    status: text("status").notNull().default("active"), // active | inactive
    // admin SEAT registration (capacity-tracked per plan). Delegated
    // acting-on-behalf access is a separate rolling-out feature — this
    // flag never grants login rights to the business account.
    isAdmin: boolean("is_admin").notNull().default(false),
    compensation: text("compensation").notNull().default(""), // private note
    notes: text("notes").notNull().default(""),
    addedAt: timestamp("added_at", { withTimezone: true, mode: "date" }).notNull().$defaultFn(() => new Date()),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
    createdAt: ts("created_at"),
  },
  (t) => [
    uniqueIndex("business_team_pair").on(t.businessId, t.personId),
    index("business_team_person").on(t.personId, t.status),
  ]
);


/* -------------------------------- bookings -------------------------------- */

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    serviceId: text("service_id").references(() => services.id, { onDelete: "set null" }),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id),
    providerId: text("provider_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
    durationMin: integer("duration_min").notNull().default(60),
    price: integer("price").notNull(),
    // itemized snapshot of what was selected from the creator's menu —
    // [{label, amount}] in payout dollars; frozen at booking time so the
    // receipt never changes even if the creator edits the menu later
    items: text("items").notNull().default("[]"),
    location: text("location").notNull().default(""),
    // travel fee computed server-side from the service's travel config and
    // the real distance between client and provider — disclosed before pay
    travelFee: integer("travel_fee").notNull().default(0),
    // lifecycle: pending (requested, awaiting creator) → accepted (payment
    // pending) → confirmed (payment secured) → completed · cancelled ·
    // reschedule_requested (proposedStartsAt holds the new time)
    status: text("status").notNull().default("pending"),
    // demo progress beats for confirmed bookings (one-time provider updates
    // into the conversation): "" -> preparing -> in_progress
    progress: text("progress").notNull().default(""),
    proposedStartsAt: timestamp("proposed_starts_at", { withTimezone: true, mode: "date" }),
    // bookings and their conversation reference the same transaction
    conversationId: text("conversation_id"),
    isSeed: seed(),
    createdAt: ts("created_at"),
  },
  (t) => [index("bookings_provider_starts").on(t.providerId, t.startsAt)]
);

/* ------------------------------ OTP + outbox ------------------------------ */

/* One-time codes for phone verification & phone login. SECURITY: only a
   sha256 HASH of the code is ever stored; 5-minute expiry; 5 attempts;
   request rate limiting lives in the route. */
export const otpCodes = pgTable(
  "otp_codes",
  {
    id: id(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    purpose: text("purpose").notNull().default("login"), // login | verify
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: ts("created_at"),
  },
  (t) => [index("otp_phone").on(t.phone, t.createdAt)]
);

/* Outbound email/SMS delivery log. In this demo it IS the delivery
   channel (inspectable, honest); production swaps the writer for a real
   provider (Twilio/SES) behind the same dispatch call. OTP codes are
   NEVER written here in plaintext. */
export const outbox = pgTable(
  "outbox",
  {
    id: id(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(), // sms | email
    to: text("to").notNull(),
    body: text("body").notNull(),
    kind: text("kind").notNull().default(""), // pref category or 'otp' | 'security'
    createdAt: ts("created_at"),
  },
  (t) => [index("outbox_user").on(t.userId, t.createdAt)]
);

/* ------------------------- portfolio / experience ------------------------- */

export const portfolioItems = pgTable("portfolio_items", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  kind: text("kind").notNull().default("image"), // image | video | audio | link | project | mavyn_project
  mediaUrl: text("media_url"),
  client: text("client").notNull().default(""),
  projectId: text("project_id"), // set when sourced from a completed Mavyn project
  aiInvolvement: text("ai_involvement").notNull().default("none"),
  visible: bool("visible", true),
  createdAt: ts("created_at"),
});

export const experiences = pgTable("experiences", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  position: text("position").notNull(),
  organization: text("organization").notNull(),
  start: text("start").notNull(),
  end: text("end").notNull().default(""), // "" = present
  description: text("description").notNull().default(""),
  location: text("location").notNull().default(""),
  order: integer("order").notNull().default(0),
});

/* -------------------------------- products -------------------------------- */
/* The sixth entity. Post = something you share · Service = something you
   offer · Booking = someone scheduled you · Project = structured paid work
   · Opportunity = you're asking for people · PRODUCT = something you SELL.
   One configurable listing system: category (official or custom), variants,
   quantity, fulfillment options, and either Mavyn checkout (orders below)
   or an HONEST external link ("you'll complete your purchase on the
   seller's website" — Mavyn never pretends it processed that sale). */

export const products = pgTable("products", {
  id: id(),
  sellerId: text("seller_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  // whole dollars, seller payout; buyer pays the 5% fee on top (Mavyn checkout)
  price: integer("price").notNull(),
  category: text("category").notNull().default("other"),
  condition: text("condition").notNull().default(""), // "", new, like_new, used
  quantity: integer("quantity").notNull().default(1),
  sold: integer("sold").notNull().default(0),
  // [{name:"Size", options:["S","M","L"]}] — up to 2 groups
  variants: text("variants").notNull().default("[]"),
  // subset of: shipping | pickup | delivery | digital — buyer picks one
  fulfillment: text("fulfillment").notNull().default('["shipping"]'),
  media: text("media").notNull().default("[]"), // up to 4 images
  // seller-defined return policy (JSON, lib/protection.ts) — disclosed
  // BEFORE checkout. Platform protections survive "no returns".
  returnPolicy: text("return_policy").notNull().default("{}"),
  // set ⇒ external checkout: discovery on Mavyn, purchase on their site
  externalUrl: text("external_url"),
  status: text("status").notNull().default("active"), // active | sold_out | archived
  isSeed: seed(),
  createdAt: ts("created_at"),
});

/* --------------------------------- orders --------------------------------- */
/* The purchase transaction — the buyer SEES what's happening instead of
   hoping: placed → secured → preparing → shipped (carrier/tracking/eta) →
   delivered → completed (payout released) · cancelled. Funds are held from
   payment until completion, exactly like bookings/projects. */

export const orders = pgTable(
  "orders",
  {
    id: id(),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sellerId: text("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // frozen snapshot — the receipt survives product edits
    title: text("title").notNull(),
    price: integer("price").notNull(), // per unit, seller payout dollars
    qty: integer("qty").notNull().default(1),
    variant: text("variant").notNull().default(""), // "Size: L · Color: Black"
    fulfillment: text("fulfillment").notNull().default("shipping"),
    // pickup orders NEVER carry an address — exact location is arranged in
    // the conversation after confirmation, by design
    note: text("note").notNull().default(""),
    status: text("status").notNull().default("placed"),
    // {carrier, code, eta} — set at ship time; a real integration would
    // sync from the carrier, the demo simulates the states honestly
    tracking: text("tracking").notNull().default("{}"),
    // buyer-protection window: starts at delivery; if no problem is
    // reported before it ends, the order auto-completes and funds release
    protectionEndsAt: timestamp("protection_ends_at", { withTimezone: true, mode: "date" }),
    // PRIVATE seller shipment evidence (JSON): {serial?, weightLb?, note?,
    // photos: []} — recorded before shipping (required for high-value).
    // Never public; serial visible to seller + platform review only.
    sellerEvidence: text("seller_evidence").notNull().default("{}"),
    conversationId: text("conversation_id"),
    isSeed: seed(),
    createdAt: ts("created_at"),
  },
  (t) => [index("orders_buyer").on(t.buyerId, t.createdAt), index("orders_seller").on(t.sellerId, t.createdAt)]
);

/* ---------------------------------- works ---------------------------------- */
/* Licensable creative WORK — beats, tracks, packs, photos, designs. The
   seventh entity: showcased safely (configurable preview, creator-controlled
   watermark labeling) and licensed on the CREATOR's terms. Mavyn never
   claims content can't be recorded or stolen — the protection is clear
   terms, preserved license records, and a dispute lane with evidence. */

export const works = pgTable("works", {
  id: id(),
  creatorId: text("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  kind: text("kind").notNull().default("beat"), // beat | track | sample_pack | photo | design | video | other
  description: text("description").notNull().default(""),
  coverUrl: text("cover_url"), // image data-URL
  // streaming preview instead of handing everyone the original file:
  previewUrl: text("preview_url"), // audio/image data-URL or path
  previewLength: integer("preview_length").notNull().default(30), // seconds
  watermarked: bool("watermarked", true), // creator-controlled tag on previews
  // creator-configured license OPTIONS (JSON, lib/licensing.ts) — free,
  // non-commercial, commercial, exclusive, custom; their prices, their terms
  licenseOptions: text("license_options").notNull().default("[]"),
  // set when an EXCLUSIVE license is sold — further licensing stops
  exclusiveLicenseId: text("exclusive_license_id"),
  status: text("status").notNull().default("active"), // active | archived
  isSeed: seed(),
  createdAt: ts("created_at"),
});

/* --------------------------------- licenses --------------------------------- */
/* The transaction/license RECORD — who licensed what, on which terms, when,
   for how much. Frozen at purchase; the raw material of dispute resolution. */

export const licenses = pgTable(
  "licenses",
  {
    id: id(), // the license / transaction ID shown to both parties
    workId: text("work_id").references(() => works.id, { onDelete: "set null" }),
    creatorId: text("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    licenseeId: text("licensee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // snapshot of the agreed terms — survives later edits to the work
    workTitle: text("work_title").notNull(),
    licenseType: text("license_type").notNull(), // free | non_commercial | commercial | exclusive | custom
    optionName: text("option_name").notNull(),
    permittedUsage: text("permitted_usage").notNull().default(""),
    restrictions: text("restrictions").notNull().default(""),
    attribution: bool("attribution", false),
    price: integer("price").notNull().default(0), // creator payout dollars
    // issued (payment secured, delivery pending) → completed (released);
    // free licenses complete immediately
    status: text("status").notNull().default("issued"),
    conversationId: text("conversation_id"),
    isSeed: seed(),
    createdAt: ts("created_at"),
  },
  (t) => [index("licenses_work").on(t.workId), index("licenses_creator").on(t.creatorId, t.createdAt)]
);

/* ----------------------------- campus marketplace ----------------------------- */
/* Students helping students — a campus-scoped marketplace, SEPARATE from
   the worldwide Shop. One configurable listing, six transaction types:
   fixed price | free | negotiable (OBO) | trade | auction | borrow — plus
   "need to borrow" requests. FREE means you keep it; BORROW means it
   stays the owner's property and comes back. Verified campus members
   transact; guests browse a limited slice. */

export const campusListings = pgTable(
  "campus_listings",
  {
    id: id(),
    sellerId: text("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("other"),
    // fixed | free | negotiable | trade | auction | borrow | need_borrow
    type: text("type").notNull().default("fixed"),
    price: integer("price"), // fixed/negotiable ask; auction starting price
    condition: text("condition").notNull().default(""), // new | like_new | good | fair
    media: text("media").notNull().default("[]"),
    quantity: integer("quantity").notNull().default(1),
    claimed: integer("claimed").notNull().default(0),
    // pickup | campus_delivery | shipping | flexible (JSON array)
    fulfillment: text("fulfillment").notNull().default('["pickup"]'),
    // general meeting area only — NEVER a private address
    meetSpot: text("meet_spot").notNull().default(""),
    firstCome: bool("first_come", true),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    // free items: Claim → Reserved → Completed
    claimedById: text("claimed_by_id"),
    // auctions (optional — never the default)
    auctionEndsAt: timestamp("auction_ends_at", { withTimezone: true, mode: "date" }),
    reservePrice: integer("reserve_price"),
    bidIncrement: integer("bid_increment").notNull().default(1),
    // borrow config: $0 by default — this is resource sharing, not rental
    maxBorrowDays: integer("max_borrow_days"),
    allowExtensions: bool("allow_extensions", true),
    deposit: integer("deposit"), // optional REFUNDABLE security deposit
    status: text("status").notNull().default("active"), // active | reserved | completed | expired | archived
    isSeed: seed(),
    createdAt: ts("created_at"),
  },
  (t) => [index("campus_listings_campus").on(t.campusId, t.createdAt)]
);

export const bids = pgTable(
  "bids",
  {
    id: id(),
    listingId: text("listing_id")
      .notNull()
      .references(() => campusListings.id, { onDelete: "cascade" }),
    bidderId: text("bidder_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    createdAt: ts("created_at"),
  },
  (t) => [index("bids_listing").on(t.listingId, t.amount)]
);

/* ---------------------------------- loans ---------------------------------- */
/* The whole loan is tracked: Requested → Approved → Borrowed → Return
   claimed → Completed (+ overdue flags, extensions, and BEFORE/AFTER
   condition records so "it was already cracked" has an answer). */

export const loans = pgTable(
  "loans",
  {
    id: id(),
    listingId: text("listing_id").references(() => campusListings.id, { onDelete: "set null" }),
    lenderId: text("lender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    borrowerId: text("borrower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemTitle: text("item_title").notNull(),
    message: text("message").notNull().default(""),
    // requested → approved (accepted, exchange pending) → borrowed →
    // return_claimed → completed · declined · cancelled ·
    // returned_disputed (damage/missing reported). Display phases
    // "Return due"/"Overdue" derive from dueAt — see loanPhase().
    status: text("status").notNull().default("requested"),
    // the borrowing AGREEMENT: when the item is needed (date + approx
    // time), how the exchange happens, and when it comes back (dueAt
    // carries date + approx time)
    neededAt: timestamp("needed_at", { withTimezone: true, mode: "date" }),
    exchangeMethod: text("exchange_method").notNull().default("campus_meetup"), // campus_meetup | pickup | dropoff | custom
    exchangeNote: text("exchange_note").notNull().default(""),
    startAt: timestamp("start_at", { withTimezone: true, mode: "date" }),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }).notNull(),
    // owner's counter-proposed return date/time on an extension request —
    // the borrower accepts or declines; nothing changes automatically
    counterUntil: timestamp("counter_until", { withTimezone: true, mode: "date" }),
    // factual return record: when the borrower handed it back, and whether
    // that was after the agreed due date (history, never auto-punishment)
    returnedAt: timestamp("returned_at", { withTimezone: true, mode: "date" }),
    returnedLate: bool("returned_late"),
    // {note, photos[]} — recorded at handoff / at return
    conditionBefore: text("condition_before").notNull().default("{}"),
    conditionAfter: text("condition_after").notNull().default("{}"),
    extensionUntil: timestamp("extension_until", { withTimezone: true, mode: "date" }), // pending request
    dueSoonNotified: bool("due_soon_notified", false),
    overdueNotified: bool("overdue_notified", false),
    deposit: integer("deposit"), // refundable, held via payments when set
    conversationId: text("conversation_id"),
    isSeed: seed(),
    createdAt: ts("created_at"),
  },
  (t) => [index("loans_lender").on(t.lenderId, t.dueAt), index("loans_borrower").on(t.borrowerId, t.dueAt)]
);

/* --------------------------------- disputes --------------------------------- */
/* Two-sided, evidence-based. Opening one FREEZES funds; nobody wins by
   default. kind "problem" (delivery/item disputes) or "return" (policy
   returns). Evidence entries: [{by, at, note, photos[]}] — private to the
   parties and platform review. */

export const disputes = pgTable(
  "disputes",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    openedById: text("opened_by_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind").notNull().default("problem"), // problem | return
    reason: text("reason").notNull(),
    // open → under_review | return_authorized → return_in_transit →
    // resolved_refund | resolved_release | withdrawn
    status: text("status").notNull().default("open"),
    evidence: text("evidence").notNull().default("[]"),
    returnTracking: text("return_tracking").notNull().default(""),
    resolutionNote: text("resolution_note").notNull().default(""),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    isSeed: seed(),
    createdAt: ts("created_at"),
  },
  (t) => [index("disputes_order").on(t.orderId)]
);

/* ------------------------------- order events ------------------------------- */
/* The private chronological evidence timeline / audit log — every state
   change, payment event, evidence submission, and decision, appended and
   never rewritten. Visible only to the two parties and platform review. */

export const orderEvents = pgTable(
  "order_events",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    actorId: text("actor_id"), // null = system
    kind: text("kind").notNull(), // created | paid | preparing | shipped | delivered | protection_started | disputed | evidence | return_* | resolved | completed | cancelled | released | refunded
    note: text("note").notNull().default(""),
    createdAt: ts("created_at"),
  },
  (t) => [index("order_events_order").on(t.orderId, t.createdAt)]
);

/* --------------------------- reviews / payments --------------------------- */

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    subjectId: text("subject_id")
      .notNull()
      .references(() => users.id),
    rating: doublePrecision("rating").notNull(),
    body: text("body").notNull().default(""),
    createdAt: ts("created_at"),
  },
  (t) => [uniqueIndex("reviews_project_author").on(t.projectId, t.authorId)]
);

export const payments = pgTable("payments", {
  id: id(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  bookingId: text("booking_id"),
  orderId: text("order_id"), // product purchase this payment secures
  licenseId: text("license_id"), // creative-work license this payment secures
  communityId: text("community_id"), // community membership period this payment covers
  payerId: text("payer_id")
    .notNull()
    .references(() => users.id),
  payeeId: text("payee_id")
    .notNull()
    .references(() => users.id),
  // amounts in cents; amount = creator payout, fee = 5% buyer-side platform fee.
  // NO card data is ever stored. provider/providerRef are the Stripe Connect
  // seam: providerRef will hold the PaymentIntent / Transfer id and webhooks
  // will drive status transitions.
  amountCents: integer("amount_cents").notNull(),
  feeCents: integer("fee_cents").notNull(),
  status: text("status").notNull().default("pending"), // pending | held | released | refunded
  provider: text("provider").notNull().default("stripe_connect"),
  providerRef: text("provider_ref"),
  createdAt: ts("created_at"),
});

/* ------------------------------ interactions ------------------------------ */
/* The behavioral event log feeding the recommendation engine — views,
   likes, saves, bookings, hides, and everything between. Raw signals
   only; ranking logic lives in lib/server/recsys.ts and can be swapped
   for an ML model without touching this table. */

export const interactions = pgTable(
  "interactions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(), // post | service | opportunity | community | event | user
    targetId: text("target_id").notNull(),
    action: text("action").notNull(), // view | like | unlike | comment | save | unsave | follow | unfollow | profile_view | service_view | book | apply | join | hide | not_interested | report
    meta: text("meta").notNull().default(""),
    createdAt: ts("created_at"),
  },
  (t) => [index("interactions_user").on(t.userId, t.action), index("interactions_target").on(t.targetType, t.targetId)]
);

/* ------------------------------- moderation ------------------------------- */

export const reports = pgTable("reports", {
  id: id(),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => users.id),
  targetType: text("target_type").notNull(), // user | post | message | service | opportunity | community | project
  targetId: text("target_id").notNull(),
  category: text("category").notNull(), // payment | creator | creative-integrity | safety | emergency | stolen_work | impersonation | false_service_claim | copyright | other
  details: text("details").notNull().default(""),
  // automated RISK SIGNALS computed at filing time (duplicate-image match,
  // account age, prior reports). Advisory context for the human moderator —
  // NEVER treated as proof, never triggers automatic action.
  signals: text("signals").notNull().default("[]"),
  status: text("status").notNull().default("open"), // open | reviewing | resolved | dismissed
  createdAt: ts("created_at"),
});

/* -------------------------------- bookmarks -------------------------------- */
/* One shared save system: any record type, referenced by id — never a copy. */

export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(), // post | opportunity | service | event | community | user (saved talent)
    targetId: text("target_id").notNull(),
    createdAt: ts("created_at"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetId] })]
);

/* --------------------------------- events --------------------------------- */
/* Slug ids match the event detail routes; list surfaces query this table.   */

export const events = pgTable("events", {
  id: id(),
  slug: text("slug").notNull().unique(),
  hostId: text("host_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  // SCOPE RULE — campusId set = a campus event: it lives in Your Campus
  // (visible to that campus's verified members only) and NEVER appears in
  // the public Events section. campusId null = the wider world.
  campusId: text("campus_id").references(() => campuses.id, { onDelete: "set null" }),
  // VISIBILITY ≠ ELIGIBILITY: a campus event may be LISTED publicly
  // (organizer opt-in; info only) while RSVP stays restricted to
  // verified members of that campus.
  publicVisibility: boolean("public_visibility").notNull().default(false),
  category: text("category").notNull().default("Other"),
  startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
  timeLabel: text("time_label").notNull().default(""),
  location: text("location").notNull().default(""),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),
  // coords power nearby discovery server-side only — never returned by the API
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  price: integer("price"), // null = free
  capacity: integer("capacity"),
  attending: integer("attending").notNull().default(0), // seed baseline; real RSVPs add on top
  imageUrl: text("image_url"),
  kind: text("kind").notNull().default("rsvp"), // rsvp | registration | ticket | approval
  ageRule: text("age_rule").notNull().default("all"),
  config: text("config").notNull().default("{}"), // {fields, rules, waitlist}
  status: text("status").notNull().default("active"), // active | cancelled
  isSeed: seed(),
  createdAt: ts("created_at"),
});

/* One-click "Going" — a real attendee record, not a counter. */
export const eventRsvps = pgTable(
  "event_rsvps",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at"),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] })]
);

/* ================================ LIVE ================================ */
/* Mavyn Live — ONE universal live-streaming ecosystem for everyone      */
/* (students, creators, musicians, gamers, businesses, educators…).      */
/* "Campus" is an AUDIENCE/DISCOVERY layer inside Live, never a separate */
/* product. Streams carry real state transitions (live → ended →         */
/* replay saved/deleted), and every permission (audience gating,         */
/* campus verification, mutes/blocks, moderator powers) is enforced      */
/* SERVER-SIDE in lib/server/live.ts — the UI is never the security.     */
/*                                                                       */
/* Video transport note (honest): the sandbox has no RTMP/WebRTC media   */
/* infrastructure, so the stage renders a live presence canvas; every    */
/* OTHER part of the system (state, chat, reactions, presence,           */
/* moderation, guests, replays, permissions) is real and DB-backed.      */

export const liveStreams = pgTable("live_streams", {
  id: id(),
  hostId: text("host_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  // music | gaming | fashion | fitness | education | business |
  // conversation | behind_the_scenes | irl | creative | other
  category: text("category").notNull().default("other"),
  // everyone | followers | campus | nearby | community | invite
  audience: text("audience").notNull().default("everyone"),
  campusId: text("campus_id").references(() => campuses.id), // audience=campus → the host's VERIFIED campus only
  communityId: text("community_id").references(() => communities.id), // audience=community → members only
  status: text("status").notNull().default("live"), // live | ended
  chatEnabled: bool("chat_enabled", true),
  reactionsEnabled: bool("reactions_enabled", true),
  sharingEnabled: bool("sharing_enabled", true),
  guestsEnabled: bool("guests_enabled", true),
  saveReplay: bool("save_replay", true),
  pinnedMessageId: text("pinned_message_id").notNull().default(""),
  // replay lifecycle after the stream ends: none | saved | deleted
  replayStatus: text("replay_status").notNull().default("none"),
  replayHighlight: bool("replay_highlight", false),
  // host city centroid at start time — SERVER-SIDE nearby scoping only,
  // never returned by any API (same privacy rule as profiles.lat/lng)
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  peakViewers: integer("peak_viewers").notNull().default(0),
  startedAt: ts("started_at"),
  endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
  isSeed: seed(),
  createdAt: ts("created_at"),
});

export const liveMessages = pgTable("live_messages", {
  id: id(),
  streamId: text("stream_id")
    .notNull()
    .references(() => liveStreams.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  kind: text("kind").notNull().default("chat"), // chat | system
  deleted: bool("deleted", false), // moderator-deleted — kept for audit, never served
  createdAt: ts("created_at"),
});

/* named reaction types rendered as icons (heart | fire | clap | wow | laugh) */
export const liveReactions = pgTable("live_reactions", {
  id: id(),
  streamId: text("stream_id")
    .notNull()
    .references(() => liveStreams.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("heart"),
  createdAt: ts("created_at"),
});

/* presence: heartbeat rows — viewerCount = lastSeenAt within the window */
export const liveViewers = pgTable(
  "live_viewers",
  {
    streamId: text("stream_id")
      .notNull()
      .references(() => liveStreams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: ts("joined_at"),
    lastSeenAt: ts("last_seen_at"),
  },
  (t) => [primaryKey({ columns: [t.streamId, t.userId] })]
);

/* guests / co-hosts: invited → active (split-screen) | declined | removed */
export const liveGuests = pgTable("live_guests", {
  id: id(),
  streamId: text("stream_id")
    .notNull()
    .references(() => liveStreams.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("invited"), // invited | active | declined | removed | left
  invitedAt: ts("invited_at"),
  joinedAt: timestamp("joined_at", { withTimezone: true, mode: "date" }),
});

export const liveModerators = pgTable(
  "live_moderators",
  {
    streamId: text("stream_id")
      .notNull()
      .references(() => liveStreams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addedAt: ts("added_at"),
  },
  (t) => [primaryKey({ columns: [t.streamId, t.userId] })]
);

/* per-stream restrictions: mute = watch but not chat · block = no access */
export const liveRestrictions = pgTable("live_restrictions", {
  id: id(),
  streamId: text("stream_id")
    .notNull()
    .references(() => liveStreams.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // mute | block
  createdAt: ts("created_at"),
});

/* ------------------------------ kv state ------------------------------ */
/* Small operational state that used to live in files under db/ (QA run
   cursors, demo sign-out revocations, guide-defect reports). Vercel's
   filesystem is read-only, so this state lives in the database like
   everything else. Values are JSON strings keyed by name. */

export const kvState = pgTable("kv_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: ts("updated_at"),
});
