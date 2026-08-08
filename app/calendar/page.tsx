"use client";

import { useState } from "react";
import { Clock, MapPin, Plus } from "lucide-react";
import Avatar from "@/components/Avatar";
import { bookings, reliability } from "@/lib/data";

/* August 2026: starts on a Saturday, 31 days. Today is Fri Aug 7. */
const FIRST_WEEKDAY = 6; // 0 = Sunday
const DAYS = 31;
const TODAY = 7;
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function CalendarPage() {
  const [selected, setSelected] = useState<number | null>(null);

  const byDay = new Map<number, (typeof bookings)[number][]>();
  bookings.forEach((b) => byDay.set(b.day, [...(byDay.get(b.day) ?? []), b]));

  const shown = selected === null ? bookings : bookings.filter((b) => b.day === selected);

  const confirmed = bookings
    .filter((b) => b.status === "confirmed")
    .reduce((n, b) => n + (Number(b.price.replace(/[^0-9.]/g, "")) || 0), 0);
  const pending = bookings
    .filter((b) => b.status === "pending")
    .reduce((n, b) => n + (Number(b.price.replace(/[^0-9.]/g, "")) || 0), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-500">
          August 2026 · {bookings.length} booked
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Bookings</h1>
          <button className="btn-lime px-4 py-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Open a slot
          </button>
        </div>
        <p className="mt-1.5 text-sm text-zinc-500">
          Your service calendar: what&apos;s booked, what&apos;s pending, and what it pays.
        </p>
      </header>

      {/* work performance — the private professional dashboard */}
      <section className="card-money p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Work Performance</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/40 bg-lime-400/10 px-2.5 py-0.5 text-[11px] font-bold text-lime-300">
            <span className="h-1.5 w-1.5 rounded-full bg-lime-400" /> Reliable Creator
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[
            [`${reliability.onTimeRate}%`, "on-time"],
            [`${reliability.completed}`, "completed"],
            [`${reliability.onTime}`, "on time"],
            [`${reliability.extensions}`, "extension"],
            [`${reliability.rating}★`, "client rating"],
            [`${reliability.responseRate}%`, "response rate"],
          ].map(([v, k]) => (
            <div key={k as string}>
              <p className="text-lg font-extrabold tabular-nums tracking-tight text-zinc-50">{v}</p>
              <p className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500">{k}</p>
            </div>
          ))}
        </div>
        <div className="mt-2.5 border-t border-line-soft pt-2.5">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
            how deadlines are recorded — communication protects your record
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
            {([
              ["bg-lime-400", "On time"],
              ["bg-amber-400", "Extension approved — no penalty"],
              ["bg-orange-400", "Late, communicated"],
              ["bg-red-400", "Late, silent — affects standing"],
            ] as [string, string][]).map(([c, t]) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${c}`} /> {t}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-2.5 border-t border-line-soft pt-2 text-[10px] leading-relaxed text-zinc-600">
          This record is private to you. Publicly, clients only see the summary: Reliable
          Creator · {reliability.onTimeRate}% on time. Reliability adjusts visibility and access
          to higher-value work — it never brands anyone. Clients build reliability too: repeated
          cancellations, scope changes, or refused deliveries affect their standing the same way.
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* ------- month grid: money DNA, this is where income lives ------- */}
        <section className="card-money self-start p-5">
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((d, i) => (
              <span
                key={`${d}-${i}`}
                className="pb-1 font-mono text-[10px] font-medium uppercase text-zinc-500"
              >
                {d}
              </span>
            ))}
            {Array.from({ length: FIRST_WEEKDAY }).map((_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {Array.from({ length: DAYS }, (_, i) => i + 1).map((day) => {
              const dayBookings = byDay.get(day);
              const isToday = day === TODAY;
              const isSelected = day === selected;
              return (
                <button
                  key={day}
                  onClick={() => setSelected(isSelected ? null : day)}
                  aria-pressed={isSelected}
                  className={`relative flex h-9 flex-col items-center justify-center rounded-md text-sm transition ${
                    isSelected
                      ? "bg-white font-semibold text-zinc-950"
                      : isToday
                      ? "border border-white/40 font-semibold text-zinc-50"
                      : day < TODAY
                      ? "text-zinc-600 hover:bg-card-raised"
                      : "text-zinc-300 hover:bg-card-raised"
                  }`}
                >
                  {day}
                  {dayBookings && (
                    <span className="absolute bottom-1 flex gap-0.5">
                      {dayBookings.map((b) => (
                        <span
                          key={b.id}
                          className={`h-1 w-1 rounded-full ${
                            isSelected
                              ? "bg-zinc-950"
                              : b.status === "confirmed"
                              ? "bg-lime-400"
                              : "bg-amber-400"
                          }`}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* receipt total */}
          <div className="mt-4">
            <div className="border-t border-zinc-600" />
            <div className="mt-[3px] border-t border-zinc-600" />
            <p className="mt-2.5 flex items-baseline justify-between">
              <span className="text-base font-extrabold tracking-tight tabular-nums text-lime-400">
                ${confirmed.toLocaleString()}
              </span>
              <span className="text-xs text-zinc-400">
                booked this month
                {pending > 0 && (
                  <span className="text-amber-400"> · ${pending} pending</span>
                )}
              </span>
            </p>
          </div>

          <div className="mt-3 flex items-center gap-4 font-mono text-[10px] font-medium text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-400" /> confirmed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> pending
            </span>
          </div>
        </section>

        {/* ------- booking list: ticket rows ------- */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-bold tracking-tight text-zinc-100">
              {selected === null ? "Upcoming" : `August ${selected}`}
            </h2>
            {selected !== null && (
              <button
                onClick={() => setSelected(null)}
                className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 transition hover:text-zinc-200"
              >
                show all
              </button>
            )}
          </div>

          {shown.length === 0 && (
            <p className="card-money p-5 text-sm text-zinc-500">
              Nothing booked on August {selected}. Open a slot and let clients grab it.
            </p>
          )}

          {shown.map((b) => (
            <article key={b.id} className="card-money overflow-hidden">
              <div className="flex items-stretch">
                {/* date stub */}
                <div className="flex w-16 shrink-0 flex-col items-center justify-center border-r border-dashed border-zinc-700/60 bg-lime-400/[0.05] py-4">
                  <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-lime-400">
                    Aug
                  </span>
                  <span className="text-2xl font-extrabold leading-tight text-zinc-50">
                    {b.day}
                  </span>
                </div>
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar
                        src={b.clientAvatar}
                        initials={b.initials}
                        gradient={b.gradient}
                        size="sm"
                        className="ring-1 ring-line"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-100">{b.client}</p>
                        <p className="truncate text-xs text-zinc-500">{b.service}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[15px] font-bold tracking-tight tabular-nums text-lime-400">
                        {b.price}
                      </p>
                      <p
                        className={`mt-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] ${
                          b.status === "confirmed" ? "text-lime-400/80" : "text-amber-400"
                        }`}
                      >
                        {b.status}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-zinc-500" />
                      {b.time} · {b.duration}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                      {b.location}
                    </span>
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
