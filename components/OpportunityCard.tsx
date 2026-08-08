"use client";

import { useState } from "react";
import { Flame, ArrowRight, Check, Flag, FolderOpen, X } from "lucide-react";
import ReportModal from "./ReportModal";
import Avatar from "./Avatar";
import VerifiedBadge from "./VerifiedBadge";
import Perforation from "./Perforation";
import { opportunities, currentUser } from "@/lib/data";
import { getTrustStatus, setTrustStatus } from "@/lib/pro";

/* Opportunities = "We're looking for someone." The CTA is Apply:
   portfolio + availability + optional rate + short message. Never
   "Hire Me" — that's the Services direction. "Pitch" survives only as
   an optional proposal inside an application, never as UI language. */

export default function OpportunityCard({ id }: { id: string }) {
  const [pitched, setPitched] = useState(false);
  const [pitchOpen, setPitchOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const opp = opportunities.find((o) => o.id === id);
  const [available, setAvailable] = useState<"yes" | "check" | null>(null);
  const [trustOk, setTrustOk] = useState(false);
  const [message, setMessage] = useState(
    "I've shot this kind of work before, portfolio attached. I'm free on your dates."
  );
  if (!opp) return null;

  return (
    <article className="card-money relative overflow-hidden">
      <div className="p-4">
        {/* stamp row: category + budget stub */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-lime-400">
              {opp.featured && <Flame className="h-3.5 w-3.5" />}
              {opp.featured ? "Featured · " : ""}
              {opp.category}
              {opp.studentFriendly && (
                <span className="rounded-full border border-violet-400/40 px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-[0.08em] text-violet-300">
STUDENT-FRIENDLY
                </span>
              )}
              {opp.trustLevel === "high-trust" && (
                <span className="rounded-full border border-red-400/40 bg-red-500/10 px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-[0.08em] text-red-300">
<span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-400 align-middle" />HIGH-TRUST
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

        <p className="mt-2.5 text-[15px] leading-relaxed text-zinc-300">{opp.description}</p>

        <Perforation className="mt-4" />

        {/* receipt line */}
        <dl className="mt-3.5 flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <dt className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500">apply by</dt>
            <dd className="mt-0.5 text-xs font-semibold tracking-tight text-amber-400">{opp.deadline}</dd>
          </div>
          {opp.projectDates && (
            <div>
              <dt className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500">when</dt>
              <dd className="mt-0.5 text-xs font-semibold tracking-tight text-zinc-200">{opp.projectDates}</dd>
            </div>
          )}
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

            {/* high-trust gate — applicants must meet the required level */}
            {opp.trustLevel === "high-trust" && !trustOk && getTrustStatus() !== "high-trust" ? (
              <div className="mt-4">
                <div className="rounded-md border border-red-400/30 bg-red-500/5 p-3.5">
                  <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-red-300">
high-trust opportunity
                  </p>
                  <p className="mt-1.5 text-sm text-zinc-200">
                    This job involves unsupervised access to a pet, home, or property. Applicants
                    must complete High-Trust Verification.
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                    <li>✓ Identity verification — you have this</li>
                    <li className="text-zinc-600">Age verification — required</li>
                    <li className="text-zinc-600">Background screening — required (where legally permitted)</li>
                  </ul>
                </div>
                <button
                  onClick={() => {
                    setTrustStatus("high-trust");
                    setTrustOk(true);
                  }}
                  className="mt-3 w-full rounded-md bg-lime-400 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-lime-300"
                >
                  Complete High-Trust Verification
                </button>
                <p className="mt-2 text-center text-[10px] text-zinc-600">
                  Runs through an identity-verification provider — UpNova never stores your ID.
                </p>
              </div>
            ) : (
            <>
            {/* portfolio attached automatically */}
            <div className="mt-4 flex items-center gap-2.5 rounded-md border border-line bg-card-raised px-3 py-2.5">
              <FolderOpen className="h-4 w-4 shrink-0 text-lime-400" />
              <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                Portfolio attached — {currentUser.name} · 87 projects
              </span>
              <Check className="h-4 w-4 shrink-0 text-lime-400" />
            </div>

            {/* availability — tied to the actual gig, not a vague status */}
            <div className="mt-3">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                {opp.projectDates
                  ? `Are you available ${opp.projectDates}?`
                  : "Can you make this deadline?"}
              </p>
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAvailable("yes")}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-semibold transition ${
                    available === "yes"
                      ? "border-lime-400/60 bg-lime-400/10 text-lime-300"
                      : "border-line text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  ✓ Yes, I&apos;m available
                </button>
                <button
                  type="button"
                  onClick={() => setAvailable("check")}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition ${
                    available === "check"
                      ? "border-amber-400/60 bg-amber-400/10 text-amber-300"
                      : "border-line text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  Need to check my schedule
                </button>
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
                if (!available) return;
                setPitched(true);
                setPitchOpen(false);
              }}
              disabled={!available}
              className={`mt-4 w-full rounded-md py-2.5 text-sm font-bold transition ${
                available
                  ? "bg-lime-400 text-zinc-950 hover:bg-lime-300 hover:shadow-glow"
                  : "cursor-not-allowed bg-card-raised text-zinc-600"
              }`}
            >
              Send Application
            </button>
            <p className="mt-2.5 text-center font-mono text-[10px] font-medium text-zinc-500">
              applying accepts the listed budget ({opp.budget}) · {opp.poster} reviews applicants
              and picks who to start a project with
            </p>
            </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
