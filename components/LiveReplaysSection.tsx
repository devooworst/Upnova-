"use client";

/* Live replays on a member's profile — saved replays only (a deleted
   replay disappears from here instantly). Hidden when there are none. */

import { Radio, Eye } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Replay = {
  id: string;
  title: string;
  categoryLabel: string;
  peakViewers: number;
  replayHighlight: boolean;
  endedAt: string | null;
};

export default function LiveReplaysSection({ handle }: { handle: string }) {
  const [items, setItems] = useState<Replay[]>([]);
  useEffect(() => {
    fetch(`/api/live/replays?host=${encodeURIComponent(handle)}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items ?? []))
      .catch(() => {});
  }, [handle]);

  if (items.length === 0) return null;
  return (
    <section className="card mt-4 p-5" data-guide="profile-replays">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-zinc-400">
        <Radio size={13} className="text-red-400" /> Live replays
      </p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {items.map((r) => (
          <Link key={r.id} href={`/live/${r.id}`} className="rounded-xl border border-line bg-card-raised p-3 transition hover:border-zinc-600">
            <p className="truncate text-sm font-semibold text-zinc-100">{r.title}</p>
            <p className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
              <span className="rounded-full border border-line px-1.5 py-0.5">{r.categoryLabel}</span>
              <span className="flex items-center gap-1"><Eye size={11} /> {r.peakViewers} peak</span>
              {r.replayHighlight && <span className="rounded-full bg-amber-400/90 px-1.5 py-0.5 font-bold text-black">Highlight</span>}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
