"use client";

import { useState } from "react";
import { Users, Check, Plus } from "lucide-react";
import ReachBadge from "./ReachBadge";
import type { Community } from "@/lib/data";

export default function CommunityCard({ community }: { community: Community }) {
  const [joined, setJoined] = useState(!!community.joined);

  return (
    <article id={community.id} className="card flex flex-col overflow-hidden transition hover:border-zinc-600">
      <div className={`relative flex h-20 items-center justify-center bg-gradient-to-br ${community.gradient}`}>
        <span className="text-4xl drop-shadow" aria-hidden>
          {community.emoji}
        </span>
        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse-dot" />
          {community.online} online
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="font-display text-base font-bold text-zinc-50">{community.name}</h3>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
          <Users className="h-3.5 w-3.5" />
          {community.members} members
        </p>
        <p className="mt-2.5 flex-1 text-sm leading-relaxed text-zinc-400">{community.description}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ReachBadge info={community.reach} compact />
          {community.tags.map((t) => (
            <span key={t} className="chip px-2 py-0.5 text-[11px]">
              {t}
            </span>
          ))}
        </div>

        <button
          onClick={() => setJoined(!joined)}
          className={`mt-4 w-full ${
            joined ? "btn-ghost border-lime-400/40 text-lime-300" : "btn-lime"
          }`}
        >
          {joined ? (
            <>
              <Check className="h-4 w-4" /> Joined
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> Join Community
            </>
          )}
        </button>
      </div>
    </article>
  );
}
