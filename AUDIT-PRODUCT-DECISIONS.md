# Mavyn — Final Two Architecture Decisions (read-only analysis)

**Date:** 2026-08-15 · **Branch:** `arena/01a0026a-upnova` (post-Phase-5e, commit `ca6e4a1`) · **No code modified.**

These are the last two `lib/data.ts` consumers. Everything else in the app is now real.

---

# Decision 1 — Events/Manage (`/events/[id]/manage` + `EventManager.tsx`)

## What exists today (verified)

| Layer | State |
|---|---|
| **Route** | 100% mock: static params from mock `events`, fake attendee list padded from mock `creators`. **Link-orphaned** — zero inbound links anywhere; the event detail page shows hosts only a "You're hosting — N going" chip |
| **`events` table** | Rich and real: host, campus scoping + `publicVisibility`, capacity, `attending` seed baseline, `kind` (rsvp/registration/ticket/approval), `config` (fields/rules/waitlist), **`status: active \| cancelled`** — the cancel state exists in schema but **no API can set it** (only read: RSVP returns "This event was cancelled") |
| **`eventRsvps`** | Real per-user attendance records (`eventId+userId+createdAt` PK) — identities exist, but **no endpoint lists them**; only counts via `rsvpCounts()` |
| **APIs** | `GET /api/events`, `POST /api/events` (create), `GET /api/events/[id]` (detail, `isHost` computed), `POST /api/events/[id]` (RSVP toggle with campus gate + capacity). **No host-side write API at all** |
| **QA surface** | Zero fulltest/QA references to the manage route or EventManager — free to change or remove |

## The smallest useful real-lite version

One endpoint + one small host-action, then a page rewrite reusing what exists:

1. **`GET /api/events/[id]/attendees`** (host-only, ~35 lines): `requireUser` → 403 unless `hostId === user.id` → join `eventRsvps` × `profiles` → `[{displayName, avatarUrl, handle, rsvpAt}]` + counts (`real RSVPs`, `attending` baseline, capacity). This is a **deliberate new data exposure** (attendee identities to the host) — normal for events products, and scoped to the host only.
2. **`PATCH /api/events/[id]`** (host-only, ~25 lines): `{action: "cancel"}` → sets the schema's existing `status: "cancelled"` (+ optionally notify RSVPed users via the existing `notify()`; the RSVP route already refuses cancelled events, so downstream behavior is free).
3. **Page rewrite** (~150 lines replacing 263): dynamic (drop mock `generateStaticParams`), fetch detail + attendees, 404/redirect non-hosts. Sections: event info · real attendee list with search · capacity/RSVP count · Cancel event. The mock **Tickets / Check-in / Payments / Analytics tabs are removed** (not stubbed) — honest "arrives with paid ticketing" copy at most.
4. **One inbound link**: swap the event page's host chip ("You're hosting — N going") to link to `/events/[id]/manage` — fixing the orphan is what makes the page worth having.

**Scope: ~1 day-equivalent · +2 small endpoints, −mock page/component · net −~80 lines · `events` + `creators` exports die → `lib/data.ts` drops ~230 lines.**

## Risks

- **Low:** no QA coverage constraints; route unswept; nothing else consumes the new endpoints.
- **Privacy call embedded:** attendee names to hosts (recommended: yes — attending an event is a social act, and campus events already gate RSVP by verified membership).
- **Cancel semantics:** must not delete RSVPs (keep records; the RSVP route already refuses further changes).

## Is keeping it worthwhile?

**Yes — as real-lite.** The alternative (delete the route until ticketing) is cheaper but leaves hosts with literally no management surface: they can't even see who's coming to their own event, or cancel it. Both capabilities are one small endpoint each on infrastructure that already exists. Retire-for-now is defensible, but real-lite is a genuine core-loop improvement (Deliver, for event hosts) at cleanup-adjacent cost.

**Recommendation: build real-lite (option b), including the host-chip link.**

---

# Decision 2 — Campus Organizations

## What the existing Communities system already provides (verified against org requirements)

| Org requirement (from mock `CampusOrg` + OrgPage) | Communities equivalent | Status |
|---|---|---|
| Name, description, avatar/cover branding | `name/description/avatarUrl/coverUrl` | ✅ exists (mock uses emoji+gradient; communities use images) |
| Campus scoping | `campusId` + audience gating (`everyone/students/alumni`), server-enforced joins | ✅ exists, **stronger** than mock |
| Categories incl. "Student Organizations" | `category` — `STUDENT_GROUP_CATEGORIES` already includes **Student Organizations**, Academic Groups, Interest Groups, Study Groups; `isStudentGroup()` already routes them to Your Campus, not the public directory | ✅ exists |
| Membership + counts | `communityMembers` (roles member/moderator/**owner**, full status lifecycle, approval, capacity) | ✅ exists, richer |
| Leadership | owner + moderators = real leadership (mock had a string array) | ✅ exists (semantic upgrade) |
| Org posts feed | `communityPosts` + comments + moderation + identity modes | ✅ exists, richer |
| Org events | **Gap**: `events` has `campusId` but **no `communityId`** — no first-class "hosted by this org" link. Workaround: org events are campus events hosted by the owner; or a later nullable `events.communityId` column | ⚠ partial |
| "Verified Organization ✓" vs "Community Group" | **Gap**: no org-verification flag on communities. The mock's two-tier trust (`verified` bool) has no home. Options: a `verified` boolean column later, or drop the distinction for v1 (everything is a Community Group until an org-verification process exists — honest) | ⚠ gap |
| Attached opportunity | Communities can't own opportunities — but opportunities are posted by USERS, and the org owner posting a campus-scoped opportunity covers the real use ((`type: "campus"` + `studentFriendly`) already exists) | ✅ adequately covered |
| Detail page | `/communities/[id]` — full join/post/members/moderation UI, campus-gated joins | ✅ exists |
| Seeds | `bsu-digital-media-association` (category "Student Organizations", owner nia), math tutoring circle, chess club — **real org-like communities already live in the DB** | ✅ exists |

## The three approaches

### A. Separate Campus Organizations model
New tables (orgs, org_members, org_posts, org_events…), new APIs, new detail page, new moderation, new identity rules.
- **Complexity: HIGH** (weeks). **Duplication: massive** — it would re-implement 80% of communities (membership lifecycle, posting, moderation, campus gating) that took this codebase its whole history to harden. **DB changes: 4+ new tables.** **UX: splits "groups you're in" across two systems** — the sidebar "N joined", notifications, search, and reveal/identity machinery would all need org-awareness. **Scalability: two parallel social systems to maintain forever.** **Risk: high** (parallel auth surfaces). **lib/data.ts: eventually freed, slowest path.**
- The README itself says: *"organization pages — another type of community, not a separate product."* A separate model contradicts the codebase's own doctrine.

### B. Organizations = specialized Communities ✅ (verified viable)
The system was **built for this**: `kind`/`category` discriminators exist, `isStudentGroup()` already segregates org-category campus communities into Your Campus, seeds already include a real Student Organization, `/api/campus/groups` already serves them with membership state, and `/campus` already renders a real "Student Groups" area from that API.
- **Implementation: LOW** — v1 is mostly deletion + one redirect: (1) campus `#orgs` channel renders the **real** org-category groups from the existing `/api/campus/groups` (same endpoint, filter `category === "Student Organizations"`) instead of the mock grid; (2) `/campus/[org]` becomes a redirect (or thin wrapper) to `/communities/[id]` so old links survive; (3) delete `OrgPage` → which frees `OpportunityCard` → which frees `opportunities` + `currentUser` + `campusOrgs` + the last `creators` use in `lib/data.ts`.
- **DB changes required for v1: zero.** (Later, additively: `communities.verified` boolean for the ✓ tier; `events.communityId` for org-hosted events. Both nullable, non-breaking.)
- **UX consistency: best** — one join model, one post model, one moderation model; orgs inherit identity modes, approval, capacity, paid memberships for free. Sidebar counts, notifications, search all just work.
- **Compatibility:** fulltest asserts `CAMPUS_LIFE_CHANNELS` + the four doors — the `#orgs` channel **stays a channel**, only its content becomes real. All asserted strings unaffected.
- **Risk: LOW-MEDIUM.** The one real loss: the mock's "Verified Organization ✓" badge has no v1 home — recommend shipping without the tier (honest) and adding `communities.verified` when an actual verification process exists. Old `/campus/photo-club`-style links resolve only if we map/redirect; since the 3 remaining mock orgs never existed as real records, redirecting unknown slugs to the campus Communities door is correct.
- **lib/data.ts: this decision alone retires ~500 of the remaining 799 lines**, and combined with Decision 1 the file **dies entirely**.

### C. Retire the section for now
Delete `/campus/[org]`, `OrgPage`, the orgs grid, `OpportunityCard`.
- **Complexity: trivial.** **Risk: low** (nothing real depends on it). **But:** it removes a visible Campus door for zero product gain **when option B is barely more work** — the real groups list already exists and renders in the Student Groups area. C is what you do when B is expensive; B is not expensive.

## Recommendation

**Decision 2: B — confirmed viable, and cheaper than it looks.** Your instinct matches both the codebase's own architecture doctrine and the seeded data. The community system supports the required org functionality cleanly *today*, with two honest v1 caveats: no "Verified Organization" tier yet (defer, additive column later), and org-hosted events ride on campus events by the owner (defer `events.communityId`).

**Proposed execution order if both approved:**
1. **2-B first** (bigger `lib/data.ts` payoff, pure reuse): real orgs channel → `/campus/[org]` redirect → delete OrgPage + OpportunityCard → prune `campusOrgs`, `opportunities`, `currentUser`, `creators` + orphaned types.
2. **1-real-lite second**: attendees + cancel endpoints → real manage page → host-chip link → prune `events`, `UpEvent` + event enums.
3. **Then `lib/data.ts` is empty → delete the file.** The Gen-1 mock layer is fully retired.

Both steps verified against the usual battery (tsc, build, Test Center 391/13 baseline) individually, with your approval gate between them.
