"use client";

/* ------------------------------------------------------------------ */
/*  Public opportunity page — the shareable unit.                      */
/*  A link like /opportunities/<id> works for GUESTS: what is it, who  */
/*  posted it, what does it pay, where, when — everything public is    */
/*  visible first. The account ask happens at APPLY, after they        */
/*  already care. Members' Apply resumes the real application modal    */
/*  on /opportunities (?apply=<id>).                                   */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, CalendarDays, Users, Lock, Link2, Check, GraduationCap } from "lucide-react";
import Avatar from "@/components/Avatar";
import PosterBadge, { type PosterType } from "@/components/PosterBadge";
import { useSession } from "@/lib/session";
import { promptJoin } from "@/components/GuestGate";
import { engagementTypeLabel, compLabel, type EngagementConfig } from "@/lib/engagement";

interface Opp {
  id: string;
  title: string;
  description: string;
  budget: number | null;
  type: string;
  status: string;
  location: string;
  remote: boolean;
  studentFriendly: boolean;
  applyBy: string | null;
  eventDate: string | null;
  createdAt: string;
  applicants: number;
  roles: { id: string; title: string; count: number; pay: number | null; description?: string; open: number }[];
  engagement: EngagementConfig | null;
  myStatus: string | null;
  poster: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    verified: boolean;
    roleLine: string;
    locationLabel?: string | null;
  };
  posterType: PosterType;
  isMine: boolean;
  applied: boolean;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });

export default function OpportunityPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useSession();
  const [opp, setOpp] = useState<Opp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/opportunities/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) setError(d.error || "Not found");
        else setOpp(d.opportunity);
      })
      .catch(() => setError("Network error"));
  }, [id]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const apply = () => {
    if (!opp) return;
    if (me === null) {
      // the conversion moment — they already know what it is and what it pays
      promptJoin("apply", `/opportunities?apply=${opp.id}`);
      return;
    }
    router.push(`/opportunities?apply=${opp.id}`);
  };

  if (error)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm font-semibold text-zinc-200">{error}</p>
        <Link href="/opportunities" className="btn-ghost mt-4 inline-flex px-4 py-1.5 text-xs">Browse opportunities</Link>
      </div>
    );
  if (!opp) return <div className="card mx-auto h-64 max-w-2xl animate-pulse" aria-hidden />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/opportunities" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
        <ArrowLeft className="h-3.5 w-3.5" /> Opportunities
      </Link>

      <article className="card-event p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {opp.type === "collab" ? "Collaboration" : opp.type === "campus" ? "Campus" : "Opportunity"}
              {opp.status !== "open" && <span className="ml-2 text-rose-300">· Closed</span>}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">{opp.title}</h1>
          </div>
          <button onClick={share} className="btn-ghost shrink-0 px-3 py-1.5 text-xs" title="Copy link — works for anyone, no account needed to view">
            {copied ? <Check className="h-3.5 w-3.5 text-lime-300" /> : <Link2 className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Share"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-amber-300" /> {opp.remote ? "Remote" : opp.location}
          </span>
          {opp.eventDate && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-amber-300" /> {fmtDate(opp.eventDate)}
            </span>
          )}
          {opp.budget != null && (
            <span className="font-mono text-sm font-medium tracking-[0.08em] text-lime-300">${opp.budget}</span>
          )}
          {opp.applyBy && (
            <span className="font-mono text-[11px] tracking-[0.08em] text-zinc-500">APPLY BY · {fmtDate(opp.applyBy)}</span>
          )}
          {opp.studentFriendly && (
            <span className="inline-flex items-center gap-1 text-violet-300">
              <GraduationCap className="h-3.5 w-3.5" /> Student friendly
            </span>
          )}
        </div>

        {opp.engagement && opp.engagement.type !== "one_time" && (
          <div className="mt-3 rounded-xl border border-sky-400/25 bg-sky-400/5 px-3.5 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-300">{engagementTypeLabel(opp.engagement)}</p>
            <ul className="mt-1 space-y-0.5 text-xs text-zinc-300">
              {opp.engagement.rate != null && <li>Compensation: <span className="font-mono tracking-[0.05em] text-lime-300">{compLabel(opp.engagement)}</span></li>}
              {opp.engagement.workload && <li>Workload: {opp.engagement.workload}</li>}
              {opp.engagement.schedule && <li>Schedule: {opp.engagement.schedule}</li>}
              {opp.engagement.duration && <li>Duration: {opp.engagement.duration}</li>}
              {opp.engagement.startDate && <li>Starts {new Date(opp.engagement.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</li>}
              <li className={opp.engagement.classification === "external_employment" ? "text-sky-300" : "text-zinc-400"}>
                {opp.engagement.classification === "external_employment"
                  ? "Employment handled by the employer — payroll and paperwork happen outside UpNova."
                  : "Freelance/contract through UpNova — payments secured per cycle, released on completion."}
              </li>
              {opp.engagement.interviewMode === "external" && <li className="text-zinc-500">Interview process happens outside UpNova (labeled external).</li>}
              {opp.engagement.interviewMode === "upnova" && <li className="text-zinc-500">Interviews scheduled through UpNova — they land on both calendars.</li>}
            </ul>
          </div>
        )}

        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-300">{opp.description}</p>

        {/* TEAM & OPENINGS — applicants choose their role; capacity is live */}
        {opp.roles.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Roles</p>
            {opp.roles.map((r) => (
              <div
                key={r.id}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 ${
                  r.open < 1 ? "border-line-soft opacity-60" : "border-line"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-100">
                    {r.title}
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      {r.open < 1 ? "Filled" : `${r.open} opening${r.open > 1 ? "s" : ""}`}
                    </span>
                  </p>
                  {r.description && <p className="text-[11px] text-zinc-500">{r.description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  {r.pay != null && (
                    <span className="font-mono text-sm font-medium tracking-[0.08em] text-lime-300">${r.pay}</span>
                  )}
                  {!opp.isMine && !opp.applied && opp.status === "open" && r.open > 0 && (
                    <button onClick={apply} className="btn-ghost px-3 py-1.5 text-[11px]">
                      Apply for {r.title}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* about the poster — identity and verification, not perceived quality */}
        <div className="mt-5 rounded-xl border border-line bg-card-raised/50 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">About the poster</p>
          <div className="mt-2 flex items-center gap-3">
            <Link href={`/creator/${opp.poster.handle}`}>
              <Avatar src={opp.poster.avatarUrl} initials={opp.poster.displayName.charAt(0)} size="md" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/creator/${opp.poster.handle}`} className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-zinc-100 hover:text-violet-300">
                {opp.poster.displayName}
                <PosterBadge type={opp.posterType} locationLabel={opp.poster.locationLabel} />
              </Link>
              <p className="truncate text-xs text-zinc-500">
                {opp.poster.roleLine}
                {opp.poster.locationLabel ? ` · ${opp.poster.locationLabel}` : ""}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-zinc-500">
              <Users className="h-3.5 w-3.5" /> {opp.applicants} applied
            </span>
          </div>
        </div>

        {/* CTA — states, not guesses */}
        <div className="mt-5 border-t border-dashed border-line pt-4">
          {opp.isMine ? (
            <Link href={`/opportunities/${opp.id}/applicants`} className="btn-lime w-full justify-center py-2.5 text-sm">
              <Users className="h-4 w-4" /> View applicants
            </Link>
          ) : opp.applied ? (
            <p className="rounded-xl border border-lime-400/40 bg-lime-400/10 px-4 py-2.5 text-center text-sm font-semibold text-lime-300">
              Applied — track it in My Applications
            </p>
          ) : opp.status !== "open" ? (
            <p className="rounded-xl border border-line px-4 py-2.5 text-center text-sm text-zinc-500">
              This opportunity is closed.
            </p>
          ) : (
            <>
              <button onClick={apply} className="btn-lime w-full justify-center py-2.5 text-sm">
                {opp.budget == null ? "Express Interest" : "Apply to Opportunity"}
              </button>
              {me === null && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
                  <Lock className="h-3 w-3" /> Create a free account to apply — your profile becomes your application.
                </p>
              )}
            </>
          )}
        </div>
      </article>
    </div>
  );
}
