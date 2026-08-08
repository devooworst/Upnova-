"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Briefcase, MapPin } from "lucide-react";
import Avatar from "./Avatar";
import { opportunities, creators, events, type RadiusId } from "@/lib/data";

const MONTHS: Record<string, string> = {
  January: "JAN", February: "FEB", March: "MAR", April: "APR",
  May: "MAY", June: "JUN", July: "JUL", August: "AUG",
  September: "SEP", October: "OCT", November: "NOV", December: "DEC",
};

function monthDay(date: string): [string, string] {
  const m = date.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d+)/);
  return m ? [MONTHS[m[1]], m[2]] : ["", ""];
}

export default function RightSidebar({ radius }: { radius: RadiusId }) {
  const [followed, setFollowed] = useState<Record<string, boolean>>({});

  const inRange = (d?: number) =>
    radius === "city" ? true : d !== undefined && d <= Number(radius);

  const nearOpps = opportunities.filter((o) => inRange(o.distanceMi));
  const nearPeople = creators.filter((c) => inRange(c.distanceMi)).slice(0, 3);
  const nearEvents = events.slice(0, 2);

  const total = nearOpps.reduce(
    (sum, o) => sum + (Number(o.budget.replace(/[^0-9.]/g, "")) || 0),
    0
  );

  return (
    <aside className="sticky top-20 hidden w-80 shrink-0 space-y-5 self-start xl:block">
      {/* ---- money: receipt. sharp corners, lime rule, mono, dashed rows ---- */}
      <section className="card-money px-5 pb-5 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Open money</h2>
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            {radius === "city" ? "city +" : `≤ ${radius} mi`}
          </span>
        </div>

        <ul className="mt-2.5">
          {nearOpps.map((o) => (
            <li key={o.id} className="border-t border-dashed border-zinc-700/60 first:border-t-0">
              <Link
                href="/opportunities"
                className="group -mx-2 block rounded-md px-2 py-3 transition hover:bg-card-raised"
              >
                <p className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-zinc-100 group-hover:text-lime-300">
                    <Briefcase className="h-3 w-3 shrink-0 text-lime-400/70" />
                    <span className="truncate">{o.title.split("—")[0].trim()}</span>
                  </span>
                  <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-lime-400">
                    {o.budget}
                  </span>
                </p>
                <p className="mt-0.5 flex items-baseline justify-between gap-2 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                  <span className="truncate">
                    {o.distanceMi !== undefined && o.distanceMi <= 25
                      ? `${o.distanceMi} mi`
                      : "remote"}{" "}
                    · {o.roles} · due {o.deadline}
                  </span>
                  <span className="shrink-0 font-semibold text-lime-400 opacity-0 transition group-hover:opacity-100">
                    pitch →
                  </span>
                </p>
              </Link>
            </li>
          ))}
          {nearOpps.length === 0 && (
            <li className="py-2.5 text-xs text-zinc-500">
              No paid openings inside this radius yet. Try 25 mi.
            </li>
          )}
        </ul>

        {/* receipt total: double rule */}
        {nearOpps.length > 0 && (
          <div className="mt-1">
            <div className="border-t border-zinc-600" />
            <div className="mt-[3px] border-t border-zinc-600" />
            <p className="mt-2 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-widest">
              <span className="text-zinc-400">posted in range</span>
              <span className="font-bold tabular-nums text-lime-400">
                ${total.toLocaleString()}
              </span>
            </p>
          </div>
        )}

        <Link
          href="/opportunities"
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-lime-400/30 py-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-lime-300 transition hover:border-lime-400/60 hover:bg-lime-400/5"
        >
          see all paid work <ArrowRight className="h-3 w-3" />
        </Link>
      </section>

      {/* ---- people: round, avatar-forward, violet ---- */}
      <section className="card-people p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">People near you</h2>
          <Link
            href="/discover"
            className="text-xs font-semibold text-violet-400 transition hover:text-violet-300"
          >
            Discover
          </Link>
        </div>
        <ul className="mt-4 space-y-4">
          {nearPeople.map((c) => (
            <li key={c.id} className="flex items-center gap-3">
              <span className="relative shrink-0">
                <Avatar src={c.avatar} initials={c.initials} gradient={c.gradient} size="md" />
                {c.online && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-violet-400" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-100">{c.name}</p>
                <p className="truncate text-xs text-zinc-500">
                  {c.role} · {c.distanceMi} mi
                </p>
              </div>
              <button
                onClick={() => setFollowed((f) => ({ ...f, [c.id]: !f[c.id] }))}
                className={
                  followed[c.id]
                    ? "rounded-full border border-violet-400/40 px-3.5 py-1.5 text-xs font-semibold text-violet-300"
                    : "rounded-full bg-violet-400 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-violet-300 hover:shadow-glow-violet"
                }
              >
                {followed[c.id] ? "Following" : "Follow"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- events: ticket rows with real date blocks, amber ---- */}
      <section className="card-event overflow-hidden">
        <h2 className="border-b border-line-soft px-5 pb-3 pt-4 text-[15px] font-bold tracking-tight text-zinc-50">
          This week
        </h2>
        <ul className="divide-y divide-line-soft">
          {nearEvents.map((e) => {
            const [mon, day] = monthDay(e.date);
            return (
              <li key={e.id}>
                <Link href="/events" className="group flex items-stretch transition hover:bg-card-raised">
                  <span className="flex w-14 shrink-0 flex-col items-center justify-center border-r border-dashed border-zinc-700/60 bg-amber-400/[0.06] py-3">
                    <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-400">
                      {mon}
                    </span>
                    <span className="text-xl font-extrabold leading-tight text-zinc-50">
                      {day}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 px-4 py-3">
                    <span className="block truncate text-sm font-semibold text-zinc-100 group-hover:text-amber-300">
                      {e.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-500">
                      {e.time} ·
                      <MapPin className="h-3 w-3 shrink-0" />
                      {e.location.split(",")[0]} · {e.attending} going
                    </span>
                  </span>
                  <span className="mr-3 hidden shrink-0 self-center rounded-full border border-amber-400/40 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-amber-300 opacity-0 transition group-hover:opacity-100 sm:block">
                    rsvp
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="px-2 font-mono text-[10px] leading-relaxed text-zinc-600">
        about · help · privacy · terms
        <br />© 2026 UpNova, Baltimore MD
      </p>
    </aside>
  );
}
