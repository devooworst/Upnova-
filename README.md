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

**Feed & recommendations** — `/api/feed?tab=&scope=` queries the DB. Scope (5 mi / 25 mi / City /
County / State / Country / Global / My School) filters by the author's real location or verified
campus; tab picks the ranking. For You uses deterministic scoring (documented weights in
`lib/server/feed.ts`): follows +50, shared skills/interests +8 each (cap 24), shared community +12,
same city +15, recency decay to −30 over 48 h, engagement +6·ln(likes + 2·comments + 1).

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

**Location privacy** — users pick the most precise level shown publicly: City · County · State ·
Country · Don't show. `locationLabel` is computed server-side (`lib/server/serialize.ts`) and is
the only location string public surfaces render; exact addresses and coordinates are never public
regardless of setting (lat/lng are server-side scoping only). Service providers show a service
area ("Within 25 miles"), never an address. Identity verification shows only the badge — never
documents.

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
