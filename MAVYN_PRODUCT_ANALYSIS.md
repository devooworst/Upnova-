# Mavyn: Product Analysis & Strategic Recommendations

**Analyzed**: 60 pages · 122 API routes · 76 components · 64 library files · ~72,000 lines of code  
**Date**: August 12, 2026  
**Status**: Pre-launch — fully functional demo, no real users yet

---

## 1. What Mavyn Actually Is

### The Problem Mavyn Solves

Creative professionals — musicians, photographers, videographers, designers, stylists, content creators — currently fragment their professional lives across 5–8 platforms:

- **Instagram/TikTok** for visibility and social proof
- **LinkedIn** for professional credibility (but it feels corporate, not creative)
- **Fiverr/Upwork** for freelance work (but they're race-to-the-bottom marketplaces)
- **Personal website** for portfolio (but nobody finds it)
- **Email/text** for client management (but nothing is organized)
- **Eventbrite/Meetup** for events (but disconnected from their network)
- **Venmo/CashApp** for payments (but no protection or records)

**Mavyn's core thesis**: Creative professionals need ONE platform where they can be discovered, prove their work, get hired, manage clients, and get paid — without sacrificing the social energy that makes creative careers work.

### Who Mavyn Is For

**Primary user**: The independent creative professional (18–35) who makes money from their craft or is actively building toward it. They have a skill, want clients, and need a professional presence that doesn't feel like LinkedIn.

**Secondary users**:
- **Clients/businesses** looking to hire creatives (the demand side of the marketplace)
- **Students** building their creative careers while in school (campus integration)
- **Communities** of creatives who want to connect around shared interests

### What Makes Mavyn Different

| Platform | What it does | What it doesn't do |
|----------|-------------|-------------------|
| **Instagram** | Social visibility, audience | No hiring, no payments, no client management |
| **LinkedIn** | Professional networking, jobs | Corporate culture, no creative identity, no marketplace |
| **Fiverr/Upwork** | Freelance marketplace | No social layer, no portfolio depth, race-to-bottom pricing |
| **Etsy** | Product marketplace | Physical goods only, no services, no social |
| **Behance/Dribbble** | Portfolio showcase | No hiring flow, no payments, no client management |
| **Mavyn** | **All of the above, connected** | Still needs to prove it can do any ONE of them well |

### Mavyn's Strongest Value Proposition

**"Your creative career in one place."**

The single most valuable thing Mavyn offers is the *connection* between features: a client discovers you through your portfolio, messages you directly, books your service, tracks the project, and pays — all without leaving the platform. That loop is what no competitor offers.

### What Mavyn Should Be Known For

**The platform where creative careers actually happen.** Not just a portfolio site, not just a job board, not just a social network — the place where the full cycle of creative work lives: discover → connect → hire → deliver → get paid → grow.

---

## 2. Feature Audit

### Classification Framework

- **CORE** — Without this, Mavyn has no reason to exist. Launch-blocking.
- **IMPORTANT** — Adds clear value to the core experience. Should be polished for launch.
- **LATER** — Potentially valuable but adds complexity. Should wait until core proves itself.
- **INTERNAL** — Developer/QA tooling. Not a user-facing product decision.

### Full Feature Classification

| Feature | Classification | Reasoning |
|---------|---------------|-----------|
| **Auth (signup/login/MFA/OTP)** | CORE | Can't have a platform without it |
| **Profile (edit/view)** | CORE | The identity layer everything else depends on |
| **Home Feed** | CORE | The primary engagement surface |
| **Discover (search/browse)** | CORE | How people find each other and opportunities |
| **Messaging** | CORE | The connective tissue between all marketplace interactions |
| **Opportunities (browse/post/apply)** | CORE | The #1 reason professionals would use Mavyn over Instagram |
| **Services (list/hire/book)** | CORE | The #1 reason clients would use Mavyn |
| **Notifications** | CORE | Users need to know when things happen |
| **Bookmarks** | IMPORTANT | Useful but not launch-blocking |
| **Profile Studio / My World** | LATER | Pro customization — valuable for retention, not acquisition |
| **Works/Portfolio** | IMPORTANT | Portfolio is essential for creatives, but licensing is LATER |
| **Works Licensing** | LATER | Complex legal/financial surface; wait until core marketplace works |
| **Shop (products)** | LATER | Physical goods is an entirely different marketplace; adds huge complexity |
| **Bookings (calendar)** | IMPORTANT | Natural extension of services; the scheduling layer |
| **Clients (CRM)** | LATER | Valuable for power users but not a reason to join |
| **Activity (project tracker)** | IMPORTANT | Users need to see what's in progress |
| **Payments** | CORE | The money layer — but can start simple (Stripe Connect) |
| **Events** | IMPORTANT | Natural for creatives but not the primary use case |
| **Communities** | LATER | Engagement driver but extremely hard to seed with content |
| **Campus** | LATER | Interesting niche but doubles the product surface area |
| **Analytics** | IMPORTANT | Creators want to know their numbers; basic version for launch |
| **Learn** | LATER | Onboarding aid, not a product feature |
| **Plans/Billing (Pro/College/Business)** | IMPORTANT | Revenue model, but free tier must be fully functional first |
| **Hiring Dashboard (business)** | LATER | Business accounts are a second product |
| **People (business CRM)** | LATER | Business feature, not core |
| **Orders (product purchases)** | LATER | Depends on Shop, which is LATER |
| **Resolution Center** | IMPORTANT | Trust/safety for marketplace transactions |
| **Settings** | CORE | Account management |
| **Admin** | INTERNAL | Platform management |
| **Simulation/Test Center** | INTERNAL | Developer QA tooling |
| **QA Lab / Full Test** | INTERNAL | Automated testing infrastructure |
| **Feature Tours** | IMPORTANT | Onboarding; helps users understand a complex product |
| **Onboarding Tour** | IMPORTANT | First-run experience |
| **Preferred Clients / Early Access** | LATER | Power-user feature |
| **Promoted Listings (boost/featured)** | LATER | Monetization feature, requires traffic first |
| **Live / Replays / Highlights** | DON'T BUILD YET | Massive infrastructure cost; no evidence users want this from Mavyn |
| **Campus Market** | LATER | Niche within a niche |
| **Search (global)** | CORE | Users expect to find things |
| **Follow/Following** | CORE | Basic social graph |
| **Posts (create/like/comment)** | CORE | Content creation for the feed |
| **Guest Mode** | IMPORTANT | Critical for acquisition — let people see before signing up |
| **Trust System / Verified Badge** | IMPORTANT | Trust is essential for marketplace transactions |
| **Reports / Moderation** | IMPORTANT | Safety infrastructure |
| **Blocks** | IMPORTANT | User safety |
| **Nearby Now** | LATER | Location-based social; cool but not core |

### Summary

- **CORE**: ~15 features that define what Mavyn is
- **IMPORTANT**: ~12 features that make it good
- **LATER**: ~15 features that add depth but risk distraction
- **DON'T BUILD YET**: Live/Replays/Highlights
- **INTERNAL**: ~6 developer tools

---

## 3. The Core Mavyn Experience

### The Ideal User Journey

```
1. DISCOVER    Guest lands on home feed → sees real content, real people, real opportunities
       ↓       (No landing page — the app IS the landing page)
2. SIGN UP     Contextual gate: "Want to apply? Create an account" / "Want to message? Sign up"
       ↓       (Motivated signup > curious signup)
3. ONBOARD     Quick profile: name, role, location, one portfolio piece
       ↓       (5 fields, not 50)
4. ENGAGE      Home feed shows relevant content + nearby opportunities
       ↓       (Immediate value, not empty state)
5. ACT         Apply to opportunity / List a service / Post content / Follow someone
       ↓       (One meaningful action in the first session)
6. RETURN      Notification: "Someone viewed your profile" / "New opportunity near you"
       ↓       (Pull them back with real signals)
7. TRANSACT    Service booked → project tracked → payment made → review left
       ↓       (The full loop that justifies Mavyn's existence)
8. GROW        Portfolio grows, reputation builds, clients return
               (Network effects compound)
```

### Where Users Currently Get Confused

**Problem 1: Too many entry points, no clear hierarchy**

The sidebar has 16 navigation items organized into three groups (base, earn, connect). For a new user, this is overwhelming. The distinction between "earn" and "connect" is meaningful to the product team but not obvious to a user who just signed up.

**Recommendation**: The primary navigation should be 5 items maximum: Home, Discover, Messages, Activity, Profile. Everything else is reachable from within those surfaces.

**Problem 2: Social and commerce are blended without clear context**

The home feed shows posts (social), opportunities (commerce), and potentially services (commerce) in the same stream. A user looking for work and a user looking for inspiration have different needs but see the same interface.

**Recommendation**: The feed tabs already partially solve this (For You, Following, Opportunities, Trending). This is actually well-designed — the tabs let users self-select their context.

**Problem 3: The product assumes users are already creators**

Services, Works, Shop, Bookings, Clients — these are all "provider-side" features. But many users will arrive as *consumers* (looking to hire, buy, attend). The product doesn't clearly distinguish these two modes.

**Recommendation**: During onboarding, ask one question: "Are you here to offer your skills, find talent, or both?" Then customize the default view.

**Problem 4: Profile completion is too ambitious**

The Edit Profile page has 6 sections (Profile, Professional, Work, Verification, Links, Privacy) with dozens of fields. Most users will fill in 3-4 fields and leave.

**Recommendation**: Show a "5-minute profile" first (name, role, location, bio, one photo). Everything else is optional enhancement that can be prompted later.

**Problem 5: Campus features create a parallel product**

Your Campus has its own communities, services, opportunities, organizations, events, and market — essentially a second Mavyn inside Mavyn. This is ambitious but doubles the product surface.

**Recommendation**: Campus should be a *filter* on the existing product, not a separate product. "Show me opportunities near my school" is more powerful than a parallel campus job board.

---

## 4. Product-Market-Fit Strategy

### The PMF Signal

Product-market fit for Mavyn is NOT "lots of signups." It's:

> **Creators who list a service or apply to an opportunity in their first week, AND return within 7 days.**

This is the "aha moment" — the point where a user experiences Mavyn's core value (being discovered or finding work) and comes back for more.

### Metric Hierarchy

#### Tier 1: North Star Metric
**Weekly Active Transactions** — the number of service bookings, opportunity applications, or project starts per week. This is the single number that tells you if Mavyn is providing real value.

#### Tier 2: Activation Metrics (do new users experience value?)

| Metric | Target | Why It Matters |
|--------|--------|---------------|
| Signup → Profile completion (5+ fields) | >60% | Users who complete profiles get discovered |
| Profile completion → First action (apply/list/post) | >40% | The platform only works if people participate |
| First action → Return within 7 days | >30% | Retention proves the action was valuable |

#### Tier 3: Engagement Metrics (are existing users getting value?)

| Metric | Target | Why It Matters |
|--------|--------|---------------|
| Weekly active users / Monthly active users | >50% | Habitual usage, not drive-by visits |
| Messages sent per active user per week | >2 | Communication = transactions in progress |
| Opportunity applications per active opportunity | >5 | Signal that opportunities are real and worth applying to |
| Service inquiries per listed service per month | >3 | Signal that services are visible and worth listing |

#### Tier 4: Revenue Metrics (is the business viable?)

| Metric | Target | Why It Matters |
|--------|--------|---------------|
| Paid conversion rate (free → Pro/College) | >5% | Proves the free tier is valuable enough to pay for more |
| Transaction volume (monthly) | Growing 20%+ MoM | The marketplace is the revenue engine |
| Platform fee revenue per active user | >$2/month | Proves the fee model works at scale |

#### Tier 5: Health Metrics (is the platform healthy?)

| Metric | Target | Why It Matters |
|--------|--------|---------------|
| 30-day retention | >25% | Users find ongoing value |
| 90-day retention | >15% | Platform effects compound |
| Report rate | <1% | Trust and safety are working |
| Dispute rate | <5% of transactions | Marketplace quality is high |

### What to Measure First

Before launch, instrument these 5 things:
1. **Signup completion** — did they finish creating an account?
2. **Profile completion** — did they fill in enough to be discoverable?
3. **First meaningful action** — apply, list, post, or message
4. **7-day return** — did they come back?
5. **Transaction initiated** — did money or work change hands?

Everything else can wait.

---

## 5. Product-Market-Fit Survey

### Design Principles

The Sean Ellis PMF survey ("How would you feel if you could no longer use X?") is the gold standard, but it only works when users have *actually used* the product. For Mavyn, the survey should:

1. **Only trigger after the user has taken a meaningful action** (applied to an opportunity, listed a service, completed a booking, sent 5+ messages)
2. **Be brief** — 4 questions maximum
3. **Be honest** — no leading questions, no "rate us 5 stars"
4. **Be actionable** — every answer should inform a product decision

### Survey Implementation

**Trigger conditions** (any one):
- User has been active for 14+ days AND completed at least one transaction-type action
- User has listed a service that received an inquiry
- User has applied to an opportunity
- User has completed a booking or project

**Frequency**: Once per user, ever. If they dismiss it, don't ask again for 90 days.

### Survey Questions

**Q1: How would you feel if you could no longer use Mavyn?**
- Very disappointed
- Somewhat disappointed
- Not disappointed
- I no longer use Mavyn

> *The "very disappointed" percentage is the PMF number. Below 40% = not yet. Above 40% = you have something.*

**Q2: What is the main benefit you get from Mavyn?**
- Finding paid work / opportunities
- Getting discovered by clients
- Managing my client relationships
- Showcasing my portfolio
- Connecting with other creatives
- Selling my work / products
- Finding and attending events
- Other (free text)

> *This tells you which feature is the "must-have." Double down on it.*

**Q3: What would you improve about Mavyn?**
- Free text, 500 character limit

> *This is the most valuable question. Real users telling you what's broken.*

**Q4: Who do you think would benefit most from Mavyn?**
- Free text, 200 character limit

> *This tells you who your real target market is — in the users' own words.*

### Optional Follow-up (shown only to "Very disappointed" users)

**Q5: What would you use instead if Mavyn didn't exist?**
- Free text

> *This tells you your real competitors — not who you think they are.*

### What to Do With the Results

| "Very disappointed" % | Action |
|----------------------|--------|
| < 20% | Fundamental product problem. Talk to users. Rethink the core value proposition. |
| 20–40% | Close but not there yet. Focus on the #1 benefit users mention. Cut everything else. |
| 40–60% | Product-market fit achieved for a segment. Double down on that segment. |
| > 60% | Strong PMF. Focus on growth and retention. |

---

## 6. Business Model

### Current Revenue Design

Mavyn already has a well-thought-out revenue model with three subscription tiers and transaction fees:

| Plan | Price | Purpose |
|------|-------|---------|
| **Free** | $0 | Core experience — posting, applying, messaging, earning |
| **College+** | $4.99/mo | Student tools, verified badge, campus features |
| **Pro** | $12.99/mo | Advanced profile, analytics, studio customization |
| **Alumni Pro** | $7.99/mo | Loyalty rate for College+ graduates |
| **Business** | $29/mo | Higher limits, team management, recruiting tools |
| **Platform fee** | 5% | On every transaction (services, bookings, shop) |
| **Promoted listings** | $3.99–$9.99 | Boost services, profiles, opportunities |

### What Works About This Model

1. **Earning is never paywalled** — the free tier lets you make money. This is critical. Nobody will pay to use a platform they haven't made money on yet.
2. **The 5% platform fee is reasonable** — lower than Fiverr (20%) and Upwork (10–20%). Competitive advantage.
3. **College → Pro pipeline** — students join cheap, graduate into full Pro. Natural lifecycle monetization.
4. **Business accounts are separate** — businesses pay for scale (more hires, more team members), not basic access.

### What to Be Careful About

**Risk 1: Promoted listings before traffic**

Boost and Featured products only work if there's enough traffic for the promotion to matter. Selling visibility on an empty platform is selling nothing. **Wait until DAU > 1,000 before launching promoted listings.**

**Risk 2: Platform fees before trust**

Charging 5% on every transaction is fair — but only if users trust the platform enough to transact through it. Early on, consider waiving fees for the first N transactions to build habit and trust. **First 5 transactions fee-free.**

**Risk 3: Too many plans too early**

Five plan tiers (Free, College, Pro, Alumni, Business) is complex for a product with no users. **Launch with two: Free and Pro.** Add College and Business when those segments prove they exist.

### Recommended Revenue Sequence

```
NOW:  Free tier only (prove the product)
      ↓
NEXT: Pro subscription ($12.99/mo) — advanced analytics, profile customization
      ↓
NEXT: 5% platform fee on transactions (after trust is established)
      ↓
LATER: College+ ($4.99/mo) — when campus segment proves demand
      ↓
LATER: Business ($29/mo) — when businesses start hiring at scale
      ↓
LATER: Promoted listings — when traffic justifies the product
      ↓
DON'T: Shop transaction fees (physical goods is a different business)
```

### Revenue Models That Would Damage UX

- **Pay to message** — kills the connective tissue of the platform
- **Pay to apply** — creates a barrier to the core marketplace loop
- **Pay to be discovered** — makes the free tier feel like a ghost town
- **Pay to see who viewed your profile** — LinkedIn's most hated feature
- **Ads in the feed** — incompatible with a professional/creative platform

---

## 7. Financial Tracking Dashboard (Future)

### Structure for Real Numbers

The following is a framework for tracking Mavyn's financial health. No invented numbers — just the structure to plug real data into.

#### Revenue Metrics

| Metric | Source | Frequency |
|--------|--------|-----------|
| Monthly Recurring Revenue (MRR) | Stripe subscriptions | Monthly |
| Transaction fee revenue | Stripe Connect | Monthly |
| Promoted listing revenue | Internal | Monthly |
| Total revenue | Sum of above | Monthly |
| Revenue per active user | Total revenue / MAU | Monthly |
| Average transaction value | Sum of transactions / count | Monthly |
| Gross Merchandise Value (GMV) | Total transaction volume | Monthly |

#### Cost Metrics

| Metric | Source | Frequency |
|--------|--------|-----------|
| Infrastructure (hosting, CDN, DB) | Provider billing | Monthly |
| Video/media storage | S3/R2 billing | Monthly |
| Payment processing fees | Stripe | Monthly |
| SMS/OTP costs | Twilio billing | Monthly |
| Email delivery | Provider billing | Monthly |
| Customer support | Time × rate | Monthly |
| Total operating costs | Sum of above | Monthly |

#### Growth Metrics

| Metric | Source | Frequency |
|--------|--------|-----------|
| Monthly Active Users (MAU) | Analytics | Monthly |
| Daily Active Users (DAU) | Analytics | Daily |
| New signups | Auth system | Daily |
| Signup → activation rate | Analytics | Weekly |
| 7-day retention | Analytics | Weekly |
| 30-day retention | Analytics | Monthly |
| Customer Acquisition Cost (CAC) | Marketing spend / new active users | Monthly |
| Lifetime Value (LTV) | ARPU × avg. retention months | Quarterly |

#### Break-Even Analysis

```
Break-even point = Total monthly costs / Revenue per active user

Example structure (fill with real numbers):
  Monthly costs:          $___,___
  Revenue per active user: $__.___
  Break-even MAU:         ___,___
  Current MAU:            ___,___
  Months to break-even:   ___ (at current growth rate)
```

#### Unit Economics

```
Per-transaction economics:
  Average transaction:      $__.___
  Platform fee (5%):        $__.___
  Payment processing (2.9%): $__.___
  Net revenue per txn:      $__.___
  
Per-subscriber economics:
  Average subscription:     $__.___ /mo
  Payment processing:       $__.___ /mo
  Net revenue per sub:      $__.___ /mo
  Avg. subscriber lifetime: ___ months
  LTV per subscriber:       $__.___
```

### When to Build This Dashboard

**Not now.** This dashboard is meaningless without real users and real transactions. Build it when:
- You have >100 active users
- You have >10 transactions per month
- You're charging real money

Until then, track the 5 activation metrics from Section 4 in a simple spreadsheet.

---

## 8. Where Mavyn Is Overbuilt

### The Hard Truth

Mavyn has built approximately 10 products' worth of features before having a single real user. This is the most common failure mode for ambitious platforms: building everything for everyone, launching to indifference because no single feature is deep enough to create a compelling reason to switch from existing tools.

### Specific Overbuilding Concerns

#### 1. Live/Replays/Highlights — DON'T BUILD YET

**What user problem does this solve?** Real-time content creation and replay.  
**Why does Mavyn need this?** It doesn't — not yet. Instagram Live, TikTok Live, and YouTube Live already exist with massive audiences.  
**Does it strengthen the core experience?** No — it's a massive infrastructure investment (streaming servers, CDN, storage) for a feature that's table stakes on social platforms.  
**Can we measure whether it helps?** Not without a large existing user base.

**Recommendation**: Remove from the product entirely until Mavyn has >10,000 active users and users are explicitly asking for it.

#### 2. Shop (Physical Products) — DEFER

**What user problem does this solve?** Selling physical goods.  
**Why does Mavyn need this?** It doesn't — this is Etsy/Shopify territory.  
**Does it strengthen the core experience?** No — it adds an entirely separate marketplace with shipping, returns, inventory, and buyer protection for physical goods.  
**Can we measure whether it helps?** Not without users.

**Recommendation**: Keep the Shop page as a placeholder but don't invest in it. Focus the marketplace on services and digital work first.

#### 3. Campus as a Parallel Product — SIMPLIFY

**What user problem does this solve?** Students want campus-specific discovery.  
**Why does Mavyn need this?** Campus is a *filter*, not a product.  
**Does it strengthen the core experience?** The idea is strong, but building a full parallel campus experience (campus communities, campus services, campus opportunities, campus market, campus events, campus organizations) doubles the product surface.  
**Can we measure whether it helps?** Yes — but only if students actually use it.

**Recommendation**: Campus should be a filter on the existing product. "Show me opportunities at my school" is a filter, not a separate page with its own navigation.

#### 4. Works Licensing — DEFER

**What user problem does this solve?** Creators want to license their work with legal protection.  
**Why does Mavyn need this?** It's a genuine need, but licensing is a legal/financial product that requires real legal infrastructure.  
**Does it strengthen the core experience?** The portfolio/showcase part does; the licensing/contract part is a separate product.  
**Can we measure whether it helps?** Not without users who have valuable work to license.

**Recommendation**: Keep portfolio showcase. Defer licensing contracts until the marketplace proves itself.

#### 5. Clients CRM — DEFER

**What user problem does this solve?** Creators want to manage their client relationships.  
**Why does Mavyn need this?** It's a nice-to-have for power users, not a reason to join.  
**Does it strengthen the core experience?** Marginally — it's a retention feature, not an acquisition feature.  
**Can we measure whether it helps?** Only after users have clients to manage.

**Recommendation**: The data exists (who booked you, how many times). A simple "repeat clients" list on the profile is enough for now. Full CRM can come later.

#### 6. Communities — CAUTION

**What user problem does this solve?** Creatives want to connect with like-minded people.  
**Why does Mavyn need this?** Community is a retention driver, but communities are extremely hard to seed. An empty community is worse than no community.  
**Does it strengthen the core experience?** Only if communities are active.  
**Can we measure whether it helps?** Yes — active members per community.

**Recommendation**: Keep communities but don't promote them until you have >5 communities with >50 active members each. Empty communities damage trust.

### The Overbuilding Pattern

Every overbuilt feature follows the same pattern:
1. The feature is *logically* part of the ecosystem
2. It's well-designed and well-implemented
3. But it solves a problem that only exists at scale
4. Building it before scale means maintaining complexity for zero users

**The fix**: Ship the smallest version of Mavyn that delivers the core loop (discover → connect → hire → deliver → get paid) and add features only when users explicitly ask for them.

---

## 9. Prioritized Roadmap

### NOW — Focus on the Core Loop (Weeks 1–8)

These are the things that must work flawlessly before anything else matters.

1. **Simplify navigation to 5 primary items**: Home, Discover, Messages, Activity, Profile. Everything else is accessible within those surfaces.

2. **Streamline onboarding**: 5-field profile (name, role, location, bio, photo). Everything else is optional. Get users to their first meaningful action in under 3 minutes.

3. **Make the home feed immediately useful**: Pre-populate with real content. No empty states. A new user should see 10+ relevant items in their first 30 seconds.

4. **Ensure the service → booking → payment loop works end-to-end**: This is the core value proposition. A client should be able to discover a service, hire the provider, track the project, and pay — all within Mavyn.

5. **Ensure the opportunity → apply → select → project loop works end-to-end**: The other half of the marketplace. A creator should be able to find work, apply, get selected, and complete the project.

6. **Instrument the 5 activation metrics**: You can't improve what you can't measure. Before inviting real users, make sure you know exactly how many sign up, complete profiles, take first actions, return, and transact.

7. **Launch the PMF survey**: Trigger it after users complete their first meaningful action. Start collecting data immediately.

**Why these first**: Without a working core loop, nothing else matters. Users will not return to a platform where the fundamental value proposition (finding work or finding talent) is broken or empty.

### NEXT — Polish and Retention (Weeks 8–16)

Once the core loop works and you have >100 active users:

8. **Add basic analytics for creators**: Profile views, service inquiries, opportunity applications. Creators need to see that their presence is working.

9. **Improve the notification system**: Smart notifications that pull users back — "3 new opportunities match your skills," "Someone viewed your service," "Your application was viewed."

10. **Add Pro subscription**: Advanced analytics, profile customization (Profile Studio), and verified badge. This is the first revenue stream.

11. **Build the Works/portfolio showcase**: Let creators display their best work with streaming previews. This is the "proof" that makes the rest of the platform credible.

12. **Polish events**: Keep it simple — create, discover, RSVP. Events are a natural engagement driver for creatives.

13. **Add the platform fee**: Start charging 5% on transactions. Waive the first 5 transactions per user to build habit.

**Why these next**: Retention features. Once users are in the core loop, you need to give them reasons to stay and come back.

### LATER — Scale and Depth (Months 4–12)

Only after you have >1,000 active users and proven PMF:

14. **College+ plan**: Campus verification, student pricing, campus-filtered discovery. Only if students are already using the free tier organically.

15. **Business accounts**: Hiring dashboard, team management, talent saves. Only if businesses are already hiring through the platform.

16. **Promoted listings**: Boost services, featured profiles, promoted opportunities. Only if there's enough traffic for promotion to matter.

17. **Works licensing**: Legal contracts for creative work. Only if creators have valuable work that clients want to license.

18. **Clients CRM**: Relationship management for repeat clients. Only if creators have enough clients to need a CRM.

19. **Communities (scaled)**: Only if 5+ communities have 50+ active members organically.

**Why these later**: Each of these is a real product that deserves real investment — but only after the core product proves it has users who want them.

### DON'T BUILD YET — Ideas That Need Justification

These features exist in the codebase or have been discussed but should not receive investment until specific conditions are met:

20. **Live/Replays/Highlights**: Requires massive infrastructure for a feature that's table stakes elsewhere. Build only if >20% of users explicitly request it in the PMF survey.

21. **Shop (physical products)**: An entirely different business (shipping, returns, inventory). Build only if >30% of users are already selling physical goods through workarounds.

22. **Campus Market**: A niche within a niche. Build only if campus users are >25% of MAU.

23. **Nearby Now (location-based social)**: Cool but not core. Build only if location-based discovery drives >20% of transactions.

24. **Preferred Clients / Early Access**: Power-user feature. Build only if >10% of creators have 5+ repeat clients.

25. **Resolution Center (full)**: The framework is good but the full dispute/evidence/refund flow requires real transaction volume to justify the engineering investment.

**Why not yet**: Each of these features sounds valuable in isolation, but building them all means building none of them well. The product that tries to do everything does nothing well enough to be someone's daily habit.

---

## Summary: The One Thing

If Mavyn does one thing well, it should be this:

> **A creative professional can be discovered, hired, and paid on Mavyn — without needing any other platform.**

Everything else is in service of that loop. Every feature should be evaluated against one question: **Does this help a creative get hired or help a client find the right creative?**

If yes → build it, polish it, make it excellent.  
If no → defer it until the core loop is proven.

Mavyn has the architecture, the design quality, and the technical foundation to be an exceptional product. The challenge is not building more — it's having the discipline to build less, better, and prove that the core loop works before expanding.

The platform that wins is not the one with the most features. It's the one where a photographer in Baltimore can find a client, deliver great work, get paid, and come back to do it again next week. That's the product. Everything else is decoration.
