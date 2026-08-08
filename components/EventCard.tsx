"use client";

import { useState } from "react";
import { MapPin, Users, Ticket, Check } from "lucide-react";
import Image from "next/image";
import Perforation from "./Perforation";
import { events } from "@/lib/data";

const MONTHS: Record<string, string> = {
  January: "JAN", February: "FEB", March: "MAR", April: "APR",
  May: "MAY", June: "JUN", July: "JUL", August: "AUG",
  September: "SEP", October: "OCT", November: "NOV", December: "DEC",
};

export default function EventCard({ id }: { id: string }) {
  const [going, setGoing] = useState(false);
  const event = events.find((e) => e.id === id);
  if (!event) return null;

  const m = event.date.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d+)/
  );
  const [mon, day] = m ? [MONTHS[m[1]], m[2]] : ["", ""];
  const weekday = event.date.split(",")[0];

  return (
    <article className="card-event relative overflow-hidden">
      <div
        className={`relative h-28 overflow-hidden ${
          event.image ? "" : `flex items-center justify-center bg-gradient-to-br ${event.gradient}`
        }`}
      >
        {event.image ? (
          <>
            <Image src={event.image} alt="" fill sizes="640px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          </>
        ) : (
          <span className="text-4xl drop-shadow-lg" aria-hidden>
            {event.emoji}
          </span>
        )}
        <span className="absolute right-3 top-3 rounded-md bg-black/55 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-white backdrop-blur">
          {event.price}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          {/* date block — overlaps the banner like a real events app */}
          <div className="-mt-11 flex w-14 shrink-0 flex-col items-center rounded-lg border border-line bg-card-raised py-2 shadow-card">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-400">
              {mon}
            </span>
            <span className="text-2xl font-extrabold leading-none text-zinc-50">
              {day}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400">
              {weekday} · {event.time}
            </p>
            <h3 className="mt-1 text-lg font-extrabold tracking-tight text-zinc-50">
              {event.title}
            </h3>
          </div>
        </div>

        <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">{event.description}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-zinc-300">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-zinc-500" /> {event.location}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-violet-400" /> {event.attending + (going ? 1 : 0)} attending
          </span>
        </div>

        <Perforation className="mt-4" />

        {/* RSVP stub */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => setGoing(!going)}
            className={
              going
                ? "inline-flex items-center justify-center gap-1.5 rounded-full border border-amber-400/40 px-5 py-2 text-sm font-semibold text-amber-300"
                : "inline-flex items-center justify-center gap-1.5 rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-zinc-950 transition hover:bg-amber-300 active:scale-[0.98]"
            }
          >
            {going ? (
              <>
                <Check className="h-4 w-4" /> You&apos;re going
              </>
            ) : (
              <>
                <Ticket className="h-4 w-4" /> Get Tickets
              </>
            )}
          </button>
          <span className="text-xs text-zinc-500">Hosted by {event.host}</span>
          <span className="ml-auto hidden font-mono text-[9px] uppercase tracking-[0.25em] text-zinc-600 sm:block">
            admit one
          </span>
        </div>
      </div>
    </article>
  );
}
