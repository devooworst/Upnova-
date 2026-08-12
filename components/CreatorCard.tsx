"use client";

import { Star, MapPin, MessageSquare, Zap } from "lucide-react";
import Link from "next/link";
import Avatar from "./Avatar";
import FollowButton from "./FollowButton";
import VerifiedBadge from "./VerifiedBadge";
import type { Creator } from "@/lib/data";

const availabilityStyle: Record<Creator["availability"], string> = {
  "Available Now": "bg-lime-400/10 text-lime-300 border-lime-400/30",
  "Available This Week": "bg-amber-400/10 text-amber-300 border-amber-400/30",
  "Open to Work": "bg-lime-400/10 text-lime-300 border-lime-400/30",
  "Accepting Clients": "bg-lime-400/10 text-lime-300 border-lime-400/30",
};

export default function CreatorCard({ creator }: { creator: Creator }) {
  return (
    <article className="card-people card-lift flex min-w-0 flex-col p-5 hover:border-zinc-600">
      <div className="flex items-start gap-3">
        <Avatar src={creator.avatar} initials={creator.initials} gradient={creator.gradient} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-1.5 text-base font-bold text-zinc-50">
            {creator.name}
            {creator.verified && <VerifiedBadge />}
          </h3>
          <p className="mt-0.5 text-sm text-zinc-400">
            {creator.emoji} {creator.role}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
            <MapPin className="h-3 w-3" /> {creator.location}
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full border border-line bg-card-raised px-2 py-1 text-xs font-bold text-zinc-100">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {creator.rating.toFixed(1)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {creator.skills.map((s) => (
          <span key={s} className="chip">
            {s}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-400">
          Starting at <span className="text-base font-bold text-lime-400">${creator.startingAt}</span>
        </p>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${availabilityStyle[creator.availability]}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {creator.availability}
        </span>
      </div>

      <div className="mt-4 border-t border-line-soft pt-3.5">
        <FollowButton id={creator.id} size="xs" className="w-full !py-1.5" />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Link href={`/creator/${creator.id}`} className="btn-ghost min-w-0 truncate px-2 py-2 text-xs">
          View Profile
        </Link>
        <Link
          href={`/messages?to=${creator.handle}`}
          className="inline-flex min-w-0 items-center justify-center gap-1.5 truncate rounded-full border border-violet-400/40 px-2 py-2 text-xs font-medium text-violet-300 transition hover:bg-violet-400/10"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Message
        </Link>
        <Link href={`/messages?to=${creator.handle}`} className="btn-lime min-w-0 truncate px-2 py-2 text-xs">
          <Zap className="h-3.5 w-3.5" />
          Hire
        </Link>
      </div>
    </article>
  );
}
