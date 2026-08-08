"use client";

/* ------------------------------------------------------------------ */
/*  Bookings — a live view over the SAME records the rest of the app   */
/*  uses. Engagements are projects (one shared project id — View       */
/*  Project opens the exact same record Messages drives), sessions     */
/*  are booking rows. States update automatically as projects move.    */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, MapPin, ArrowRight } from "lucide-react";
import Avatar from "@/components/Avatar";

interface ProjectRow {
  id: string;
  title: string;
  amount: number;
  state: string;
  deadline: string | null;
  conversationId: string | null;
  myRole: "client" | "creator";
  with: { handle: string; displayName: string; avatarUrl: string | null };
  updatedAt: string;
}

interface BookingRow {
  id: string;
  title: string;
  startsAt: string;
  durationMin: number;
  price: number;
  location: string;
  status: string;
  myRole: "client" | "provider";
  with: { handle: string; displayName: string; avatarUrl: string | null };
}

/* project state → booking language */
const BOOKING_STATE: Record<string, { label: string; cls: string }> = {
  draft: { label: "Pending", cls: "border-line text-zinc-400" },
  offer_sent: { label: "Awaiting acceptance", cls: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  accepted: { label: "Payment required", cls: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  in_progress: { label: "Confirmed · In progress", cls: "border-violet-400/40 bg-violet-400/10 text-violet-300" },
  extension_requested: { label: "In progress · Extension pending", cls: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  submitted: { label: "Delivered", cls: "border-violet-400/40 bg-violet-400/10 text-violet-300" },
  approved: { label: "Approved", cls: "border-lime-400/40 bg-lime-400/10 text-lime-300" },
  completed: { label: "Completed", cls: "border-lime-400/40 bg-lime-400/10 text-lime-300" },
  reviewed: { label: "Completed · Reviewed", cls: "border-lime-400/40 bg-lime-400/10 text-lime-300" },
  cancelled: { label: "Cancelled", cls: "border-line text-zinc-500" },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export default function BookingsPage() {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);

  const load = useCallback(async () => {
    const [p, b] = await Promise.all([
      fetch("/api/projects", { cache: "no-store" }),
      fetch("/api/bookings", { cache: "no-store" }),
    ]);
    if (p.status === 401) {
      setProjects([]);
      setBookings([]);
      return;
    }
    setProjects((await p.json()).projects ?? []);
    setBookings((await b.json()).bookings ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = (projects ?? []).filter((p) => !["completed", "reviewed", "cancelled"].includes(p.state));
  const done = (projects ?? []).filter((p) => ["completed", "reviewed", "cancelled"].includes(p.state));
  const heldTotal = active
    .filter((p) => ["in_progress", "extension_requested", "submitted", "approved"].includes(p.state))
    .reduce((n, p) => n + p.amount, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
          <CalendarDays className="h-5 w-5 text-lime-400" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Bookings</h1>
          <p className="text-sm text-zinc-400">
            Your engagements and sessions — every card references the same project record as Messages.
          </p>
        </div>
      </div>

      {/* summary strip */}
      {projects !== null && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-line px-4 py-2.5 font-mono text-[11px] font-medium text-zinc-400">
          <span><span className="text-violet-400">{active.length}</span> active</span>
          <span><span className="text-lime-400">${heldTotal}</span> secured</span>
          <span><span className="text-zinc-200">{done.length}</span> completed</span>
          <span className="ml-auto text-zinc-600">{(bookings ?? []).length} scheduled session{(bookings ?? []).length === 1 ? "" : "s"}</span>
        </div>
      )}

      {/* engagements = projects */}
      <section>
        <h2 className="mb-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Engagements
        </h2>
        {projects === null ? (
          <div className="card h-24 animate-pulse" aria-hidden />
        ) : projects.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm font-semibold text-zinc-200">No engagements yet</p>
            <p className="mt-1 text-xs text-zinc-500">
              Hire someone from{" "}
              <Link href="/services" className="text-lime-300 hover:underline">Services</Link>{" "}
              — the project lands here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {[...active, ...done].map((p) => (
              <article key={p.id} className="card-money flex flex-wrap items-center gap-3 p-4">
                <Link href={`/creator/${p.with.handle}`}>
                  <Avatar src={p.with.avatarUrl} initials={p.with.displayName.charAt(0)} size="md" />
                </Link>
                <div className="min-w-0 flex-1">
                  <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-zinc-100">
                    {p.title}
                    <span className="font-mono text-xs font-medium tracking-[0.08em] text-lime-300">${p.amount}</span>
                  </h3>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                    {p.myRole === "client" ? "Hired" : "Client"}: {p.with.displayName}
                    {p.deadline && (
                      <span className="font-mono text-[10px] tracking-[0.08em]">
                        · DUE {fmtDate(p.deadline).toUpperCase()}
                      </span>
                    )}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${BOOKING_STATE[p.state]?.cls ?? "border-line text-zinc-400"}`}>
                  {BOOKING_STATE[p.state]?.label ?? p.state}
                </span>
                <Link href={`/projects/${p.id}`} className="btn-ghost shrink-0 px-3 py-1.5 text-[11px]">
                  View Project <ArrowRight className="h-3 w-3" />
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* scheduled sessions = bookings */}
      <section>
        <h2 className="mb-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Scheduled sessions
        </h2>
        {bookings === null ? (
          <div className="card h-20 animate-pulse" aria-hidden />
        ) : bookings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-4 text-center text-xs text-zinc-500">
            No sessions on the calendar.
          </p>
        ) : (
          <div className="space-y-2.5">
            {bookings.map((b) => (
              <article key={b.id} className="card flex flex-wrap items-center gap-3 p-4">
                <Avatar src={b.with.avatarUrl} initials={b.with.displayName.charAt(0)} size="md" />
                <div className="min-w-0 flex-1">
                  <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-zinc-100">
                    {b.title}
                    <span className="font-mono text-xs font-medium tracking-[0.08em] text-lime-300">${b.price}</span>
                  </h3>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-zinc-500">
                    <span>{b.myRole === "provider" ? "Client" : "With"}: {b.with.displayName}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtDate(b.startsAt)} ·{" "}
                      {new Date(b.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                    {b.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {b.location}
                      </span>
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    b.status === "confirmed"
                      ? "border-lime-400/40 bg-lime-400/10 text-lime-300"
                      : "border-amber-400/40 bg-amber-400/10 text-amber-300"
                  }`}
                >
                  {b.status}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
