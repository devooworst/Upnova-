"use client";

/* ------------------------------------------------------------------ */
/*  DiscoverGrid — the MOBILE/TABLET Discover surface.                 */
/*                                                                     */
/*  Discover is for BROWSING, not consuming: a dense two-column grid   */
/*  (3 on big phones, 4 on tablets) of small, mixed, type-badged cards */
/*  — several items visible in the first viewport, tap → detail view.  */
/*  For You stays the immersive one-post-at-a-time feed; this surface  */
/*  deliberately looks and behaves nothing like it.                    */
/*                                                                     */
/*  Everything here is REAL data from the existing APIs (services,     */
/*  opportunities, shop, works, events, feed authors/photos, search).  */
/*  Type badges reuse the established category color system — color    */
/*  never stands alone, every badge carries its text label.            */
/*                                                                     */
/*  Performance: constant 4:3 thumbnail boxes (zero layout shift),     */
/*  native lazy-loading, one fetch round per surface.                  */
/* ------------------------------------------------------------------ */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, Briefcase, ShoppingBag, Wrench, CalendarDays, Music2, Users, ImageIcon } from "lucide-react";
import { CATEGORY_META, type ContentCategory } from "@/lib/categories";
import Avatar from "@/components/Avatar";

/* one uniform card model for every content type */
interface Card {
  key: string;
  type: "people" | "services" | "opportunities" | "shop" | "events" | "works" | "posts" | "communities";
  href: string;
  title: string;
  meta: string;
  image?: string | null;
  avatar?: string | null; // people cards
}

const CHIPS = [
  ["all", "All"],
  ["people", "People"],
  ["services", "Services"],
  ["opportunities", "Opportunities"],
  ["shop", "Shop"],
  ["events", "Events"],
  ["works", "Works"],
  ["posts", "Posts"],
] as const;
type Chip = (typeof CHIPS)[number][0];

/* badge styling: marketplace types come straight from the category
   system; events keep Mavyn's amber-events law, people the violet-people
   law — always with a text label, never color alone */
const BADGE: Record<Card["type"], { label: string; cls: string }> = {
  services: { label: "Service", cls: CATEGORY_META.service.chip },
  opportunities: { label: "Opportunity", cls: CATEGORY_META.opportunity.chip },
  shop: { label: "Shop", cls: CATEGORY_META.shop.chip },
  works: { label: "Work", cls: CATEGORY_META.work.chip },
  events: { label: "Event", cls: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  people: { label: "Creator", cls: "border-violet-400/40 bg-violet-400/10 text-violet-300" },
  posts: { label: "Post", cls: "border-zinc-500/40 bg-zinc-500/10 text-zinc-400" },
  communities: { label: "Community", cls: "border-violet-400/40 bg-violet-400/10 text-violet-300" },
};

const PLACEHOLDER_ICON: Record<Card["type"], typeof Briefcase> = {
  services: Wrench,
  opportunities: Briefcase,
  shop: ShoppingBag,
  works: Music2,
  events: CalendarDays,
  people: Users,
  posts: ImageIcon,
  communities: Users,
};

const money = (n: number | null | undefined) => (n == null ? null : `$${n}`);

function interleave(groups: Card[][]): Card[] {
  const out: Card[] = [];
  const idx = groups.map(() => 0);
  let moved = true;
  while (moved && out.length < 60) {
    moved = false;
    for (let g = 0; g < groups.length; g++) {
      const i = idx[g];
      if (i < groups[g].length) {
        out.push(groups[g][i]);
        idx[g] = i + 1;
        moved = true;
      }
    }
  }
  return out;
}

export default function DiscoverGrid({ initialChip = "all" }: { initialChip?: Chip }) {
  const [chip, setChip] = useState<Chip>(initialChip);
  const [q, setQ] = useState("");
  const [browse, setBrowse] = useState<Card[] | null>(null); // no-query catalog
  const [results, setResults] = useState<Card[] | null>(null); // search results
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------- browse catalog: one parallel round of the real APIs ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const [svc, opp, prod, wrk, evt, feed] = await Promise.all([
        fetch("/api/services").then((r) => r.json()).catch(() => ({})),
        fetch("/api/opportunities").then((r) => r.json()).catch(() => ({})),
        fetch("/api/products").then((r) => r.json()).catch(() => ({})),
        fetch("/api/works").then((r) => r.json()).catch(() => ({})),
        fetch("/api/events").then((r) => r.json()).catch(() => ({})),
        fetch("/api/feed?scope=global").then((r) => r.json()).catch(() => ({})),
      ]);
      if (!alive) return;
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const services: Card[] = (svc.services ?? []).map((s: any) => ({
        key: `s${s.id}`, type: "services", href: `/services/${s.id}`, title: s.title,
        meta: [money(s.price) && `From ${money(s.price)}`, s.owner?.displayName].filter(Boolean).join(" · "),
        image: s.media?.[0] ?? null,
      }));
      const opps: Card[] = (opp.opportunities ?? []).map((o: any) => ({
        key: `o${o.id}`, type: "opportunities", href: `/opportunities/${o.id}`, title: o.title,
        meta: [money(o.budget), o.poster?.displayName].filter(Boolean).join(" · "),
      }));
      const products: Card[] = (prod.products ?? []).map((p: any) => ({
        key: `p${p.id}`, type: "shop", href: `/shop/${p.id}`, title: p.title,
        meta: [money(p.price), p.seller?.displayName].filter(Boolean).join(" · "),
        image: p.media?.[0] ?? null,
      }));
      const works: Card[] = (wrk.works ?? []).map((w: any) => ({
        key: `w${w.id}`, type: "works", href: `/works/${w.id}`, title: w.title,
        meta: [w.kind, w.creator?.displayName].filter(Boolean).join(" · "),
        image: w.coverUrl ?? null,
      }));
      const events: Card[] = (evt.events ?? []).map((e: any) => ({
        key: `e${e.id}`, type: "events", href: `/events/${e.slug ?? e.id}`, title: e.title,
        meta: [e.startsAt && new Date(e.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }), e.city].filter(Boolean).join(" · "),
        image: e.imageUrl ?? null,
      }));
      const items: any[] = feed.items ?? [];
      const seen = new Set<string>();
      const people: Card[] = [];
      for (const p of items) {
        const a = p.author;
        if (!a?.handle || seen.has(a.handle)) continue;
        seen.add(a.handle);
        people.push({ key: `u${a.handle}`, type: "people", href: `/creator/${a.handle}`, title: a.displayName, meta: a.roleLine || `@${a.handle}`, avatar: a.avatarUrl });
      }
      const posts: Card[] = items
        .filter((p: any) => p.imageUrl)
        .map((p: any) => ({ key: `f${p.id}`, type: "posts", href: `/posts/${p.id}`, title: (p.body || "").split("\n")[0] || "Post", meta: p.author?.displayName ?? "", image: p.imageUrl }));
      setBrowse(interleave([posts, services, opps, people, products, events, works]));
      /* eslint-enable @typescript-eslint/no-explicit-any */
    })();
    return () => { alive = false; };
  }, []);

  /* ---------- search: same compact grid, never a feed ---------- */
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const query = q.trim();
    if (!query) { setResults(null); setSearching(false); return; }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const d = await fetch(`/api/search?q=${encodeURIComponent(query)}`).then((r) => r.json());
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const cards: Card[] = [
          ...(d.people ?? []).map((u: any) => ({ key: `u${u.id}`, type: "people" as const, href: `/creator/${u.handle}`, title: u.displayName, meta: u.roleLine || `@${u.handle}`, avatar: u.avatarUrl })),
          ...(d.services ?? []).map((s: any) => ({ key: `s${s.id}`, type: "services" as const, href: `/services/${s.id}`, title: s.title, meta: [money(s.price) && `From ${money(s.price)}`, s.owner].filter(Boolean).join(" · ") })),
          ...(d.opportunities ?? []).map((o: any) => ({ key: `o${o.id}`, type: "opportunities" as const, href: `/opportunities/${o.id}`, title: o.title, meta: money(o.budget) ?? "" })),
          ...(d.communities ?? []).map((c: any) => ({ key: `c${c.id}`, type: "communities" as const, href: `/communities/${c.slug}`, title: c.name, meta: c.description ?? "" })),
          ...(d.posts ?? []).map((p: any) => ({ key: `f${p.id}`, type: "posts" as const, href: `/posts/${p.id}`, title: p.body, meta: p.author ?? "" })),
        ];
        /* eslint-enable @typescript-eslint/no-explicit-any */
        setResults(cards);
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [q]);

  const source = results ?? browse;
  const visible = useMemo(
    () => (source ?? []).filter((c) => chip === "all" || c.type === chip),
    [source, chip]
  );

  return (
    <div className="space-y-3" data-guide="discover-grid">
      {/* search — a first-class part of Discover */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people, services, work, events…"
          aria-label="Search Mavyn"
          data-guide="discover-search"
          className="w-full rounded-2xl border border-line bg-card py-3 pl-11 pr-4 text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/15"
        />
      </div>

      {/* type chips — one horizontal rail, no vertical real estate */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5" data-guide="discover-chips">
        {CHIPS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setChip(id)}
            className={`h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition ${
              chip === id ? "border-zinc-300 bg-zinc-100 text-zinc-900" : "border-line text-zinc-400 hover:border-zinc-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* the grid: 2 cols on phones → 3 on big phones → 4 on tablets */}
      {source === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">
          {searching ? "Searching…" : results ? "Nothing matched — try another word or category." : "Nothing here yet."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visible.map((c) => {
            const Icon = PLACEHOLDER_ICON[c.type];
            const badge = BADGE[c.type];
            return (
              <Link
                key={c.key}
                href={c.href}
                className="group overflow-hidden rounded-xl border border-line bg-card transition active:scale-[0.98]"
              >
                {/* constant-aspect visual — no layout jumping, lazy images */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-card-raised">
                  {c.type === "people" ? (
                    <span className="flex h-full w-full items-center justify-center">
                      <Avatar src={c.avatar} initials={c.title.charAt(0)} size="xl" />
                    </span>
                  ) : c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      <Icon className="h-7 w-7 text-zinc-700" />
                    </span>
                  )}
                  <span className={`absolute left-1.5 top-1.5 rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] backdrop-blur-sm ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-zinc-100">{c.title}</p>
                  {c.meta && <p className="mt-0.5 truncate text-[11px] text-zinc-500">{c.meta}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
