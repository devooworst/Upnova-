"use client";

/* ------------------------------------------------------------------ */
/*  Bookmarks — one shared save system across the whole app.           */
/*  Every card here is a live reference to the real record: remove it  */
/*  and the save button on the original flips off too.                 */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  FileText,
  Briefcase,
  Zap,
  Calendar,
  Users,
  Trash2,
  ArrowRight,
} from "lucide-react";

interface Item {
  type: "post" | "opportunity" | "service" | "event" | "community";
  id: string;
  title: string;
  by: string;
  byHandle: string;
  meta: string;
  href: string;
  savedAt: string;
}

const TABS = ["All", "Posts", "Opportunities", "Services", "Events", "Communities"] as const;
const TYPE_BY_TAB: Record<string, Item["type"] | null> = {
  All: null,
  Posts: "post",
  Opportunities: "opportunity",
  Services: "service",
  Events: "event",
  Communities: "community",
};

const ICON: Record<Item["type"], typeof FileText> = {
  post: FileText,
  opportunity: Briefcase,
  service: Zap,
  event: Calendar,
  community: Users,
};

const TONE: Record<Item["type"], string> = {
  post: "text-violet-400 bg-violet-400/10",
  opportunity: "text-lime-400 bg-lime-400/10",
  service: "text-lime-400 bg-lime-400/10",
  event: "text-amber-400 bg-amber-400/10",
  community: "text-violet-400 bg-violet-400/10",
};

export default function BookmarksPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");

  const load = useCallback(async () => {
    const res = await fetch("/api/bookmarks", { cache: "no-store" });
    if (res.status === 401) {
      setItems([]);
      return;
    }
    const d = await res.json();
    setItems(d.items ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (item: Item) => {
    await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: item.type, targetId: item.id }),
    });
    load();
  };

  const filtered = (items ?? []).filter((i) => !TYPE_BY_TAB[tab] || i.type === TYPE_BY_TAB[tab]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/10">
          <Bookmark className="h-5 w-5 text-violet-400" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Bookmarks</h1>
          <p className="text-sm text-zinc-400">Everything you saved, in one place.</p>
        </div>
      </div>

      <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              tab === t
                ? "border-white/40 bg-white/10 font-semibold text-zinc-50"
                : "border-line text-zinc-400 hover:border-zinc-600"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {items === null ? (
        <div className="card mt-4 h-32 animate-pulse" aria-hidden />
      ) : filtered.length === 0 ? (
        <div className="card mt-4 p-8 text-center">
          <p className="text-sm font-semibold text-zinc-200">Nothing saved{tab !== "All" ? ` in ${tab}` : ""} yet</p>
          <p className="mt-1 text-xs text-zinc-500">
            Tap the bookmark icon on any post, opportunity, or service and it lands here.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {filtered.map((item) => {
            const Icon = ICON[item.type];
            return (
              <article key={`${item.type}-${item.id}`} className="card flex items-center gap-3 p-4">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONE[item.type]}`}>
                  <Icon className="h-4.5 w-4.5 h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    {item.type}
                  </p>
                  <h3 className="truncate text-sm font-semibold text-zinc-100">{item.title}</h3>
                  <p className="truncate text-xs text-zinc-500">
                    {item.by} · {item.meta} · saved{" "}
                    {new Date(item.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                <Link href={item.href} className="btn-ghost shrink-0 px-3 py-1.5 text-[11px]">
                  Open <ArrowRight className="h-3 w-3" />
                </Link>
                <button
                  onClick={() => remove(item)}
                  title="Remove bookmark"
                  className="shrink-0 rounded-md p-1.5 text-zinc-500 transition hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
