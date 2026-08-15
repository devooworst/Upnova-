"use client";

/* ------------------------------------------------------------------ */
/*  AvailabilityStrip — the honest booking calendar.                   */
/*                                                                     */
/*  Shows the FUTURE, not just the bookable present: released dates    */
/*  in green, limited days in amber, unreleased periods shaded (not    */
/*  hidden!), closed days and fully-booked days visually distinct.     */
/*  Clicking any date explains WHY it has that state — "Bookings for   */
/*  this date aren't open yet. This provider opens bookings for this   */
/*  period on August 18." Never a bare "unavailable".                  */
/*  Used on the public service page AND the provider dashboard —       */
/*  one component, one truth.                                          */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { Lock, CalendarX2, Star } from "lucide-react";

interface Day {
  date: string;
  status: "available" | "limited" | "early_access" | "not_released" | "outside_horizon" | "booking_closed" | "fully_booked";
  opensAt?: string;
  publicAt?: string;
  note?: string;
}

const STYLE: Record<Day["status"], string> = {
  available: "bg-lime-400/25 border-lime-400/40 text-lime-200 hover:border-lime-300",
  limited: "bg-amber-400/20 border-amber-400/40 text-amber-200 hover:border-amber-300",
  early_access: "bg-violet-400/20 border-violet-400/40 text-violet-200 hover:border-violet-300",
  not_released: "bg-zinc-800/60 border-zinc-700/50 text-zinc-500 [background-image:repeating-linear-gradient(45deg,transparent_0_3px,rgba(255,255,255,0.04)_3px_6px)] hover:border-zinc-500",
  outside_horizon: "bg-zinc-800/60 border-zinc-700/50 text-zinc-500 [background-image:repeating-linear-gradient(45deg,transparent_0_3px,rgba(255,255,255,0.04)_3px_6px)] hover:border-zinc-500",
  booking_closed: "bg-zinc-900/70 border-zinc-800 text-zinc-700",
  fully_booked: "bg-rose-400/15 border-rose-400/35 text-rose-300 hover:border-rose-300",
};

const fmtDay = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const fmtAt = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function explain(d: Day): string {
  switch (d.status) {
    case "available":
      return `${fmtDay(d.date)} — available to book.`;
    case "limited":
      return `${fmtDay(d.date)} — limited availability: this day already has bookings, some times remain.`;
    case "early_access":
      return `${fmtDay(d.date)} — Preferred Clients book first.${d.publicAt ? ` Opens to everyone ${fmtAt(d.publicAt)}.` : ""}`;
    case "not_released":
      return d.opensAt
        ? `Bookings for this date aren't open yet. This provider opens bookings for this period on ${fmtAt(d.opensAt)}.${d.note ? ` ${d.note}` : ""}`
        : "This date hasn't been released for booking yet.";
    case "outside_horizon":
      return `${fmtDay(d.date)} is beyond this provider's booking window.${d.opensAt ? ` It becomes bookable ${fmtAt(d.opensAt)}.` : ""}`;
    case "booking_closed":
      return `${fmtDay(d.date)} — ${d.note ?? "the provider doesn't take bookings on this date."}`;
    case "fully_booked":
      return `${fmtDay(d.date)} — fully booked. ${d.note ?? "A cancellation reopens booking automatically."}`;
  }
}

export default function AvailabilityStrip({
  serviceId,
  days = 42,
  onSelectDate,
  selectedDate,
}: {
  serviceId: string;
  days?: number;
  /** date-selection mode: bookable dates become pickable (step 1 of the
      booking flow); non-bookable dates still explain themselves */
  onSelectDate?: (date: string) => void;
  selectedDate?: string | null;
}) {
  const [data, setData] = useState<Day[] | null>(null);
  const [picked, setPicked] = useState<Day | null>(null);

  useEffect(() => {
    let dead = false;
    fetch(`/api/services/${serviceId}/availability?days=${days}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!dead) setData(d.days ?? []); })
      .catch(() => { if (!dead) setData([]); });
    return () => { dead = true; };
  }, [serviceId, days]);

  if (data === null) return <div className="mt-2 h-16 animate-pulse rounded-xl bg-card-raised" />;
  if (data.length === 0) return null;

  return (
    <div data-tut="availability-strip">
      <div className="grid grid-cols-7 gap-1">
        {data.map((d) => {
          const day = new Date(d.date + "T12:00:00");
          return (
            <button
              key={d.date}
              onClick={() => {
                if (onSelectDate && ["available", "limited"].includes(d.status)) {
                  onSelectDate(d.date);
                  setPicked(null);
                  return;
                }
                setPicked(picked?.date === d.date ? null : d);
              }}
              className={`relative flex h-9 flex-col items-center justify-center rounded-md border text-[9px] font-semibold leading-tight transition ${STYLE[d.status]} ${picked?.date === d.date || selectedDate === d.date ? "ring-2 ring-lime-300" : ""}`}
              title={explain(d)}
              aria-label={explain(d)}
            >
              <span className="font-mono text-[8px] opacity-70">{day.toLocaleDateString("en-US", { weekday: "narrow" })}</span>
              <span>{day.getDate()}</span>
              {d.status === "early_access" && <Star className="absolute right-0.5 top-0.5 h-2 w-2" aria-hidden />}
              {d.status === "booking_closed" && <Lock className="absolute right-0.5 top-0.5 h-2 w-2 opacity-50" aria-hidden />}
              {d.status === "fully_booked" && <CalendarX2 className="absolute right-0.5 top-0.5 h-2 w-2" aria-hidden />}
            </button>
          );
        })}
      </div>
      {/* the WHY — one honest sentence per state */}
      {picked && (
        <p className="mt-2 rounded-lg border border-line bg-card-raised px-3 py-2 text-[11px] leading-relaxed text-zinc-300">
          {explain(picked)}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[8px] uppercase tracking-[0.1em] text-zinc-500">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-lime-400/60" /> available</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-amber-400/60" /> limited</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-violet-400/60" /> preferred first</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm border border-zinc-600 bg-zinc-800" /> not released yet</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-zinc-900 ring-1 ring-zinc-800" /> closed</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-rose-400/50" /> fully booked</span>
      </div>
    </div>
  );
}
