"use client";

/* ------------------------------------------------------------------ */
/*  Global search — the navbar search that actually searches.          */
/*                                                                     */
/*  Types → debounced /api/search over the REAL account data: every    */
/*  registered user (handle + display name, exact + partial), plus     */
/*  opportunities, services, and communities. Enter always lands on    */
/*  /search?q=… — never a dead keypress on the Home feed. Nothing is   */
/*  hardcoded; new accounts are searchable the moment they exist.      */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, GraduationCap, Search, ShoppingBag, Users } from "lucide-react";
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
  posts: { id: string; body: string; author: string; authorHandle: string }[];
}

export default function GlobalSearch({ variant = "desktop" }: { variant?: "desktop" | "mobile" }) {
  // data-tour anchor added on the wrapper below (New Member Tour: "Search")
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const runSearch = useCallback((term: string) => {
    const mySeq = ++seq.current;
    if (!term.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(term.trim())}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (mySeq === seq.current && d.people) {
          setResults(d);
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const onChange = (v: string) => {
    setQ(v);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(v), 180);
  };

  // Enter → the full results page. Never a silent keypress.
  const submit = () => {
    if (!q.trim()) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  // click-away closes; ⌘K / Ctrl-K focuses (desktop)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && variant === "desktop") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [variant]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const hasAny =
    !!results &&
    (results.people.length > 0 || results.opportunities.length > 0 || results.services.length > 0 || results.communities.length > 0);

  return (
    <div ref={boxRef} data-tour={variant === "desktop" ? "search" : undefined} className={variant === "desktop" ? "relative mx-auto hidden w-full max-w-xl md:block" : "relative"}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => q.trim() && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Search people, opportunities, communities…"
        aria-label="Search Mavyn"
        className={
          variant === "desktop"
            ? "w-full rounded-full border border-line bg-card px-10 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/15"
            : "w-full rounded-full border border-line bg-card py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-lime-400/40"
        }
      />
      {variant === "desktop" && !q && (
        <kbd className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-card-raised px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 lg:block">
          ⌘K
        </kbd>
      )}

      {/* dropdown */}
      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full z-[80] mt-2 overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
          {loading && !results ? (
            <p className="px-4 py-3 text-xs text-zinc-500">Searching…</p>
          ) : results && (
            <div className="max-h-[70vh] overflow-y-auto py-1.5">
              {/* PEOPLE — real accounts, ranked exact-handle first */}
              <p className="flex items-center gap-1.5 px-4 pb-1 pt-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                <Users className="h-3 w-3" /> People
              </p>
              {results.people.length === 0 ? (
                <p className="px-4 pb-2 text-xs text-zinc-500">No people found for &ldquo;{results.q}&rdquo;</p>
              ) : (
                results.people.slice(0, 5).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => go(`/creator/${p.handle}`)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-card-raised"
                  >
                    <Avatar src={p.avatarUrl} initials={p.displayName.charAt(0)} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
                        <span className="truncate">{p.displayName}</span>
                        {p.business && (
                          <span className="inline-flex items-center gap-0.5 rounded-full border border-sky-400/40 bg-sky-400/10 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-sky-300">
                            <Building2 className="h-2.5 w-2.5" /> Business
                          </span>
                        )}
                        {p.campus && !p.business && (
                          <span className="inline-flex items-center gap-0.5 rounded-full border border-violet-400/40 bg-violet-400/10 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-violet-300">
                            <GraduationCap className="h-2.5 w-2.5" /> {p.campus}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        @{p.handle}
                        {p.roleLine ? ` · ${p.roleLine}` : ""}
                      </span>
                    </span>
                  </button>
                ))
              )}

              {/* compact cross-sections */}
              {results.opportunities.slice(0, 2).map((o) => (
                <button key={o.id} onClick={() => go(`/opportunities/${o.id}`)} className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-card-raised">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-lime-400/30 bg-lime-400/10"><Briefcase className="h-3.5 w-3.5 text-lime-300" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-zinc-100">{o.title}</span>
                    <span className="block truncate text-xs text-zinc-500">Opportunity · {o.location}{o.budget != null ? ` · $${o.budget}` : ""}</span>
                  </span>
                </button>
              ))}
              {results.services.slice(0, 2).map((s) => (
                <button key={s.id} onClick={() => go(`/services/${s.id}`)} className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-card-raised">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-400/30 bg-sky-400/10"><ShoppingBag className="h-3.5 w-3.5 text-sky-300" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-zinc-100">{s.title}</span>
                    <span className="block truncate text-xs text-zinc-500">Service · {s.owner} · from ${s.price}</span>
                  </span>
                </button>
              ))}
              {results.communities.slice(0, 2).map((c) => (
                <button key={c.id} onClick={() => go(`/communities/${c.slug || c.id}`)} className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-card-raised">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-400/30 bg-violet-400/10"><Users className="h-3.5 w-3.5 text-violet-300" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-zinc-100">{c.name}</span>
                    <span className="block truncate text-xs text-zinc-500">Community</span>
                  </span>
                </button>
              ))}

              <button onClick={submit} className="mt-1 flex w-full items-center gap-2 border-t border-line-soft px-4 py-2.5 text-left text-xs font-semibold text-lime-300 transition hover:bg-card-raised">
                <Search className="h-3.5 w-3.5" /> View all results for &ldquo;{q.trim()}&rdquo; →
              </button>
              {!hasAny && (
                <p className="px-4 pb-2 text-[11px] text-zinc-600">Nothing matched across opportunities, services, or communities either.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
