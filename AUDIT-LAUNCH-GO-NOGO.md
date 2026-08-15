# LAUNCH-READINESS GO / NO-GO REPORT

Date: 2026-08-15 · Branch audited: `arena/01a0026a-upnova` @ `28cb063` (HEAD, pushed)
Method: GitHub Deployments API (`gh`), public probes of `*.vercel.app` domains, repo/source inspection.
Constraint honored: **zero code changes** — this document is the only file added.

---

## VERDICT: **NO-GO** (for Production launch today)

Preview is healthy and the hardened code is deployed to it, but Production is
currently serving **nothing at all**, the required environment variables cannot
be confirmed, and the two external-integration smoke tests could not be
executed from this sandbox. Every blocker is a dashboard/config action, not a
code change.

---

## 1. Exact deployment currently serving Production

**NONE.** This is the headline finding — the situation is *better* than feared
but still not launch-ready:

| Probe | Result |
|---|---|
| `https://upnova-6qqz-fcq9uxa15-upnova.vercel.app` (the stale 2026-08-10 deployment) | **410 GONE — `DEPLOYMENT_DELETED`**. The stale pre-hardening deployment has been deleted from Vercel. It is not serving anyone. |
| `https://upnova-6qqz.vercel.app` (project `upnova` default prod domain) | 404 `DEPLOYMENT_NOT_FOUND` — no production deployment assigned |
| `https://upnova-7wqt.vercel.app` | 404 `DEPLOYMENT_NOT_FOUND` — no production deployment assigned |
| `https://upnova-tibp.vercel.app` | 404 `DEPLOYMENT_NOT_FOUND` — no production deployment assigned |
| `https://upnova.vercel.app` | Serves **"EducateHub"** — an unrelated third-party app. That global domain is owned by another Vercel account; it is NOT this project and never was. Do not treat it as ours. |

Why Production is empty: every Production deployment ever recorded (3 total,
all 2026-08-10) was built from `main` @ `86cdb94` — and **`main` contains
exactly one file: `README.md`**. The real application has only ever lived on
the `arena/*` branches. Two of the three prod builds failed outright; the one
that "succeeded" is the deleted `upnova-6qqz-fcq9uxa15` deployment.

**Consequence:** Production deploys track `main`. Until the hardened branch is
merged/promoted to `main` (or the projects' production branch is changed in the
dashboard), no push can ever produce a real Production deployment. This is a
**new P0 blocker** discovered by this audit.

## 2. Canonical project determination

Four Vercel projects (+ one dormant) are connected to `devooworst/Upnova-`:

| Project | Preview @ `28cb063` | Production state | Recommendation |
|---|---|---|---|
| `upnova` (deploy URLs use `upnova-6qqz-*`/`upnova-8b4*` slugs; default domain `upnova-6qqz.vercel.app`) | ✅ success | Empty (stale deploy deleted) | **CANONICAL** — only project that ever completed a Production deploy; plain-named; keep for Preview + Production |
| `upnova-7wqt` | ✅ success | Empty (prod build of `main` failed — expected, `main` is a README) | Disconnect from the repo or delete (duplicate builds) |
| `upnova-tibp` | ✅ success | Empty (same failed `main` build) | Disconnect or delete |
| `upnova-arena-019fdecc-upnova-20` | ❌ "Deployment was blocked" on every commit | — | **ROOT CAUSE FOUND: the project is PAUSED by the owner** (`503 DEPLOYMENT_PAUSED`, spend-management pause). Not a code issue. Delete it, or unpause if wanted — but deleting is cleaner. |
| `upnova-6qqz` (GitHub environment exists, no recent deployments) | dormant | — | Historical artifact of the `upnova` project's URL slug; no action |

Canonical going forward: **`upnova`** owns Preview and Production. The
duplicates cost 3× build minutes per push and create alias confusion.
(Project selection/deletion is dashboard-only — marked MANUAL below.)

## 3–4. Environment variables — **MANUAL, could not be inspected**

The sandbox has no Vercel API credentials and no network path to
`api.vercel.com`. **None of the following could be verified programmatically;
all are explicit manual dashboard actions on the canonical `upnova` project:**

Must be SET on Production (and DATABASE_URL + keys on Preview for smoke tests):

- [ ] `DATABASE_URL` (postgres:// — Neon). Code fails closed without it (`db/index.ts` throws FATAL on `VERCEL_ENV=production`), so a missing value breaks visibly rather than silently — but it still must be set.
- [ ] `CRON_SECRET` (Vercel sends it to `/api/jobs/tick`; route 503s fail-closed on prod without it)
- [ ] `STRIPE_SECRET_KEY` = **`sk_test_...`** during the test phase
- [ ] `STRIPE_WEBHOOK_SECRET` (from the Stripe dashboard webhook endpoint pointing at `/api/webhooks/stripe`)
- [ ] `RESEND_API_KEY`
- [ ] `EMAIL_FROM` (defaults to `"Mavyn <onboarding@resend.dev>"` if unset — acceptable for testing)

Must be ABSENT on Production:

- [ ] `MAVYN_DEMO_MODE`
- [ ] `MAVYN_FORCE_DEMO_IN_PRODUCTION`
- [ ] `MAVYN_ALLOW_LIVE_STRIPE`
- [ ] `NEXT_PUBLIC_SHOW_DEMO_LOGINS`

Code-side defense-in-depth for the "absent" list is VERIFIED in source: demo
mode is hard-OFF on `VERCEL_ENV=production` unless `MAVYN_FORCE_DEMO_IN_PRODUCTION=1`,
and `sk_live_` keys are refused unless `MAVYN_ALLOW_LIVE_STRIPE=1`
(`lib/server/auth.ts`, `lib/server/paymentProvider.ts:73-77`). So even a
mistake here fails safe — but verify the dashboard anyway.

## 5. Hardened branch deployed to canonical Preview — ✅ VERIFIED

`28cb063` (HEAD of `arena/01a0026a-upnova`) is deployed with **success** status
to Preview on all three active projects, including canonical `upnova`:
`https://upnova-8b465x5do-upnova.vercel.app` (2026-08-15T07:13Z).

**Caveat:** all Preview URLs are behind **Vercel Deployment Protection**
(SSO login wall). Confirmed by direct probes — every preview URL redirects to
the Vercel login page.

## 6–8. Stripe + Resend smoke tests — **BLOCKED, manual**

Could **not** be executed. Three independent hard stops:

1. **Deployment Protection**: every Preview URL returns the Vercel SSO wall to unauthenticated callers. No API route is reachable from outside the team.
2. **Sandbox egress**: this sandbox has zero network access to `api.stripe.com`, `api.resend.com`, and `*.vercel.app` via curl (all 000); the page-fetch path that does work is GET-only and cannot drive POST flows (payment, `POST /api/auth/forgot`).
3. **Keys unconfirmed**: `STRIPE_SECRET_KEY` / `RESEND_API_KEY` presence on Preview could not be verified (see §3), and without them the app intentionally uses the simulated provider / outbox on Preview — a smoke test would exercise nothing external.

Exact manual procedure (10 minutes, from any logged-in browser):

- Set `STRIPE_SECRET_KEY` (sk_test_), `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `DATABASE_URL` on **Preview** env of project `upnova`; redeploy `arena/01a0026a-upnova`.
- **Stripe round trip**: log in as a seed user, pay for any order/booking; confirm a test-mode PaymentIntent appears in the Stripe test dashboard with `metadata.mavynPaymentId`, then confirm the webhook flips the payment row `pending→held` (Stripe dashboard → webhook endpoint → recent deliveries → 200).
- **Resend round trip**: `POST /api/auth/forgot` for an account whose email you control (demo mode ON on Preview means `devResetUrl` also appears in the response — that's expected on Preview); confirm the email arrives and the reset link works end-to-end.
- Optional: enable **Protection Bypass for Automation** (dashboard → Deployment Protection) to allow scripted smoke tests with the `x-vercel-protection-bypass` header.

## 9. No live credentials / no real money — ✅ VERIFIED

- No `.env` files committed (only `.env.example`); no `sk_live_` material anywhere in the tree (grep: only refusal-logic and docs).
- `sk_live_` keys are structurally refused at runtime without `MAVYN_ALLOW_LIVE_STRIPE=1`.
- Nothing is serving Production at all, so no user-facing money path exists anywhere.
- This sandbox holds no Stripe/Resend/Vercel credentials.

## 10. Cron schedule accepted by current plan — ✅ VERIFIED

`vercel.json` carries `0 6 * * *` (daily). Evidence of acceptance: commits
`e485632`→`6d00e3a` with the old `*/10 * * * *` cron **failed every Vercel
build** ("Deployment has failed"); `28cb063` with the daily cron builds
**green on all three active projects**. Same plan, same projects — the only
delta is the schedule. Restore `*/10 * * * *` after a Hobby→Pro upgrade if the
10-minute sweep cadence is wanted.

---

## Summary matrices

### Verified programmatically ✅
| # | Item | Result |
|---|---|---|
| 1 | Stale 2026-08-10 pre-hardening Production deployment | **Deleted (410 GONE)** — not serving anyone |
| 1 | Deployment currently serving Production | **None** — all prod domains 404 |
| 2 | Canonical project identified | `upnova` (recommendation; enactment is manual) |
| 2 | `upnova-arena-019fdecc-upnova-20` failure root cause | Project is **paused** (spend management) — not a code issue |
| 5 | Hardened `28cb063` on Preview | Green on all 3 active projects |
| 9 | No live keys / no real money | Confirmed in code, repo, and (vacuously) in prod |
| 10 | Daily cron accepted by plan | Confirmed via green builds post-`28cb063` |
| — | Demo-mode + sk_live fail-safes in source | Confirmed |

### Manual dashboard actions required 🔲
1. Set the 6 required env vars on `upnova` Production (+ Preview for smoke tests).
2. Confirm the 4 forbidden env vars are absent from Production.
3. **Point Production at real code**: merge/promote `arena/01a0026a-upnova` → `main` (or change the production branch setting). *Not done from this session — branch isolation policy prohibits pushing to `main`.*
4. Run the Stripe sk_test_ and Resend smoke tests from Preview (procedure in §6–8).
5. Decommission duplicate projects `upnova-7wqt`, `upnova-tibp`; delete or unpause `upnova-arena-019fdecc-upnova-20`.
6. Decide Hobby→Pro for the 10-minute cron cadence (daily is fine to launch).
7. Choose/attach the real production domain (note: `upnova.vercel.app` is owned by a third party and unavailable).

### Remaining blockers (all non-code)
- `main` is an empty README → Production structurally cannot deploy the app until promotion.
- Env vars unverified/likely unset.
- External integrations (Stripe test-mode, Resend) never exercised over the network.

### Security concerns
- **None new.** Demo hard-off, fail-closed DB/payments/email/cron, live-key refusal all verified in source at `28cb063`.
- Deployment Protection on Previews is currently a *benefit* (seed data + demo logins not publicly exposed). Revisit only if public preview links are wanted.
- `upnova.vercel.app` belonging to a stranger is a phishing-adjacent footnote: never publish that URL as ours.

### External integration results
- Stripe: **not exercised** (blocked; see §6–8). Structural verification only.
- Resend: **not exercised** (blocked; see §6–8). Structural verification only.

---

**GO conditions:** items 1–4 of the manual list complete + both smoke tests
pass. No further code changes are required for launch. Per standing
instructions, no P1/P2 work, no Stripe Connect, and no live Stripe activation
have been started.

---

# ADDENDUM — Re-verification after "manual configuration complete" (2026-08-15, later same day)

**Result: NO-GO — no observable configuration change detected.** Every programmatic signal
is byte-identical to the prior NO-GO state:

1. **Production deployment commit/branch**: GitHub Deployments API still shows exactly
   3 Production deployments, all 2026-08-10, all at `86cdb94` (`main` = bare README).
   Zero Production deployments created since. `main` is still at `86cdb94`; no PRs exist.
2. **Probe test**: pushed an empty commit `eadbd62` to `arena/01a0026a-upnova`.
   It triggered **4 Preview deployments and 0 Production deployments** (upnova: success,
   upnova-7wqt: success, upnova-tibp: success, upnova-arena-019fdecc-upnova-20: still
   blocked/paused). Conclusion: no Vercel project has its Production branch pointed at
   the hardened branch, and `main` has not been promoted.
3. **Production URLs**: `upnova-6qqz.vercel.app`, `upnova-7wqt.vercel.app`,
   `upnova-tibp.vercel.app` all still 404 `DEPLOYMENT_NOT_FOUND`. Nothing serves Production.
4. **Env vars / forbidden flags**: still MANUAL — sandbox has no Vercel API egress
   (api.vercel.com → 000) and no Vercel credentials; dashboard state cannot be read.
5. **Preview**: ✅ healthy — `eadbd62` deployed green to canonical `upnova`
   (`upnova-12ju9ddfi-upnova.vercel.app`), behind the expected SSO protection wall.
6. **Stripe smoke test**: NOT RUN — blocked (Preview SSO wall + no egress to api.stripe.com
   + keys unverifiable).
7. **Resend smoke test**: NOT RUN — same blocks.

If configuration was performed in the Vercel dashboard, it has not resulted in any
Production deployment. Most likely missing step: the Production **branch** setting —
either merge/promote `arena/01a0026a-upnova` → `main`, or set the project's production
branch to `arena/01a0026a-upnova` and trigger a deploy. Until a Production deployment
object exists, no dashboard env-var work is testable end-to-end.
