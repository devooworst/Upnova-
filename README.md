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

- Background `#0A0A0F`, cards `#111111`, zinc borders. One UI family: **Plus Jakarta Sans**
  (weight/size/tracking carry all hierarchy — every page title is `text-2xl` bold tight).
  **JetBrains Mono** is the data voice: distances, budgets, receipt lines, overlines.
  **Syne** appears exactly once, as the UpNova wordmark.
- Accent colors have **jobs**, so the eye learns the language:
  - **lime** = money & opportunity (budgets, Apply, Hire, Open to Work, revenue)
  - **violet** = people & community (follow, join, messages, online, likes)
  - **amber** = events & energy (tickets, deadlines, trending, ratings)
  - **white/neutral** = navigation, active states, verified trust marks, locality
- Card **shapes** carry the category too — no two categories share the same DNA:
  - **money** = receipt/ticket: sharp corners, lime top rule, mono figures, dashed
    perforation with punched edges, a "posted in range" receipt total in the sidebar
  - **people** = round (`rounded-3xl`), avatar-forward, soft
  - **events** = ticket with a real date block (month/day tile), dashed stub divider,
    "admit one" stub detail
- Locality is spatial, not decorative: one radius selector (5 mi / 25 mi / City +) in
  the masthead is the single home for radius; the feed is grouped into distance rings
  ("Within 5 mi", "5–25 mi", "Beyond — collapsed") and every card carries a mono
  distance chip. No fake radar graphics — the distance-sorted list *is* the data viz.
  The story-circle row is replaced by a rectangular "Live near you" activity strip
  whose tiles take the shape of their category.

## Run it

```bash
npm install
npm run dev    # http://localhost:3000
```

## Data & the road ahead

All content lives in `lib/data.ts` as typed mock data that mirrors the future database model
(`User`, `Service`, `Post`, `Opportunity`, `Application`, `Community`, `Event`, `Message`,
`Payment`, `Review`, `Location/Reach`). Swapping the mock layer for Supabase is the next step:
the components already consume the exact shapes the business needs.

The money flow this UI already describes: view service → contact creator → discuss → agree price →
payment processed → creator delivers → client approves → creator gets paid → both review → reputation grows.

> **Design rule:** do not redesign UpNova into a generic social-media website. Preserve the dark
> black/lime identity and these components; improve quality, spacing, responsiveness, hierarchy,
> and functionality while staying centered on local creator discovery, paid opportunities,
> services, communities, and events. Every feature must help somebody discover something,
> offer something, connect with somebody, participate in something, or make money.
