# ✦ UpNova

**Find what's happening around you — and find the people who can make it happen.**

UpNova is a local-first platform where creators, businesses, and everyday people can discover each other,
find opportunities, offer services, build communities, attend events, collaborate, and make money.

Not Instagram with a job board attached. Not LinkedIn. Not Craigslist. Not Discord.
A combination of **social discovery + local community + creator services + paid opportunities**,
organized around **location and creator reach**.

---

## The defining feature: Reach

Every creator, opportunity, community, and event declares how far it should reach:

| Reach | Meaning |
| --- | --- |
| 📍 Nearby | 5 miles |
| 📍 Local | 25 miles |
| 🏙 City | your city |
| 🗺 Regional / State | your state |
| 🇺🇸 National | whole country |
| 🌎 Global | everyone |
|  Remote | location doesn't matter |

Reach is shown everywhere it matters (opportunity cards, creator cards, events, communities,
the create flow) via `<ReachBadge />` and is a first-class field in `lib/data.ts`.

## What's in this build

- **Home — "Near You"**: stories, "What's on your mind?" create area, feed tabs
  (Near You / Following / Opportunities / Trending) and a mixed feed of
  featured opportunity, creator posts, audio posts (with simulated playback),
  polls (votable), and events.
- **Navbar**: ✦ UpNova, global search, Create `+`, Messages, Notifications, profile dropdown.
- **Left sidebar**: Near You, Discover, Communities, Opportunities, Events, Marketplace,
  Messages, Bookmarks, Analytics + Your Communities + UpNova Pro + profile.
- **Right sidebar** (focused, not overloaded): Opportunities Near You, Trending, Who to Follow.
- **Discover**: ecosystem search across Creators / Services / Opportunities / Communities /
  Events / Businesses with Location, Category, and Availability filters.
- **Opportunities**: professional marketplace with filter chips and Apply Now flow.
- **Communities**: location-driven community cards with reach, online counts, and join.
- **Events**: location-driven event cards with attendance and tickets.
- **Messages**: conversation list + chat, with "Create Project" as the bridge to the money flow.
- **Bookmarks** and **Analytics** (reach chart, audience locations, top posts).
- **Profile**: banner + overlapping avatar, OPEN TO WORK badge, stats, skills, and the three
  core sections — **Portfolio | Opportunities | About** (with Services + "Hire Me").
- **Create modal**: Post, Opportunity, Service, Community, Event, Poll, Live — every option
  includes the Reach selector.
- **Mobile**: bottom navigation (Home, Discover, Create, Messages, Profile) and single-column feed.

## Visual identity

- **Light + dark mode (V1).** The entire palette rides on CSS variables — light
  mode is a class on `<html>`, not a redesign. Same structure, same lime identity;
  accents darken in light mode for contrast. Settings → Appearance offers Dark /
  Light / Use device settings (persisted, no-flash init script), plus a sun/moon
  toggle in the navbar.
- Background `#0A0A0F` (dark), cards `#111111`, zinc borders. One UI family: **Plus Jakarta Sans**
  (weight/size/tracking carry all hierarchy — every page title is `text-2xl` bold tight).
  **JetBrains Mono** is the data voice: distances, budgets, receipt lines, overlines.
  **Syne** appears exactly once, as the UpNova wordmark.
- Accent colors have **jobs**, so the eye learns the language:
  - **lime** = money & opportunity (budgets, Apply, Hire, Open to Work, revenue)
  - **violet** = people & community (follow, join, messages, online, likes)
  - **amber** = events & energy (tickets, deadlines, trending, ratings)
  - **white/neutral** = navigation, active states, verified trust marks, locality
- **Signature motif: the ticket perforation.** A dashed rule with punched edges runs
  through the brand — money cards, event stubs, the receipt total, the home masthead.
  The thesis: everything near you is a ticket you can tear off (a gig, an event, a
  person to meet).
- Card **shapes** carry the category too — no two categories share the same DNA:
  - **money** = receipt/ticket: sharp corners, lime top rule, mono figures, dashed
    perforation with punched edges, a "posted in range" receipt total in the sidebar
  - **people** = round (`rounded-3xl`), avatar-forward, soft
  - **events** = ticket with a real date block (month/day tile), dashed stub divider,
    "admit one" stub detail
- **Monetization (lib/fees.ts is the single source of truth).** Free to join and
  earn — the core ability to make money is never paywalled. Three revenue streams:
  (1) **5% transaction fee**, paid by the buyer on top of the creator's listed price,
  shown transparently before checkout; (2) **UpNova Pro, $7.99/mo** — growth tools,
  not earning ability; (3) **paid promotion** (Boost Service $3.99/3d, Featured
  Profile $7.99/7d, Featured Opportunity $9.99/7d) — always labeled, never overrides
  relevance. No proprietary wallet, no stored balances: production payments are
  designed around Stripe Connect (connected accounts, destination charges with
  application fees, payouts, refunds, disputes). Transactions, projects, payments,
  fees, payouts, and reviews are modeled as separate entities from messaging.
- **Account architecture: Plan ≠ Verification ≠ Navigation ≠ Feed Scope.** Four
  independent properties: Plan (free / college / pro — perks only), Verification
  (student identity — controls campus eligibility, survives plan changes),
  Communities/School (navigation destinations), Feed Scope (a filter, never a mode).
  "Your Campus" is navigation for a verified student; "UpNova College ✓" is a
  subscription indicator — never the same thing. Switching College → Pro drops
  College perks but keeps verified school identity and campus access. College never
  takes over the interface: a College subscriber browses global UpNova normally.
- **Your Campus is layered, not one giant group chat.** Six sections with distinct
  jobs: 💬 Communities (interest-based conversation — fashion, gaming, memes, late
  night), 🛍️ Campus Services (a searchable directory of student providers with
  "I'm looking for…" filters and "+ Post a Request" that becomes a Campus
  Opportunity), 💰 Campus Opportunities (real Opportunity cards — paid gigs and
  unpaid collabs), 🏛️ Organizations, 🎉 Events, 📚 Campus Questions. The
  social → discovery → business loop: ask in a community, get a creator card,
  Follow → Message → View Services → Hire — all on the existing systems.
- **College verification is free; College+ is the optional upgrade.** The paywall
  never sits between people and the network — verification, school community,
  campus chat, networking, following, DMs, applying, and basic portfolio are all $0
  for verified students (and alumni communities stay free after graduation).
  College+ ($4.99/mo test price) sells enhanced exposure: Student Boost, featured
  portfolio, analytics, priority placement — "pay to get seen," never "pay for
  permission to talk to your school." Account matrix: Free / Verified Student ($0,
  campus access) / College+ (exposure) / Pro (professional) / Alumni ($0).
- **UpNova College — the campus-to-career pipeline.** Three plans with three jobs:
  Free ($0, get discovered — earning is never paywalled), College ($4.99/mo test
  price, verified students only: 🎓 badge, Student Boost, Student Opportunities,
  campus discovery, student earnings dashboard, Spotlight eligibility), Pro
  ($12.99/mo test price, professional growth). Boost is relevance-first — students
  get extra exposure only when they're a qualified match, never pay-to-win.
  Verification runs through an education-verification provider (school email alone
  isn't the source of truth; the email is never public). College ends at the
  verified graduation date; everything the student built stays theirs, with a
  natural transition to Pro.
- **Trust Levels — verification scales with the job.** Three levels: 🟢 Standard
  (creative/digital work; no ID needed to sell a logo), 🟡 Identity Verified
  (in-person work, valuables), 🔴 High-Trust (unsupervised access to a person,
  child, pet, home, vehicle, or property: identity + age verification + background
  screening where legally permitted). Verification runs through a provider — UpNova
  never stores IDs, and status never exposes legal name/DOB/address. Enforced, not
  suggested: high-trust services can't be published without verification, high-trust
  opportunities gate applicants, and buyers see a safety-verification interstitial
  before paying (checks passed — never "100% safe person"). High-trust projects get
  an 🚨 Emergency / Safety Concern lane that isn't ordinary support.
- **One project system, participant-specific, never hardcoded.** Every conversation
  has its own ID + participant; every conversation owns its own project, payment,
  and extension state (keyed per conversation — switching chats switches ALL of it).
  Hire Me / Message / Book anywhere deep-links to `/messages?to=<creatorId>`,
  creating the conversation if needed (seeded with "Hi X! I'm interested in your Y
  service."). Create Project prefills from the creator's service (name + starting
  price). Extensions are stateful and idempotent: one request → one decision → one
  result; approved extensions show as a ✓ status with the new deadline and never
  re-ask. Discuss closes the drawer, focuses the conversation on the extension, and
  keeps the decision available. Services and Opportunities converge into this same
  lifecycle: two ways to find work, one transaction system.
- **Work History & Reliability.** Every paid job creates a verified work record.
  Portfolio = "look what I can create"; Experience = "look what I've actually done"
  (Verified UpNova Project — added to the public portfolio only with the creator's
  permission; client work is never auto-exposed). Reliability is a private record
  (on-time / approved extension / late-communicated / late-silent / cancels /
  disputes) shown to the owner in the Work Performance dashboard; the public surface
  is only the summary (🟢 Reliable Creator · 98% on time). Consequences are quiet
  privilege changes — visibility, recommendation priority, project limits, payout
  timing — never public marks. Communication protects the record: approved
  extensions carry no penalty (the flow demos this). Reviews come exclusively from
  verified projects, are two-sided, and cover communication / quality / reliability
  / professionalism / deadline. Clients build reliability too.
- **The Create system: no generic forms.** Each creation type has its own
  purpose-specific form, fields, validation, and resulting feed card. Post = social
  (media, post type, audience, community, tags). Opportunity = a project listing
  builder (roles × counts, paid/unpaid/negotiable/royalty, payment structure,
  requirements, location + reach, deadlines, response method). Service = a
  professional listing (deliverables, pricing model, turnaround, availability,
  portfolio, original-work flag). Poll = duration, voter scope, add-own-options,
  results visibility. Event routes to the full Event Setup (it's an experience, not
  a popup). Live = title, category, watch scope, chat/reactions → Go Live. Shared
  controls only where shared: audience/reach, community, tags.
- **Sidebar answers "where do I go?"; pages answer "what's here?".** The joined-
  community list left the global sidebar (it's a compact "N joined" count on the
  Communities nav item); the Communities page splits into Your Communities (compact
  strip — places you're connected to) and Discover (big cards — places to join).
  The freed sidebar space goes to the Your Account plan card, which changes with
  the actual plan: Pro ✓ (perks + Manage Plan), College+ ✓ (school + benefits),
  or Free (View Plans + free student verification hint). No plan ever replaces
  navigation — College is a feature area, never a mode.
- **Communities are creator-controlled spaces, not group chats.** Create Community
  is a setup wizard: type (15 categories), access (public / private / invite-only /
  verified-only), reach (5 mi → global, or a specific school), rules (members can be
  required to agree), interaction mode (💬 Discussion / 📢 Announcements / 🎤 Broadcast
  / 🤝 Collaboration / ❓ Q&A), appearance (icon, color, banner), and member
  permissions (promotion, opportunities, events, links, post approval). Roles:
  Owner → Admin → Moderator → Member. Modes actually change the product: Daily
  Inspiration is a broadcast community — admins post, members react and save.
  Community rules never override UpNova's safety policies. V2: advanced roles,
  approval workflows, community analytics, community-scoped services/opportunities
  surfaces, private org chats. Later: sponsored communities, community monetization.
- **Organizations & Campus Groups (V1 scope, deliberately).** Org pages are another
  type of community: branding gradient (cosmetic only), ✓ Verified Organization vs
  Community Group (org legitimacy ≠ membership proof), about/leadership, posts,
  events (big ticketed org events run on the full Events system), members, and org
  opportunities feeding the work ecosystem. V2: private org/leadership chats, sports
  teams, dorm communities (privacy-conscious, opt-in), admin-approved ✓ Verified
  Member, org dashboards. Later: Greek-life integrations, school partnerships.
- **Creative Integrity — AI-transparent, creator-controlled.** UpNova does not
  prohibit AI universally; it prohibits misrepresentation. Every service carries an
  AI policy (🔴 No AI / 🟡 with disclosure / 🟠 assisted / 🟢 client decides), clients
  set AI requirements when hiring, the agreed policy becomes part of the project
  agreement, and portfolio pieces declare AI involvement. No "AI detector" promises:
  disputes go through Creative Integrity Review (agreement + disclosures + reasonable
  process evidence), with payout paused during review.
- **Flexible Events — the organizer controls the rules.** No mandatory registration
  model: one-click RSVP, registration-required, paid tickets (with ticket types +
  QR check-in), or request-to-attend — the organizer picks admission (free/paid),
  age restriction (all/16+/18+/21+, DOB only collected when the event needs it),
  capacity (auto sold-out + optional waitlist), required attendee fields, and rules
  (acknowledged at registration). Organizers get an Event Manager: attendees,
  tickets, QR check-in, payments (buyer-pays fee; listed price = organizer payout),
  settings, analytics. Ticketing is UpNova's third transaction stream.
- **Services vs Opportunities — never mixed.** Services (`/services`) is the creator
  catalog: clients hire a creator's predefined offering; the CTA is always **Hire Me**.
  Opportunities (`/opportunities`) is the job board: projects looking for people; the
  CTA is always **Apply** (portfolio + availability + optional rate + short message —
  "pitch" is never UI language; a proposal is just an optional field inside an
  application). One direction per surface: Services = "I'm available to be hired."
  Opportunities = "We're looking for someone."
- **Two feeds, two data sources.** `GET /api/feed/for-you` is the global feed: no
  location logic, ranked by trending + engagement (Instagram/TikTok style).
  `GET /api/feed/near-you?radius=5|25|city` is the local feed: located items only,
  sorted nearest-first. Changing the radius selector always switches you to the
  Near You feed, so the distance filter visibly does something.
- Locality is spatial, not decorative: one radius selector (5 mi / 25 mi / City +) in
  the masthead is the single home for radius; the feed is grouped into distance rings
  ("Within 5 mi", "5–25 mi", "Beyond — collapsed") and every card carries a mono
  distance chip. No fake radar graphics — the distance-sorted list *is* the data viz.
  The story-circle row is replaced by a rectangular "Live near you" activity strip
  whose tiles take the shape of their category.

## Run it

```bash
npm install
npm run db:push          # create the SQLite schema (db/upnova.dev.db)
npm run db:seed          # load development seed data (see below)
npm run dev              # http://localhost:3000
```

> **Self-initializing dev database:** if `db/upnova.dev.db` is missing (fresh clone, reset
> workspace), the server creates the schema from `db/bootstrap.sql` and seeds the demo world on
> first touch — the exact failure that used to surface as "Internal error" on login (better-sqlite3
> silently creates an EMPTY file, then every query dies with `no such table: users`, which
> `guarded()` masked). Route errors now surface their real message outside production
> (`UPNOVA_VERBOSE_ERRORS=1` to force). Auto-seed is dev/demo behavior — set `UPNOVA_AUTOSEED=0`
> to disable; a Postgres production deployment never hits this path. Nothing bypasses
> authentication: bootstrap only guarantees the schema and seed accounts EXIST so real
> scrypt/session auth can run against them. After schema changes run `npm run db:bootstrap` to
> refresh the snapshot.

> `better-sqlite3` is pinned to 12.4.1 — the newest line with published prebuilt binaries for
> Node 22 (13.0.x has none, forcing a source build). If your environment has to compile it
> anyway, local Node headers work: `npx node-gyp rebuild --nodedir=/usr/local` inside
> `node_modules/better-sqlite3`.

## Backend (production transition)

The app is now a real multi-user application. localStorage mock state has been replaced by a
database + authenticated APIs for every core system.

**Stack** — Drizzle ORM on SQLite in dev (`db/upnova.dev.db`, gitignored); the schema
(`db/schema.ts`) is written to port straight to Postgres. Auth is email/password (bcrypt) with
DB-backed sessions in an httpOnly cookie — no tokens in JS.

**Models** — users, sessions, profiles, posts, comments, likes, follows, conversations,
conversation_members, messages, notifications, communities, community_members, campuses,
campus_verifications, services, opportunities, applications, projects, project_milestones,
extension_requests, bookings, portfolio_items, experiences, reviews, payments, reports.

**Project lifecycle** — `lib/server/projects.ts` is the single transition authority:
`draft → offer_sent → accepted → in_progress → (extension_requested ⇄ in_progress) → submitted →
approved → completed → reviewed`. Each transition names who may perform it (client vs creator).
Extension requests are persistent rows — one pending per project, decided exactly once, never
recreated on reload. `start` holds payment in escrow; `complete` releases it; mutual reviews close
the project.

**Authorization** — `lib/server/authz.ts` enforces ownership on every mutation (conversation
membership, project parties, service/opportunity ownership, message permissions). `db/rls.sql`
documents the equivalent Postgres Row Level Security policies for production, where the database
becomes the second line of defense.

**Recommendation architecture** — modular ranking system (`lib/server/recsys.ts`), nothing
hard-coded. An `interactions` event log records views, likes, comments, saves, follows, profile
views, service views, bookings, applications, hides, not-interested, and reports — domain routes
record their own actions server-side; `/api/track` accepts only passive/negative client signals
(forged likes are rejected). `buildTaste()` turns the log into a taste profile: follows,
interests, per-author and per-category affinity (tanh-squashed action weights), hidden targets,
and downranked authors/categories. Everything rankable (Posts, Services, Opportunities —
Communities/Events map to the same `Scorable` shape) flows through a transparent `WEIGHTS` table
(the whole algorithm on one screen: followed +50, interest match +8×cap 24, shared community +12,
proximity +10/15, author affinity ±20, category affinity ±15, freshness 30→0 over 48 h,
engagement 6·ln, not-interested −25/−40) and every scored item carries human-readable `reasons`
("you follow them", "near you", "you engage with this creator"). The `Ranker` interface is the ML
swap point — a learned model replaces `weightedRanker` without touching routes or UI. Privacy
shapes the algorithm: authors with hidden location visibility get NO proximity scoring. Negative
feedback is first-class: the post overflow menu offers Hide (never shown again, enforced
server-side) and Not Interested (downranks the author + category). Promoted content NEVER enters
organic ranking — it is fetched separately, slotted after the third feed item, and labeled
"Promoted · not part of your recommendations"; on Services it's pinned first with a Promoted tag.
Scope filtering (5 mi → My School) still lives in `lib/server/feed.ts` and runs before ranking.

**The transaction backbone** — Messages is the transaction hub: conversations carry normal chat
plus system messages for every project event (offer sent, terms updated, accepted, payment
secured, delivered, revision requested, extension decided, released, cancelled), so the thread
literally shows the deal progressing. The server is the only sequence authority
(`lib/server/projects.ts`): discover → contact → discuss → create project (either side) → review
→ accept → payment secured → work → delivery → approve/revise → complete → review → reputation.
Transaction-authorization integrity per OWASP: `accept_offer` and `start` carry
`expectedAmount` — if the creator changed the price since the client loaded the screen, the
server refuses (409) and the change is announced in-thread; terms lock entirely once accepted.
Cancellation exists only before payment. Payment language is deliberately "secured/released" —
never "escrow", which is a specific legal service UpNova does not claim to provide. Every project
carries the transaction-safety banner, and off-platform payment mentions trigger the client-side
warning.

**Creator-defined policies** — one configurable service engine, never 50 systems.
`/services/new` is a dynamic eight-step wizard (Service → Fulfillment → Availability →
Location → Pricing & policies → Service menu → Show your work → Preview & publish) built on one rule:
category = defaults only, fulfillment model = workflow, creator settings = the service.
Retwist → Beauty + Appointment and Logo → Design + Project use the same system. Picking a
category suggests fulfillment + duration; picking Appointment unlocks weekly days, hours,
appointment length, buffer, max/day, same-day and advance-notice rules — all enforced
server-side at booking time ("doesn't take bookings on Sundays", "outside working hours",
buffer-widened conflicts). Pricing is a model (fixed / starting at / hourly / custom quote)
plus an optional deposit; "Show your work" attaches up to 3 photos; Preview renders the exact
customer-facing card before Publish; and the post-publish screen offers an editable
auto-generated announcement post ("Retwist appointments are open…"). Verification is explained,
not thrown: care categories say WHY High-Trust is needed and link to Settings. The legacy
Create-modal Service/Opportunity forms now route to the real builders. Everything lands in the
listing's config (`lib/servicePolicies.ts`). UpNova compiles the config into the customer flow: travel fees are
computed from real profile distances ($2/mi after 5 mi → calculated automatically), service
radius rejects out-of-area bookings, maxPerDay caps the creator's calendar, duration comes from
their scheduling rules, and cancellation/reschedule/late/no-show policies are shown IN the
booking review before payment — no surprise fees, ever. Refunds honor the creator's cancellation
policy server-side (provider-initiated cancels always refund in full). Each seed provider
operates differently on purpose: Imani (no travel, 15-min grace + $10 late fee, 4/day), Nia
(free travel within 10 mi, cancel anytime), Ava (per-mile travel, 48h partial policy), TJ (flat
$25 travel, 1 booking/day, no-show full charge).

**The service menu** — creators build their own price structure, not UpNova's. A service can
carry a `menu` in its config: **add-ons** (name, price mode fixed / starting-at / quote-required,
minutes added to the appointment, optional/required) and **packages** (creator-priced bundles of
the base service + add-ons, so "Retwist $60 / Retwist + Wash $70 / Retwist + Style $80 / Full
Package $90" is ONE listing, not four). The wizard's "Service menu" step is optional — a
one-price service simply skips it. On the customer side, Book opens with a **Build your service**
step: pick a package or the base, toggle add-ons, and watch one calculator
(`computeSelection` in `lib/servicePolicies.ts`, shared verbatim by client and server) recompute
the payout AND the reserved calendar time (Retwist 60 + Wash 20 + Style 30 + Detangling 30 =
140 minutes actually blocked — overlapping requests are rejected). Quote-priced add-ons are
never silently charged: they appear as "quoted separately in the conversation" lines. The server
re-prices every booking from the creator's stored menu — the client sends ids only, unknown ids
are 400s, and `pay` carries `expectedTotal`: if the amount the client reviewed differs from the
server's number by a cent, the payment is refused (409) and the summary is re-shown. The selected
lines are frozen into `bookings.items` at request time, so the receipt survives later menu edits,
shows itemized in the calendar detail, and lands as an itemized "Payment secured" system message
in the shared conversation. Seed example: Imani's **Loc Retwist** carries the full canonical menu
(wash/style/deep clean/detangling, "Loc Repair — starting at $25", "Loc Reattachment — quote",
same-day fee, three packages); her Gel Nail Set and Ava's Event Photography have their own,
differently-shaped menus.

**Publishing: one canonical record, creator-controlled reach.** Publishing a service creates ONE
record that automatically surfaces everywhere it belongs — the creator's profile, the Services
directory, category filters (`/services?category=…` deep links), search, and the For You feed,
where the recommendation engine now places one ORGANIC "Suggested service" card (ranked with
reasons shown — separate from and never mixed with the labeled Promoted slot). No duplicate
records per surface. *Categories*: official ones give smart defaults; **+ Add category** lets a
creator type their own (normalized, works immediately for filtering/search/profile) without
becoming a global category — the admin overview tracks custom-category usage live ("crochet ×3")
so frequent ones can be promoted to official later. *Visibility* (enforced server-side at read
AND at booking): **Public** · **Followers only** (directory/profile/share page require actually
following — verified 403s) · **Unlisted/link only** (the share link works for anyone, listed
nowhere) · **Private draft** (owner-only, 404 to everyone else). *Lifecycle*: the profile's
service manager (`/api/me/services`) shows every state — draft/unlisted/followers/paused/
deactivated — with per-service booking history (upcoming · completed · cancelled · $ earned) and
controls for pause, visibility, deactivate, reactivate. **Deactivate is history, not erasure**:
the listing leaves the directory but stays on the creator's public record under "Past services",
its share page still resolves ("no longer offered"), and one click reactivates it. Seed world:
Sofia's "Custom Crochet Pieces" (custom category) and Imani's retired "Acrylic Full Set"
(deactivated, in history).

**Team & Openings — configurable roles on the universal Opportunity system.** One opportunity can
need Photographer ×1 $500 + Model ×3 $200 + MUA ×1 $200 + Stylist ×1 $300 — or Security ×6 +
Stagehands ×4, or Actor ×3 + Cinematographer ×1. Roles (`opportunities.roles`,
`lib/opportunityRoles.ts`) are configuration of the same architecture: Opportunity → Roles →
Capacity → Applications → Selection → Acceptance → Booking → Payment → Completion → History —
never a separate casting/hiring/fashion/job system. Applicants pick WHICH role they're applying
for (role cards with live "2 of 3 openings left"; full roles reject with 409 server-side). The
poster reviews applicants GROUPED by role with Shortlist / Select / Message / Decline; selecting
sends an OFFER ("You've been selected — Role · $pay · date · location · via UpNova payment"),
the applicant Accepts (→ a real booking lands on BOTH calendars in payment-pending state, wired
to the shared conversation) or declines (the opening frees up). The poster's page becomes a
**Team board**: every selected member with Awaiting response / Confirmed status, secured through
the normal booking payment flow (secured → completed → released; verified live: Sofia paid
Marcus's $500 + $25 fee). Declines and closing applications send the professional update ("the
creator has decided to move forward with other applicants"), per the poster's notification
setting — never a harsh "declined". Selection modes: manual (default) or shortlist-first. Demo
Mode: post a role opportunity and seed locals apply to every role instantly; seed applicants
accept offers instantly (the protagonist admin account never auto-acts). Seed world: Sofia's
"Clothing Brand Photoshoot" with four roles, Marcus confirmed (booking + conversation live),
Imani's offer awaiting acceptance, and a full review queue.
**Engagements — one-time work AND ongoing relationships, same system.** The poster configures the
engagement (`opportunities.engagement`, `lib/engagement.ts`): type (one-time / short-term contract /
ongoing freelance / part-time / full-time / temporary / collaboration / custom label), workload,
schedule, start date, duration, and a compensation schedule (hourly / per-project / milestone /
weekly / biweekly / monthly / custom). The hiring workflow is states, not vibes: Open →
Applications → Review → Shortlisted → **Interview** (scheduled through UpNova = a $0 booking on
BOTH calendars, or an external process labeled "happens OUTSIDE UpNova") → **Offer** (a
configurable terms sheet: role, comp model + amount, schedule, start, duration, classification,
notes) → Accepted → **Active** → Completed. Classification is configuration, never automatic:
**freelance/contract through UpNova** runs each cycle through the real payment machinery — accept
→ cycle 1 booking → secured ($150 + fee, verified) → completed → released, poster starts cycle N
from the team board — while **external employment** is labeled everywhere as handled by the
employer outside UpNova, refuses UpNova payment cycles (409, verified), and creates no payment
records. Seed: Devin's "Ongoing Video Editor — 2 videos/week" (weekly $150, UpNova interviews)
with three applicants ready for the full hiring demo.

**Works & Licensing — showcase safely, license on the creator's terms.** WORK is the seventh
entity: beats, tracks, sample packs, photos, designs (`works`, `lib/licensing.ts`). Protection is
honest by design — UpNova never claims content can't be recorded or stolen. The stack is:
**streaming previews** instead of source files (creator-configured length + watermark/tag
labeling; original files are delivered after licensing, in the conversation), **creator-defined
license options** (free / non-commercial / commercial / exclusive / custom — each with the
creator's own name, price or quote, attribution requirement, permitted usage, and restrictions;
presets are starting points, nobody is forced into a standard model), **permanent license
records** (`licenses`: creator, purchaser, work, type, permitted usage, restrictions,
attribution, price, date, transaction ID — frozen snapshots, listed under Works → My licenses for
both parties), and a **dispute lane** ("my work is used without a license / a licensee exceeds
their terms / re-uploaded as theirs" → the human moderation queue, where those records are the
evidence). Priced licenses run through the real machinery: expectedTotal auth (tampered → 409),
payment held → creator delivers → licensee confirms → released. **Exclusive sales stop all
further licensing** (server-enforced 409, and the feed stops suggesting the work). Free licenses
still create the record; quote options open the negotiation conversation. Licensing history
feeds the Trust & authenticity panel ("N licenses issued") — evidence, never a guarantee. The
**For You feed is now a discovery-and-action surface**: every card type is distinct and labeled
with its action — posts (Follow/Book via profile), ● WORK · License, ● OPPORTUNITY · Apply,
● PRODUCT · Buy, SERVICE · Book, and the separate Promoted slot — all ranked by the same engine
with reasons shown. Seed: Kofi's "Midnight Run" beat with a five-tier license ladder and a
playable demo-tone preview (a generated WAV standing in for the tagged clip), Maya's vocal pack,
Ava's editorial photo, and TJ's completed $75 commercial lease on record.

**Publishing = feed presence (linked posts).** One canonical object, ONE linked feed post
(`posts.refType/refId`, `lib/server/publish.ts`): publishing an Opportunity, Service (Share to
feed, default ON, opt-out), Product, or Work automatically creates a post that flows through the
same ranked For You feed and lands on the creator's profile grid instantly — the card carries a
typed banner (OPPORTUNITY · Apply, SERVICE · Book/Request, PRODUCT · Buy, WORK · License) whose
CTA opens the REAL object. Never duplicate copies; the post is a pointer. Reusable machinery —
the same function publishes a photographer's session, a producer's beat, a brand's casting call.
The opportunity form also got marketplace-grade money handling: Openings inputs are real text
fields (clearable, retypable, min 1 on submit), and **live budget validation** — total
compensation = Σ pay × openings recalculated on every keystroke against the Max budget, with
"Over budget by $X" blocking publish (and the SERVER enforces the same rule: over-budget posts
are 400'd, verified). Freelance opportunities fund through UpNova (secured before work, released
on completion); external employment stays labeled and outside — unchanged and re-verified.

**Products & Orders — "buy this", staged honestly.** PRODUCT is the sixth entity (Post = share ·
Service = offer · Booking = scheduled · Project = paid work · Opportunity = asking for people ·
Product = SELL), on the same configurable listing system: photos, price, quantity (qty 1 = a
one-time sale that shows SOLD and stays in history), condition, official + custom categories,
variant groups (Size/Color…), and fulfillment options (shipping / local pickup / local delivery /
digital). Two DISCLOSED checkout modes: **UpNova checkout** — the order timeline the buyer can
actually see (placed → payment secured → preparing → shipped with carrier/tracking/ETA →
delivered → completed), funds held from payment until the buyer confirms receipt, cancels before
shipping refund in full, stock re-checked at pay time, `expectedTotal` transaction authentication
(tampered totals 409) — or **External checkout**, labeled "you'll complete your purchase on the
seller's website; UpNova doesn't process this sale". Pickup orders never store or show an address:
the exact spot is arranged in Messages after confirmation. Seller pages show only what UpNova has
verified and counted — badges, rating, completed orders, joined date, other listings — never a
guarantee. "Report a problem" (item never shipped / not received / wrong item / not as described /
damaged / seller unresponsive) files into the human moderation queue; no automatic refunds or
accusations. The feed knows a product is not a post: a labeled PRODUCT card ranked by the same
engine, separate from the SERVICE suggestion and the Promoted slot. Demo Mode: seed sellers ship
instantly with mock USPS tracking (digital delivers, pickup proposes a meetup in chat) and
shipped orders auto-deliver at ETA. Later phases stay honest: real carrier tracking, deposits,
and a full dispute/refund workflow are production items, not demo pretense.

**Posts, not Portfolio** — the profile's first tab is **Posts**: a visual work grid whose
filters are LEARNED from the creator's own categories (a hairstylist gets Hair/Nails, a producer
gets Beats — nothing hard-coded). Posts carry a kind (Work / Behind the scenes / Announcement /
Promotion / Content), optional creator-defined category + subcategory, and an optional uploaded
photo — all set in the Home composer. Clicking a grid item opens the post (likes, comments) and,
when the creator has a related service (loose word-stem match), a **Book this service** strip
with that listing's real CTA: Post → Creator → Service → Booking. The five entities stay
distinct on purpose: Post = something you share · Service = something you offer · Booking =
someone scheduled you · Project = structured paid work · Opportunity = you're asking for people.
Verified client projects still live under Opportunities → Verified Projects; portfolio_items
remain the curated "featured from completed work" layer managed in Edit Profile.

**Dynamic CTAs & Demo Mode** — "Hire Me" is gone platform-wide. The CTA comes from the
listing's fulfillment configuration (`ctaFor` in the services API): Book Appointment
(hair/nails/care) · Book Session (photo/tutoring) · Book Time (studio/DJ) · Book Me (fixed
creative) · Request Project · Request Quote (≥ $500) · Apply / Express Interest (opportunities /
collabs). The appointment flow is a four-step wizard — slot → details (with the cancellation
rule) → itemized demo payment (payout + 5% fee + total) → "Payment secured" with View Booking /
Message. Demo Mode is explicit (navbar chip + labels on every payment screen): seed providers
accept booking requests instantly, confirm in chat after payment, and past confirmed
appointments auto-complete with the payout released — the full lifecycle plays through solo,
through the same APIs real users would hit. Bookings carry a conversationId: booking events post
as system messages in the thread and the conversation header shows the live booking strip
(title · date · status · View Booking) — Service → Booking → Payment → Messages reference ONE
record.

**Bookings** — calendar-first scheduling dashboard (no "Engagements"). Monthly Mon-first
calendar with thin status bars (lime confirmed · amber pending · violet reschedule · zinc
completed · rose cancelled — always paired with labels in the legend), click a day → that day's
bookings, click a booking → the full record (client, time range, duration, price, payment state)
with role-appropriate actions. Server-enforced lifecycle: pending (requested) → accepted (payment
pending) → confirmed (payment secured) → completed (payment released), plus cancelled (full
refund of secured payments) and reschedule_requested (proposed time approved/declined by the
other side). Pending requests get their own Accept/Decline rail; accepted+paid bookings appear on
the calendar automatically. Services carry a fulfillment model: appointment services (hair,
nails, pet care, photo sessions, DJ sets) book real time slots with double-booking rejected
server-side; project services keep the project-request flow — a calendar is never forced onto
project work. Project work shows as a compact deadline-based strip below the calendar.

**Poster identity** — every opportunity communicates WHO is posting and how much UpNova has
verified them, never rank: `Verified Business` (dedicated sky accent — reserved alongside
lime=money, violet=people, amber=events — subtle left border + overline + BadgeCheck icon),
`Business · Verification pending`, `Independent Creator`, and `Local Creator · <city>`. Always
color + label + icon so the distinction survives color-blindness and quick scanning
(`components/PosterBadge.tsx`, consistent across opportunity cards, the apply screen, profiles,
conversations, the sidebar widget, and feed posts). **Business verification is independent of any
subscription** — accounts choose Individual/Business at signup, businesses start unverified, and
only UpNova's verification process (admin dashboard action; a document flow in production) grants
the badge. Verified live: a business bought Pro and stayed "pending".

**Adaptive intake** — no universal application form. Opportunities are a short application
("I want to be considered"): why-you (poster can waive it), availability Yes/No/Need-to-confirm
(added automatically only when the gig has a date), at most ONE poster-defined question, and an
optional anything-else — while profile, skills, portfolio, ratings, and verification attach
automatically and are never re-typed. Posters set these requirements when creating the listing
(`/opportunities/new` → applyConfig, enforced server-side). Services are a project request
("I want this person to do work for me") with presets matched to the job: simple (what/when/
anything else, budget prefilled from the listed price), detailed for bigger builds (scope,
existing materials, deadline, budget ranges), and care for trust services (date, duration,
who's being cared for, special requirements, provider verification banner). Progressive
disclosure throughout: minimum first, details after the provider responds.

**Trust & Authenticity** — a layer separate from BOTH subscriptions and standard auth, built on
one principle: show what has actually been verified, never tell users who to trust. The registry
(`lib/trust.ts`) defines the signals; adding a new one is a new entry, not a new system.
*Account badges* (earned, never purchasable — Pro/Business grant zero of these): Identity
Verified (from High-Trust verification), Business Verified, Student Verified (from campus
verification rows). *Content signals per post*: **Verified Work** — exists ONLY when the server
validated a link between the post and a completed UpNova project/booking the poster actually
participated in (`lib/server/trust.ts` — client sends ids, server 403/404/409s anything else);
**Client Confirmed** — set only by the linked counterparty via `POST /api/posts/[id]/confirm`
(the poster and third parties get 403, verified live); **Creator Attested** — the creator's
recorded claim of publishing rights, explicitly labeled as a claim, not verification. The bare
"Original Work" declaration is replaced by a *content disclosure*: original / AI-assisted /
AI-generated / credited (with a name) / unspecified — set in the composer, rendered as chips
(`components/TrustChips.tsx`) in the feed and profile grid. The composer's trust panel appears
progressively (work posts / photos), offers "link to completed UpNova work" from `/api/me/work`,
and the linked client is notified to confirm (seed counterparties confirm instantly in Demo
Mode). Profiles get a computed **Trust & authenticity** panel: badges + completed transactions,
verified-work posts, client confirmations, and review history — all derived from records, none
self-reported. Reporting: "Someone is using my work / impersonating me / claiming work they
didn't perform / copyright / other" from any post's menu (`components/TrustReportModal.tsx`)
into the existing human moderation queue — filing never auto-accuses or auto-bans. Automated
checks (exact duplicate-image hash across accounts, account age, prior unresolved reports) are
attached to reports as **advisory risk signals**, displayed to the admin under an explicit
"advisory only, not proof" banner — similarity is never treated as evidence of theft.

**Location privacy** — users pick the most precise level shown publicly: City · County · State ·
Country · Don't show. `locationLabel` is computed server-side (`lib/server/serialize.ts`) and is
the only location string public surfaces render; exact addresses and coordinates are never public
regardless of setting (lat/lng are server-side scoping only). Service providers show a service
area ("Within 25 miles"), never an address. Identity verification shows only the badge — never
documents.

**Guest access — three states, not two** — Guest → Member → Verified/Professional/Business.
A guest can LOOK: the homepage becomes **Discover** (a capped, unpersonalized slice of public
posts — 12 of N, ranked by recency + engagement, no taste profile, no reasons, no promoted slot),
plus public Services, Opportunities, Events, and creator profiles. Location privacy is identical
for guests and members: `locationLabel` is the only public location string, computed from each
creator's own visibility setting (a `hidden` creator shows no location to anyone). A member can
PARTICIPATE; verification layers capabilities on top and is never granted by Pro/Business
subscriptions. The enforcement is server-side: every create/interact endpoint calls
`requireUser()` and 401s guests — hiding buttons is presentation, never the access control
(verified endpoint-by-endpoint: posts, comments, likes, bookmarks, follows, conversations,
bookings, services, opportunities, projects, applications, track, profile all 401 without a
session; only signup/login/forgot/reset are public). The conversion UX is contextual, not a
wall: `components/GuestGate.tsx` provides `promptJoin(action)` — pressing Book says "Create an
account to book", Apply says "Create an account to apply … your profile becomes your
application", Create says "Join UpNova to create", likes/saves/follows/messages/personalization
each get their own copy, always with a "Already have an account? Sign in" path. Guests browse
freely first: one inline join card after the Discover feed, one dismissible banner after ~6 page
views per session (sessionStorage), and never a repeat nag after dismissal.
Conversion returns you to the moment: every prompt and banner carries `?next=` (path-only,
validated against open redirects), and the flagship flows RESUME — a guest who pressed Apply
lands back on `/opportunities?apply=<id>` with that application modal open; a guest who pressed
Book lands on `/services?book=<id>` with that booking wizard open. **Public sharing is
first-class**: `/creator/<handle>`, `/services/<id>`, and `/opportunities/<id>` are shareable
guest-visible pages (price, menu, availability, policies, reviews, verification badges, poster
identity — with copy-link Share buttons and inline "Create a free account to …" hints under the
CTA), so a forwarded booking link or opportunity link is the growth loop: view as guest → care →
account at the exact moment of intent.

**Payments** — no card data is ever stored. The `payments` table records payout + 5 % buyer-side
fee in cents with `provider="stripe_connect"` and a `providerRef` seam where the PaymentIntent /
Transfer id and webhooks slot in. Verification evidence (`campus_verifications.evidenceRef`) is a
private reference, never returned by any API.

**Seed vs production data** — every seeded record carries `isSeed=true`.
`npm run db:seed` (idempotent) · `npm run db:seed -- --fresh` (reset demo world) ·
`npm run db:seed -- --wipe` (remove ALL seed data, keep real users).
Seed accounts: `devin@upnova.dev` (admin), `ava@`, `jordanmiles@`, `marcusj@`, `nia@`, `lena@`
— all `upnova123`.

**Admin** — `/admin` (role-gated): platform stats, user management (suspend/reactivate kills
sessions immediately), and report moderation with an emergency lane.

**Authentication & password policy** (NIST SP 800-63B / OWASP-aligned) — length over composition:
12–128 characters, NO required character classes, spaces and passphrases welcome, never
truncated, never expired on a timer. Common passwords are blocked server-side
(`lib/passwordPolicy.ts` — the seam swaps to the HIBP k-anonymity API in production). The signup
form gives live strength feedback (length + repeat/sequence/common patterns, never "add 1
uppercase"), show/hide toggles, and real-time confirm-match. Handles are 3–30 chars
(letters/numbers/`_`/`.`), unique case-insensitively. Server side: **scrypt** hashing
(N=2^15, r=8, p=1, unique 16-byte salt — memory-hard, no 72-byte truncation; legacy bcrypt hashes
verify and transparently rehash on login), login rate limiting (5 fails / 15 min per account),
single-use 30-minute password-reset tokens that revoke all sessions (`/forgot` → `/reset`; the
link is emailed in production, returned as a labeled dev URL in the sandbox), **real TOTP MFA**
(RFC 6238, works with any authenticator app — manage it in Settings → Account → Security), and
security notifications for sign-ins, password changes, and MFA changes. Email verification and
HIBP checks are production items (no SMTP/egress in the sandbox).

### Connected to the database (this pass)

Auth (login/signup/logout, navbar session), Home feed + composer + likes + comments, feed scopes,
Messages (dynamic conversations, `?to=handle` / `?c=id` / `?project=id` deep links), the full
project panel + extensions + reviews, notification bell + notification center, Services
marketplace + Hire Me, Opportunities + Apply + poster-side applicant review (select →
auto-created project), public creator profiles (`/creator/[handle]` resolves any real user),
own profile header/About tab, Edit Profile (loads and saves the DB record, manages real service
listings), Admin.

### Demo provider behavior (dev only)

Seed accounts behave like responsive counterparts (`lib/server/demo.ts`) so the whole loop can be
demonstrated by one person: they reply to messages, review your brief and send the offer, start
work when you pay, request one honest extension, deliver after you decide it, and review you back
after completion. Everything goes through the same state machine and notification paths a real
user would use; none of it runs for non-seed accounts. Delete that module for production.

### Audit — still on static demo data (next passes)

- Communities pages and Campus page CONTENT (the campus gate + verification are real; the
  sections inside are demo data) — models and APIs are ready, UI still reads `lib/data`.
- Event DETAIL pages (`/events/[slug]` ticketing/QR/manage) — the events list, "This week"
  widget, and event bookmarks are DB-backed; the rich detail experience is still demo.
- Analytics, Discover, Resolution Center demo case, Settings.
- Legacy components no longer mounted anywhere but kept in the tree: `components/Feed.tsx`
  (type exports only), `MessagesClient`, `NotificationBell`, `NearbyNow`, `CreatePost`,
  `HireModal`, `lib/follow.tsx`, `lib/notifications.ts`.
- Username/handle change, notification delivery channels, community feeds.

Everything on the user's own profile is now real: verified projects, applications, listings,
portfolio items (`portfolio_items` via /api/me/portfolio), computed reliability chip (only shown
with actual completed work — approved extensions never count against anyone), real joined date,
real contact email. Plan and trust state live on the account (DB), and logout purges per-user
client caches so nothing leaks between users.

## Data & the road ahead

Legacy demo content lives in `lib/data.ts` and is being retired screen by screen (see audit above).
The database schema in `db/schema.ts` mirrors it 1:1 where the shapes matter.

The money flow this UI already describes: view service → contact creator → discuss → agree price →
payment processed → creator delivers → client approves → creator gets paid → both review → reputation grows.

> **Design rule:** do not redesign UpNova into a generic social-media website. Preserve the dark
> black/lime identity and these components; improve quality, spacing, responsiveness, hierarchy,
> and functionality while staying centered on local creator discovery, paid opportunities,
> services, communities, and events. Every feature must help somebody discover something,
> offer something, connect with somebody, participate in something, or make money.
