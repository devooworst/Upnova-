"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import Avatar from "./Avatar";
import RadarRings from "./RadarRings";
import { opportunities, creators, events, currentUser, type RadiusId } from "@/lib/data";

export default function RightSidebar({ radius }: { radius: RadiusId }) {
  const [followed, setFollowed] = useState<Record<string, boolean>>({});

  const inRange = (d?: number) =>
    radius === "city" ? true : d !== undefined && d <= Number(radius);

  const nearOpps = opportunities.filter((o) => inRange(o.distanceMi));
  const nearPeople = creators.filter((c) => inRange(c.distanceMi)).slice(0, 3);
  const nearEvents = events.filter((_, i) => i < 2);

  return (
    <aside className="sticky top-20 hidden w-80 shrink-0 space-y-5 self-start xl:block">
      {/* your radius */}
      <section className="card radar-bg relative overflow-hidden p-4">
        <div className="flex items-center gap-4">
          <RadarRings radius={radius} className="h-24 w-24 shrink-0" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              your radius
            </p>
            <p className="mt-1 font-display text-lg font-bold text-zinc-50">
              {radius === "city" ? "City +" : `${radius} mi`}
              <span className="text-zinc-500"> around {currentUser.location.split(",")[0]}</span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              <span className="font-semibold text-lime-400">{nearOpps.length} paid openings</span>{" "}
              • <span className="font-semibold text-violet-400">{nearPeople.length} creators</span>{" "}
              active in range
            </p>
          </div>
        </div>
      </section>

      {/* Opportunities in range — lime = money */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold text-zinc-100">Money in range</h2>
          <Link
            href="/opportunities"
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-lime-400 hover:text-lime-300"
          >
            all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <ul className="space-y-1">
          {nearOpps.map((o) => (
            <li key={o.id}>
              <Link
                href="/opportunities"
                className="group block rounded-xl px-2.5 py-2.5 transition hover:bg-card-raised"
              >
                <p className="flex items-baseline justify-between gap-2 text-sm font-semibold text-zinc-100 group-hover:text-lime-300">
                  <span className="truncate">{o.title.split("—")[0].trim()}</span>
                  <span className="shrink-0 font-mono text-sm font-bold text-lime-400">
                    {o.budget}
                  </span>
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
                  {o.distanceMi !== undefined ? `${o.distanceMi} mi` : "remote"} • {o.roles}
                </p>
              </Link>
            </li>
          ))}
          {nearOpps.length === 0 && (
            <li className="px-2.5 py-2 text-xs text-zinc-500">
              Nothing paid inside this radius yet — widen it.
            </li>
          )}
        </ul>
      </section>

      {/* People in range — violet = community */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold text-zinc-100">People in range</h2>
          <Link
            href="/discover"
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-violet-400 hover:text-violet-300"
          >
            discover <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <ul className="space-y-3">
          {nearPeople.map((c) => (
            <li key={c.id} className="flex items-center gap-2.5">
              <Avatar src={c.avatar} initials={c.initials} gradient={c.gradient} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-100">{c.name}</p>
                <p className="truncate font-mono text-[10px] text-zinc-500">
                  {c.distanceMi} mi • {c.role}
                </p>
              </div>
              <button
                onClick={() => setFollowed((f) => ({ ...f, [c.id]: !f[c.id] }))}
                className={
                  followed[c.id]
                    ? "rounded-full border border-violet-400/40 px-3 py-1.5 text-xs font-semibold text-violet-300"
                    : "rounded-full bg-violet-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-violet-300"
                }
              >
                {followed[c.id] ? "Following" : "Follow"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* This week — amber = events */}
      <section className="card p-4">
        <h2 className="mb-3 font-display text-sm font-bold text-zinc-100">This week near you</h2>
        <ul className="space-y-2.5">
          {nearEvents.map((e) => (
            <li key={e.id}>
              <Link
                href="/events"
                className="group flex items-start gap-3 rounded-xl px-2.5 py-2 transition hover:bg-card-raised"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/10">
                  <CalendarDays className="h-4 w-4 text-amber-400" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-zinc-100 group-hover:text-amber-300">
                    {e.title}
                  </span>
                  <span className="block font-mono text-[10px] text-zinc-500">
                    {e.date} • {e.time} • {e.attending} going
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="px-2 font-mono text-[10px] leading-relaxed text-zinc-600">
        about • help • privacy • terms
        <br />© 2026 upnova — find what&apos;s happening around you.
      </p>
    </aside>
  );
}
