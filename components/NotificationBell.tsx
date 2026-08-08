"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  notifications,
  categoryInfo,
  getReadIds,
  markRead,
  markAllRead,
  NOTIF_EVENT,
} from "@/lib/notifications";

/* The bell: central activity inbox. Opens the notification center —
   never someone's conversation directly. Click a notification →
   marked read → routed to its specific destination. */

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setReadIds(getReadIds());
    sync();
    window.addEventListener(NOTIF_EVENT, sync);
    return () => window.removeEventListener(NOTIF_EVENT, sync);
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const unread = notifications.filter((n) => !readIds.has(n.id));
  const hasAction = unread.some((n) => n.priority === "high");
  const preview = notifications.slice(0, 6);

  const openNotification = (id: string, href: string) => {
    markRead(id);
    setOpen(false);
    router.push(href);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="icon-btn relative"
        aria-label={unread.length > 0 ? `Notifications, ${unread.length} unread` : "Notifications"}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread.length > 0 && (
          <span
            className={`absolute right-2 top-2 h-2 w-2 rounded-full ${
              hasAction ? "bg-amber-400 animate-pulse-dot" : "bg-violet-400"
            }`}
          />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] overflow-hidden rounded-xl border border-line bg-card shadow-card animate-fade-up">
          <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
            <p className="text-sm font-bold tracking-tight text-zinc-50">Notifications</p>
            {unread.length > 0 && (
              <button
                onClick={markAllRead}
                className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 transition hover:text-zinc-200"
              >
                Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-[26rem] overflow-y-auto">
            {preview.map((n) => {
              const isUnread = !readIds.has(n.id);
              const cat = categoryInfo[n.category];
              return (
                <li key={n.id} className="border-b border-line-soft last:border-0">
                  <button
                    onClick={() => openNotification(n.id, n.href)}
                    className={`flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition hover:bg-card-raised ${
                      isUnread ? "bg-card-raised/40" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={`font-mono text-[9px] font-semibold uppercase tracking-[0.1em] ${cat.color}`}>
                        {cat.label}
                      </span>
                      <span className={`mt-0.5 block truncate text-sm ${isUnread ? "font-semibold text-zinc-100" : "font-medium text-zinc-400"}`}>
                        {n.title}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">{n.body}</span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className="font-mono text-[10px] text-zinc-600">{n.time}</span>
                        {n.action && isUnread && (
                          <span className="font-mono text-[10px] font-semibold text-lime-400">
                            {n.action} →
                          </span>
                        )}
                      </span>
                    </span>
                    {isUnread && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />}
                  </button>
                </li>
              );
            })}
          </ul>

          <button
            onClick={() => {
              setOpen(false);
              router.push("/notifications");
            }}
            className="block w-full border-t border-line-soft py-2.5 text-center text-xs font-semibold text-zinc-300 transition hover:bg-card-raised hover:text-zinc-100"
          >
            View all notifications →
          </button>
        </div>
      )}
    </div>
  );
}
