"use client";

/* LIVE NOW — the For You feed's live rail. Real streams from /api/live
   (audience-gated server-side per viewer). Hidden when nobody's live. */

import { Radio, Eye } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Card = {
  id: string;
  title: string;
  categoryLabel: string;
  viewerCount: number | null;
  host: { handle: string; displayName: string; avatarUrl: string | null };
  campusName: string | null;
  communityName: string | null;
};

export default function LiveNowRail() {
  const [items, setItems] = useState<Card[]>([]);

  useEffect(() => {
    const load = () =>
      fetch("/api/live?filter=foryou")
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => setItems((d.items ?? []).slice(0, 6)))
        .catch(() => {});
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-line bg-card p-3.5" data-guide="feed-live-now">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-zinc-300">
          <span className="flex items-center gap-1 rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
          </span>
          Live now
        </p>
        <Link href="/live" className="text-xs font-semibold text-red-300 transition hover:text-red-200">
          See all Live →
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
        {items.map((s) => (
          <Link
            key={s.id}
            href={`/live/${s.id}`}
            className="w-44 shrink-0 rounded-xl border border-line bg-card-raised p-2.5 transition hover:border-zinc-600"
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-[11px] font-bold text-zinc-300 ring-2 ring-red-400/40">
                {s.host.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.host.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  s.host.displayName.slice(0, 1)
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-zinc-200">{s.host.displayName}</p>
                <p className="flex items-center gap-1 text-[10px] text-zinc-500">
                  <Eye size={10} /> {s.viewerCount ?? 0} · {s.categoryLabel}
                </p>
              </div>
            </div>
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-zinc-400">{s.title}</p>
            {(s.campusName || s.communityName) && (
              <p className="mt-1 truncate text-[10px] text-violet-300">{s.campusName ?? s.communityName}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
