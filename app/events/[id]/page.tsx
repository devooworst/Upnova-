"use client";

/* ------------------------------------------------------------------ */
/*  Event detail — database-backed. Campus events are served only to    */
/*  verified members of that campus (the API enforces it; this page     */
/*  just renders the refusal honestly).                                 */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Calendar, MapPin, Users, Bookmark, Check, GraduationCap,
  Ticket, Lock, MessageSquare, ClipboardList,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { promptJoin } from "@/components/GuestGate";
import { kindLabel } from "@/lib/events";

interface EventDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  startsAt: string;
  timeLabel: string;
  location: string;
  city: string;
  price: number | null;
  capacity: number | null;
  attending: number;
  spotsLeft: number | null;
  imageUrl: string | null;
  kind: string;
  ageRule: string;
  config: { fields?: string[]; rules?: string[]; waitlist?: boolean };
  isCampus: boolean;
  campusName: string | null;
  host: string;
  hostHandle: string;
  isHost: boolean;
  saved: boolean;
  going: boolean;
  distanceMi: number | null;
}

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useSession();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/events/${id}`, { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) return setErr(j.error || "Event not found");
    setEvent(j.event);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleGoing = async () => {
    if (!user) return promptJoin("tickets", `/events/${id}`);
    const res = await fetch(`/api/events/${id}`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(j.error || "Couldn't update");
    load();
  };

  const toggleSave = async () => {
    if (!user) return promptJoin("save", `/events/${id}`);
    await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "event", targetId: event?.id }),
    });
    load();
  };

  if (err)
    return (
      <div className="mx-auto max-w-xl pt-16 text-center">
        <Lock className="mx-auto h-8 w-8 text-zinc-600" />
        <p className="mt-3 text-sm text-zinc-400">{err}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/events" className="rounded-full border border-zinc-700 px-4 py-1.5 text-xs font-semibold text-zinc-300">All events</Link>
          <Link href="/campus" className="rounded-full border border-zinc-700 px-4 py-1.5 text-xs font-semibold text-zinc-300">Your Campus</Link>
        </div>
      </div>
    );
  if (!event)
    return <p className="py-16 text-center font-mono text-[11px] tracking-[0.1em] text-zinc-600">LOADING…</p>;

  const d = new Date(event.startsAt);
  const full = event.spotsLeft != null && event.spotsLeft <= 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={event.isCampus ? "/campus" : "/events"}
        className="inline-flex items-center gap-1 px-1 font-mono text-[11px] tracking-[0.1em] text-zinc-500 hover:text-amber-300"
      >
        <ArrowLeft className="h-3 w-3" /> {event.isCampus ? "YOUR CAMPUS" : "EVENTS"}
      </Link>

      <article className="card-event overflow-hidden">
        <div className="relative aspect-[16/8]">
          {event.imageUrl ? (
            <Image src={event.imageUrl} alt={event.title} fill sizes="672px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-card-raised">
              <Calendar className="h-10 w-10 text-zinc-700" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <span className="absolute left-4 top-4 flex flex-col items-center rounded-lg border border-amber-400/40 bg-ink/80 px-3 py-2 backdrop-blur">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-400">{MON[d.getMonth()]}</span>
            <span className="text-xl font-extrabold leading-tight text-zinc-50">{d.getDate()}</span>
          </span>
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-ink/80 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-300 backdrop-blur">{event.category}</span>
              {event.isCampus && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-400/90 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-950">
                  <GraduationCap className="h-3 w-3" /> {event.campusName ?? "Campus"}
                </span>
              )}
              <span className="rounded bg-ink/80 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-300 backdrop-blur">
                {event.price != null ? `$${event.price}` : "FREE"}{event.ageRule !== "all" ? ` · ${event.ageRule}` : ""}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-50">{event.title}</h1>
            <p className="mt-0.5 text-sm text-zinc-300">
              Hosted by{" "}
              <Link href={`/creator/${event.hostHandle}`} className="font-semibold text-amber-300 hover:text-amber-200">
                {event.host}
              </Link>
              {event.isHost && <span className="ml-1.5 font-mono text-[9px] tracking-[0.1em] text-zinc-400">YOU</span>}
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {msg && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              {msg}
              <button onClick={() => setMsg(null)} className="float-right text-amber-300/60">✕</button>
            </div>
          )}

          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{event.description}</p>

          <div className="grid gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 text-[13px] text-zinc-300 sm:grid-cols-2">
            <span className="inline-flex items-center gap-2"><Calendar className="h-4 w-4 text-amber-400" /> {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {event.timeLabel}</span>
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-amber-400" /> {event.location}
              {event.distanceMi != null && <span className="font-mono text-[11px] text-amber-300/80">{event.distanceMi} mi away</span>}
            </span>
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-400" /> {event.attending} going
              {event.capacity != null && <span className="text-zinc-500">of {event.capacity}</span>}
              {full && <span className="font-mono text-[10px] tracking-[0.1em] text-red-300">FULL</span>}
            </span>
            <span className="inline-flex items-center gap-2"><Ticket className="h-4 w-4 text-amber-400" /> {kindLabel(event.kind)}</span>
          </div>

          {(event.config.rules?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-zinc-800 p-3.5">
              <p className="mb-1.5 font-mono text-[10px] tracking-[0.14em] text-zinc-500">EVENT RULES</p>
              <ul className="space-y-1 text-xs text-zinc-400">
                {event.config.rules!.map((r, i) => (
                  <li key={i}>· {r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ---------------- actions per entry model ---------------- */}
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800/60 pt-4">
            {(event.kind === "rsvp" || event.kind === "registration") && !event.isHost && (
              <button
                onClick={toggleGoing}
                disabled={full && !event.going}
                className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-bold transition disabled:opacity-40 ${
                  event.going ? "border border-lime-400/50 text-lime-300" : "bg-amber-400 text-zinc-950 hover:bg-amber-300"
                }`}
              >
                <Check className="h-4 w-4" />
                {event.going ? "You're going — tap to cancel" : event.kind === "registration" ? "Register" : "RSVP — I'm going"}
              </button>
            )}
            {event.kind === "ticket" && !event.isHost && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/5 px-4 py-2 font-mono text-[11px] tracking-[0.06em] text-amber-200">
                <Ticket className="h-3.5 w-3.5" /> ${event.price} — ticket checkout is coming; save the event meanwhile
              </span>
            )}
            {event.kind === "approval" && !event.isHost && (
              <Link
                href={`/messages?to=${event.hostHandle}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-zinc-950 hover:bg-amber-300"
              >
                <MessageSquare className="h-4 w-4" /> Request to attend
              </Link>
            )}
            {event.isHost && (
              <Link
                href={`/events/${event.slug}/manage`}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-4 py-2 font-mono text-[11px] tracking-[0.06em] text-zinc-300 transition hover:border-lime-400/50 hover:text-lime-300"
              >
                <ClipboardList className="h-3.5 w-3.5" /> You&apos;re hosting — {event.attending} going · Manage
              </Link>
            )}
            <button
              onClick={toggleSave}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                event.saved ? "border-violet-400/50 text-violet-300" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${event.saved ? "fill-violet-300" : ""}`} /> {event.saved ? "Saved" : "Save"}
            </button>
          </div>

          {event.isCampus && (
            <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.08em] text-zinc-600">
              Campus event — visible to verified {event.campusName} members only. It never appears in the public Events section.
            </p>
          )}
        </div>
      </article>
    </div>
  );
}
