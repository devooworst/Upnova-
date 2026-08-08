"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  notifications,
  categoryInfo,
  getReadIds,
  markRead,
  markAllRead,
  NOTIF_EVENT,
  type NotificationCategory,
} from "@/lib/notifications";

/* Full notification history: filterable, grouped by day, never
   disappearing just because it's old. "Wait, when did they send me
   that project?" — findable here. */

const filters: { id: NotificationCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "activity", label: "Activity" },
  { id: "work", label: "Work" },
  { id: "message", label: "Messages" },
  { id: "community", label: "Communities" },
  { id: "campus", label: "Campus" },
  { id: "payment", label: "Payments" },
];

const dayLabels = { today: "Today", yesterday: "Yesterday", earlier: "Earlier" } as const;

export default function NotificationsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<NotificationCategory | "all">("all");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const sync = () => setReadIds(getReadIds());
    sync();
    window.addEventListener(NOTIF_EVENT, sync);
    return () => window.removeEventListener(NOTIF_EVENT, sync);
  }, []);

  const items = notifications.filter((n) => filter === "all" || n.category === filter);
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-50">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/10">
              <Bell className="h-5 w-5 text-violet-400" />
            </span>
            Notifications
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-ghost px-3.5 py-1.5 text-xs">
            Mark all read
          </button>
        )}
      </header>

      {/* category filters */}
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === f.id
                ? "bg-white text-zinc-950"
                : "border border-line text-zinc-400 hover:bg-card-raised hover:text-zinc-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* grouped history */}
      {(["today", "yesterday", "earlier"] as const).map((day) => {
        const dayItems = items.filter((n) => n.day === day);
        if (dayItems.length === 0) return null;
        return (
          <section key={day}>
            <h2 className="mb-1.5 px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {dayLabels[day]}
            </h2>
            <div className="card divide-y divide-line-soft overflow-hidden">
              {dayItems.map((n) => {
                const isUnread = !readIds.has(n.id);
                const cat = categoryInfo[n.category];
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      markRead(n.id);
                      router.push(n.href);
                    }}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-card-raised ${
                      isUnread ? "bg-card-raised/40" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={`font-mono text-[9px] font-semibold uppercase tracking-[0.1em] ${cat.color}`}>
                        {cat.label}
                        {n.priority === "high" && isUnread && (
                          <span className="ml-2 text-amber-400">action needed</span>
                        )}
                      </span>
                      <span className={`mt-0.5 block text-sm ${isUnread ? "font-semibold text-zinc-100" : "font-medium text-zinc-400"}`}>
                        {n.title}
                      </span>
                      <span className="block text-xs text-zinc-500">{n.body}</span>
                      <span className="mt-1 flex items-center gap-3">
                        <span className="font-mono text-[10px] text-zinc-600">{n.time}</span>
                        {n.action && isUnread && (
                          <span className="font-mono text-[10px] font-semibold text-lime-400">{n.action} →</span>
                        )}
                      </span>
                    </span>
                    {isUnread && <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {items.length === 0 && (
        <p className="py-12 text-center text-sm text-zinc-500">Nothing in this category yet.</p>
      )}
    </div>
  );
}
