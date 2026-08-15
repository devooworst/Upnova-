"use client";

/* ------------------------------------------------------------------ */
/*  Event Manager — the HOST's real-lite management page.              */
/*                                                                     */
/*  Everything on this page is a real record: the event itself         */
/*  (/api/events/[id]), the attendee list (host-only                   */
/*  /api/events/[id]/attendees over eventRsvps), and the cancel        */
/*  action (PATCH, existing active|cancelled status).                  */
/*                                                                     */
/*  Ticketing, payments, QR check-in, and event analytics are NOT      */
/*  implemented yet — so they simply don't appear here. No fake tabs.  */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, MapPin, Search, Users, XCircle } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useSession } from "@/lib/session";

interface EventDetail {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  timeLabel: string;
  location: string;
  city: string;
  state: string;
  capacity: number | null;
  attending: number;
  spotsLeft: number | null;
  kind: string;
  status: string;
  isCampus: boolean;
  campusName: string | null;
  isHost: boolean;
}

interface Attendee {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  rsvpAt: string;
}

interface Counts {
  rsvps: number;
  baseline: number;
  going: number;
  capacity: number | null;
  spotsLeft: number | null;
}

export default function EventManagePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Attendee[] | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [q, setQ] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/events/${id}`, { cache: "no-store" });
    if (!res.ok) {
      setDenied("Event not found.");
      return;
    }
    const d = await res.json();
    if (!d.event?.isHost) {
      setDenied("Only the host can manage this event.");
      return;
    }
    setEvent(d.event);
    const ra = await fetch(`/api/events/${id}/attendees`, { cache: "no-store" });
    if (ra.ok) {
      const a = await ra.json();
      setAttendees(a.attendees);
      setCounts(a.counts);
    }
  }, [id]);

  useEffect(() => {
    if (user === undefined) return; // auth initializing
    if (user === null) {
      setDenied("Sign in to manage your events.");
      return;
    }
    void load();
  }, [user, load]);

  const cancelEvent = async () => {
    setBusy(true);
    const res = await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    setConfirmCancel(false);
    if (!res.ok) {
      setNote(d.error || "Couldn't cancel the event.");
      return;
    }
    setNote(`Event cancelled — ${d.notified} attendee${d.notified === 1 ? "" : "s"} notified. RSVP records are kept.`);
    void load();
  };

  if (denied) {
    return (
      <div className="mx-auto max-w-md pt-16 text-center">
        <p className="text-sm text-zinc-400">{denied}</p>
        <button onClick={() => router.push("/events")} className="btn-ghost mt-4 px-4 py-2 text-xs">
          Back to Events
        </button>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-3xl pt-10" aria-busy="true">
        <div className="h-8 w-64 animate-pulse rounded bg-card-raised" />
        <div className="mt-4 h-40 animate-pulse rounded-xl bg-card-raised" />
      </div>
    );
  }

  const cancelled = event.status === "cancelled";
  const shown = (attendees ?? []).filter(
    (a) => !q || a.displayName.toLowerCase().includes(q.toLowerCase()) || a.handle.toLowerCase().includes(q.toLowerCase())
  );
  const when = new Date(event.startsAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={`/events/${event.slug}`} className="flex w-fit items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to event page
      </Link>

      {/* event summary */}
      <header className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">event manager</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">{event.title}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-zinc-500" /> {when}
                {event.timeLabel ? ` · ${event.timeLabel}` : ""}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-zinc-500" /> {event.location || [event.city, event.state].filter(Boolean).join(", ") || "Location TBA"}
              </span>
            </p>
            {event.isCampus && (
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-600">
                Campus event · {event.campusName} — RSVP limited to verified members
              </p>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${
              cancelled ? "border-red-400/40 text-red-300" : "border-lime-400/40 text-lime-300"
            }`}
          >
            {cancelled ? "cancelled" : "active"}
          </span>
        </div>

        {/* real counts */}
        {counts && (
          <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line-soft pt-4">
            <div>
              <dd className="text-xl font-bold tabular-nums text-zinc-50">{counts.going}</dd>
              <dt className="text-xs text-zinc-500">going{counts.baseline > 0 ? ` (${counts.rsvps} RSVPs + ${counts.baseline} baseline)` : ""}</dt>
            </div>
            <div>
              <dd className="text-xl font-bold tabular-nums text-zinc-50">{counts.capacity ?? "—"}</dd>
              <dt className="text-xs text-zinc-500">capacity</dt>
            </div>
            <div>
              <dd className="text-xl font-bold tabular-nums text-zinc-50">{counts.spotsLeft ?? "—"}</dd>
              <dt className="text-xs text-zinc-500">spots left</dt>
            </div>
          </dl>
        )}
      </header>

      {note && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-2.5 text-sm text-amber-200">
          {note}
          <button onClick={() => setNote(null)} className="float-right text-amber-300/60 hover:text-amber-200">✕</button>
        </div>
      )}

      {/* attendees — real RSVP records, host-only */}
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-50">
            <Users className="h-4 w-4 text-zinc-400" /> Attendees
            {attendees !== null && <span className="font-mono text-[10px] text-zinc-500">{attendees.length} RSVP{attendees.length === 1 ? "" : "s"}</span>}
          </h2>
        </div>

        {attendees !== null && attendees.length > 3 && (
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search attendees…"
              className="input-dark w-full pl-9"
            />
          </div>
        )}

        {attendees === null ? (
          <div className="mt-3 h-16 animate-pulse rounded-xl bg-card-raised" aria-busy="true" />
        ) : attendees.length === 0 ? (
          <p className="mt-4 pb-2 text-center text-xs leading-relaxed text-zinc-500">
            No RSVPs yet — attendees appear here the moment someone taps Going.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line-soft">
            {shown.map((a) => (
              <li key={a.handle} className="flex items-center gap-3 py-2.5">
                <Avatar src={a.avatarUrl} initials={a.displayName.charAt(0)} size="sm" className="ring-1 ring-line" />
                <div className="min-w-0 flex-1">
                  <Link href={`/creator/${a.handle}`} className="truncate text-sm font-semibold text-zinc-100 hover:text-violet-300">
                    {a.displayName}
                  </Link>
                  <p className="truncate text-xs text-zinc-500">@{a.handle}</p>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-zinc-600">
                  {new Date(a.rsvpAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
            {shown.length === 0 && <li className="py-4 text-center text-xs text-zinc-500">No attendees match that search.</li>}
          </ul>
        )}
      </section>

      {/* host controls */}
      {!cancelled && (
        <section className="card p-5">
          <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Host controls</h2>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-500/[0.04] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-zinc-200">Cancel this event</p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                Everyone who RSVPed is notified. The event and all RSVP records are kept — nothing is deleted.
              </p>
            </div>
            {confirmCancel ? (
              <span className="flex shrink-0 gap-2">
                <button
                  onClick={() => void cancelEvent()}
                  disabled={busy}
                  className="rounded-full bg-red-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-red-400 disabled:opacity-50"
                >
                  {busy ? "Cancelling…" : "Confirm cancel"}
                </button>
                <button onClick={() => setConfirmCancel(false)} className="btn-ghost px-3.5 py-1.5 text-xs">
                  Keep it
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmCancel(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-red-400/40 px-3.5 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
              >
                <XCircle className="h-3.5 w-3.5" /> Cancel event
              </button>
            )}
          </div>
        </section>
      )}

      <p className="text-center text-[10px] leading-relaxed text-zinc-600">
        Ticket sales, check-in, and event payouts arrive with paid ticketing.
      </p>
    </div>
  );
}
