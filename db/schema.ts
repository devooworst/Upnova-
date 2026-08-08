/* ------------------------------------------------------------------ */
/*  UpNova — production data model (Drizzle ORM)                       */
/*                                                                     */
/*  Dev runs on SQLite (zero-config in any sandbox). The schema is     */
/*  written to be portable to Postgres for production: swap the        */
/*  dialect, turn the string "enum" columns into real enums, and       */
/*  apply the Row Level Security policies in db/rls.sql. Until then,   */
/*  every route handler enforces identical ownership rules in the      */
/*  app layer via lib/server/authz.ts — no mutation happens without    */
/*  an ownership check.                                                */
/*                                                                     */
/*  Seed separation: every seedable table carries isSeed so demo data  */
/*  can be wiped (npm run db:seed -- --wipe) without touching real     */
/*  user records.                                                      */
/* ------------------------------------------------------------------ */

import { sqliteTable, text, integer, real, primaryKey, uniqueIndex, index } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const ts = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());
const bool = (name: string, def = false) => integer(name, { mode: "boolean" }).notNull().default(def);
const seed = () => bool("is_seed", false);

/* ------------------------------- identity ------------------------------- */

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  handle: text("handle").notNull().unique(),
  role: text("role").notNull().default("user"), // user | admin
  plan: text("plan").notNull().default("free"), // free | college | pro
  status: text("status").notNull().default("active"), // active | suspended
  isSeed: seed(),
  createdAt: ts("created_at"),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: ts("created_at"),
  },
  (t) => [index("sessions_user").on(t.userId)]
);

export const profiles = sqliteTable("profiles", {
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
  verified: bool("verified"),

  // location — lat/lng are used server-side for distance scoping and are
  // never returned by the public API
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),
  county: text("county").notNull().default(""),
  country: text("country").notNull().default(""),
  lat: real("lat"),
  lng: real("lng"),

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

export const posts = sqliteTable(
  "posts",
  {
    id: id(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    imageUrl: text("image_url"),
    kind: text("kind").notNull().default("post"), // post | opportunity | service | poll | event
    isSeed: seed(),
    createdAt: ts("created_at"),
  },
  (t) => [index("posts_author_created").on(t.authorId, t.createdAt)]
);

export const comments = sqliteTable(
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

export const likes = sqliteTable(
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

export const follows = sqliteTable(
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

export const conversations = sqliteTable("conversations", {
  id: id(),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
});

export const conversationMembers = sqliteTable(
  "conversation_members",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: integer("last_read_at", { mode: "timestamp_ms" }),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] }), index("conv_members_user").on(t.userId)]
);

export const messages = sqliteTable(
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
    createdAt: ts("created_at"),
  },
  (t) => [index("messages_conv_created").on(t.conversationId, t.createdAt)]
);

export const notifications = sqliteTable(
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
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: ts("created_at"),
  },
  (t) => [index("notif_user_read").on(t.userId, t.readAt), index("notif_user_created").on(t.userId, t.createdAt)]
);

/* ------------------------------ communities ------------------------------ */

export const communities = sqliteTable("communities", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  access: text("access").notNull().default("public"), // public | private | invite | verified
  mode: text("mode").notNull().default("discussion"), // discussion | announcements | broadcast | collaboration | qa
  avatarUrl: text("avatar_url"),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id),
  isSeed: seed(),
  createdAt: ts("created_at"),
});

export const communityMembers = sqliteTable(
  "community_members",
  {
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // member | moderator | owner
    joinedAt: ts("joined_at"),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.userId] })]
);

/* --------------------------------- campus --------------------------------- */

export const campuses = sqliteTable("campuses", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),
  isSeed: seed(),
});

export const campusVerifications = sqliteTable(
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
    evidenceRef: text("evidence_ref"),
    program: text("program").notNull().default(""),
    gradYear: text("grad_year").notNull().default(""),
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
    createdAt: ts("created_at"),
  },
  (t) => [uniqueIndex("campus_verif_user_campus").on(t.userId, t.campusId)]
);

/* ------------------------------ marketplace ------------------------------ */

export const services = sqliteTable("services", {
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
  active: bool("active", true),
  paused: bool("paused", false),
  isSeed: seed(),
  createdAt: ts("created_at"),
});

export const opportunities = sqliteTable("opportunities", {
  id: id(),
  posterId: text("poster_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  budget: integer("budget"), // null = collaboration / unpaid
  type: text("type").notNull().default("gig"), // gig | collab | event | campus
  location: text("location").notNull().default(""),
  lat: real("lat"),
  lng: real("lng"),
  remote: bool("remote", false),
  studentFriendly: bool("student_friendly", false),
  trustRequired: text("trust_required").notNull().default("standard"),
  applyBy: integer("apply_by", { mode: "timestamp_ms" }),
  eventDate: integer("event_date", { mode: "timestamp_ms" }),
  status: text("status").notNull().default("open"), // open | closed | filled
  isSeed: seed(),
  createdAt: ts("created_at"),
});

export const applications = sqliteTable(
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
    availability: text("availability").notNull().default("yes"), // yes | need_check
    status: text("status").notNull().default("submitted"), // submitted | shortlisted | selected | declined
    createdAt: ts("created_at"),
  },
  (t) => [uniqueIndex("app_opp_applicant").on(t.opportunityId, t.applicantId)]
);

/* -------------------------------- projects -------------------------------- */

export const projects = sqliteTable(
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
    deadline: integer("deadline", { mode: "timestamp_ms" }),
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

export const projectMilestones = sqliteTable("project_milestones", {
  id: id(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueAt: integer("due_at", { mode: "timestamp_ms" }),
  status: text("status").notNull().default("pending"), // pending | done
  order: integer("order").notNull().default(0),
});

export const extensionRequests = sqliteTable(
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
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    createdAt: ts("created_at"),
  },
  (t) => [index("ext_project_status").on(t.projectId, t.status)]
);

/* -------------------------------- bookings -------------------------------- */

export const bookings = sqliteTable(
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
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    durationMin: integer("duration_min").notNull().default(60),
    price: integer("price").notNull(),
    location: text("location").notNull().default(""),
    status: text("status").notNull().default("pending"), // pending | confirmed | completed | cancelled
    isSeed: seed(),
    createdAt: ts("created_at"),
  },
  (t) => [index("bookings_provider_starts").on(t.providerId, t.startsAt)]
);

/* ------------------------- portfolio / experience ------------------------- */

export const portfolioItems = sqliteTable("portfolio_items", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  kind: text("kind").notNull().default("image"), // image | video | audio | link | project | upnova_project
  mediaUrl: text("media_url"),
  client: text("client").notNull().default(""),
  projectId: text("project_id"), // set when sourced from a completed UpNova project
  aiInvolvement: text("ai_involvement").notNull().default("none"),
  visible: bool("visible", true),
  createdAt: ts("created_at"),
});

export const experiences = sqliteTable("experiences", {
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

/* --------------------------- reviews / payments --------------------------- */

export const reviews = sqliteTable(
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
    rating: real("rating").notNull(),
    body: text("body").notNull().default(""),
    createdAt: ts("created_at"),
  },
  (t) => [uniqueIndex("reviews_project_author").on(t.projectId, t.authorId)]
);

export const payments = sqliteTable("payments", {
  id: id(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  bookingId: text("booking_id"),
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

/* ------------------------------- moderation ------------------------------- */

export const reports = sqliteTable("reports", {
  id: id(),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => users.id),
  targetType: text("target_type").notNull(), // user | post | message | service | opportunity | community | project
  targetId: text("target_id").notNull(),
  category: text("category").notNull(), // payment | creator | creative-integrity | safety | emergency
  details: text("details").notNull().default(""),
  status: text("status").notNull().default("open"), // open | reviewing | resolved | dismissed
  createdAt: ts("created_at"),
});
