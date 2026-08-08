"use client";

/* The bell — real notification center backed by the DB. Opens the
   center, never a conversation directly. Click → mark read → route
   to the notification's specific destination. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useSession } from "@/lib/session";

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

function timeAgo(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function DbNotificationBell() {
  const router = useRouter();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasHigh, setHasHigh] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const res = await fetch("/api/notifications?limit=20", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.notifications ?? []);
    setUnreadCount(data.unreadCount ?? 0);
    setHasHigh(!!data.hasHighPriorityUnread);
  }, [user]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!user) return null;

  const openNotification = async (n: Notif) => {
    setOpen(false);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [n.id] }),
    });
    load();
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="icon-btn relative"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className={`absolute right-2 top-2 h-2 w-2 rounded-full ${
              hasHigh ? "bg-amber-400 animate-pulse-dot" : "bg-violet-400"
            }`}
          />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] overflow-hidden rounded-xl border border-line bg-card shadow-card animate-fade-up">
          <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAll} className="text-[11px] font-semibold text-violet-300 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.slice(0, 6).map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => openNotification(n)}
                  className={`flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition hover:bg-card-raised ${
                    n.read ? "opacity-60" : ""
                  }`}
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
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-zinc-100">{n.title}</span>
                    {n.body && <span className="block truncate text-[11px] text-zinc-500">{n.body}</span>}
                    <span className="mt-0.5 block text-[10px] text-zinc-600">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
            {items.length === 0 && <li className="px-4 py-6 text-center text-xs text-zinc-500">You&apos;re all caught up.</li>}
          </ul>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-line-soft px-4 py-2.5 text-center text-xs font-semibold text-violet-300 transition hover:bg-card-raised"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
