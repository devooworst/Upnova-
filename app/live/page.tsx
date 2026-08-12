"use client";

/* ------------------------------------------------------------------ */
/*  /live — Mavyn's ONE universal Live destination.                    */
/*  Discovery filters (Live Now · Following · For You · Campus ·       */
/*  Nearby · Replays) + category chips. Campus is an audience layer    */
/*  here, not a separate product; Nearby never exposes locations.      */
/* ------------------------------------------------------------------ */

import { Radio, Eye, GraduationCap, Users, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import GoLiveFlow from "@/components/GoLiveFlow";
import { useSession } from "@/lib/session";

type Card = {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  audience: string;
  status: string;
  viewerCount: number | null;
  peakViewers: number;
  replayHighlight: boolean;
  host: { handle: string; displayName: string; avatarUrl: string | null; accountType: string };
  campusName: string | null;
  communityName: string | null;
  isMine: boolean;
};

const FILTERS = [
  ["now", "Live Now"], ["following", "Following"], ["foryou", "For You"],
  ["campus", "Campus"], ["nearby", "Nearby"], ["replays", "Replays"],
] as const;
const CATS = [
  ["all", "All"], ["music", "Music"], ["gaming", "Gaming"], ["fashion", "Fashion"], ["fitness", "Fitness"],
  ["education", "Education"], ["business", "Business"], ["conversation", "Conversation"],
  ["behind_the_scenes", "Behind the Scenes"], ["irl", "IRL"], ["creative", "Creative"], ["other", "Other"],
] as const;

const CAT_TINT: Record<string, string> = {
  music: "from-violet-500/30", gaming: "from-emerald-500/30", fashion: "from-pink-500/30",
  fitness: "from-orange-500/30", education: "from-sky-500/30", business: "from-sky-400/30",
  conversation: "from-amber-500/30", behind_the_scenes: "from-zinc-500/30", irl: "from-red-500/30",
  creative: "from-lime-500/30", other: "from-zinc-600/30",
};

function LiveCard({ s }: { s: Card }) {
  return (
    <Link
      href={`/live/${s.id}`}
      data-guide={`live-card-${s.host.handle}`}
      className="group overflow-hidden rounded-2xl border border-line bg-card transition hover:border-zinc-600"
    >
      <div className={`relative aspect-video bg-gradient-to-br ${CAT_TINT[s.category] ?? "from-zinc-600/30"} to-transparent`}>
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
          {s.status === "live" ? (
            <span className="flex items-center gap-1 rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
            </span>
          ) : (
            <span className="rounded-md bg-zinc-800/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-300">Replay</span>
          )}
          {s.replayHighlight && <span className="rounded-md bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-bold text-black">Highlight</span>}
        </div>
        <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-100">
          <Eye size={11} /> {s.status === "live" ? (s.viewerCount ?? 0) : s.peakViewers}
        </span>
        <Radio size={34} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20" />
      </div>
      <div className="flex gap-2.5 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-xs font-bold text-zinc-300">
          {s.host.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.host.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            s.host.displayName.slice(0, 1)
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-100">{s.title}</p>
          <p className="truncate text-xs text-zinc-400">{s.host.displayName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-line px-1.5 py-0.5 text-[10px] text-zinc-400">{s.categoryLabel}</span>
            {s.campusName && (
              <span className="flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-400/10 px-1.5 py-0.5 text-[10px] text-violet-300">
                <GraduationCap size={10} /> {s.campusName}
              </span>
            )}
            {s.communityName && (
              <span className="flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-400/10 px-1.5 py-0.5 text-[10px] text-violet-300">
                <Users size={10} /> {s.communityName}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function LivePage() {
  const { user } = useSession();
  const [filter, setFilter] = useState("now");
  const [cat, setCat] = useState("all");
  const [items, setItems] = useState<Card[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showGoLive, setShowGoLive] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/live?filter=${filter}&category=${cat}`);
    if (!res.ok) return;
    const d = await res.json();
    setItems(d.items ?? []);
    setNote(d.note ?? null);
  }, [filter, cat]);

  useEffect(() => {
    setItems(null);
    load();
    const iv = setInterval(load, 10_000);
    return () => clearInterval(iv);
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-zinc-100">
            <Radio size={22} className="text-red-400" /> Live
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">One live ecosystem — creators, students, businesses, everyone.</p>
        </div>
        {user && (
          <button
            onClick={() => setShowGoLive(true)}
            data-guide="live-golive-open"
            className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-400 active:scale-[0.98]"
          >
            <Radio size={15} /> Go Live
          </button>
        )}
      </div>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" data-guide="live-filters">
        {FILTERS.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition active:scale-[0.97] ${
              filter === v ? "border-red-400/50 bg-red-400/10 text-red-300" : "border-line text-zinc-400 hover:border-zinc-600"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {CATS.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setCat(v)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] transition active:scale-[0.97] ${
              cat === v ? "border-zinc-500 bg-card-raised text-zinc-200" : "border-line-soft text-zinc-500 hover:border-zinc-600"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {note && (
        <p className="mt-4 rounded-xl border border-line bg-card px-4 py-3 text-sm text-zinc-400">{note}</p>
      )}

      {items === null ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-52 animate-pulse rounded-2xl border border-line-soft bg-card" />
          ))}
        </div>
      ) : items.length === 0 && !note ? (
        <div className="mt-10 text-center">
          <Radio size={32} className="mx-auto text-zinc-700" />
          <p className="mt-3 text-sm font-semibold text-zinc-400">
            {filter === "replays" ? "No replays here yet." : "Nobody's live here right now."}
          </p>
          <p className="mt-1 text-xs text-zinc-600">Be the first — hit Go Live.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <LiveCard key={s.id} s={s} />
          ))}
        </div>
      )}

      {showGoLive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowGoLive(false)}>
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-bold text-zinc-100">
                <Radio size={16} className="text-red-400" /> Go Live
              </h2>
              <button onClick={() => setShowGoLive(false)} aria-label="Close" className="text-zinc-500 hover:text-zinc-200">
                <X size={16} />
              </button>
            </div>
            <GoLiveFlow onClose={() => setShowGoLive(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
