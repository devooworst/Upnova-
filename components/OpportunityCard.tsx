"use client";

import { useState } from "react";
import {
  Flame,
  Wallet,
  CalendarClock,
  Users,
  ArrowRight,
  Check,
} from "lucide-react";
import Avatar from "./Avatar";
import ReachBadge from "./ReachBadge";
import VerifiedBadge from "./VerifiedBadge";
import { opportunities } from "@/lib/data";

export default function OpportunityCard({ id }: { id: string }) {
  const [applied, setApplied] = useState(false);
  const opp = opportunities.find((o) => o.id === id);
  if (!opp) return null;

  return (
    <article className="card overflow-hidden">
      {opp.featured && (
        <div className="flex items-center gap-2 border-b border-lime-400/20 bg-gradient-to-r from-lime-400/15 via-lime-400/5 to-transparent px-4 py-2 sm:px-5">
          <Flame className="h-4 w-4 text-lime-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-lime-300">
            Featured Opportunity
          </span>
        </div>
      )}

      <div className="p-4 sm:p-5">
        {/* poster */}
        <div className="flex items-center gap-3">
          <Avatar
            src={opp.posterAvatar}
            initials={opp.posterInitials}
            gradient={opp.posterGradient}
            size="sm"
          />
          <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-300">
            {opp.poster}
            {opp.verifiedPoster && <VerifiedBadge />}
            <span className="text-zinc-500">is hiring</span>
          </p>
        </div>

        {/* title + category */}
        <h3 className="mt-3 flex flex-wrap items-center gap-2 font-display text-lg font-bold text-zinc-50">
          {opp.title}
        </h3>
        <span className="chip mt-2 border-lime-400/25 bg-lime-400/5 text-lime-300">
          {opp.category}
        </span>

        <p className="mt-3 text-[15px] leading-relaxed text-zinc-300">{opp.description}</p>

        {/* details */}
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            { icon: Wallet, label: "Budget", value: opp.budget, lime: true },
            { icon: CalendarClock, label: "Deadline", value: opp.deadline },
            { icon: Users, label: "Applicants", value: `${opp.applicants}` },
          ].map((d) => (
            <div key={d.label} className="rounded-xl border border-line-soft bg-card-raised px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-zinc-500">
                <d.icon className="h-3.5 w-3.5" />
                {d.label}
              </dt>
              <dd className={`mt-1 text-sm font-bold ${d.lime ? "text-lime-400" : "text-zinc-100"}`}>
                {d.value}
              </dd>
            </div>
          ))}
        </dl>

        {/* reach + roles */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ReachBadge info={opp.reach} />
          <span className="chip">{opp.roles}</span>
        </div>

        {/* CTA */}
        <div className="mt-4 flex items-center gap-3 border-t border-line-soft pt-4">
          <button
            onClick={() => setApplied(!applied)}
            className={applied ? "btn-ghost flex-1 border-lime-400/40 text-lime-300 sm:flex-none sm:px-6" : "btn-lime flex-1 sm:flex-none sm:px-6"}
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
            {opp.applicants} people have applied
          </p>
        </div>
      </div>
    </article>
  );
}
