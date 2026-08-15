# Mavyn — Phase 5 Architecture Plan: the six remaining `lib/data.ts` consumers

**Date:** 2026-08-15 · **Branch:** `arena/01a0026a-upnova` (post-Phase-5a, commit `8b8765a`) · **READ-ONLY — no code changed.**

`lib/data.ts` is now 967 lines / 21 exports, consumed by exactly 9 files across 6 product surfaces. Every remaining consumer represents a **product/backend decision**, not dead code. For each: what's mock, what the UI means, what real source exists, what's missing, migration class, breakage risk, and the smallest safe implementation.

Test-Center constraints that bound any change here (verified):
- The **route sweep** loads `/settings` and `/analytics` as real pages (must stay HTTP 200, no error markers). `/resolution`, `/campus`, `/campus/[org]`, `/events/[id]/manage` are **not** swept.
- `app/campus/page.tsx` **source** is asserted on (must keep: `sm:grid-cols-4`, `CAMPUS_LIFE_CHANNELS`, `"Student services"`, the `aria-current` line; must NOT contain: the old callout text, `id: "services", emoji`, the old tile style).
- `app/settings/page.tsx` source must keep `PrefsEditor` + `"personalization"`.
- Nothing in the fulltest references `EventManager`, `OrgPage`, `OpportunityCard`, or the mock `analytics/events/creators/campusOrgs/opportunities` exports.

---

## 1 · Analytics (`app/analytics/page.tsx`) — mock: `analytics`

| Question | Answer |
|---|---|
| **Mock data used** | The `analytics` object (29 lines): `stats` (Profile Views / Post Reach / New Followers / Service Revenue chips), `weeklyReach` (7-day bar chart), `audience` (location % split), `topPosts` (reach/engagement list). |
| **What the UI represents** | A creator growth dashboard: traffic, reach trend, audience geography, best content. |
| **Real source exists?** | **Partially.** The page already renders a REAL header from `/api/analytics/summary` (revenue this/last month, avg value, clients, repeat clients, completed engagements, followers + new-this-month — all computed from `payments`/`bookings`/`projects`/`follows`). The four mock sections have raw material in the DB: the `interactions` table records `view/like/comment/save/profile_view/service_view/…` per user+target via `/api/track`, and `likes`/`comments` exist per post. |
| **What's missing** | Aggregation endpoints only — no schema change needed for an honest v1: **profile views** = `interactions(action=profile_view, targetId=me)`; **post reach (views)** = `interactions(action=view, target my posts)` bucketed by day for `weeklyReach`; **top posts** = my posts ranked by views/likes/comments; **audience location** = viewer profiles' `city/state` joined through interactions (approximate but real). "Post Reach 24.3K"-style vanity numbers can't be reproduced honestly — real numbers will be small. |
| **Migration or feature?** | **Feature task (small-to-medium):** extend `/api/analytics/summary` (or add `/api/analytics/engagement`) with 3–4 aggregations + swap the page's four sections to fetch state. The API file's own doctrine helps: *"metrics we don't track are simply not returned"* — sections can render conditionally. |
| **Breakage if mock removed without replacement** | Page crashes (`analytics.weeklyReach` at module top level → `Math.max` of empty). Route-sweep step for `/analytics` would FAIL (a baseline regression). Must replace or conditionally hide sections, never just delete. |
| **Smallest safe implementation** | One new aggregation block in `/api/analytics/summary` returning `{ weeklyViews: [{day,value}×7], topPosts: [{title,views,likes,comments}], audienceTop: [{place,pct}], profileViews30d }` from `interactions`; page renders each section only when the field is present. Falls back to "not enough data yet" copy — honest for a young account. |

**Risk: MEDIUM** (real aggregation code + a swept route; but self-contained, no schema change, no cross-feature coupling).

---

## 2 · Campus (`app/campus/page.tsx` + `app/campus/[org]/page.tsx` + `OrgPage.tsx`) — mock: `creators`, `campusOrgs`

Campus is **two distinct problems**:

### 2a. Main campus page — small mock islands in a mostly-real page
Real already: gate/verification (`/api/campus/verify`), Events (`/api/campus/events` + RSVP), Communities/Groups (`/api/campus/groups` + join), Marketplace (link out to real `/campus/market`).
Still mock: **(i)** the scripted community-chat demo including the `ava` creator card (`creators.find("ava")`), **(ii)** the `campusServices` hardcoded list ("Student services" — README: demo by design), **(iii)** `campusOppIds` → 4 mock `<OpportunityCard>`s, **(iv)** the `campusOrgs` grid linking to `/campus/[org]`, **(v)** hardcoded interest-channel chats.

| Question | Answer |
|---|---|
| **Real source exists?** | For **(iii)**: yes — `/api/opportunities` is scope-aware and the server knows `scope=school` + `studentFriendly`; the real `OpportunityList` component already renders DB opportunities elsewhere. For **(i)**: a real seeded `ava` user exists (`/api/users/ava`). For **(ii)/(iv)/(v)**: no — there is no campus-services directory, no orgs model, and the scripted chats are a deliberate demo of "social → discovery → business". |
| **What's missing** | An **organizations model** (org page, membership, leadership, org posts/events) for (iv) — the biggest gap; a "campus services" concept for (ii) (could simply be services by campus-verified owners — `services` + `campusVerifications` join, no new table); real community-channel chat for (v) (campus groups already exist as communities — the chats could point into them). |
| **Migration or feature?** | (iii) = **simple migration** (swap mock cards for `OpportunityList`/API fetch with the school scope). (i) = **simple migration** (fetch `/api/users/ava` or drop the scripted card). (ii) = **medium feature** (a filtered services query). (iv)+(v) = **real product architecture** — orgs need a decision: build the model, fold orgs into communities (a `kind`/`category` on communities — half the infrastructure exists: `campusId`, `audience`, categories), or drop the section. |
| **Breakage if removed** | `/campus/[org]` 404s for all org links; the Opportunities door goes empty; the Communities door loses its demo chat (the real groups list beneath it stays). Fulltest campus source assertions do NOT reference any of the mock — but `"Student services"` string must remain somewhere in the file. |
| **Smallest safe implementation** | Phase it: **(A)** swap the Opportunities door to the real API (pure migration); **(B)** swap `campusServices` to real services owned by campus-verified users; **(C)** decide orgs (recommended: communities with `category: "Student Organizations"` — already seeded — then `/campus/[org]` becomes a redirect to `/communities/[id]` and `OrgPage`/`campusOrgs` die); **(D)** the scripted chat either keeps inline constants (losing the `lib/data` import) or is removed in favor of the real groups. |

**Risk: (A)+(i) LOW · (B) MEDIUM · (C)+(D) HIGH** (product decision on orgs; touches a fulltest-asserted file — edits must preserve the asserted strings).

### 2b. `/campus/[org]` + `OrgPage` — 100% mock route
No real model behind it at all (`campusOrgs`: name/members/leadership/posts/orgEvents all fabricated). `generateStaticParams` builds 5 static pages from mock. Linked only from the campus orgs grid. **This route cannot be "migrated" — it must be built (orgs model), absorbed (communities), or retired (with its grid).** Pure product decision.

---

## 3 · Events/Manage (`app/events/[id]/manage/page.tsx` + `EventManager.tsx`) — mock: `events`, `creators`

| Question | Answer |
|---|---|
| **Mock data used** | Mock `events` for `generateStaticParams` (`organizedByYou` flag), title, capacity, `ticketTypes`; mock `creators` padded with fake names as the attendee list. Tabs: Attendees / Tickets / Check-in / payments — all fabricated (fake QR check-in was already removed with `QrCode.tsx` in Step 1). |
| **What the UI represents** | The organizer's event dashboard: who's coming, ticket sales, door check-in, revenue. |
| **Real source exists?** | **Partially.** Real `events` + `eventRsvps` tables, real `/api/events/[id]` (GET detail + POST rsvp) with `isHost` computed, real capacity/waitlist logic. **Missing:** an attendee-LIST endpoint (RSVPs are only counted, never listed with identities — same privacy shape as the follower-list gap), ticket purchase/checkout (no payments link to events; README: "needs the payments pass"), and check-in state (no schema field). |
| **Migration or feature?** | Attendee list = **small feature** (host-only endpoint listing `eventRsvps` joined to profiles — a privacy decision: hosts seeing attendee names is normal, but it's still a new data exposure). Tickets/revenue/check-in = **real feature work** (payments integration + a `checkedInAt` column). |
| **Breakage if removed** | Almost none: the route is **link-orphaned** (zero inbound links anywhere — verified; even the event detail page never links to /manage). Not in the route sweep, no fulltest references. Deleting the route + `EventManager` would strand nobody. But per instructions this is flagged, not done. |
| **Smallest safe implementation** | Two candidate minimal paths: **(a) retire** the route until the ticketing pass (nothing links to it) — cleanup, no backend; or **(b) make it real-lite**: replace `generateStaticParams` with a dynamic host-gated page over `/api/events/[id]`, add a host-only `GET /api/events/[id]/attendees`, show real RSVP names + capacity, and hide the Tickets/Check-in tabs behind "coming with paid ticketing". (b) is one endpoint + one page rewrite; the honest v1. |

**Risk: (a) LOW · (b) MEDIUM.** The choice between them is a product call (keep a visible organizer surface vs. ship nothing fake).

---

## 4 · Resolution (`app/resolution/page.tsx`) — mock: `creators`, `currentUser`

| Question | Answer |
|---|---|
| **Mock data used** | `creators.find("jordan")` + `currentUser` for one hardcoded demo dispute (case UPN-2481, $300, fixed timeline, fake evidence rows). The page is ~100% static demo content. |
| **What the UI represents** | The user's dispute-case center: active cases, their timeline, evidence, and how protection works. |
| **Real source exists?** | **Yes, for orders only:** `disputes` table + full lifecycle APIs (`GET/POST/PATCH /api/orders/[id]/dispute`, admin review via `/api/admin/disputes`), already used by the Orders page (open dispute, respond, admin resolve). **Gap:** bookings/projects have no dispute records (their protection flows live in messages/support copy), and there is no cross-order "my disputes" list endpoint (only per-order + admin-all). |
| **Migration or feature?** | **Medium feature:** a `GET /api/me/disputes` (my disputes across my orders — trivial query over existing tables, no schema change) + rewriting the page to list real cases with the real timeline (`orderEvents` already records the order history). Keep the educational "how protection works" copy as static content — that part isn't data. Empty state: "no open cases" — which is TRUE for most users and more honest than a permanent fake dispute. |
| **Breakage if removed** | Low: linked from Navbar account menu + ReportModal; not route-swept, no fulltest source assertions. Removing mock without replacement = an empty-ish page, not a crash (the demo case is inline JSX; the only `lib/data` use is names/avatars). |
| **Smallest safe implementation** | Two-step: **(1)** drop the `lib/data` import by replacing the fake case with a real-data list (one new 30-line endpoint reading `disputes` joined to `orders` both directions) + empty-state; **(2)** keep static education sections as-is. No schema change. Booking/project disputes stay out of scope (their own product decision). |

**Risk: MEDIUM** (small new endpoint + page rewrite; no schema change; low blast radius).

---

## 5 · Settings (`app/settings/page.tsx`) — mock: `currentUser`, `services`, `bookings`

Three separate mock islands inside an otherwise-real page (the page's education, notifications, personalization, security, campus, demo sections are all real APIs):

| Island | Mock used | What it represents | Real source | Class |
|---|---|---|---|---|
| **Creator section bio/skills form** | `currentUser.bio`, `.skills` | Editing your public profile | **Fully exists**: `/api/me/profile` + the real editor at `/profile/edit` (bio, skills, everything). This settings form is **decorative** — zero save handlers (verified: no fetch/onSubmit in the section). | **Simple migration** — replace the dead form with a link/redirect to `/profile/edit` (dedupe), or hydrate it from `useSession().profile` if kept visual. Recommend the link: two editors for the same data is drift-bait. |
| **Payments & Earnings card** | `bookings` (pending $ math) + hardcoded `earned = 4850` + fake `transactions` array (inline, not lib/data) | Earnings summary + transaction history | **Fully exists**: `/api/me/payments` (`paymentsFor`) returns direction-aware transactions with titles + counterparties across bookings/projects/orders; the `/payments` page already renders it. | **Simple migration** — fetch `/api/me/payments`, derive earned/pending from real statuses, list real transactions (or slim the card to a link to `/payments`, which the Sidebar business section already has). |
| **Hiring section "Your services"** | `services` array | Your service listings + prices | **Fully exists**: `/api/me/services` (used by EditProfile) and the real management UI on `/services` (mine view) + `/services/new`. | **Simple migration** — fetch `/api/me/services`; wire "+ Add service"/Edit to the real pages (currently dead buttons). |

- **Breakage if removed:** `/settings` is route-swept — it must keep rendering 200. All three islands are render-only; replacing data sources doesn't change structure. The fulltest's `PrefsEditor`/`"personalization"` strings are in untouched sections.
- **Smallest safe implementation:** three independent fetch-swaps (or link-outs), each individually testable. After them, `currentUser`'s Settings usage disappears.

**Risk: LOW** (all real APIs exist; UI preserved; decorative forms become honest links).

---

## 6 · OpportunityCard (`components/OpportunityCard.tsx`) — mock: `opportunities`, `currentUser`

| Question | Answer |
|---|---|
| **Mock data used** | The whole component IS mock: `opportunities.find(id)` resolves the four mock campus opp ids (`org-promo`, `campus-web`, `campus-mv-collab`, `social-video`); `currentUser.name` decorates a fake "Portfolio attached" line; the Pitch flow sets local state only (nothing is ever submitted). |
| **What the UI represents** | An opportunity card with an inline pitch/apply flow — the Gen-1 ancestor of the real system. |
| **Real source exists?** | **Yes, entirely:** `components/db/OpportunityList` + `/api/opportunities` (scope-aware, incl. school) + the real application flow (`/api/opportunities/[id]/applications`, application builder, applicant review). The real system is the core loop's Hire lane. |
| **What's missing** | Nothing backend. What's missing is **real campus-scoped content on the two render sites**: Campus page Opportunities door and OrgPage. OpportunityCard cannot be "migrated" — it's superseded; the sites should render the real list/cards instead. |
| **Breakage if removed** | Compile break at the 2 render sites until they're swapped; OrgPage is itself mock (§2b), so realistically OpportunityCard dies **with** the Campus-opportunities-door migration (§2a-A) and the orgs decision (§2b). Its fake pitch flow currently *looks* functional but submits nothing — arguably a trust bug worth retiring early. |
| **Smallest safe implementation** | Do §2a-A: Campus Opportunities door → real `/api/opportunities` fetch (server already filters school scope); OrgPage keeps its card only until §2b resolves — or drops the opportunity block (one conditional already guards it: `org.opportunityId &&`). Then delete OpportunityCard + the `opportunities` export (its last consumer). |

**Risk: LOW-MEDIUM** (component swap; bounded by the Campus decisions; touches the fulltest-asserted campus file — asserted strings unaffected but must re-verify).

---

## Ranked migration order (each requires individual approval)

| Rank | Item | Class | Risk | Backend work | Product decision needed? |
|---|---|---|---|---|---|
| 1 | **Settings — services card** → `/api/me/services` | migration | **LOW** | none | no |
| 2 | **Settings — payments card** → `/api/me/payments` | migration | **LOW** | none | no |
| 3 | **Settings — bio/skills form** → link to `/profile/edit` (or hydrate from session) | migration/dedupe | **LOW** | none | tiny (keep form vs link) |
| 4 | **Campus Opportunities door + OpportunityCard retirement** → real `/api/opportunities` | migration | **LOW-MEDIUM** | none | no (content, not model) |
| 5 | **Campus ava-card** → real `/api/users/ava` or inline constants | migration | **LOW-MEDIUM** | none | tiny (keep scripted demo or not) |
| 6 | **Resolution** → real `disputes` via a small `GET /api/me/disputes` | small feature | **MEDIUM** | 1 endpoint, no schema | empty-state copy |
| 7 | **Analytics charts** → `interactions` aggregations in `/api/analytics/summary` | small feature | **MEDIUM** | 1 endpoint extension, no schema | accept honest small numbers |
| 8 | **Events/Manage** → retire (orphaned) OR real-lite attendees endpoint | feature or removal | **MEDIUM** | 1 endpoint + page rewrite (if kept) | **yes: keep vs defer to ticketing pass** |
| 9 | **Campus services list** → services by campus-verified owners | feature | **MEDIUM-HIGH** | query + UI, no schema | yes (what "campus services" means) |
| 10 | **Campus orgs + `/campus/[org]` + OrgPage** → build orgs model / fold into communities / retire | architecture | **HIGH** | model decision | **yes — the big one** |
| 11 | **Campus scripted chats** → real community channels or removal | architecture | **HIGH** | rides on #10 | yes |

`lib/data.ts` retirement math: after #1–5, the `services`, `bookings`, `opportunities` exports die and `currentUser` loses 2 of 3 consumers; after #6, `currentUser` + the `creators` "jordan" use die; after #7, `analytics` dies; after #8, `events` + `UpEvent`/ticket types die; after #10/11, `campusOrgs` + the last `creators` use die — **file deletable only after #10/11**, which is exactly the product-architecture conversation you flagged.

**Untouched, per instructions:** no code changed, `lib/data.ts` intact, `currentUser` intact, branch isolated from `arena/019fdecc-upnova`.
