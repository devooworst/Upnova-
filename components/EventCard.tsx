"use client";

import { useState } from "react";
import { MapPin, CalendarDays, Clock, Users, Ticket, Check } from "lucide-react";
import ReachBadge from "./ReachBadge";
import { events } from "@/lib/data";

export default function EventCard({ id }: { id: string }) {
  const [going, setGoing] = useState(false);
  const event = events.find((e) => e.id === id);
  if (!event) return null;

  return (
    <article className="card overflow-hidden">
      <div className={`relative flex h-28 items-center justify-center bg-gradient-to-br ${event.gradient}`}>
        <span className="text-5xl drop-shadow-lg" aria-hidden>
          {event.emoji}
        </span>
        <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {event.price}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <h3 className="font-display text-base font-bold text-zinc-50">{event.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{event.description}</p>

        <ul className="mt-3 space-y-1.5 text-sm text-zinc-300">
          <li className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-zinc-300" /> {event.location}
          </li>
          <li className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-amber-400" /> {event.date}
          </li>
          <li className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" /> {event.time}
          </li>
          <li className="flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-400" /> {event.attending + (going ? 1 : 0)} attending
          </li>
        </ul>

        <div className="mt-3">
          <ReachBadge info={event.reach} />
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-line-soft pt-4">
          <button
            onClick={() => setGoing(!going)}
            className={
              going
                ? "btn-ghost border-amber-400/40 text-amber-300"
                : "inline-flex items-center justify-center gap-1.5 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 active:scale-[0.98]"
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
        </div>
      </div>
    </article>
  );
}
