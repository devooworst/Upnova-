"use client";

import { useState } from "react";
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
        {/* masthead — unboxed, type does the work */}
        <header className="pt-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500">
            {currentUser.location} · Thu Aug 7
          </p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
              Near You
            </h1>
            {/* radius selector — the one place radius lives */}
            <div className="flex overflow-hidden rounded-full border border-line bg-card">
              {radiusOptions.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRadius(r.id)}
                  aria-pressed={radius === r.id}
                  className={`px-3.5 py-1.5 font-mono text-xs transition ${
                    radius === r.id
                      ? "bg-white font-semibold text-zinc-950"
                      : "text-zinc-400 hover:bg-card-raised hover:text-zinc-200"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
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
