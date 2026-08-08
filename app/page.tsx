"use client";

import { useState } from "react";
import RadarRings from "@/components/RadarRings";
import NearbyNow from "@/components/NearbyNow";
import CreatePost from "@/components/CreatePost";
import Feed from "@/components/Feed";
import RightSidebar from "@/components/RightSidebar";
import { radiusOptions, type RadiusId, currentUser } from "@/lib/data";

export default function Home() {
  const [radius, setRadius] = useState<RadiusId>("25");

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-5">
        {/* spatial header */}
        <header className="radar-bg card relative overflow-hidden p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                {currentUser.location} • centered on you
              </p>
              <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-zinc-50">
                Near You
              </h1>
              <p className="mt-1.5 max-w-sm text-sm text-zinc-500">
                Creators, gigs, communities, and events — grouped by how close they actually are.
              </p>
            </div>
            <RadarRings radius={radius} className="hidden h-32 w-32 shrink-0 sm:block" />
          </div>

          {/* radius selector */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              radius
            </span>
            <div className="flex overflow-hidden rounded-full border border-line">
              {radiusOptions.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRadius(r.id)}
                  aria-pressed={radius === r.id}
                  className={`px-3.5 py-1.5 font-mono text-xs transition ${
                    radius === r.id
                      ? "bg-white text-zinc-950"
                      : "text-zinc-400 hover:bg-card-raised hover:text-zinc-200"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {/* legend */}
            <span className="ml-auto hidden items-center gap-3 font-mono text-[10px] text-zinc-500 md:flex">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-lime-400" /> work & money
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> people
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> events
              </span>
            </span>
          </div>
        </header>

        <NearbyNow />
        <CreatePost />
        <Feed radius={radius} />
      </div>

      <RightSidebar radius={radius} />
    </div>
  );
}
