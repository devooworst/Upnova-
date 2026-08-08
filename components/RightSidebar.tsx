"use client";

import { useState } from "react";
import Link from "next/link";
import { Briefcase, TrendingUp, UserPlus, Check, ArrowRight } from "lucide-react";
import Avatar from "./Avatar";
import VerifiedBadge from "./VerifiedBadge";
import { opportunities, trending, creators } from "@/lib/data";

export default function RightSidebar() {
  const sideOpps = opportunities.filter((o) => ["photo-gig", "music-video", "brand-collab"].includes(o.id));
  const whoToFollow = creators.filter((c) => ["ava", "marcus", "nia"].includes(c.id));
  const [followed, setFollowed] = useState<Record<string, boolean>>({});

  return (
    <aside className="sticky top-20 hidden w-80 shrink-0 space-y-5 self-start xl:block">
      {/* Opportunities Near You */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-100">
            <Briefcase className="h-4 w-4 text-lime-400" />
            Opportunities Near You
          </h2>
          <Link href="/opportunities" className="text-xs font-medium text-lime-400 hover:text-lime-300">
            See all
          </Link>
        </div>
        <ul className="space-y-1">
          {sideOpps.map((o) => (
            <li key={o.id}>
              <Link
                href="/opportunities"
                className="group block rounded-xl px-2.5 py-2.5 transition hover:bg-card-raised"
              >
                <p className="text-sm font-semibold text-zinc-100 group-hover:text-lime-300">
                  {o.title.split("—")[0].trim()}
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-xs">
                  <span className="font-bold text-lime-400">{o.budget}</span>
                  <span className="text-zinc-500">{o.reach.location}</span>
                  {o.reach.reach === "Remote" && (
                    <span className="rounded-full bg-card-raised px-1.5 py-0.5 text-[10px] text-zinc-400">
                      Remote
                    </span>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Trending */}
      <section className="card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-100">
          <TrendingUp className="h-4 w-4 text-lime-400" />
          Trending
        </h2>
        <ul className="space-y-0.5">
          {trending.map((t, i) => (
            <li key={t.tag}>
              <button className="w-full rounded-xl px-2.5 py-2 text-left transition hover:bg-card-raised">
                <p className="text-sm font-semibold text-zinc-100">{t.tag}</p>
                <p className="text-xs text-zinc-500">
                  {i + 1} • Trending • {t.posts}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Who to Follow */}
      <section className="card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-100">
          <UserPlus className="h-4 w-4 text-lime-400" />
          Who to Follow
        </h2>
        <ul className="space-y-3">
          {whoToFollow.map((c) => (
            <li key={c.id} className="flex items-center gap-2.5">
              <Avatar src={c.avatar} initials={c.initials} gradient={c.gradient} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-semibold text-zinc-100">
                  {c.name}
                  {c.verified && <VerifiedBadge />}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {c.emoji} {c.role} • {c.location}
                </p>
              </div>
              <button
                onClick={() => setFollowed((f) => ({ ...f, [c.id]: !f[c.id] }))}
                className={
                  followed[c.id]
                    ? "inline-flex items-center gap-1 rounded-full border border-lime-400/40 px-3 py-1.5 text-xs font-semibold text-lime-300"
                    : "inline-flex items-center gap-1 rounded-full bg-lime-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-lime-300"
                }
              >
                {followed[c.id] ? (
                  <>
                    <Check className="h-3 w-3" /> Following
                  </>
                ) : (
                  "Follow"
                )}
              </button>
            </li>
          ))}
        </ul>
        <Link
          href="/discover"
          className="mt-3 flex items-center justify-center gap-1 rounded-xl border border-line-soft py-2 text-xs font-medium text-zinc-400 transition hover:bg-card-raised hover:text-zinc-200"
        >
          Discover more creators <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>

      <p className="px-2 text-[11px] leading-relaxed text-zinc-600">
        About • Help • Privacy • Terms
        <br />© 2026 UpNova — Find what&apos;s happening around you.
      </p>
    </aside>
  );
}
