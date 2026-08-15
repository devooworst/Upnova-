# Mavyn — Final Post-Cleanup Architecture Audit (read-only)

**Date:** 2026-08-15 · **Branch:** `arena/01a0026a-upnova` @ `96b45f6` · **QA baseline:** 391 PASSED / 13 known failures (untouched)
**No code was modified during this audit.** Source of truth: the current tree, verified by fresh repo-wide scans — not prior assumptions.

Campaign ledger: **80,312 → 74,292 lines · 381 → 350 files · 9 commits · baseline held at exactly 391/13 throughout.**

---

## 1 · `lib/data.ts` — CONFIRMED GONE ✅

File does not exist. Repo-wide scan (all import styles, dynamic `import()`/`require()`, QA source assertions, configs): **zero references.** The single remaining hit is a historical *comment* in `components/DiscoverClient.tsx:10` describing what the old page used to be — prose, not code.

## 2 · Deleted Gen-1 systems — ZERO PRODUCTION REFERENCES ✅

Verified per symbol: Feed cluster (`Feed`, `PostCard`, `PollCard`, `AudioPost`, `BottomStats`, `EventCard`, `ProfilePreview`), follow system (`lib/follow`, `FollowButton`, `FollowListModal`, `FollowProvider`, `useFollow`), mock profile/community components (`CreatorProfile`, `CommunityView`, `CommunityCard`, `CreatorCard`, `CreatePost`, `NotificationBell`, `lib/notifications`, `NearbyNow`, `HireModal`, `EventDetail`, `QrCode`, `ProjectDrawer`, `ProjectBar`, `PortfolioTab`, badges), `OrgPage`, `OpportunityCard`, `EventManager` — **all zero references.**
Three name collisions verified harmless: `interface CommunityCard` (communities page), `interface EventDetail` (event pages) are unrelated local API-payload types; `DbPostCard` is the live component.

## 3 · Remaining mock/demo/fake data — all intentional, each with a reason

| Item | Why it exists | Honest? |
|---|---|---|
| **QA/demo platform** (`db/DEMO_MODE`, `/simulation`, `/learn`, `/debug/session`, `/api/demo/*`, `/api/qa/*`, seed users w/ `mavyn123`, QA personas) | The product's own test/demo harness; server-gated by `isDemoMode()` + `requireQaOperator`. The DEMO_MODE file says "DELETE FOR PRODUCTION" | ✅ by design — but see P0 |
| **Test payments** (`held/released/refunded — all TEST`) | No real payment provider connected; the money model is real, the charges aren't. Stripe Connect is named as the production path | ✅ labeled everywhere |
| **Outbox as SMS/email channel** | Demo delivery is an inspectable DB table; production swaps the writer for Twilio/SES at the same call site | ✅ documented |
| **Live video stage** | No RTMP/WebRTC infra in the sandbox — presence canvas instead; state/chat/moderation/replays are all real | ✅ documented in schema |
| **Campus scripted chats + `campusServices` list** (`app/campus/page.tsx:78/99`) | The last deliberate demo content: interest-channel chat vignettes (the ava card inside now pulls the real user) and the "Student services" grid. Kept because real channel-chat + a campus-services source don't exist yet | ⚠ the only remaining *unlabeled* demo data in a production surface |
| **Mock USPS tracking on orders** | Carrier integration deferred; states simulate honestly | ✅ documented |
| **Plan feature lists** (`app/pro`, `/plans`) | Marketing copy, not data | ✅ normal |
| **Dormant geo system** (`LocationPicker`, `GeoSelect`, `/api/geo/*`, `build-geo.mjs`) | Deliberately kept for a future version; Test-Center-asserted to exist | ✅ protected |

## 4 · Remaining duplication / legacy architecture to consolidate eventually

1. **Two profile stacks, both live:** owner "Management view" (`ProfileHeader` + `ProfileTabs` + tab components) vs. the visitor-truth view (`ResponsiveProfile` → `DbCreatorProfile`/`MobileProfile`). Intentional (README: management vs. what-visitors-see) but it's two renderings of the same data to keep in sync.
2. **Two `FeedScope` dialects** (client `"5"` vs server `"5mi"`) with a mapping table — now documented at both ends, but still a rename-hazard.
3. **`timeAgo` ×6, `money()` ×3** copy-pasted helpers → one `lib/format.ts` eventually.
4. **`CampusGroups` vs `CampusOrgs`** components on the campus page share ~70% of their join/card logic (deliberately separate presentations; could share a card primitive).
5. **CreateModal is decorative** (0 fetches): a preview/launcher that links to the real `/…/new` pages. Two "creation UX" layers; fine for now, consolidation candidate.
6. **`/welcome` tombstone redirect** — intentional (old links), trivial.

## 5 · Major technical debt (created or exposed by current architecture)

1. **The scheduler never runs.** `startJobScheduler()` exists but is never called; `runJobsTick()` fires only from demo/QA endpoints. In production, **booking reminders, review nudges, auto-releases, and payout timers simply won't happen** without a cron/trigger. Biggest hidden landmine in the codebase.
2. **Full-table-scan query style:** ~145 `.all()` loads with JS-side filtering, including `profiles`/`users`/`payments` full loads to build name maps (activity, admin, market, disputes). Fine for a 17-user demo DB; degrades linearly with users.
3. **`app/api/demo/fulltest/route.ts` (2,900 lines) asserts on SOURCE CODE strings** of ~20 files — a brittle contract that makes refactors (renames, formatting) fail QA even when behavior is identical. It's also the only regression harness, so it can't just be dropped.
4. **Data-URL images stored in DB columns** (16 API sites: market listings, dispute evidence, community posts) — payload bloat on every read; blobs exist (`lib/server/blobs.ts`) but aren't used for these paths.
5. **One pre-existing lint error** (`fulltest:2191`, unused variables) blocks `--noUnusedLocals` from being enabled repo-wide.

## 6 · Real but incomplete database/API areas

| Area | Real today | Missing |
|---|---|---|
| **Event ticketing** | `kind: "ticket"`, price, capacity; RSVP refuses with honest copy | checkout, payments link, check-in (deliberate defer) |
| **Event approval flow** | `kind: "approval"` refuses RSVP → "message the host" | actual request/approve mechanics |
| **Payments** | full held/released/refunded model, fees, timelines | real provider (Stripe Connect), payout accounts, receipts |
| **Notifications delivery** | in-app real; prefs granular | real SMS/email provider (outbox is the stub) |
| **Disputes** | orders fully; `GET /api/me/disputes` new | booking/project disputes have no dispute records |
| **Analytics** | engagement block real | views only counted from signed-in browsing; no guest impressions |
| **`reveal-author` + `me/outbox` endpoints** | built, secured | no UI consumer (moderation reveal awaits UI; outbox awaits an inspector view) |
| **Org verification** | orgs = communities (2-B) | `communities.verified` tier + process (deliberate defer) |
| **Follower lists** | counts + followedByMe real | no follower-identity list API (deliberately not built) |
| **Geo system** | compiled-DB API dormant | activation decision |

## 7 · Security/privacy before real users

1. **P0 — demo auth surface:** committed `db/DEMO_MODE` enables demo tokens signed with a **hardcoded key** (`mavyn-demo-signing-key-NOT-FOR-PRODUCTION`) and seed logins with a public password (`mavyn123`). The deploy pipeline must delete the marker (and never set `MAVYN_DEMO_MODE`/`NEXT_PUBLIC_SHOW_DEMO_LOGINS`/sticky-session envs). `vercel-build` currently runs `drizzle-kit push --force && tsx db/seed.ts` — **seeding demo users on every production build.**
2. **P0 — seeded admin:** `devin@mavyn.dev` is role=admin with the public password.
3. **P1 — rate limiting is thin:** 8 routes covered (auth, chat, posts, conversations). Uncovered state-changers include follows, RSVPs, bookmarks, applications, bookings, community joins, report submission — spam/abuse surface.
4. **P1 — embedding posture:** deliberately no frame-blocking headers + `SameSite=None` cookies (needed for the sandbox preview). For production, revisit: allow-list embedding origins or add `frame-ancestors`.
5. **P1 — data-URL uploads:** validated by prefix/size but stored in-row; multi-image posts allow ~500KB×4 per request paths — modest DoS/storage surface; move to Blob.
6. **P2 — `db/rls.sql` is documentation only** — RLS is not applied; all enforcement is app-layer (currently consistent, but single-layer).
7. Solid already: scrypt password hashing (bcrypt legacy migration), server-side sessions with revocation, CSRF origin middleware, campus/host/party authorization checks verified during this campaign, location-privacy respected in analytics/audience.

## 8 · Performance (especially mobile)

1. **Polling everywhere, no backoff:** live chat 2.5s + detail 8s + presence 15s + a 1s ticker simultaneously on `/live/[id]`; messages 6s; activity/live-list 10s. On mobile this is battery + radio churn; none pause on `document.hidden`.
2. **Query style (see §5.2)** — server-side cost will show up as TTFB on mobile first.
3. **Data-URL images** inflate JSON payloads on market/community/dispute reads (no CDN caching, no resizing).
4. **`sharp` missing** for production `next/image` optimization (build warns).
5. **Heavy single-file client pages** (`EditProfile` 1,855 lines, settings 1,233, services 1,129, campus 1,065) — one bundle each; acceptable, but they're the first candidates if mobile TTI becomes a complaint. First Load JS shared ~87.5KB is healthy.

## 9 · UX complexity worth simplifying

1. **Settings has 15 sections** — several near-empty or single-card (hiring, help, appearance); consolidation would cut cognitive load.
2. **CreateModal double-hop:** big "+" opens a modal that mostly links to the real `/new` pages — a launcher pretending to be a composer (its previews no longer lie about identity, but the hop remains).
3. **Payment-methods card in Settings** is still dead buttons ("Card •••• 4242", "Connect payouts") — the last decorative controls in Settings; honest removal or wiring belongs to the payments pass.
4. **Campus page density:** four doors + channel list + scripted chats + verification + alumni flows in one 1,065-line page; the doors help, but the Communities door contains three sub-concepts (channels/groups/orgs).
5. **Two event creation vocabularies** (`rsvp/registration/ticket/approval`) surface to users while two of them can't complete their flows yet — consider hiding `ticket`/`approval` until they work end-to-end.

## 10 · Orphaned / hard-to-reach routes

| Route | Reachability | Verdict |
|---|---|---|
| `/debug/session` | 0 links — URL-only, demo-gated | intentional (diagnostics) |
| `/admin` | conditional Navbar item (role=admin only) | fine |
| `/welcome`, `/reset` | 0 static links (redirect tombstone; email-flow entry) | fine |
| `/schools/[slug]` | 1 link (ProfileHeader academic line) | thin but reachable |
| `/works/new`, `/campus/market/new` | 1 link each | thin but reachable |
| `/learn` | 1 link (Settings → Help) | underexposed for what it does; consider surfacing in onboarding |
| `/resolution` | 1 nav link (account menu) + ReportModal | fine |
| `/payments` | 2 links (business sidebar + settings) | creators without business plan reach it only via Settings — worth one more entry |
| ~~`/events/[id]/manage`~~ | fixed this campaign (host chip links) | ✅ no longer orphaned |

---

# Prioritized list

## P0 — Must fix before real users
1. **Production deploy hygiene:** pipeline must delete `db/DEMO_MODE`, skip/replace demo seeding in `vercel-build` (currently seeds `mavyn123` users + an admin on every build), and guarantee `MAVYN_DEMO_MODE`, `NEXT_PUBLIC_SHOW_DEMO_LOGINS`, sticky-session envs are unset. Rotate/remove the hardcoded demo signing key path entirely in prod builds.
2. **Run the scheduler:** wire `runJobsTick()` to a real trigger (Vercel cron hitting a guarded route, or `startJobScheduler()` on server boot) — otherwise reminders, auto-releases, and payout timers silently never fire.
3. **Real payment provider** (Stripe Connect per the codebase's own notes) — the core loop ends at "Get Paid"; TEST payments can't ship to real users.
4. **Real email delivery for auth flows** (password reset/OTP currently land in the demo outbox — users can't recover accounts).

## P1 — Important for launch quality
5. Rate-limit the uncovered state-changing routes (follows, RSVPs, applications, bookings, joins, reports, bookmarks).
6. Move data-URL image storage to the existing Blob path (market, community posts, dispute evidence) + add `sharp`.
7. Replace full-table `.all()` scans with `where`/`inArray` on the hot paths (activity, bookings, admin, market).
8. Production embedding posture: `frame-ancestors` allow-list / revisit `SameSite=None`.
9. Polling hygiene: pause intervals on `document.hidden`, back off live polling on mobile.
10. Notification delivery provider (SMS/email beyond auth).
11. Wire or remove the dead payment-methods buttons in Settings.

## P2 — Improve after launch
12. Consolidate `timeAgo`/`money` into `lib/format.ts`; extract a shared campus group/org card.
13. Fix `fulltest:2191` and enable `noUnusedLocals` in `tsconfig`.
14. Migrate fulltest's source-string assertions toward behavioral assertions (keep the 391-step behavioral core; shrink the brittle source-grep layer).
15. Settings IA: merge near-empty sections (15 → ~9).
16. Hide `ticket`/`approval` event kinds until their flows complete.
17. Build the small UIs for the two orphaned-but-secured endpoints (`reveal-author` moderation action; outbox inspector) — or consciously retire them.
18. Booking/project dispute records (extend the disputes model beyond orders).
19. Surface `/learn` and `/payments` better.

## LATER — Future product work
20. Event ticketing + check-in (+ then the ticket/approval kinds ship fully).
21. `communities.verified` organization tier + verification process; `events.communityId` for org-hosted events.
22. Follower-identity list API + UI (re-enable the ProfileHeader count click).
23. Geo system activation decision (or removal of the dormant stack + its 3 devDeps and test contract).
24. Real live-video transport (RTMP/WebRTC) behind the existing state machine.
25. Campus scripted chats → real interest-channel chat; campus services → real directory (services × campus verification).
26. Guest impression tracking for analytics (privacy-reviewed).
27. RLS enforcement as a second authorization layer.

---

**Verification state at audit time:** working tree exactly matches pushed `96b45f6` (a sandbox HEAD-rollback was detected and restored via `git reset --hard FETCH_HEAD` — no content was lost; this is the third occurrence of the environment quirk this campaign). Baseline 391/13 untouched.
