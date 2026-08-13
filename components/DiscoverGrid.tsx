"use client";

/* ------------------------------------------------------------------ */
/*  DiscoverGrid — the Discover surface (all widths).                  */
/*                                                                     */
/*  Discover has ONE job: search people and explore the Mavyn          */
/*  ecosystem. It is deliberately NOT category navigation — the        */
/*  sidebar already owns intentional trips to Opportunities /          */
/*  Services / Shop / Works / etc., so there is no permanent filter    */
/*  row here. Browsing is a compact, intentionally MIXED grid          */
/*  (person | work | service, post | opportunity | event…) where the   */
/*  colored type badge — color + text label, never color alone —       */
/*  tells you what each tile is, and tapping opens its detail page.    */
/*                                                                     */
/*  Search is the first-class citizen: results are relevance-ranked    */
/*  (people/profiles first — searching "Ava Chen" surfaces the         */
/*  person, then her works, posts, services…), and type filters        */
/*  appear ONLY inside an active search, to narrow results — they      */
/*  vanish the moment the query clears.                                */
/*                                                                     */
/*  Three distinct experiences by design:                              */
/*    For You  = immersive feed   ·   Discover = exploration grid      */
/*    Sidebar  = direct navigation                                     */
/*                                                                     */
/*  Everything here is REAL data from the existing APIs. Constant 4:3  */
/*  thumbnails (zero layout shift) + native lazy-loading.              */
/* ------------------------------------------------------------------ */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, Briefcase, ShoppingBag, Wrench, CalendarDays, Music2, Users, ImageIcon } from "lucide-react";
import { CATEGORY_META } from "@/lib/categories";
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

/* relevance for non-people results: exact title → title prefix →
   word prefix → title contains → meta contains */
function relevance(card: Card, nq: string): number {
  const t = card.title.toLowerCase();
  if (t === nq) return 0;
  if (t.startsWith(nq)) return 1;
  if (t.split(/\s+/).some((w) => w.startsWith(nq))) return 2;
  if (t.includes(nq)) return 3;
  return card.meta.toLowerCase().includes(nq) ? 4 : 5;
}

export default function DiscoverGrid() {
  const [q, setQ] = useState("");
  const [browse, setBrowse] = useState<Card[] | null>(null); // no-query catalog
  const [results, setResults] = useState<Card[] | null>(null); // search results
  const [searching, setSearching] = useState(false);
  const [resultType, setResultType] = useState<"all" | Card["type"]>("all"); // in-search narrowing only
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

  /* ---------- search: relevance-ranked, people first ---------- */
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const query = q.trim();
    setResultType("all"); // narrowing belongs to ONE search, never carries over
    if (!query) { setResults(null); setSearching(false); return; }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const d = await fetch(`/api/search?q=${encodeURIComponent(query)}`).then((r) => r.json());
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const people: Card[] = (d.people ?? []).map((u: any) => ({ key: `u${u.id}`, type: "people" as const, href: `/creator/${u.handle}`, title: u.displayName, meta: u.roleLine || `@${u.handle}`, avatar: u.avatarUrl }));
        const rest: Card[] = [
          ...(d.works ?? []).map((w: any) => ({ key: `w${w.id}`, type: "works" as const, href: `/works/${w.id}`, title: w.title, meta: [w.kind, w.creator].filter(Boolean).join(" · "), image: w.coverUrl ?? null })),
          ...(d.services ?? []).map((s: any) => ({ key: `s${s.id}`, type: "services" as const, href: `/services/${s.id}`, title: s.title, meta: [money(s.price) && `From ${money(s.price)}`, s.owner].filter(Boolean).join(" · ") })),
          ...(d.opportunities ?? []).map((o: any) => ({ key: `o${o.id}`, type: "opportunities" as const, href: `/opportunities/${o.id}`, title: o.title, meta: money(o.budget) ?? "" })),
          ...(d.products ?? []).map((p: any) => ({ key: `p${p.id}`, type: "shop" as const, href: `/shop/${p.id}`, title: p.title, meta: [money(p.price), p.seller].filter(Boolean).join(" · "), image: p.image ?? null })),
          ...(d.events ?? []).map((e: any) => ({ key: `e${e.id}`, type: "events" as const, href: `/events/${e.slug ?? e.id}`, title: e.title, meta: [e.startsAt && new Date(e.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }), e.city].filter(Boolean).join(" · "), image: e.imageUrl ?? null })),
          ...(d.communities ?? []).map((c: any) => ({ key: `c${c.id}`, type: "communities" as const, href: `/communities/${c.slug}`, title: c.name, meta: c.description ?? "" })),
          ...(d.posts ?? []).map((p: any) => ({ key: `f${p.id}`, type: "posts" as const, href: `/posts/${p.id}`, title: p.body, meta: p.author ?? "" })),
        ];
        /* eslint-enable @typescript-eslint/no-explicit-any */
        /* people lead (a name search should surface the person first),
           then everything else by how well the title matches */
        const nq = query.toLowerCase();
        rest.sort((a, b) => relevance(a, nq) - relevance(b, nq));
        setResults([...people, ...rest]);
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [q]);

  const inSearch = results !== null;
  const source = results ?? browse;

  /* type counts — used ONLY for the in-search narrowing pills */
  const typeCounts = useMemo(() => {
    const m = new Map<Card["type"], number>();
    for (const c of results ?? []) m.set(c.type, (m.get(c.type) ?? 0) + 1);
    return m;
  }, [results]);

  const visible = useMemo(
    () => (source ?? []).filter((c) => !inSearch || resultType === "all" || c.type === resultType),
    [source, inSearch, resultType]
  );

  return (
    <div className="space-y-3" data-guide="discover-grid">
      {/* search — the first-class citizen of Discover */}
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

      {/* narrowing pills — exist ONLY inside an active search with mixed
          results; browsing never shows category controls (the sidebar is
          the intentional way into Opportunities / Services / Shop / …) */}
      {inSearch && typeCounts.size > 1 && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5" data-guide="discover-result-filters">
          <button
            onClick={() => setResultType("all")}
            className={`h-8 shrink-0 rounded-full border px-3 text-[11px] font-semibold transition ${
              resultType === "all" ? "border-zinc-300 bg-zinc-100 text-zinc-900" : "border-line text-zinc-400 hover:border-zinc-600"
            }`}
          >
            All results · {results!.length}
          </button>
          {(Object.keys(BADGE) as Card["type"][])
            .filter((t) => typeCounts.has(t))
            .map((t) => (
              <button
                key={t}
                onClick={() => setResultType(resultType === t ? "all" : t)}
                className={`h-8 shrink-0 rounded-full border px-3 text-[11px] font-semibold transition ${
                  resultType === t ? "border-zinc-300 bg-zinc-100 text-zinc-900" : "border-line text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {BADGE[t].label} · {typeCounts.get(t)}
              </button>
            ))}
        </div>
      )}

      {/* the grid: 2 cols on phones → 3 → 4 → 5 on desktop */}
      {source === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5" aria-busy="true">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">
          {searching ? "Searching…" : inSearch ? "Nothing matched — try another word." : "Nothing here yet."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
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
