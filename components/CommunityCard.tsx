"use client";

import { useState } from "react";
import { Users, Check, Plus, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import ReachBadge from "./ReachBadge";
import type { Community } from "@/lib/data";

export default function CommunityCard({ community }: { community: Community }) {
  const [joined, setJoined] = useState(!!community.joined);

  return (
    <article id={community.id} className="card-people card-lift flex flex-col overflow-hidden hover:border-zinc-600">
      <Link href={`/communities/${community.id}`} aria-label={`Open ${community.name}`}>
      <div
        className={`relative h-24 overflow-hidden ${
          community.image
            ? ""
            : `flex items-center justify-center bg-gradient-to-br ${community.gradient}`
        }`}
      >
        {community.image ? (
          <>
            <Image src={community.image} alt="" fill sizes="480px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          </>
        ) : (
          <span className="text-4xl drop-shadow" aria-hidden>
            {community.emoji}
          </span>
        )}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse-dot" />
          {community.online} online
        </span>
      </div>
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <Link href={`/communities/${community.id}`} className="text-base font-bold text-zinc-50 transition hover:text-violet-300">{community.name}</Link>
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

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setJoined(!joined)}
            className={`flex-1 ${
              joined
                ? "btn-ghost border-violet-400/40 text-violet-300"
                : "inline-flex items-center justify-center gap-1.5 rounded-full bg-violet-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-violet-300 hover:shadow-glow-violet active:scale-[0.98]"
            }`}
          >
            {joined ? (
              <>
                <Check className="h-4 w-4" /> Joined
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Join
              </>
            )}
          </button>
          <Link
            href={`/communities/${community.id}`}
            className="btn-ghost flex-1 px-3 py-2 text-sm"
          >
            Open <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
