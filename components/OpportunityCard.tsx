"use client";

import { useState } from "react";
import { Flame, ArrowRight, Check, Flag, FolderOpen, X } from "lucide-react";
import ReportModal from "./ReportModal";
import Avatar from "./Avatar";
import VerifiedBadge from "./VerifiedBadge";
import Perforation from "./Perforation";
import { opportunities, currentUser } from "@/lib/data";

/* Opportunities = "We're looking for someone." The CTA is Apply:
   portfolio + availability + optional rate + short message. Never
   "Hire Me" — that's the Services direction. "Pitch" survives only as
   an optional proposal inside an application, never as UI language. */

export default function OpportunityCard({ id }: { id: string }) {
  const [pitched, setPitched] = useState(false);
  const [pitchOpen, setPitchOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const opp = opportunities.find((o) => o.id === id);
  const [rate, setRate] = useState(opp?.budget.replace(/[^0-9]/g, "") ?? "");
  const [message, setMessage] = useState(
    "I've shot this kind of work before, portfolio attached. I'm free on your dates."
  );
  if (!opp) return null;

  return (
    <article className="card-money relative overflow-hidden">
      <div className="p-4 sm:p-5">
        {/* stamp row: category + budget stub */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-lime-400">
              {opp.featured && <Flame className="h-3.5 w-3.5" />}
              {opp.featured ? "Featured · " : ""}
              {opp.category}
              {opp.studentFriendly && (
                <span className="rounded-full border border-violet-400/40 px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-[0.08em] text-violet-300">
                  🎓 STUDENT-FRIENDLY
                </span>
              )}
            </p>
            <h3 className="mt-2 text-xl font-bold tracking-tight text-zinc-50">{opp.title}</h3>
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
              <span>is looking for people</span>
            </p>
          </div>
          {/* budget stub */}
          <div className="shrink-0 text-right">
            <p className="text-[28px] font-extrabold leading-none tracking-tight tabular-nums text-lime-400">
              {opp.budget}
            </p>
            <p className="mt-1 font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500">
              budget
            </p>
          </div>
        </div>

        <p className="mt-3 text-[15px] leading-relaxed text-zinc-300">{opp.description}</p>

        <Perforation className="mt-4" />

        {/* receipt line */}
        <dl className="mt-3.5 flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <dt className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500">deadline</dt>
            <dd className="mt-0.5 text-xs font-semibold tracking-tight text-amber-400">{opp.deadline}</dd>
          </div>
          <div>
            <dt className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500">applicants</dt>
            <dd className="mt-0.5 text-xs font-semibold tabular-nums tracking-tight text-zinc-200">
              {opp.applicants + (pitched ? 1 : 0)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500">where</dt>
            <dd className="mt-0.5 text-xs font-semibold tracking-tight text-zinc-200">
              {opp.reach.reach === "Remote"
                ? "remote"
                : opp.distanceMi !== undefined && opp.distanceMi <= 25
                ? `${opp.distanceMi} mi away`
                : opp.reach.location}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500">looking for</dt>
            <dd className="mt-0.5 truncate text-xs font-semibold tracking-tight text-zinc-200">{opp.roles}</dd>
          </div>
        </dl>

        {/* CTA — apply, never hire */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => (pitched ? setPitched(false) : setPitchOpen(true))}
            className={
              pitched
                ? "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-lime-400/40 px-5 py-2 text-sm font-semibold text-lime-300 sm:flex-none"
                : "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-lime-400 px-5 py-2 text-sm font-bold text-zinc-950 transition hover:bg-lime-300 hover:shadow-glow active:scale-[0.98] sm:flex-none"
            }
          >
            {pitched ? (
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
            {opp.applicants + (pitched ? 1 : 0)} creators applied
          </p>
          <button
            onClick={() => setReportOpen(true)}
            className="ml-auto text-zinc-600 transition hover:text-red-300"
            aria-label="Report this opportunity"
            title="Report / Get Help"
          >
            <Flag className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {reportOpen && (
        <ReportModal context={`Opportunity · ${opp.title}`} onClose={() => setReportOpen(false)} />
      )}

      {/* -------- application -------- */}
      {pitchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={() => setPitchOpen(false)}
        >
          <div className="card-money w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-lime-400">
                  your application
                </p>
                <h2 className="mt-1 text-[15px] font-bold tracking-tight text-zinc-50">Apply to {opp.title}</h2>
              </div>
              <button onClick={() => setPitchOpen(false)} className="icon-btn h-8 w-8" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* portfolio attached automatically */}
            <div className="mt-4 flex items-center gap-2.5 rounded-md border border-line bg-card-raised px-3 py-2.5">
              <FolderOpen className="h-4 w-4 shrink-0 text-lime-400" />
              <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                Portfolio attached — {currentUser.name} · 87 projects
              </span>
              <Check className="h-4 w-4 shrink-0 text-lime-400" />
            </div>

            <div className="mt-3 flex gap-3">
              <div className="flex-1">
                <label htmlFor="pitch-rate" className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                  proposed rate
                </label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
                  <input
                    id="pitch-rate"
                    value={rate}
                    onChange={(e) => setRate(e.target.value.replace(/[^0-9]/g, ""))}
                    className="input-dark pl-7 tabular-nums"
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="flex-1">
                <label htmlFor="pitch-avail" className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                  availability
                </label>
                <select id="pitch-avail" className="input-dark mt-1.5 appearance-none">
                  <option>Available now</option>
                  <option>This week</option>
                  <option>From next week</option>
                  <option>Flexible</option>
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label htmlFor="pitch-msg" className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                why are you a good fit?
              </label>
              <textarea
                id="pitch-msg"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="input-dark mt-1.5 resize-none"
              />
            </div>

            <button
              onClick={() => {
                setPitched(true);
                setPitchOpen(false);
              }}
              className="btn-lime mt-4 w-full rounded-md py-2.5 text-sm"
            >
              Send Application
            </button>
            <p className="mt-2.5 text-center font-mono text-[10px] font-medium text-zinc-500">
              {opp.poster} reviews applicants and picks who to start a project with
            </p>
          </div>
        </div>
      )}
    </article>
  );
}
