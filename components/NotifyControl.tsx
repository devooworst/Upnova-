"use client";

/* ------------------------------------------------------------------ */
/*  Notification controls, right where the content is.                 */
/*                                                                     */
/*  CreatorNotifyBell — a bell next to Follow: pick a LEVEL             */
/*    (All activity · New posts · Live streams · Bookings ·             */
/*     New opportunities · Important only · Off).                       */
/*  ContentNotifyToggle — one tap on a post / opportunity / service:   */
/*    "Notify me when bookings open", "…when this opportunity           */
/*    changes", "…about activity on this post".                         */
/*                                                                     */
/*  Both write /api/me/subscriptions (stored on the ACCOUNT →           */
/*  respected across devices), and every resulting send still passes   */
/*  the user's Settings → Notifications switches. Off = never sent.    */
/* ------------------------------------------------------------------ */

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, BellRing, Check } from "lucide-react";
import { useSession } from "@/lib/session";

const CREATOR_LEVELS: { id: string; label: string; hint: string }[] = [
  { id: "all", label: "All activity", hint: "Posts, live, bookings, opportunities" },
  { id: "posts", label: "New posts", hint: "Only when they post" },
  { id: "live", label: "Live streams", hint: "Only when they go live" },
  { id: "bookings", label: "Bookings & services", hint: "When bookings open up" },
  { id: "opportunities", label: "New opportunities", hint: "When they post paid work" },
  { id: "important", label: "Important only", hint: "Big updates, nothing routine" },
  { id: "off", label: "Off", hint: "Nothing from this creator" },
];

export function CreatorNotifyBell({ creatorId, compact = false }: { creatorId: string; compact?: boolean }) {
  const { user } = useSession();
  const [mode, setMode] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || user.id === creatorId) return;
    fetch(`/api/me/subscriptions?targetType=creator&targetId=${creatorId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { mode: null }))
      .then((d) => setMode(d.mode))
      .catch(() => {});
  }, [user?.id, creatorId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!user || user.id === creatorId) return null;
  const active = !!mode && mode !== "off";

  const pick = async (m: string) => {
    setBusy(true);
    try {
      const r = await fetch("/api/me/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "creator", targetId: creatorId, mode: m }),
      });
      if (r.ok) setMode(m);
    } catch {}
    setBusy(false);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notification settings for this creator"
        aria-expanded={open}
        data-guide="creator-notify-bell"
        className={`flex items-center justify-center rounded-full border transition ${compact ? "h-9 w-9" : "h-10 w-10"} ${
          active ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line bg-card text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
        }`}
      >
        {mode === "off" ? <BellOff className="h-4 w-4" /> : active ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-card shadow-2xl animate-fade-up">
          <p className="border-b border-line-soft px-4 pb-2 pt-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            notify me about
          </p>
          <ul className="p-1">
            {CREATOR_LEVELS.map((l) => {
              const on = mode === l.id || (!mode && l.id === "off");
              return (
                <li key={l.id}>
                  <button
                    onClick={() => pick(l.id)}
                    disabled={busy}
                    className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition ${on ? "bg-white/10" : "hover:bg-card-raised"}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={`block text-xs font-semibold ${on ? "text-zinc-50" : "text-zinc-300"}`}>{l.label}</span>
                      <span className="block text-[10px] text-zinc-600">{l.hint}</span>
                    </span>
                    {on && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-400" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-line-soft px-4 py-2 text-[10px] leading-relaxed text-zinc-600">
            Saved to your account — applies on every device. Your Settings switches still apply.
          </p>
        </div>
      )}
    </div>
  );
}

export function ContentNotifyToggle({
  targetType,
  targetId,
  label,
  activeLabel,
}: {
  targetType: "post" | "opportunity" | "service";
  targetId: string;
  /** e.g. "Notify me when bookings open" */
  label: string;
  /** e.g. "You'll be notified" */
  activeLabel?: string;
}) {
  const { user } = useSession();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/me/subscriptions?targetType=${targetType}&targetId=${targetId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { mode: null }))
      .then((d) => setOn(d.mode === "on"))
      .catch(() => {});
  }, [user?.id, targetType, targetId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const toggle = async () => {
    if (busy || on === null) return;
    setBusy(true);
    try {
      const r = await fetch("/api/me/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, mode: on ? "off" : "on" }),
      });
      if (r.ok) setOn(!on);
    } catch {}
    setBusy(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={busy || on === null}
      aria-pressed={!!on}
      data-guide="content-notify-toggle"
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        on ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
      }`}
    >
      {on ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
      {on ? activeLabel ?? "You'll be notified" : label}
    </button>
  );
}
