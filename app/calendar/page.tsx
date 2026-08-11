"use client";

/* ------------------------------------------------------------------ */
/*  Bookings — calendar-first scheduling dashboard.                    */
/*                                                                     */
/*  The calendar is the source of truth. Every card here is the same   */
/*  booking record the APIs drive: pending → accepted → confirmed →    */
/*  completed, plus cancelled and reschedule_requested. Status         */
/*  indicators are thin colored bars — no emoji circles:               */
/*    lime = confirmed · amber = pending/awaiting payment ·            */
/*    violet = reschedule · zinc = completed · rose = cancelled        */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { EtaPicker, UpdatePreview, combineEta, fmtEta, clampPercent } from "@/components/ProgressComposer";
import { defaultPercentFor } from "@/lib/progressDefaults";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  ArrowRight,
  MessageSquare,
  X,
  Check,
  Send,
} from "lucide-react";
import Avatar from "@/components/Avatar";

/* ------------------------------- types ------------------------------- */

interface Booking {
  id: string;
  title: string;
  startsAt: string;
  proposedStartsAt: string | null;
  durationMin: number;
  price: number;
  location: string;
  status: string;
  paymentStatus: string | null;
  travelFee?: number;
  items?: { label: string; amount: number | null }[];
  myRole: "client" | "provider";
  with: { handle: string; displayName: string; avatarUrl: string | null };
}

interface ProjectRow {
  id: string;
  title: string;
  amount: number;
  state: string;
  myRole: string;
  with: { displayName: string };
}

const STATUS: Record<string, { label: string; bar: string; badge: string }> = {
  pending: { label: "Requested", bar: "bg-amber-400", badge: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  accepted: { label: "Payment pending", bar: "bg-amber-400", badge: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  confirmed: { label: "Confirmed", bar: "bg-lime-400", badge: "border-lime-400/40 bg-lime-400/10 text-lime-300" },
  reschedule_requested: { label: "Reschedule requested", bar: "bg-violet-400", badge: "border-violet-400/40 bg-violet-400/10 text-violet-300" },
  completed: { label: "Completed", bar: "bg-zinc-500", badge: "border-line text-zinc-400" },
  cancelled: { label: "Cancelled", bar: "bg-rose-400", badge: "border-rose-400/40 bg-rose-400/10 text-rose-300" },
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const fmtDur = (min: number) =>
  min >= 60 ? `${Math.floor(min / 60)} hr${min >= 120 ? "s" : ""}${min % 60 ? ` ${min % 60} min` : ""}` : `${min} min`;
const fmtLong = (d: Date) =>
  d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

/* =============================== page =============================== */

export default function BookingsPage() {
  const today = new Date();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [selected, setSelected] = useState<Date>(today);
  const [open, setOpen] = useState<Booking | null>(null);

  const load = useCallback(async () => {
    const [b, p] = await Promise.all([
      fetch("/api/bookings", { cache: "no-store" }),
      fetch("/api/projects", { cache: "no-store" }),
    ]);
    if (b.status === 401) {
      setBookings([]);
      return;
    }
    const bd = await b.json();
    setBookings(bd.bookings ?? []);
    if (p.ok) setProjects(((await p.json()).projects ?? []).filter((x: ProjectRow) => !["completed", "reviewed", "cancelled"].includes(x.state)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* keep the modal in sync after actions */
  useEffect(() => {
    if (open && bookings) {
      const fresh = bookings.find((b) => b.id === open.id);
      if (fresh && fresh !== open) setOpen(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  const byDay = useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const b of bookings ?? []) {
      const k = dayKey(new Date(b.startsAt));
      m.set(k, [...(m.get(k) ?? []), b]);
    }
    for (const list of Array.from(m.values())) list.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    return m;
  }, [bookings]);

  const upcoming = (bookings ?? [])
    .filter((b) => ["pending", "accepted", "confirmed", "reschedule_requested"].includes(b.status) && Date.parse(b.startsAt) >= Date.now() - 86400_000)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const pendingForMe = (bookings ?? []).filter(
    (b) => (b.status === "pending" && b.myRole === "provider") || b.status === "reschedule_requested"
  );
  const completed = (bookings ?? [])
    .filter((b) => b.status === "completed")
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));

  /* calendar grid (Monday-first) */
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const nav = (dir: -1 | 1) => {
    const d = new Date(year, month + dir, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
  };

  const selectedBookings = byDay.get(dayKey(selected)) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* header + honest summary line */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
            <CalendarDays className="h-5 w-5 text-lime-400" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Bookings</h1>
            {bookings !== null && (
              <p className="font-mono text-[11px] font-medium text-zinc-500">
                <span className="text-lime-400">{upcoming.length}</span> upcoming ·{" "}
                <span className="text-amber-400">{pendingForMe.length}</span> pending ·{" "}
                <span className="text-zinc-300">{completed.length}</span> completed
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* ============================ calendar ============================ */}
        <div className="min-w-0 space-y-4">
          <section className="card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">
                {MONTHS[month]} {year}
              </h2>
              <div className="flex items-center gap-1">
                <button onClick={() => nav(-1)} aria-label="Previous month" className="rounded-md p-1.5 text-zinc-500 transition hover:bg-card-raised hover:text-zinc-200">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setMonth(today.getMonth());
                    setYear(today.getFullYear());
                    setSelected(today);
                  }}
                  className="rounded-md px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500 transition hover:bg-card-raised hover:text-zinc-200"
                >
                  Today
                </button>
                <button onClick={() => nav(1)} aria-label="Next month" className="rounded-md p-1.5 text-zinc-500 transition hover:bg-card-raised hover:text-zinc-200">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <p key={w} className="pb-1 text-center font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-zinc-600">
                  {w}
                </p>
              ))}
              {cells.map((d, i) => {
                if (!d) return <span key={i} aria-hidden />;
                const k = dayKey(d);
                const dayBookings = byDay.get(k) ?? [];
                const isToday = k === dayKey(today);
                const isSelected = k === dayKey(selected);
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(d)}
                    className={`flex min-h-[52px] flex-col items-center gap-1 rounded-lg border p-1.5 transition sm:min-h-[60px] ${
                      isSelected
                        ? "border-lime-400/60 bg-lime-400/5"
                        : isToday
                          ? "border-zinc-600 bg-card-raised"
                          : "border-transparent hover:border-line hover:bg-card-raised/60"
                    }`}
                  >
                    <span className={`text-xs font-semibold ${isToday ? "text-lime-300" : isSelected ? "text-zinc-50" : "text-zinc-400"}`}>
                      {d.getDate()}
                    </span>
                    {/* thin status bars — up to 3, professional indicators */}
                    <span className="flex w-full flex-col gap-[3px] px-0.5">
                      {dayBookings.slice(0, 3).map((b) => (
                        <span key={b.id} className={`h-[3px] w-full rounded-full ${STATUS[b.status]?.bar ?? "bg-zinc-600"}`} title={`${b.title} — ${STATUS[b.status]?.label}`} />
                      ))}
                      {dayBookings.length > 3 && <span className="text-center font-mono text-[8px] leading-none text-zinc-500">+{dayBookings.length - 3}</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* legend — label + color, never color alone */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line-soft pt-3">
              {[
                ["bg-lime-400", "Confirmed"],
                ["bg-amber-400", "Pending"],
                ["bg-violet-400", "Reschedule"],
                ["bg-zinc-500", "Completed"],
                ["bg-rose-400", "Cancelled"],
              ].map(([c, l]) => (
                <span key={l} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                  <span className={`h-[3px] w-4 rounded-full ${c}`} /> {l}
                </span>
              ))}
            </div>
          </section>

          {/* -------------------- selected day -------------------- */}
          <section className="card p-4 sm:p-5">
            <h3 className="text-sm font-bold text-zinc-100">{fmtLong(selected)}</h3>
            {selectedBookings.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">Nothing booked this day.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {selectedBookings.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setOpen(b)}
                    className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-left transition hover:border-zinc-600"
                  >
                    <span className={`h-9 w-1 shrink-0 rounded-full ${STATUS[b.status]?.bar}`} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-100">
                        <span className="font-mono text-xs font-medium tracking-[0.08em] text-zinc-400">{fmtTime(b.startsAt)}</span>
                        {b.title}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {b.myRole === "provider" ? "Client" : "With"}: {b.with.displayName} · {fmtDur(b.durationMin)} ·{" "}
                        <span className="font-mono tracking-[0.08em] text-lime-300">${b.price}</span>
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${STATUS[b.status]?.badge}`}>
                      {STATUS[b.status]?.label}
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold text-violet-300">View booking →</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* -------------------- project work (no schedule) -------------------- */}
          {projects.length > 0 && (
            <section className="card p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-100">Project work</h3>
                <p className="text-[11px] text-zinc-500">Deadline-based — no time slot</p>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {projects.map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-2.5 rounded-xl border border-line bg-card-raised px-3.5 py-2.5 transition hover:border-zinc-600">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-100">{p.title}</p>
                      <p className="text-xs text-zinc-500">
                        {p.with.displayName} · <span className="font-mono tracking-[0.08em] text-lime-300">${p.amount}</span>
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ============================ right rail ============================ */}
        <div className="space-y-4">
          {/* pending requests — decisions live here */}
          <section className="card p-4">
            <h3 className="text-sm font-bold text-zinc-100">Pending requests</h3>
            {pendingForMe.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">Nothing waiting on you.</p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {pendingForMe.map((b) => (
                  <PendingCard key={b.id} b={b} onChanged={load} onOpen={() => setOpen(b)} />
                ))}
              </div>
            )}
          </section>

          {/* upcoming */}
          <section className="card p-4">
            <h3 className="text-sm font-bold text-zinc-100">Upcoming</h3>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">No upcoming bookings.</p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {upcoming.slice(0, 6).map((b) => (
                  <button key={b.id} onClick={() => { setSelected(new Date(b.startsAt)); setOpen(b); }} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-card-raised">
                    <span className={`h-8 w-1 shrink-0 rounded-full ${STATUS[b.status]?.bar}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-zinc-100">{b.title}</p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {new Date(b.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {fmtTime(b.startsAt)} · {b.with.displayName}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] tracking-[0.08em] text-lime-300">${b.price}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* recent completed */}
          <section className="card p-4">
            <h3 className="text-sm font-bold text-zinc-100">Recent completed</h3>
            {completed.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">Completed bookings land here.</p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {completed.slice(0, 4).map((b) => (
                  <button key={b.id} onClick={() => setOpen(b)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-card-raised">
                    <Check className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-zinc-300">{b.title}</p>
                      <p className="truncate text-[11px] text-zinc-600">
                        {new Date(b.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {b.with.displayName}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] tracking-[0.08em] text-zinc-500">${b.price}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {open && <BookingModal b={open} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}

/* --------------------------- pending card --------------------------- */

function PendingCard({ b, onChanged, onOpen }: { b: Booking; onChanged: () => void; onOpen: () => void }) {
  const [busy, setBusy] = useState(false);
  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    await fetch(`/api/bookings/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setBusy(false);
    onChanged();
  };

  return (
    <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
      <button onClick={onOpen} className="w-full text-left">
        <p className="text-xs font-bold text-zinc-100">{b.title} — {b.with.displayName}</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          {new Date(b.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {fmtTime(b.startsAt)} ·{" "}
          <span className="font-mono tracking-[0.08em] text-lime-300">${b.price}</span>
        </p>
      </button>
      {b.status === "pending" && b.myRole === "provider" && (
        <div className="mt-2 flex gap-1.5">
          <button disabled={busy} onClick={() => act("accept")} className="btn-lime flex-1 justify-center py-1.5 text-[11px]">
            Accept
          </button>
          <button disabled={busy} onClick={() => act("decline")} className="flex-1 rounded-full border border-line py-1.5 text-[11px] font-semibold text-zinc-400 transition hover:border-rose-400/40 hover:text-rose-300">
            Decline
          </button>
        </div>
      )}
      {b.status === "reschedule_requested" && b.proposedStartsAt && (
        <div className="mt-2">
          <p className="text-[11px] text-violet-300">
            Proposed: {new Date(b.proposedStartsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {fmtTime(b.proposedStartsAt)}
          </p>
          <div className="mt-1.5 flex gap-1.5">
            <button disabled={busy} onClick={() => act("reschedule_decide", { approve: true })} className="flex-1 rounded-full bg-violet-400 py-1.5 text-[11px] font-semibold text-zinc-950 transition hover:bg-violet-300">
              Approve new time
            </button>
            <button disabled={busy} onClick={() => act("reschedule_decide", { approve: false })} className="flex-1 rounded-full border border-line py-1.5 text-[11px] font-semibold text-zinc-400">
              Keep original
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------- booking record --------------------------- */

function BookingModal({ b, onClose, onChanged }: { b: Booking; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reschedOpen, setReschedOpen] = useState(false);
  const [newTime, setNewTime] = useState("");

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/bookings/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Something went wrong");
      return;
    }
    onChanged();
  };

  const start = new Date(b.startsAt);
  const end = new Date(start.getTime() + b.durationMin * 60_000);
  const st = STATUS[b.status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Booking</p>
            <h3 className="mt-1 text-base font-bold tracking-tight text-zinc-50">{b.title}</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Link href={`/creator/${b.with.handle}`}>
            <Avatar src={b.with.avatarUrl} initials={b.with.displayName.charAt(0)} size="md" />
          </Link>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-100">{b.with.displayName}</p>
            <p className="text-xs text-zinc-500">{b.myRole === "provider" ? "Client" : "Provider"}</p>
          </div>
          <span className={`ml-auto shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${st?.badge}`}>{st?.label}</span>
        </div>

        <dl className="mt-4 space-y-1.5 rounded-xl border border-line bg-card-raised p-3.5 text-sm">
          <div className="flex justify-between"><dt className="text-zinc-500">Date</dt><dd className="text-zinc-200">{fmtLong(start)}</dd></div>
          <div className="flex justify-between"><dt className="text-zinc-500">Time</dt><dd className="font-mono text-xs tracking-[0.08em] text-zinc-200">{fmtTime(b.startsAt)} – {end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</dd></div>
          <div className="flex justify-between"><dt className="text-zinc-500">Duration</dt><dd className="text-zinc-200">{fmtDur(b.durationMin)}</dd></div>
          {b.location && (
            <div className="flex justify-between"><dt className="text-zinc-500">Location</dt><dd className="flex items-center gap-1 text-zinc-200"><MapPin className="h-3 w-3 text-zinc-500" />{b.location}</dd></div>
          )}
          {(b.items?.length ?? 0) > 1 ? (
            <>
              {b.items!.map((l, i) => (
                <div key={i} className="flex justify-between">
                  <dt className="text-zinc-500">{l.label}</dt>
                  <dd className={`font-mono tracking-[0.08em] ${l.amount == null ? "text-amber-300" : "text-zinc-200"}`}>
                    {l.amount == null ? "Quoted" : `$${l.amount}`}
                  </dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-dashed border-line pt-1.5">
                <dt className="text-zinc-400">Subtotal</dt>
                <dd className="font-mono font-medium tracking-[0.08em] text-lime-300">${b.price}</dd>
              </div>
            </>
          ) : (
            <div className="flex justify-between"><dt className="text-zinc-500">Price</dt><dd className="font-mono font-medium tracking-[0.08em] text-lime-300">${b.price}</dd></div>
          )}
          {(b.travelFee ?? 0) > 0 && (
            <div className="flex justify-between"><dt className="text-zinc-500">Travel fee</dt><dd className="font-mono tracking-[0.08em] text-zinc-200">${b.travelFee}</dd></div>
          )}
          <div className="flex justify-between">
            <dt className="text-zinc-500">Payment</dt>
            <dd className={`flex items-center gap-1.5 text-xs font-semibold ${b.paymentStatus === "held" ? "text-lime-300" : b.paymentStatus === "released" ? "text-lime-300" : b.paymentStatus === "refunded" ? "text-zinc-400" : "text-zinc-500"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${b.paymentStatus === "held" || b.paymentStatus === "released" ? "bg-lime-400" : "bg-zinc-600"}`} />
              {b.paymentStatus === "held" ? "Secured" : b.paymentStatus === "released" ? "Released" : b.paymentStatus === "refunded" ? "Refunded" : "Not paid yet"}
            </dd>
          </div>
          {b.status === "reschedule_requested" && b.proposedStartsAt && (
            <div className="flex justify-between border-t border-line-soft pt-1.5">
              <dt className="text-violet-300">Proposed time</dt>
              <dd className="font-mono text-xs tracking-[0.08em] text-violet-300">
                {new Date(b.proposedStartsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {fmtTime(b.proposedStartsAt)}
              </dd>
            </div>
          )}
        </dl>

        {/* live progress — real progress_updates rows; the provider posts
            updates HERE (the workspace), the client sees them instantly */}
        {["accepted", "confirmed", "completed"].includes(b.status) && <BookingProgressPanel b={b} />}

        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-rose-300">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {error}
          </p>
        )}

        {/* actions by role × status — the server enforces them anyway */}
        <div className="mt-4 space-y-1.5">
          {b.status === "pending" && b.myRole === "provider" && (
            <div className="flex gap-1.5">
              <button disabled={busy} onClick={() => act("accept")} className="btn-lime flex-1 justify-center py-2 text-xs">Accept</button>
              <button disabled={busy} onClick={() => act("decline")} className="flex-1 rounded-full border border-line py-2 text-xs font-semibold text-zinc-400 hover:border-rose-400/40 hover:text-rose-300">Decline</button>
            </div>
          )}
          {b.status === "pending" && b.myRole === "client" && (
            <p className="text-xs text-zinc-500">Waiting for {b.with.displayName} to accept your request.</p>
          )}
          {b.status === "accepted" && b.myRole === "client" && (
            <button disabled={busy} onClick={() => act("pay")} className="btn-lime w-full justify-center py-2 text-sm">
              Pay ${((b.price + (b.travelFee ?? 0)) * 1.05).toFixed(2)} — secures the booking
            </button>
          )}
          {b.status === "accepted" && b.myRole === "provider" && (
            <p className="text-xs text-zinc-500">Accepted — waiting for the client&apos;s payment.</p>
          )}
          {b.status === "reschedule_requested" && (
            <div className="flex gap-1.5">
              <button disabled={busy} onClick={() => act("reschedule_decide", { approve: true })} className="flex-1 rounded-full bg-violet-400 py-2 text-xs font-semibold text-zinc-950 hover:bg-violet-300">Approve new time</button>
              <button disabled={busy} onClick={() => act("reschedule_decide", { approve: false })} className="flex-1 rounded-full border border-line py-2 text-xs font-semibold text-zinc-400">Keep original</button>
            </div>
          )}
          {b.status === "confirmed" && b.myRole === "provider" && (
            <div>
              <button
                disabled={busy}
                onClick={() => act("complete")}
                className="btn-lime w-full justify-center py-2 text-xs"
                title={`The customer's payment is secured. When you mark the service completed, the secured $${b.price + (b.travelFee ?? 0)} is released to you.`}
              >
                Mark completed — release ${b.price + (b.travelFee ?? 0)} to me
              </button>
              <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500">
                The customer&apos;s payment is secured. When you mark the service completed, the secured
                ${b.price + (b.travelFee ?? 0)} is released <span className="font-semibold text-zinc-400">to you</span>.
              </p>
            </div>
          )}

          {["accepted", "confirmed"].includes(b.status) && (
            !reschedOpen ? (
              <button onClick={() => setReschedOpen(true)} className="w-full rounded-full border border-line py-2 text-xs font-medium text-zinc-400 transition hover:border-violet-400/40 hover:text-violet-300">
                Reschedule
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-line bg-card-raised p-2.5">
                <input type="datetime-local" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs text-zinc-100 outline-none" />
                <button disabled={busy || !newTime} onClick={async () => { await act("reschedule_request", { newStartsAt: newTime }); setReschedOpen(false); }} className="rounded-full bg-violet-400 px-3 py-1.5 text-[11px] font-semibold text-zinc-950 disabled:opacity-40">
                  Propose
                </button>
              </div>
            )
          )}

          <div className="flex gap-1.5 border-t border-line-soft pt-2.5">
            <Link href={`/messages?to=${b.with.handle}`} className="btn-ghost flex-1 justify-center py-2 text-xs">
              <MessageSquare className="h-3.5 w-3.5" /> Message {b.myRole === "provider" ? "client" : "provider"}
            </Link>
            {["pending", "accepted", "confirmed", "reschedule_requested"].includes(b.status) && (
              <button disabled={busy} onClick={() => act("cancel")} className="flex-1 rounded-full border border-line py-2 text-xs font-semibold text-zinc-500 transition hover:border-rose-400/40 hover:text-rose-300">
                Cancel booking
              </button>
            )}
          </div>
          <p className="pt-1 text-center text-[10px] text-zinc-600">
            <Clock className="mr-1 inline h-3 w-3 align-[-2px]" />
            Confirmed bookings are paid up front and released when the provider marks them complete.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- booking progress panel ----------------------
   The PROVIDER keeps the client informed from inside the booking
   workspace: status, percent, message, and estimated completion — all
   stored as real progress_updates rows. The client sees the latest
   update and the full history; Activity and the conversation mirror
   the events, but the controls live here. */

const BOOKING_PROGRESS_OPTIONS = [
  ["not_started", "Not started"],
  ["preparing", "Preparing"],
  ["in_progress", "In progress"],
  ["waiting_on_client", "Waiting on client"],
  ["finalizing", "Finalizing"],
  ["ready_for_review", "Ready for review"],
  ["completed", "Completed"],
] as const;

function BookingProgressPanel({ b }: { b: Booking }) {
  const [progress, setProgress] = useState<{
    latest: { statusLabel: string; percent: number | null; message: string; at: string } | null;
    etaAt: string | null;
    updates: { id: string; kind: string; statusLabel: string; percent: number | null; message: string; etaAt: string | null; at: string; mine: boolean }[];
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("in_progress");
  const [percent, setPercent] = useState("");
  const [message, setMessage] = useState("");
  const [etaDate, setEtaDate] = useState("");
  const [etaTime, setEtaTime] = useState("17:00");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/bookings/${b.id}/progress`, { cache: "no-store" });
    if (res.ok) setProgress((await res.json()).progress);
  }, [b.id]);
  useEffect(() => {
    load();
  }, [load]);

  const post = async () => {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/bookings/${b.id}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "update",
        status,
        percent: percent === "" ? null : Number(percent),
        message,
        etaAt: combineEta(etaDate, etaTime),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(d.error || "Couldn't post the update");
    setOpen(false);
    setMessage("");
    setPercent("");
    setEtaDate("");
    setEtaTime("17:00");
    load();
  };

  const latest = progress?.latest ?? null;
  const canPost = b.myRole === "provider" && ["accepted", "confirmed"].includes(b.status);
  if (!latest && !canPost) return null;

  const agoTxt = (iso: string) => {
    const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  return (
    <div className="mt-3 rounded-xl border border-line bg-card-raised p-3.5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Progress</p>
        {latest && <span className="font-mono text-[10px] tracking-[0.08em] text-zinc-600">updated {agoTxt(latest.at)}</span>}
      </div>
      {latest ? (
        <>
          <div className="mt-2 flex items-center gap-2.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/40">
              <div className="h-full rounded-full bg-lime-400 transition-all" style={{ width: `${latest.percent ?? 0}%` }} />
            </div>
            <span className="font-mono text-xs font-bold tracking-[0.08em] text-lime-300">
              {latest.percent != null ? `${latest.percent}%` : "—"}
            </span>
          </div>
          <p className="mt-1.5 text-xs font-semibold text-zinc-200">{latest.statusLabel}{latest.percent != null ? ` — ${latest.percent}% complete` : ""}</p>
          {latest.message && <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">&ldquo;{latest.message}&rdquo;</p>}
          {progress?.etaAt && (
            <p className="mt-1 text-[11px] text-zinc-500">
              Est. completion:{" "}
              <span className="font-mono tracking-[0.08em] text-zinc-300">{fmtEta(progress.etaAt)}</span>
            </p>
          )}
        </>
      ) : (
        <p className="mt-1.5 text-xs text-zinc-500">No updates yet — keep {b.with.displayName.split(" ")[0]} in the loop.</p>
      )}

      {canPost && !open && (
        <button onClick={() => setOpen(true)} className="btn-ghost mt-2.5 w-full justify-center py-1.5 text-xs">
          <Send className="h-3.5 w-3.5" /> Post progress update
        </button>
      )}
      {canPost && open && (
        <div className="mt-2.5 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                const d = defaultPercentFor(e.target.value);
                if (d != null) setPercent(String(d));
              }}
              className="input-dark py-1.5 text-xs"
            >
              {BOOKING_PROGRESS_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input
              type="number" min={0} max={100} step={1} inputMode="numeric" value={percent}
              onChange={(e) => setPercent(clampPercent(e.target.value))}
              placeholder="% complete (0–100)" className="input-dark py-1.5 text-xs"
              aria-label="Percent complete, 0 to 100"
            />
          </div>
          <textarea
            value={message} onChange={(e) => setMessage(e.target.value)} rows={2}
            placeholder="What are you currently working on?"
            className="input-dark w-full resize-none py-1.5 text-xs"
          />
          <EtaPicker date={etaDate} time={etaTime} onDate={setEtaDate} onTime={setEtaTime} />
          <UpdatePreview percent={percent} message={message} etaIso={combineEta(etaDate, etaTime)} />
          {err && <p className="text-xs font-medium text-rose-300">{err}</p>}
          <div className="flex gap-1.5">
            <button disabled={busy} onClick={post} className="btn-lime flex-1 justify-center py-1.5 text-xs">Post update</button>
            <button onClick={() => setOpen(false)} className="btn-ghost flex-1 justify-center py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
