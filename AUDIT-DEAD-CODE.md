# Mavyn — Dead-Code & Architecture Audit (read-only)

**Date:** 2026-08-14 · **Branch:** `arena/01a0026a-upnova` · **Scope:** entire repo (~80,300 LOC across 381 source files)
**Nothing was modified during this audit.** Verification methods: full module-resolution import graph from all Next.js entrypoints (pages, layouts, API routes, opengraph images, middleware, config, seed, scripts), dynamic `import()`/`require()` scan, string-literal API-consumer matching (including template literals), DB table usage scan, `tsc --noUnusedLocals`, and a check of the Test Center's *source-level* assertions (`/api/demo/fulltest` reads files off disk with `fs.readFileSync` — deleting certain files breaks the QA suite even though nothing imports them).

---

## Architecture summary (what's actually running)

The app went through a **mock → database migration** (documented in README "Audit — still on static demo data"). Two generations coexist:

- **Generation 2 (live):** DB-backed via Drizzle (PGlite locally / Neon in prod). `components/db/*`, `components/profile/*`, `ResponsiveProfile`/`MobileProfile`, all `/api/*` routes, `lib/server/*`. This is the core loop: Discover → Connect → Hire → Deliver → Get Paid → Grow. All healthy.
- **Generation 1 (legacy mock):** `lib/data.ts` (2,093 lines of hardcoded demo content) + a family of old components (`Feed`, `PostCard`, `CreatorProfile`, `NotificationBell`, …) and a localStorage follow store (`lib/follow.tsx`). Most of it is fully unreachable; a few live pages still lean on it (Campus orgs, Event Manage, Analytics charts, Resolution demo case, parts of Settings).
- **QA/demo surface (deliberate, gated):** Test Center (`/simulation`, `/api/demo/*`, `/api/qa/*`, `/debug/session`), QA personas, Learn guides. Gated server-side by `isDemoMode()` + `requireQaOperator`. Demo mode is ON because of the committed `db/DEMO_MODE` marker file — that's intentional per its own contents ("DELETE THIS FILE FOR ANY PRODUCTION DEPLOYMENT").
- **"UpNova" old-brand code:** only 3 spots, all *intentional* legacy-session migration fallbacks (`upnova_session` cookie / `upnova-session-token` key in `lib/server/auth.ts`, `lib/session.tsx`) + a rebrand-continuity test. **Not dead code — keep.**

---

## 1 · SAFE TO REMOVE — confirmed unused, no known dependencies

Every item below has **zero importers** outside its own dead cluster, is not referenced dynamically, not read by the Test Center, not in any nav/config, and `tsc` passes without it. They form self-contained clusters; each cluster must be removed together.

### Cluster A — old mock profile/community/feed UI (replaced by `components/db/*` + `ResponsiveProfile`)

| File | What it does | Why it appears unused | What depends on it | Risk |
|---|---|---|---|---|
| `components/CreatorProfile.tsx` (265) | Old mock creator profile page | Replaced by `DbCreatorProfile` + `ResponsiveProfile` (used by `/creator/[id]`, `/profile`) | Nothing (it *imports* dead badges below) | **Low** |
| `components/CommunityView.tsx` (393) | Old mock community detail UI | Replaced by DB-backed `app/communities/[id]/page.tsx` | Nothing | **Low** |
| `components/CommunityCard.tsx` (86) | Old mock community card | Replaced by inline cards in `app/communities/page.tsx` | Nothing | **Low** |
| `components/CreatorCard.tsx` (79) | Old mock creator card | Replaced by DB-backed discover/people cards | Nothing | **Low** |
| `components/CreatePost.tsx` (48) | Old composer stub (opens CreateModal) | Replaced by `DbComposer` on Home | Nothing | **Low** |
| `components/NotificationBell.tsx` (131) | Old mock notification bell | Replaced by `DbNotificationBell` (mounted in Navbar) | Nothing | **Low** |
| `lib/notifications.ts` (189) | Mock notification inbox data/helpers | Sole consumer was `NotificationBell.tsx` (dead) | Only dead `NotificationBell` | **Low** — remove with it |
| `components/NearbyNow.tsx` (139) | Old "nearby creators" strip (mock) | Replaced by `RightSidebar` (`/api/users?near=1`) + `LiveNowRail` | Nothing | **Low** |
| `components/HireModal.tsx` (199) | Old mock hire modal | Hire flow now goes through messages/projects (`/api/projects`) | Nothing | **Low** |
| `components/AiPolicyBadge.tsx` (24) | AI-policy chip (mock vocab) | Only imported by dead `CreatorProfile` | Only Cluster A | **Low** |
| `components/TrustBadge.tsx` (20) | Old trust chip | Only imported by dead `CreatorProfile`; live vocab is `lib/trust.ts` + `TrustChips` | Only Cluster A | **Low** |
| `components/ReachBadge.tsx` (35) | Locality badge (mock `ReachInfo`) | Only imported by dead `CommunityCard` | Only Cluster A | **Low** |

### Cluster B — old event detail + project drawer (replaced by DB pages)

| File | What it does | Why it appears unused | What depends on it | Risk |
|---|---|---|---|---|
| `components/EventDetail.tsx` (464) | Old mock event detail w/ ticketing UI | Replaced by DB-backed `app/events/[id]/page.tsx` | Nothing | **Low** |
| `components/QrCode.tsx` (35) | Fake deterministic QR block | Only imported by dead `EventDetail` | Only Cluster B | **Low** |
| `components/ProjectDrawer.tsx` (529) | Old project-stage drawer for messages | Replaced by `/projects/[id]` page + `DbMessages` project chips | Only dead `ProjectBar` (type import) | **Low** |
| `components/ProjectBar.tsx` (86) | Slim project bar above old chat | Nothing imports it; `DbMessages` handles this now | Imports type from `ProjectDrawer` — remove together | **Low** |
| `components/profile/PortfolioTab.tsx` (165) | Old separate portfolio tab | `OpportunitiesTab` now renders portfolio (`/api/me/portfolio`); `ProfileTabs` has 3 tabs, not 4 | Nothing | **Low** |

### Cluster C — trivially dead assets/styles

| Item | What it is | Why unused | Depends | Risk |
|---|---|---|---|---|
| `public/images/qa-landscape.svg`, `public/images/qa-square.svg` | QA test fixtures | Zero references anywhere (only `qa-portrait.svg` is used by the Test Center) | Nothing | **Low** |
| `app/globals.css` → `.chip-active`, `.text-gradient-lime` | Two custom utility classes | Zero usages in any tsx/ts (checked static + template strings) | Nothing | **Low** |
| ~100 unused imports/locals (per `tsc --noUnusedLocals`) | Mostly in `components/CreateModal.tsx` (31) and `app/profile/studio/page.tsx` (18) | Leftovers from refactors | Nothing | **Low** — mechanical cleanup |

**Total confirmed-dead code: ≈ 3,200 lines** (clusters A+B+C).

---

## 2 · PROBABLY UNUSED — appears abandoned, verify before touching

| Item | What it does | Why it appears unused | What depends on it | Risk of removal |
|---|---|---|---|---|
| `components/LocationPicker.tsx` (257) + `components/GeoSelect.tsx` (274) | Cascading geo location selector | No page imports them — location entry rolled back to plain text inputs | **The Test Center asserts these files EXIST on disk** (`fulltest` step: "component retained, dormant, for a future version") and `browser-qa-location.mjs` proves zero `/api/geo/*` calls | **High if removed naively** — breaks `/api/demo/fulltest`. They are *deliberately dormant*, not abandoned. Keep, or remove only together with the fulltest assertions + `/api/geo/*` + `lib/server/geo.ts` + `scripts/build-geo.mjs` + `better-sqlite3` + 3 geo devDeps as one decision |
| `app/api/geo/{countries,states,counties,cities}/route.ts` + `lib/server/geo.ts` + `scripts/build-geo.mjs` | Geo reference API over compiled `db/geo.db` | Only consumers are the dormant LocationPicker and QA scripts | Same dormant-geo contract as above; `db:seed` script runs `build-geo.mjs --if-missing` | Same as above — one package deal, currently protected by tests |
| `app/api/communities/[id]/reveal-author/route.ts` | Owner/admin-only moderation reveal of masked community authors (writes to mod log) | **Zero UI or test consumers** call this endpoint | Uses live `identityReveals`/`communityModLog` tables and `lib/server/communities.ts` helpers (which stay) | **Low-medium** — it's a real, security-reviewed moderation capability with no front-end yet. Likely "built ahead of UI". Recommend keep-or-confirm with product before deleting |
| `app/api/me/outbox/route.ts` | Reads your own demo email/SMS outbox (demo delivery channel) | No fetches to `/api/me/outbox` anywhere | The `outbox` **table + writer** (`lib/server/notify.ts`) are live and used; only this read endpoint is orphaned | **Low** — but it's the only way to inspect deliveries; may be intended as a debugging surface |
| `lib/follow.tsx` (localStorage mock follow store) + `components/FollowButton.tsx` + `components/FollowListModal.tsx` | Gen-1 follow system (seeded `jordan/ava/marcus`, localStorage) | Real following uses `/api/follow/[userId]` everywhere else | **Still mounted**: `FollowProvider` wraps the whole app in `app/layout.tsx`; `FollowButton` used on the live Campus page (mock `ava`); `FollowListModal` (mock creators list!) opened by the **live** `profile/ProfileHeader` follower-count click | **Medium** — removal requires small edits to `layout.tsx`, `campus/page.tsx`, `ProfileHeader.tsx`. This is a *mock-data leak into live UI*, worth replacing with the DB follow API rather than plain deletion |
| Unused exported functions in live modules: `scorePost` (`lib/server/feed.ts`), `startJobScheduler` (`lib/server/jobs.ts` — never called; jobs run via explicit `runJobsTick`), `totpCode` (`lib/server/totp.ts`), `normalizeLegacyLocation` (`lib/server/geo.ts`), `parseInterview` (`lib/engagement.ts`), `evaluateScenario` (`lib/server/qaScenarios.ts`), `revealBetween`/`setAlias` (`lib/server/communities.ts`), plus ~40 unused type/const exports (largest group in `lib/data.ts`) | Helpers superseded by newer paths (`recsys.arrangeFeed` replaced `scorePost`; on-demand ticks replaced the scheduler) | No callers outside their own files | Their host files are all live | **Low per-symbol** — remove the export or the function body only, never the file |
| `app/welcome/page.tsx` | Redirect stub → `/` | It's a 20-line intentional tombstone ("RETIRED as a separate landing page") | Old links, logout destinations, `GuestGate`/`OnboardingTour` path lists, a fulltest step checks the redirect | **Keep** — deliberate; removal breaks old links and one test |
| `db/rls.sql` | Row-level-security policy documentation | Never executed by any script (drizzle push doesn't apply it) | README references it as the RLS design doc | **Low** — documentation, not code; keep or fold into README |
| `scripts/qa-audit.mjs` | Standalone QA-scenario walker | Not wired into `package.json` scripts or fulltest | None | **Low** — dev tool, harmless |

---

## 3 · DO NOT REMOVE — still connected to the active application

### Core product (all verified live, DB-backed, multiple consumers)
- **All 130 API routes except the two flagged above** — every one has ≥1 real consumer (page, component, QA scenario, or auth-lifecycle script).
- **All 61 DB tables in `db/schema.ts`** — every table is read or written by live code (checked individually; even `communityModLog`, `bids`, `projectMilestones`, `outbox`).
- Auth (`lib/server/auth.ts`, `passwords.ts`, `otp.ts`, `totp.ts`, `ratelimit.ts`, `middleware.ts` CSRF guard), sessions incl. **UpNova legacy cookie fallbacks** (rebrand continuity — tested), profiles, Home/For You (`DbFeed` + `recsys`), Discover, Search, Messaging (`DbMessages` + conversations), Services, Opportunities, Bookings, Payments, Posts (`DbPostCard`), Notifications (`DbNotificationBell` + `notify.ts`), Following (`/api/follow`), Bookmarks, Activity, Onboarding (`OnboardingTour`, `PersonalizeFlow`, `PrefsEditor`), Live/Replays/Highlights (per your instruction), Shop/orders, Communities, Campus + Market, My World/Profile Studio, Business suite (hiring/people/clients/plans), Works/licensing, Events, Schools, Admin, Trust/reports/resolution.

### Legacy-looking but LIVE (the dangerous ones — these look dead but are not)
| Item | Why it must stay (for now) |
|---|---|
| `components/Feed.tsx` | Nothing renders `<Feed>`, **but** `app/page.tsx`, `RightSidebar`, `DbFeed` all import `type FeedScope` from it. Note: `lib/server/feed.ts` has a **different** `FeedScope` (`"5mi"` vs `"5"`) — a rename/merge is a refactor, not a deletion. Removing `Feed.tsx` today = build break |
| `components/PostCard/PollCard/AudioPost/BottomStats/EventCard/ProfilePreview` | Imported (transitively) by `Feed.tsx`; they die only after the `FeedScope` type is extracted and `Feed.tsx` retired. Also `ProfilePreview`/`EventCard` are imported by `CommunityView` (Cluster A) |
| `components/Sidebar.tsx` | THE live navigation (via `SidebarShell` in layout) — but still imports mock `communities` from `lib/data.ts` for the "joined" count |
| `components/CreateModal.tsx` + `CreateModalTrigger.ts` | Mounted in `app/layout.tsx`; triggered by Navbar + MobileNav; links to the real `/…/new` pages. Imports mock `currentUser` |
| `components/OpportunityCard.tsx` | Used by the **live** Campus page (and `OrgPage`) — even though `OpportunityList` is the DB replacement elsewhere |
| `components/EventManager.tsx` + `app/events/[id]/manage/page.tsx` | Live route; README explicitly: "Ticket CHECKOUT + QR check-in … legacy mock — needs the payments pass". Mock-backed but shipped |
| `components/OrgPage.tsx` + `app/campus/[org]/page.tsx` | Live route linked from Campus; README: campus org sections are still demo data by design |
| `components/ReportModal.tsx` | Decorative (no fetch — `TrustReportModal` is the real reporter) but rendered by **live** `DbMessages`, resolution page, and `OpportunityCard` |
| `lib/data.ts` | Still imported by 6 live pages (`analytics`, `campus`, `campus/[org]`, `events/[id]/manage`, `resolution`, `settings`) + the live components above. ~40 of its exports are orphaned and can be pruned, but the file must stay until those screens are migrated (README: "being retired screen by screen") |
| `app/resolution/page.tsx`, `app/analytics/page.tsx` | Live routes in the account menu; partially mock-backed (known, documented) |

### QA / demo / dev-only surface — deliberately shipped, correctly gated (do not delete; flag for production)
- `db/DEMO_MODE` marker, `/simulation` + `QaLab/QaGuide/QaPersonaBar/QaExampleValues/DemoModeSwitch`, `/learn` + `LearnGuide`, `/debug/session`, `/api/demo/*`, `/api/qa/*`, `/api/debug/session`, `lib/qa*`, `lib/server/qa*`, `lib/server/demo.ts`, `lib/learnScenarios.ts`, `scripts/*` (fulltest spawns the three `browser-qa-*.mjs` scripts as child processes).
- All gated: routes 404 unless `isDemoMode()`; UI hidden unless `user.demoTools` + QA persona. **The one production action required is deleting `db/DEMO_MODE` at deploy time (or via the vercel-build pipeline) — the file says so itself.** The `/api/demo/fulltest` suite is also your only regression harness (348+ steps); removing it removes your safety net for the cleanup itself.

### Dependencies — **none are removable**
All runtime deps verified in use (fonts via `globals.css`, `bcryptjs` for legacy-hash verification, `better-sqlite3` for the dormant-but-test-protected geo.db, `@electric-sql/pglite`/`@neondatabase/serverless` for the dual DB driver, `@vercel/blob` for uploads). All devDeps verified (`@sparticuz/chromium`/`puppeteer-core`/`axe-core` for browser QA; `country-state-city`/`cities-1000-structured`/`@nickgraffis/us-counties` for `build-geo.mjs`; `tsx`/`drizzle-kit` in npm scripts).

### Duplicates inventory (for later consolidation, not deletion)
- `FeedScope` defined twice with **different literal values** (`components/Feed.tsx` vs `lib/server/feed.ts`) — the client one is the URL-param dialect; unify deliberately.
- `timeAgo` copy-pasted in 6 files; `money()` in 3 — candidates for one `lib/format.ts`.
- Two follow systems (localStorage `lib/follow.tsx` vs `/api/follow`), two report modals (`ReportModal` mock vs `TrustReportModal` real), two profile stacks (`ProfileHeader/ProfileTabs` management view vs `ResponsiveProfile` visitor view — both currently live by design).

---

## Recommended cleanup order (after your approval — nothing deleted yet)

Each step is independently shippable, verified by `tsc --noEmit` + `next build` + a full Test Center run (`npm run test:e2e`) before moving on.

1. **Zero-risk deletions (Clusters A + B + C).** Delete the 17 unreachable files (~3,000 lines) + 2 QA SVGs + 2 CSS classes. No live file changes needed. *This alone removes most genuinely dead code.*
2. **Mechanical unused-import sweep.** Fix the ~100 `tsc --noUnusedLocals` hits (CreateModal, profile/studio, etc.). Consider enabling `noUnusedLocals` afterward to lock it in.
3. **Extract the `FeedScope` type** into a small shared module (or `DbFeed` itself), update the 3 type-importers, then delete `Feed.tsx` → which frees `PostCard`, `PollCard`, `AudioPost`, `BottomStats`, and (with Cluster A gone) `EventCard`, `ProfilePreview` (~770 more lines).
4. **Retire the localStorage follow system.** Point `ProfileHeader`'s follower list at `/api/follow`/`/api/users`, replace the Campus-page `FollowButton` with the DB-backed pattern used elsewhere, unmount `FollowProvider` from layout → delete `lib/follow.tsx`, `FollowButton.tsx`, `FollowListModal.tsx`. (Small feature-parity work, not pure deletion — this fixes a mock-data leak in a live surface.)
5. **Prune orphaned exports** in live libs (`lib/data.ts`'s ~40 unused exports, `scorePost`, `startJobScheduler`, `totpCode`, etc.) — trims ~500 lines without touching behavior.
6. **Decide the two orphaned API routes** with product: keep `reveal-author` (moderation capability awaiting UI) and `me/outbox` (delivery inspection), or drop them. Zero coupling either way.
7. **Screen-by-screen `lib/data.ts` retirement** (the migration the README already prescribes): Settings mock sections → real APIs; Analytics charts → `/api/analytics/summary`; Resolution demo case → `/api/orders/[id]/dispute` data; Campus orgs + `OrgPage` → DB; Event Manage + `EventManager` → real ticketing (payments pass). Only after the last consumer is migrated does `lib/data.ts` get deleted. **This is feature work, not cleanup — do last, one screen at a time.**
8. **Production-deployment hygiene (config, not code):** ensure the deploy pipeline deletes `db/DEMO_MODE` (and never sets `MAVYN_DEMO_MODE`/demo-login envs) for real production. All QA tooling stays in the tree — it self-disables.

**Explicitly untouched throughout:** Live/Replays/Highlights, Shop, Communities, Campus, My World/Profile Studio, the dormant geo system (test-protected), the UpNova legacy-session fallbacks, the whole QA/Test Center, and every feature listed in your core-loop requirements.
