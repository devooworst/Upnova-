# Mavyn — Step 3 Pre-Cleanup Dependency & Architecture Map (read-only)

**Date:** 2026-08-14 · **Branch:** `arena/01a0026a-upnova` (post-Step-1, commit `778e8b4`)
**Nothing was modified during this audit.** Verified via: fresh import-graph reachability scan (post-Step-1), per-symbol own-file vs external usage counts, and a check of every Test Center (`/api/demo/fulltest`) source-level assertion against each file involved.

Classifications: **SAFE TO REMOVE** · **SAFE TO REFACTOR** · **LIVE DEPENDENCY** · **DO NOT TOUCH YET**

---

## 1 · `components/Feed.tsx` and the `FeedScope` type

### The exact dependency picture

`Feed.tsx` (208 lines) exports three things:

| Export | Consumers | Nature |
|---|---|---|
| `type FeedScope` | `app/page.tsx:8`, `components/RightSidebar.tsx:15`, `components/db/DbFeed.tsx:17` | **type-only imports** (all three are `import type`) |
| `type FeedTab` | none — `DbFeed.tsx` declares its **own** `FeedTab` (`"For You" \| "Following"`), which is what `app/page.tsx` imports | dead |
| `default Feed` component | none — `<Feed>` is rendered nowhere | dead |

The three consumers use `FeedScope` as a **value dictionary key**, not just an annotation: `DbFeed` and `RightSidebar` each define `const scopeParam: Record<FeedScope, string>` mapping the client dialect (`"foryou" | "5" | "25" | "city" | "county" | "state" | "country" | "global" | "school"`) to the API dialect (`lib/server/feed.ts`'s separate `FeedScope`: `"for-you" | "5mi" | "25mi" | …`). The two dialects are intentionally different (URL-param vs server enum) — **do not merge them**, just relocate the client one.

### Can extracting `FeedScope` free the whole cluster? Yes.

`Feed.tsx` is the **sole remaining importer** of every satellite (verified post-Step-1):

```
Feed.tsx ─┬→ PostCard.tsx (134)  ─┬→ BottomStats.tsx (75)
          │                       └→ ProfilePreview.tsx (86) → FollowButton, lib/follow, lib/data
          ├→ PollCard.tsx (101)   →  BottomStats
          ├→ AudioPost.tsx (113)  →  BottomStats
          ├→ EventCard.tsx (137)  →  Perforation (shared, stays), lib/data
          ├→ OpportunityCard.tsx  →  ⚠ ALSO imported by app/campus/page.tsx + OrgPage.tsx (LIVE)
          ├→ lib/data.ts (Post type, creators, opportunities, events)
          └→ lib/follow.tsx (useFollow)
```

**Test Center safety:** fulltest reads `DbFeed.tsx` source and asserts on `FeedTab`/`LiveNowRail`/tab strings — **none of its assertions touch DbFeed's `FeedScope` import line**. It does **not** read `Feed.tsx`, `app/page.tsx`, or `RightSidebar.tsx`. Changing the import specifier in the three consumers is invisible to the QA suite.

### Classification

| Item | Class | Notes |
|---|---|---|
| `FeedScope` type (9 literals) | **SAFE TO REFACTOR** | Move into `DbFeed.tsx` itself (it already exports `FeedTab` — the natural home) or a tiny `lib/feedScope.ts`; update 3 `import type` lines |
| `components/Feed.tsx` | **SAFE TO REMOVE** (after the type move) | Zero remaining consumers once the 3 imports repoint |
| `PostCard`, `PollCard`, `AudioPost`, `BottomStats`, `EventCard`, `ProfilePreview` | **SAFE TO REMOVE** (after Feed.tsx) | Each verified: no other importer. ProfilePreview's removal also drops a `lib/follow` + `lib/data` consumer |
| `components/OpportunityCard.tsx` | **LIVE DEPENDENCY** | Rendered by live Campus page (line 524) and OrgPage (line 150); internally reads mock `opportunities`/`currentUser` — retires only with the Campus/OrgPage mock-data pass (§3) |

**Net effect of the Feed step: −854 lines (7 files), plus it removes 2 of the 5 remaining `lib/follow` consumers and 6 of the 19 `lib/data` importers.**

---

## 2 · `lib/follow.tsx` — the localStorage follow system

### Complete flow trace

```
app/layout.tsx:44  <FollowProvider>            ← wraps the ENTIRE app (context mount)
  │
  ├─ components/FollowButton.tsx               useFollow().isFollowing/toggle
  │    ├─ app/campus/page.tsx:480              ⚠ LIVE PAGE — "ava" creator card inside the
  │    │                                          scripted campus chat demo (mock creator from lib/data)
  │    ├─ components/FollowListModal.tsx:54    (below)
  │    ├─ components/PostCard.tsx:58           dead-cluster (dies with Feed)
  │    └─ components/ProfilePreview.tsx:68     dead-cluster (dies with Feed)
  │
  ├─ components/FollowListModal.tsx            useFollow().isFollowing + MOCK creators/currentUser
  │    └─ components/profile/ProfileHeader.tsx:254   ⚠ LIVE — owner "Management view" header;
  │         clicking the Followers/Following COUNT (which IS real, from /api/users/[handle])
  │         opens this modal listing FAKE lib/data creators
  │
  ├─ components/ProfilePreview.tsx             useFollow().followerCount + formatCount
  │    └─ (dead cluster only)
  │
  └─ components/Feed.tsx:86                    useFollow().isFollowing (dead component)
```

### Is there a DB-backed replacement? Partially.

| Capability | localStorage system | DB-backed equivalent | Exists? |
|---|---|---|---|
| Follow/unfollow action | `toggle(id)` → localStorage | `POST/DELETE /api/follow/[userId]` — used by `DbCreatorProfile`, `MobileProfile`, `RightSidebar`, `DbFeed` | ✅ yes, the standard pattern |
| Follow state for a user | `isFollowing(id)` | `followedByMe` returned by `/api/users/[handle]` and `/api/users?near=1` | ✅ yes |
| Follower/following **counts** | `followerCount(c)` (fake baseline math) | `/api/users/[handle]` returns real counts (privacy-aware: `showFollowers/showFollowing`) — ProfileHeader **already uses this** for the numbers | ✅ yes |
| Follower/following **list** (names) | `FollowListModal` (fake `creators` slice) | **❌ NO endpoint lists follower/following identities.** `follows` table queries in routes only produce counts/flags. This is a real feature gap the modal papers over |

### Classification

| Item | Class | Notes |
|---|---|---|
| `lib/follow.tsx` (67) | **SAFE TO REFACTOR → then REMOVE** | Removable once its 4 remaining consumers are gone. `formatCount` (used only by dead ProfilePreview) dies with it |
| `<FollowProvider>` in `app/layout.tsx` | **SAFE TO REFACTOR** | Unmount when no `useFollow()` caller remains. fulltest reads `layout.tsx` but asserts only on `pb-28 pt-20`/`lg:pb-10` padding strings — FollowProvider is not asserted |
| `components/FollowButton.tsx` (34) | **SAFE TO REFACTOR → then REMOVE** | After PostCard/ProfilePreview die with Feed, its only live usage is the Campus "ava" card. Two options: (a) swap that one button to the `DbCreatorProfile` fetch pattern against the real seeded `ava` user, or (b) drop the button from the scripted demo card (it already has Message/View/Hire links). fulltest's campus assertions don't mention FollowButton |
| `components/FollowListModal.tsx` (66) | **SAFE TO REFACTOR → then REMOVE** | The only honest cleanup-scoped fix: make ProfileHeader's count stat **non-interactive** (remove `setListOpen`) and delete the modal. Building a real follower-list API/UI is **new feature work — out of cleanup scope** |
| `components/profile/ProfileHeader.tsx` | **LIVE DEPENDENCY** | Only its `listOpen` state + modal render (3 small spots) change; counts/stats stay untouched |
| `app/campus/page.tsx` | **LIVE DEPENDENCY** | One-line change at most (the FollowButton swap/removal) |

**Order constraint:** FollowButton/FollowListModal can only go **after** the Feed cluster (PostCard/ProfilePreview import FollowButton).

---

## 3 · `lib/data.ts` (2,093 lines) — exact per-page usage

19 importers remain; 13 are in the Feed/follow clusters above and vanish with them. The **six live pages** (plus 5 live components) and exactly what they consume:

### The six live pages

| Page | Imports | Exact usage | What must change before retirement |
|---|---|---|---|
| **`app/analytics/page.tsx`** | `analytics` | 4 render spots: `analytics.stats` (chip row), `.weeklyReach` (bar chart), `.audience` (breakdown), `.topPosts` (list). The page **already fetches** `/api/analytics/summary` for the revenue/clients/followers header — only these 4 chart sections are mock | Extend `/api/analytics/summary` (or accept sparse UI) with weekly-reach buckets, audience split, top-posts — needs `interactions`/`likes` aggregation. **Feature work: API + UI pass** |
| **`app/settings/page.tsx`** | `currentUser`, `services`, `bookings` | `currentUser.bio/.skills` in a **decorative** account form (real editing lives in `/profile/edit`); `services.map` in "Your services" card (real data exists at `/api/me/services`); `bookings` → `pending` $ sum in the earnings card (real data at `/api/me/payments`) | Point the two cards at the existing APIs; drop or wire the decorative form. **Small refactor — APIs already exist.** ⚠ fulltest reads this file but only asserts `PrefsEditor`/`"personalization"` — untouched by this change |
| **`app/campus/page.tsx`** | `creators`, `campusOrgs` | `creators.find("ava")` for the scripted chat's creator card (avatar/name/rating/handle); `campusOrgs.map` for the orgs grid linking to `/campus/[org]` | Swap the ava card to the real seeded `ava` user (exists in DB) or keep it scripted with inline constants; orgs grid → DB (no `campus_orgs` table exists — schema+API feature work) or explicit demo constants local to the page. ⚠ fulltest asserts on this file's source (grid-cols, CAMPUS_LIFE_CHANNELS…) — none touch `creators`/`campusOrgs` |
| **`app/campus/[org]/page.tsx`** + `OrgPage.tsx` (212) | `campusOrgs`, `creators` | Entire route is mock: `generateStaticParams` from `campusOrgs`, OrgPage renders org profile + mock `OpportunityCard` | Needs a real campus-orgs model → **feature work**, README explicitly lists it as a pending pass. Alternatively product could decide to drop the route — **product decision, not cleanup** |
| **`app/events/[id]/manage/page.tsx`** + `EventManager.tsx` (263) | `events`, `creators` | Entire route is mock: static params from `events.filter(organizedByYou)`, EventManager is the ticketing/check-in dashboard | README: "Ticket CHECKOUT + QR check-in … needs the payments pass". Real `events`/`eventRsvps` tables exist; the manage dashboard needs a real API + auth (host-only). **Feature work** |
| **`app/resolution/page.tsx`** | `creators`, `currentUser` | `creators.find("jordan")` + `currentUser` for ONE demo dispute case card (names/avatars) | Wire to real `disputes`/`orders` via existing `/api/orders/[id]/dispute` + `/api/admin/disputes`, or make the demo case self-contained constants. **Small-to-medium** |

### The five live components still importing `lib/data.ts`

| Component | Imports | Usage | Fix required |
|---|---|---|---|
| `components/Sidebar.tsx` | `communities` | `communities.filter(joined).length` → the "N joined" badge on the Communities nav item | Fetch count from existing `/api/communities` (`mine.length`) or drop the meta badge. **Tiny** |
| `components/CreateModal.tsx` | `currentUser` | Name/avatar in the 3 mock "published" confirmation panels (modal never POSTs — real creation happens on the `/…/new` pages it links to) | Use `useSession()` user (already the app-wide pattern) or drop the decorative panels. **Tiny** |
| `components/OpportunityCard.tsx` | `opportunities`, `currentUser` | Looks up mock opportunity by id; "Portfolio attached — {currentUser.name}" line | Dies with Campus/OrgPage mock retirement (§1/§3); not separately fixable |
| `components/EventManager.tsx`, `components/OrgPage.tsx` | `events`/`creators`, `campusOrgs`/`creators` | Whole components are mock | Tied to their pages above |
| `components/FollowListModal.tsx`, `components/ProfilePreview.tsx`, `components/PostCard.tsx`, `components/EventCard.tsx`, `components/Feed.tsx`, `components/PollCard.tsx`, `components/AudioPost.tsx`, `lib/follow.tsx` | various | All in the §1/§2 removal clusters | Vanish automatically |

### Dead weight inside `lib/data.ts` — SAFE TO REMOVE now

Of its ~66 exports, only **13 values + 4 types** are consumed externally: `analytics`, `campusOrgs`, `creators`, `currentUser`, `events`, `opportunities`, `services`, `bookings`, `communities`, and types `Post`, `Creator` (+ transitive interfaces they reference). Everything else is orphaned — `stories`, `feed`, `trending`, `conversations`, `bookmarks`, `portfolio`, `profileStats`, `profileOpportunities`, `experience`, `workRecords`, `reliability`, `serviceCatalog`, `communityContent`, `contact`, all `*Filters`/`*Options` arrays, `trustLevelInfo`, `aiPolicyInfo`, `aiInvolvementInfo`, and ~20 unused type aliases. **Roughly 900–1,000 of its 2,093 lines can be pruned without touching any page.** (`Post` is consumed only by the Feed cluster — after §1 it becomes prunable too.)

### Classification

| Item | Class |
|---|---|
| Orphaned exports inside `lib/data.ts` (~950 lines) | **SAFE TO REMOVE** (after §1 removes the Feed cluster, `Post`/`Story`-related types join the list) |
| `lib/data.ts` as a module | **DO NOT TOUCH YET** — 6 live pages + 5 live components still read it; retirement is the screen-by-screen migration (audit Step 7), mostly feature work |
| `app/campus/[org]` + OrgPage, `events/[id]/manage` + EventManager | **DO NOT TOUCH YET** — live routes, mock-backed by documented design; need product/payments passes |
| Settings/Sidebar/CreateModal mock reads | **SAFE TO REFACTOR** — existing APIs cover them (small, behavior-preserving swaps) |
| Analytics charts, Resolution demo case | **DO NOT TOUCH YET** — need API extensions (feature work), or a product call to simplify |

---

## 4 · Post-Step-1 orphaned exports/functions (fresh scan)

File-level: the **only** orphan files left are `LocationPicker.tsx`/`GeoSelect.tsx` — protected (dormant geo, Test-Center-asserted). Nothing else.

Symbol-level (export exists, **zero callers anywhere** incl. own file, QA scripts, and fulltest string assertions — each individually verified):

### SAFE TO REMOVE (function/const body deletions inside otherwise-live files)

| Symbol | File | Evidence |
|---|---|---|
| `scorePost()` | `lib/server/feed.ts` | Superseded by `recsys.arrangeFeed` pipeline; fulltest asserts on recsys strings, never `scorePost` |
| `startJobScheduler()` | `lib/server/jobs.ts` | Never called; jobs run via `runJobsTick()` (demo/fulltest). Interval scheduler is dead |
| `totpCode()` | `lib/server/totp.ts` | Only `verifyTotp`/`generateSecret`/`otpauthUrl` are used (login + MFA routes). No QA usage |
| `normalizeLegacyLocation()` | `lib/server/geo.ts` | ⚠ file is geo (protected) but this **symbol** has zero callers and no fulltest assertion — removable without touching the dormant-geo contract. Conservative option: leave whole file alone |
| `revealBetween()` | `lib/server/communities.ts` | Zero callers (distinct from the used `revealsBetween`-style helpers: `acceptedRevealSet`/`mutualFollowSet` ARE used internally) |
| `evaluateScenario()` | `lib/server/qaScenarios.ts` | QA route uses `getScenario`/`scenarioProgress`/`buildContext` instead |
| `parseInterview()` | `lib/engagement.ts` | Zero callers |
| `setPro()`, `isStudentVerified()`, `setStudentVerified()` | `lib/pro.ts` | Zero callers (plan/trust now come from the session account state; `setPlan`/`getPlan`/`PRO_EVENT` remain live) |
| `getProfile()`, `isLoggedOut()` | `lib/profile.ts` | Zero callers (`useProfile`/`roleLine`/`locationLine` remain live) |
| `LOAN_FLOW` | `lib/campusMarket.ts` | Zero callers |
| `AGENCY_PRICE` | `lib/fees.ts` | Zero callers (page reads `NEXT_PUBLIC_AGENCY_PRICE` env directly) |
| `periodLabel()`, `ALIAS_RULES`, `COMMUNITY_ACCESS`, `MEMBERSHIP_STATE_LABEL` | `lib/communityIdentity.ts` | Zero callers |
| `WORLD_STACK_BELOW`, `WORLD_DEVICES` | `lib/profileStudio.ts` | Zero callers (`WORLD_BP_PHONE/TABLET` used internally — keep) |
| ~25 unused **type-only** exports (`Taste`, `ScoredItem`, `Ranker`, `QaContext`…, `WorkLink`, `RefType`, service-policy label types, notify pref types) | various | Types: zero runtime risk; removal optional/cosmetic |

**Not removable despite looking orphaned (verified live via internal use or QA):** `kvGet/kvSet` (used by `kvGetJson/kvSetJson`), `scoreItem`/`weightedRanker`/`ARRANGE` (internal recsys pipeline + fulltest reads recsys source), `canWatch`/`CATEGORY_LABEL`/`NEARBY_MILES` (internal to live.ts), `MOTIVATION_QUOTES` (used by `quoteFor`), `applyTheme`/`THEME_EVENT` (internal), `TOURS` (internal), `bootSession` (**called by `scripts/verify-auth-lifecycle.mts`**), `saveUserSnapshot`/`SESSION_EVENT` (internal session machinery), `setAlias`/`acceptedRevealSet`/`mutualFollowSet` (internal), `validateAnswer`, `isCommonPassword`, `businessUsage`/`assertBusinessCapacity`, `isConversationMember`/`hasWorkedTogether`, `AuthError`, `LEGACY_SESSION_COOKIE` (**UpNova fallback — protected**), all label/default constants with internal readers.

---

## Recommended execution order for Step 3 (pending your approval)

Each sub-step independently buildable + testable (`tsc` → `next build` → fulltest, expecting the same 391-pass baseline):

1. **3a — FeedScope extraction + Feed cluster removal** *(pure cleanup, biggest win)*
   Move `FeedScope` to `components/db/DbFeed.tsx`; repoint 3 `import type` lines; delete `Feed.tsx`, `PostCard`, `PollCard`, `AudioPost`, `BottomStats`, `EventCard`, `ProfilePreview` (−854 lines). `FollowButton` usage drops to Campus-only; `lib/data` importers drop to 12.
2. **3b — follow-system retirement** *(two tiny live-file edits + three deletions)*
   Campus ava card: drop/swap `FollowButton`; ProfileHeader: make count stats non-interactive; unmount `FollowProvider` from layout; delete `FollowButton.tsx`, `FollowListModal.tsx`, `lib/follow.tsx` (−167 lines). *Note: a real follower-list UI would be new feature work — explicitly out of scope.*
3. **3c — orphaned-symbol prune** *(no file deletions)*
   Remove the dead functions/consts listed in §4 (~250–300 lines) + optionally the dead type exports.
4. **3d — `lib/data.ts` internal prune** *(no consumer changes)*
   Delete its ~950 orphaned-export lines; module shrinks to ~1,100 lines serving only the six live screens.
5. **Defer (not Step 3):** Settings/Sidebar/CreateModal API swaps (small but behavior-adjacent), analytics/resolution/campus-orgs/event-manager migrations (feature work — the audit's Step 7).

Projected Step 3 total: **≈ −2,200 lines** with zero product-visible change except the FollowListModal (which currently shows fabricated people — arguably a bug fix).
