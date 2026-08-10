"use client";

/* ------------------------------------------------------------------ */
/*  Events — THE WIDER WORLD. Categories, search, time/price filters,  */
/*  and location-based discovery (distance computed server-side from   */
/*  profile coords — never exposed). Campus events do NOT appear here: */
/*  they live in Your Campus, which is its own environment.            */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Calendar, MapPin, Users, Bookmark, ArrowRight, Search, GraduationCap, Check, Plus } from "lucide-react";
import { useSession } from "@/lib/session";
import { promptJoin } from "@/components/GuestGate";
import { EVENT_CATEGORIES, EVENT_SCOPES, WHEN_FILTERS } from "@/lib/events";

interface EventItem {
  id: string;
  slug: string;
  isCampus?: boolean;
  campusName?: string | null;
  title: string;
  description: string;
  category: string;
  startsAt: string;
  timeLabel: string;
  location: string;
  city: string;
  price: number | null;
  capacity: number | null;
  attending: number;
  spotsLeft: number | null;
  imageUrl: string | null;
  kind: string;
  ageRule: string;
  host: string;
  saved: boolean;
  going: boolean;
  distanceMi: number | null;
}

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export default function EventsPage() {
  const { user } = useSession();
  const [items, setItems] = useState<EventItem[] | null>(null);
  const [scopeNote, setScopeNote] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [when, setWhen] = useState("all");
  const [price, setPrice] = useState("all");
  const [scope, setScope] = useState("all");

  const load = useCallback(async () => {
    const sp = new URLSearchParams({ q, category, when, price, scope });
    const res = await fetch(`/api/events?${sp}`, { cache: "no-store" });
    const d = await res.json();
    setItems(d.events ?? []);
    setScopeNote(d.scopeNote ?? null);
  }, [q, category, when, price, scope]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSave = async (e: EventItem) => {
    if (!user) return promptJoin("save", "/events");
    const res = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "event", targetId: e.id }),
    });
    if (res.ok) load();
  };

  const toggleGoing = async (e: EventItem) => {
    if (!user) return promptJoin("tickets", "/events");
    const res = await fetch(`/api/events/${e.id}`, { method: "POST" });
    if (res.ok) load();
    else {
      const j = await res.json().catch(() => ({}));
      if (j.error) alert(j.error);
    }
  };

  const pill = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.08em] transition ${
      active ? "bg-amber-400 font-bold text-zinc-950" : "border border-zinc-800 text-zinc-400 hover:border-amber-400/40"
    }`;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="px-1">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10">
            <Calendar className="h-5 w-5 text-amber-400" />
          </span>
          Events
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          What&apos;s happening around you — the wider world, with real hosts.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => (user ? (window.location.href = "/events/create") : promptJoin("create", "/events/create"))}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-amber-300"
          >
            <Plus className="h-4 w-4" /> Create Event
          </button>
          <Link
            href="/campus"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-400 transition hover:border-amber-400/40 hover:text-amber-300"
          >
            <GraduationCap className="h-3.5 w-3.5" /> Campus events live in Your Campus
          </Link>
        </div>
      </header>

      {/* ---------------- discovery filters ---------------- */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search events, venues, cities…"
            className="w-full rounded-full border border-zinc-800 bg-zinc-900/60 py-2 pl-9 pr-4 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-amber-400/40"
          />
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
          <button onClick={() => setCategory("")} className={pill(!category)}>ALL</button>
          {EVENT_CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(category === c ? "" : c)} className={pill(category === c)}>
              {c.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="shrink-0 font-mono text-[9px] tracking-[0.14em] text-zinc-600">WHERE</span>
          {EVENT_SCOPES.map((s) => (
            <button key={s.id} onClick={() => setScope(s.id)} className={pill(scope === s.id)}>
              {s.label.toUpperCase()}
            </button>
          ))}
          <span className="ml-2 shrink-0 font-mono text-[9px] tracking-[0.14em] text-zinc-600">WHEN</span>
          {WHEN_FILTERS.map((w) => (
            <button key={w.id} onClick={() => setWhen(w.id)} className={pill(when === w.id)}>
              {w.label.toUpperCase()}
            </button>
          ))}
          <span className="ml-2 shrink-0 font-mono text-[9px] tracking-[0.14em] text-zinc-600">PRICE</span>
          {["all", "free", "paid"].map((p) => (
            <button key={p} onClick={() => setPrice(p)} className={pill(price === p)}>
              {p.toUpperCase()}
            </button>
          ))}
        </div>
        {scopeNote && <p className="px-1 font-mono text-[10px] tracking-[0.08em] text-amber-300/80">{scopeNote}</p>}
      </div>

      {items === null ? (
        <div className="grid gap-4 md:grid-cols-2" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="card-event h-64 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-600">
          Nothing matches those filters — widen the search or check back soon.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((e) => {
            const d = new Date(e.startsAt);
            return (
              <article key={e.id} className="card-event group overflow-hidden">
                <Link href={`/events/${e.slug}`} className="relative block aspect-[16/9] overflow-hidden">
                  {e.imageUrl ? (
                    <Image
                      src={e.imageUrl}
                      alt={e.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 480px"
                      className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-card-raised">
                      <Calendar className="h-8 w-8 text-zinc-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
                  <span className="absolute left-3 top-3 flex flex-col items-center rounded-lg border border-amber-400/40 bg-ink/80 px-2.5 py-1.5 backdrop-blur">
                    <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-amber-400">
                      {MON[d.getMonth()]}
                    </span>
                    <span className="text-lg font-extrabold leading-tight text-zinc-50">{d.getDate()}</span>
                  </span>
                  <span className="absolute right-3 top-3 rounded-full border border-line bg-ink/80 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-200 backdrop-blur">
                    {e.price != null ? `$${e.price}` : "FREE"}
                    {e.ageRule !== "all" ? ` · ${e.ageRule}` : ""}
                  </span>
                  <span className="absolute bottom-3 left-3 rounded bg-ink/80 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-300 backdrop-blur">
                    {e.category}
                  </span>
                  {e.isCampus && (
                    <span
                      className="absolute bottom-3 right-3 flex items-center gap-1 rounded border border-violet-400/40 bg-ink/80 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-violet-300 backdrop-blur"
                      title="Publicly listed campus event — anyone can view; RSVP is for verified members of this school."
                    >
                      {(e.campusName ?? "Campus").replace(" University", "")} members
                    </span>
                  )}
                </Link>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/events/${e.slug}`} className="min-w-0">
                      <h3 className="truncate text-[15px] font-bold text-zinc-50 transition group-hover:text-amber-300">
                        {e.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-zinc-500">Hosted by {e.host}</p>
                    </Link>
                    <button
                      onClick={() => toggleSave(e)}
                      title={e.saved ? "Remove bookmark" : "Save"}
                      className={`shrink-0 rounded-full border p-1.5 transition ${
                        e.saved
                          ? "border-violet-400/50 text-violet-300"
                          : "border-line text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                      }`}
                    >
                      <Bookmark className={`h-3.5 w-3.5 ${e.saved ? "fill-violet-300" : ""}`} />
                    </button>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-400">{e.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-dashed border-line pt-3 text-[11px] text-zinc-500">
                    <span>{e.timeLabel}</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {e.location.split(",")[0]}
                      {e.distanceMi != null && (
                        <span className="font-mono text-amber-300/80"> · {e.distanceMi} mi</span>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" /> {e.attending} going
                      {e.spotsLeft != null && e.spotsLeft <= 30 && (
                        <span className="font-mono font-medium text-amber-300"> · {e.spotsLeft} spots left</span>
                      )}
                    </span>
                    {(e.kind === "rsvp" || e.kind === "registration") && (
                      <button
                        onClick={() => toggleGoing(e)}
                        className={`inline-flex items-center gap-1 font-semibold ${
                          e.going ? "text-lime-300" : "text-zinc-400 hover:text-lime-300"
                        }`}
                      >
                        <Check className="h-3 w-3" /> {e.going ? "Going" : e.kind === "registration" ? "Register" : "RSVP"}
                      </button>
                    )}
                    <Link
                      href={`/events/${e.slug}`}
                      className="ml-auto inline-flex items-center gap-1 font-semibold text-amber-300 hover:text-amber-200"
                    >
                      Details <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
