"use client";

/* ------------------------------------------------------------------ */
/*  Notification center — real records, 7 filters, grouped by day.     */
/*  Every notification routes somewhere specific.                      */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Notif {
  id: string;
  type: string;
  category: string;
  priority: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
}

const FILTERS = ["All", "Activity", "Work", "Messages", "Communities", "Campus", "Payments"] as const;

function dayGroup(iso: string): "Today" | "Yesterday" | "Earlier" {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d >= today) return "Today";
  if (d >= new Date(today.getTime() - 86400_000)) return "Yesterday";
  return "Earlier";
}

function timeAgo(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications?limit=100", { cache: "no-store" });
    if (res.status === 401) {
      setItems([]);
      return;
    }
    const data = await res.json();
    setItems(data.notifications ?? []);
    setUnread(data.unreadCount ?? 0);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNotification = async (n: Notif) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [n.id] }),
    });
    router.push(n.href);
  };

  const markAll = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    load();
  };

  const filtered = (items ?? []).filter((n) => filter === "All" || n.category === filter.toLowerCase());
  const groups: Record<string, Notif[]> = { Today: [], Yesterday: [], Earlier: [] };
  for (const n of filtered) groups[dayGroup(n.createdAt)].push(n);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Notifications</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {unread > 0 ? `${unread} unread — high-priority items need action.` : "You're all caught up."}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={markAll} className="btn-ghost px-3.5 py-1.5 text-xs">
            Mark all read
          </button>
        )}
      </div>

      <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              filter === f ? "border-white/40 bg-white/10 font-semibold text-zinc-50" : "border-line text-zinc-400 hover:border-zinc-600"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {items === null ? (
        <div className="card mt-4 animate-pulse p-6" aria-hidden>
          <div className="h-3 w-1/2 rounded bg-card-raised" />
          <div className="mt-3 h-3 w-2/3 rounded bg-card-raised" />
        </div>
      ) : items.length === 0 ? (
        <div className="card mt-4 p-8 text-center">
          <p className="text-sm font-semibold text-zinc-200">Nothing yet</p>
          <p className="mt-1 text-xs text-zinc-500">
            Notifications appear when people follow you, message you, or work with you.{" "}
            <Link href="/login" className="text-violet-300 hover:underline">Sign in</Link> if you haven&apos;t.
          </p>
        </div>
      ) : (
        (["Today", "Yesterday", "Earlier"] as const).map(
          (g) =>
            groups[g].length > 0 && (
              <section key={g} className="mt-5">
                <h2 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{g}</h2>
                <div className="card divide-y divide-line-soft">
                  {groups[g].map((n) => (
                    <button
                      key={n.id}
                      onClick={() => openNotification(n)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-card-raised ${n.read ? "opacity-60" : ""}`}
                    >
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          n.read
                            ? "bg-transparent"
                            : n.priority === "high"
                              ? "bg-amber-400"
                              : n.category === "payments"
                                ? "bg-lime-400"
                                : "bg-violet-400"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-100">{n.title}</span>
                          {n.priority === "high" && !n.read && (
                            <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">
                              Action needed
                            </span>
                          )}
                        </span>
                        {n.body && <span className="mt-0.5 block text-xs text-zinc-500">{n.body}</span>}
                        <span className="mt-1 block text-[10px] text-zinc-600">
                          {timeAgo(n.createdAt)} · {n.category}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )
        )
      )}
    </div>
  );
}
