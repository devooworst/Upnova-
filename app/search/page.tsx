"use client";

/* ------------------------------------------------------------------ */
/*  /search?q=… — the full search results page. Pressing Enter in the  */
/*  navbar always lands here (never a silent keypress). Sections:      */
/*  People · Opportunities · Services · Communities · Posts — all      */
/*  from /api/search over the real records, with honest empty states.  */
/*  Clicking a person opens their actual public profile / My World.    */
/* ------------------------------------------------------------------ */

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  FileText,
  GraduationCap,
  Search,
  ShoppingBag,
  Users,
} from "lucide-react";
import Avatar from "@/components/Avatar";

interface Person {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  roleLine: string;
  verified: boolean;
  business: boolean;
  campus: string | null;
}
interface Results {
  q: string;
  people: Person[];
  opportunities: { id: string; title: string; type: string; location: string; budget: number | null }[];
  services: { id: string; title: string; price: number; category: string; owner: string }[];
  communities: { id: string; slug: string; name: string; description: string }[];
  posts: { id: string; body: string; author: string; authorHandle: string; at: string }[];
}

function SearchInner() {
  const params = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const [data, setData] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}&full=1`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.people && setData(d))
      .finally(() => setLoading(false));
  }, [q]);

  const total = data
    ? data.people.length + data.opportunities.length + data.services.length + data.communities.length + data.posts.length
    : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
          <Search className="h-3.5 w-3.5" /> Search
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">
          {q ? <>Results for &ldquo;{q}&rdquo;</> : "Search Mavyn"}
        </h1>
        {data && !loading && (
          <p className="mt-1 text-xs text-zinc-500">
            {total} result{total === 1 ? "" : "s"} across people, opportunities, services, communities, and posts.
          </p>
        )}
      </header>

      {!q ? (
        <div className="card p-8 text-center text-sm text-zinc-500">Type in the search bar above to find people, opportunities, services, and communities.</div>
      ) : loading && !data ? (
        <div className="card h-40 animate-pulse" />
      ) : data ? (
        <>
          {/* ---------------- PEOPLE ---------------- */}
          <section className="card overflow-hidden">
            <p className="flex items-center gap-2 border-b border-line-soft px-5 py-3 text-sm font-bold text-zinc-100">
              <Users className="h-4 w-4 text-violet-400" /> People
              <span className="ml-auto font-mono text-[10px] text-zinc-600">{data.people.length}</span>
            </p>
            {data.people.length === 0 ? (
              <p className="px-5 py-4 text-xs text-zinc-500">No people found for &ldquo;{q}&rdquo;.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {data.people.map((p) => (
                  <li key={p.id}>
                    <Link href={`/creator/${p.handle}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-card-raised">
                      <Avatar src={p.avatarUrl} initials={p.displayName.charAt(0)} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-zinc-100">
                          {p.displayName}
                          {p.verified && <CheckCircle2 className="h-3.5 w-3.5 text-lime-400" />}
                          {p.business && (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-sky-400/40 bg-sky-400/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-sky-300">
                              <Building2 className="h-2.5 w-2.5" /> Business
                            </span>
                          )}
                          {p.campus && !p.business && (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-violet-400/40 bg-violet-400/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-violet-300">
                              <GraduationCap className="h-2.5 w-2.5" /> {p.campus}
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
                          @{p.handle}
                          {p.roleLine ? ` · ${p.roleLine}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold text-lime-300">View profile →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---------------- OPPORTUNITIES ---------------- */}
          <section className="card overflow-hidden">
            <p className="flex items-center gap-2 border-b border-line-soft px-5 py-3 text-sm font-bold text-zinc-100">
              <Briefcase className="h-4 w-4 text-amber-400" /> Opportunities
              <span className="ml-auto font-mono text-[10px] text-zinc-600">{data.opportunities.length}</span>
            </p>
            {data.opportunities.length === 0 ? (
              <p className="px-5 py-4 text-xs text-zinc-500">No opportunities matched.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {data.opportunities.map((o) => (
                  <li key={o.id}>
                    <Link href={`/opportunities/${o.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-card-raised">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-zinc-100">{o.title}</span>
                        <span className="block text-xs text-zinc-500">
                          {o.type} · {o.location}
                          {o.budget != null ? ` · $${o.budget}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold text-amber-300">Open →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---------------- SERVICES ---------------- */}
          <section className="card overflow-hidden">
            <p className="flex items-center gap-2 border-b border-line-soft px-5 py-3 text-sm font-bold text-zinc-100">
              <ShoppingBag className="h-4 w-4 text-lime-400" /> Services
              <span className="ml-auto font-mono text-[10px] text-zinc-600">{data.services.length}</span>
            </p>
            {data.services.length === 0 ? (
              <p className="px-5 py-4 text-xs text-zinc-500">No services matched.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {data.services.map((s) => (
                  <li key={s.id}>
                    <Link href={`/services/${s.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-card-raised">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-zinc-100">{s.title}</span>
                        <span className="block text-xs text-zinc-500">{s.owner} · {s.category}</span>
                      </span>
                      <span className="shrink-0 font-mono text-xs font-bold tracking-[0.06em] text-lime-300">from ${s.price}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---------------- COMMUNITIES ---------------- */}
          <section className="card overflow-hidden">
            <p className="flex items-center gap-2 border-b border-line-soft px-5 py-3 text-sm font-bold text-zinc-100">
              <Users className="h-4 w-4 text-violet-400" /> Communities
              <span className="ml-auto font-mono text-[10px] text-zinc-600">{data.communities.length}</span>
            </p>
            {data.communities.length === 0 ? (
              <p className="px-5 py-4 text-xs text-zinc-500">No communities matched.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {data.communities.map((c) => (
                  <li key={c.id}>
                    <Link href={`/communities/${c.slug || c.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-card-raised">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-zinc-100">{c.name}</span>
                        <span className="block truncate text-xs text-zinc-500">{c.description}</span>
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold text-violet-300">Visit →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---------------- POSTS ---------------- */}
          <section className="card overflow-hidden">
            <p className="flex items-center gap-2 border-b border-line-soft px-5 py-3 text-sm font-bold text-zinc-100">
              <FileText className="h-4 w-4 text-zinc-400" /> Posts
              <span className="ml-auto font-mono text-[10px] text-zinc-600">{data.posts.length}</span>
            </p>
            {data.posts.length === 0 ? (
              <p className="px-5 py-4 text-xs text-zinc-500">No posts matched.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {data.posts.map((p) => (
                  <li key={p.id}>
                    <Link href={`/posts/${p.id}`} className="block px-5 py-3 transition hover:bg-card-raised">
                      <span className="block truncate text-sm text-zinc-200">&ldquo;{p.body}&rdquo;</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        {p.author} · @{p.authorHandle}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {total === 0 && (
            <div className="card p-8 text-center">
              <p className="text-sm font-semibold text-zinc-200">Nothing found for &ldquo;{q}&rdquo;</p>
              <p className="mt-1 text-xs text-zinc-500">Try a different spelling, a @handle, or browse Discover.</p>
              <Link href="/discover" className="btn-ghost mt-4 inline-flex px-4 py-1.5 text-xs">Open Discover</Link>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="card mx-auto h-64 max-w-3xl animate-pulse" />}>
      <SearchInner />
    </Suspense>
  );
}
