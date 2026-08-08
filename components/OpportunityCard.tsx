"use client";

import { useState } from "react";
import { Flame, ArrowRight, Check } from "lucide-react";
import Avatar from "./Avatar";
import VerifiedBadge from "./VerifiedBadge";
import Perforation from "./Perforation";
import { opportunities } from "@/lib/data";

export default function OpportunityCard({ id }: { id: string }) {
  const [applied, setApplied] = useState(false);
  const opp = opportunities.find((o) => o.id === id);
  if (!opp) return null;

  return (
    <article className="card-money relative overflow-hidden">
      <div className="p-4 sm:p-5">
        {/* stamp row: category + budget stub */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-lime-400">
              {opp.featured && <Flame className="h-3.5 w-3.5" />}
              {opp.featured ? "Featured · " : ""}
              {opp.category}
            </p>
            <h3 className="mt-2 text-xl font-extrabold tracking-tight text-zinc-50">
              {opp.title}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
              <Avatar
                src={opp.posterAvatar}
                initials={opp.posterInitials}
                gradient={opp.posterGradient}
                size="xs"
                className="!h-4 !w-4 !rounded-sm !text-[8px]"
              />
              {opp.poster}
              {opp.verifiedPoster && <VerifiedBadge />}
              <span>is hiring</span>
            </p>
          </div>
          {/* budget stub */}
          <div className="shrink-0 text-right">
            <p className="font-mono text-2xl font-bold tabular-nums leading-none text-lime-400">
              {opp.budget}
            </p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500">
              budget
            </p>
          </div>
        </div>

        <p className="mt-3 text-[15px] leading-relaxed text-zinc-300">{opp.description}</p>

        <Perforation className="mt-4" />

        {/* receipt line */}
        <dl className="mt-3.5 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-wide">
          <div>
            <dt className="text-[9px] tracking-[0.2em] text-zinc-500">deadline</dt>
            <dd className="mt-0.5 font-semibold text-amber-400">{opp.deadline}</dd>
          </div>
          <div>
            <dt className="text-[9px] tracking-[0.2em] text-zinc-500">applicants</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-zinc-200">{opp.applicants}</dd>
          </div>
          <div>
            <dt className="text-[9px] tracking-[0.2em] text-zinc-500">where</dt>
            <dd className="mt-0.5 font-semibold text-zinc-200">
              {opp.reach.reach === "Remote"
                ? "remote"
                : opp.distanceMi !== undefined && opp.distanceMi <= 25
                ? `${opp.distanceMi} mi away`
                : opp.reach.location}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[9px] tracking-[0.2em] text-zinc-500">looking for</dt>
            <dd className="mt-0.5 truncate font-semibold text-zinc-200">{opp.roles}</dd>
          </div>
        </dl>

        {/* CTA — sharp corners, money category */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => setApplied(!applied)}
            className={
              applied
                ? "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-lime-400/40 px-5 py-2 text-sm font-semibold text-lime-300 sm:flex-none"
                : "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-lime-400 px-5 py-2 text-sm font-bold text-zinc-950 transition hover:bg-lime-300 active:scale-[0.98] sm:flex-none"
            }
          >
            {applied ? (
              <>
                <Check className="h-4 w-4" />
                Applied
              </>
            ) : (
              <>
                Apply Now
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
          <p className="hidden text-xs text-zinc-500 sm:block">
            {opp.applicants + (applied ? 1 : 0)} people have applied
          </p>
        </div>
      </div>
    </article>
  );
}
