"use client";

/* ------------------------------------------------------------------ */
/*  Events — database-backed listings with real hosts and working      */
/*  bookmarks. Detail pages live at /events/[slug].                    */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Calendar, MapPin, Users, Bookmark, ArrowRight } from "lucide-react";

interface EventItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  startsAt: string;
  timeLabel: string;
  location: string;
  city: string;
  price: number | null;
  capacity: number | null;
  attending: number;
  imageUrl: string | null;
  kind: string;
  ageRule: string;
  host: string;
  saved: boolean;
}

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export default function EventsPage() {
  const [items, setItems] = useState<EventItem[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/events", { cache: "no-store" });
    const d = await res.json();
    setItems(d.events ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSave = async (e: EventItem) => {
    const res = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "event", targetId: e.id }),
    });
    if (res.ok) load();
  };

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
          What&apos;s happening around you — real listings with real hosts.
        </p>
      </header>

      {items === null ? (
        <div className="grid gap-4 md:grid-cols-2" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="card-event h-64 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((e) => {
            const d = new Date(e.startsAt);
            const spotsLeft = e.capacity != null ? e.capacity - e.attending : null;
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
                    <div className="h-full w-full bg-card-raised" />
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
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" /> {e.attending} going
                      {spotsLeft != null && spotsLeft <= 30 && (
                        <span className="font-mono font-medium text-amber-300"> · {spotsLeft} spots left</span>
                      )}
                    </span>
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
