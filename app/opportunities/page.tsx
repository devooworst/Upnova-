"use client";

/* ------------------------------------------------------------------ */
/*  Opportunities — "we're looking for someone → Apply Now".           */
/*  Every listing is a DB record with a real poster; applying creates  */
/*  a real application; posters review applicants and select — which   */
/*  auto-creates the project.                                          */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Plus } from "lucide-react";
import OpportunityList from "@/components/db/OpportunityList";
import { ENGAGEMENT_TYPES, cycleLabel, type EngagementOffer, type InterviewInfo } from "@/lib/engagement";

interface MyApplication {
  id: string;
  status: "submitted" | "shortlisted" | "interview" | "selected" | "confirmed" | "active" | "completed" | "declined" | "offer_declined";
  interview: InterviewInfo | null;
  offer: (EngagementOffer & { cycles?: number }) | null;
  availability: string;
  message: string;
  createdAt: string;
  role: { title: string; pay: number | null } | null;
  opportunity: { id: string; title: string; budget: number | null; location: string; eventDate: string | null; status: string; poster: string };
}

const APP_STATUS: Record<string, { label: string; cls: string }> = {
  submitted: { label: "Under Review", cls: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  shortlisted: { label: "Shortlisted", cls: "border-violet-400/40 bg-violet-400/10 text-violet-300" },
  interview: { label: "Interview", cls: "border-sky-400/40 bg-sky-400/10 text-sky-300" },
  selected: { label: "Offer — respond", cls: "border-lime-400/40 bg-lime-400/10 text-lime-300" },
  confirmed: { label: "Confirmed", cls: "border-lime-400/40 bg-lime-400/10 text-lime-300" },
  active: { label: "Active", cls: "border-lime-400/40 bg-lime-400/10 text-lime-300" },
  completed: { label: "Completed", cls: "border-line text-zinc-400" },
  declined: { label: "Not selected", cls: "border-line text-zinc-500" },
  offer_declined: { label: "You declined", cls: "border-line text-zinc-500" },
};

export default function OpportunitiesPage() {
  const [scope, setScope] = useState("for-you");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("apps")) setView("applications");
  }, []);
  const [view, setView] = useState<"browse" | "applications">("browse");
  const [apps, setApps] = useState<MyApplication[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    const res = await fetch("/api/me/applications", { cache: "no-store" });
    if (!res.ok) {
      setApps([]);
      return;
    }
    setApps((await res.json()).applications ?? []);
  }, []);

  useEffect(() => {
    if (view === "applications") loadApps();
  }, [view, loadApps]);

  const respond = async (id: string, action: "accept" | "decline_offer") => {
    await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    loadApps();
  };

  const withdraw = async (id: string) => {
    await fetch(`/api/applications/${id}`, { method: "DELETE" });
    loadApps();
  };

  /* arriving from the sidebar widget: preserve the feed scope */
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("scope");
    if (s && ["5", "25", "city", "county", "state", "school"].includes(s)) {
      setScope(s === "5" ? "5mi" : s === "25" ? "25mi" : s);
    } else if (s === "global" || s === "country") {
      setScope(s);
    }
  }, []);

  const scopes = [
    { id: "for-you", label: "All" },
    { id: "25mi", label: "Near me" },
    { id: "state", label: "My state" },
    { id: "global", label: "Global" },
    { id: "school", label: "My school" },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
          <Briefcase className="h-5 w-5 text-lime-400" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Opportunities</h1>
          <p className="text-sm text-zinc-400">Paid work and collaborations from real posters. Apply Now — never pitch.</p>
        </div>
        <Link href="/opportunities/new" className="btn-lime shrink-0 px-4 py-1.5 text-xs sm:text-sm">
          <Plus className="h-4 w-4" /> Post opportunity
        </Link>
      </div>

      {/* browse vs my applications */}
      <div className="mt-4 flex items-center gap-4 border-b border-line-soft text-sm">
        {(["browse", "applications"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`-mb-px border-b-2 pb-2.5 transition ${
              view === v
                ? "border-white font-semibold text-zinc-50"
                : "border-transparent font-medium text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {v === "browse" ? "Browse" : "My Applications"}
          </button>
        ))}
      </div>

      {view === "browse" ? (
        <>
          <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto pb-1">
            {scopes.map((s) => (
              <button
                key={s.id}
                onClick={() => setScope(s.id)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                  scope === s.id
                    ? "border-lime-400/50 bg-lime-400/10 font-semibold text-lime-300"
                    : "border-line text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <OpportunityList scope={scope} />
          </div>
        </>
      ) : (
        <div className="mt-4 space-y-2.5">
          {apps === null ? (
            <div className="card h-24 animate-pulse" aria-hidden />
          ) : apps.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm font-semibold text-zinc-200">No applications yet</p>
              <p className="mt-1 text-xs text-zinc-500">Apply to an opportunity and it shows up here with its live status.</p>
            </div>
          ) : (
            apps.map((a) => (
              <article key={a.id} className="card p-4">
                <button onClick={() => setExpanded(expanded === a.id ? null : a.id)} className="flex w-full items-center gap-3 text-left">
                  <div className="min-w-0 flex-1">
                    <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-zinc-100">
                      {a.opportunity.title}
                      {a.role && (
                        <span className="rounded-full border border-amber-400/30 bg-amber-400/5 px-2 py-0.5 font-mono text-[10px] tracking-[0.05em] text-amber-300">
                          {a.role.title}{a.role.pay != null ? ` · $${a.role.pay}` : ""}
                        </span>
                      )}
                      {!a.role && a.opportunity.budget != null && (
                        <span className="font-mono text-xs font-medium tracking-[0.08em] text-lime-300">
                          ${a.opportunity.budget}
                        </span>
                      )}
                    </h3>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {a.opportunity.poster} · {a.opportunity.location} · applied{" "}
                      {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold ${APP_STATUS[a.status].cls}`}>
                    {APP_STATUS[a.status].label}
                  </span>
                </button>
                {a.status === "interview" && a.interview && (
                  <p className="mt-3 rounded-xl border border-sky-400/30 bg-sky-400/5 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-300">
                    {a.interview.mode === "external" ? (
                      <>Interview stage — <span className="font-semibold text-sky-300">external process</span>: it happens outside Mavyn.{a.interview.note ? ` ${a.interview.note}` : ""} Coordinate in Messages.</>
                    ) : (
                      <>Interview scheduled{a.interview.at ? ` — ${new Date(a.interview.at).toLocaleDateString("en-US", { month: "long", day: "numeric" })} at ${new Date(a.interview.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}. It&apos;s on your <Link href="/calendar" className="font-semibold text-sky-300 underline-offset-2 hover:underline">calendar</Link>.</>
                    )}
                  </p>
                )}
                {/* configurable OFFER — the full terms, then the choice */}
                {a.status === "selected" && a.offer && (
                  <div className="mt-3 rounded-xl border border-lime-400/40 bg-lime-400/5 p-3.5">
                    <p className="text-sm font-bold text-lime-300">Offer — {a.offer.title}</p>
                    <ul className="mt-1.5 space-y-0.5 text-xs leading-relaxed text-zinc-300">
                      <li>{ENGAGEMENT_TYPES.find((t) => t.id === a.offer!.engagementType)?.label ?? a.offer.engagementType}{a.offer.duration ? ` · ${a.offer.duration}` : ""}</li>
                      <li><span className="font-mono tracking-[0.05em] text-lime-300">${a.offer.amount}</span> per {cycleLabel(a.offer.compModel)}</li>
                      {a.offer.schedule && <li>Schedule: {a.offer.schedule}</li>}
                      {a.offer.startDate && <li>Starts {new Date(a.offer.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</li>}
                      {a.offer.note && <li className="text-zinc-400">&ldquo;{a.offer.note}&rdquo;</li>}
                      <li className={a.offer.classification === "external_employment" ? "text-sky-300" : "text-zinc-400"}>
                        {a.offer.classification === "external_employment"
                          ? "External employment — pay & paperwork handled by the employer OUTSIDE Mavyn."
                          : "Freelance via Mavyn — each cycle secured up front, released on completion."}
                      </li>
                    </ul>
                    <div className="mt-2.5 flex gap-2">
                      <button onClick={() => respond(a.id, "accept")} className="btn-lime px-4 py-1.5 text-xs">Accept offer</button>
                      <button onClick={() => respond(a.id, "decline_offer")} className="btn-ghost px-3.5 py-1.5 text-xs">Decline</button>
                    </div>
                  </div>
                )}
                {a.status === "active" && a.offer && (
                  <p className="mt-3 rounded-xl border border-lime-400/30 bg-lime-400/5 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-300">
                    <span className="font-semibold text-lime-300">Active</span> — {a.offer.title}.
                    {a.offer.classification === "external_employment"
                      ? " Compensation handled outside Mavyn."
                      : ` ${a.offer.cycles ?? 0} paid cycle${(a.offer.cycles ?? 0) === 1 ? "" : "s"} started — track them in `}
                    {a.offer.classification !== "external_employment" && (
                      <Link href="/calendar" className="font-semibold text-lime-300 underline-offset-2 hover:underline">Bookings</Link>
                    )}
                  </p>
                )}
                {/* the offer moment — role, date, place, pay, and the choice */}
                {a.status === "selected" && !a.offer && a.role && (
                  <div className="mt-3 rounded-xl border border-lime-400/40 bg-lime-400/5 p-3.5">
                    <p className="text-sm font-bold text-lime-300">You&apos;ve been selected!</p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-300">
                      <span className="font-semibold text-zinc-100">{a.opportunity.title}</span>
                      <br />Role: {a.role.title}
                      {a.opportunity.eventDate && (
                        <> · {new Date(a.opportunity.eventDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</>
                      )}
                      {" "}· {a.opportunity.location}
                      {a.role.pay != null && <> · <span className="font-mono tracking-[0.05em] text-lime-300">${a.role.pay}</span> via Mavyn payment (secured, released after completion)</>}
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <button onClick={() => respond(a.id, "accept")} className="btn-lime px-4 py-1.5 text-xs">
                        Accept — add to Bookings
                      </button>
                      <button onClick={() => respond(a.id, "decline_offer")} className="btn-ghost px-3.5 py-1.5 text-xs">
                        Decline offer
                      </button>
                    </div>
                  </div>
                )}
                {a.status === "confirmed" && (
                  <p className="mt-3 rounded-xl border border-lime-400/30 bg-lime-400/5 px-3.5 py-2.5 text-xs text-zinc-300">
                    Confirmed — it&apos;s on your{" "}
                    <Link href="/calendar" className="font-semibold text-lime-300 underline-offset-2 hover:underline">calendar</Link>.
                    {a.role?.pay != null && ` The poster's payment secures your $${a.role.pay}.`}
                  </p>
                )}
                {expanded === a.id && (
                  <div className="mt-3 border-t border-line-soft pt-3">
                    {a.message && <p className="text-xs leading-relaxed text-zinc-400">&ldquo;{a.message}&rdquo;</p>}
                    <p className="mt-1.5 text-[11px] text-zinc-500">
                      Availability: {a.availability === "yes" ? "confirmed for the date" : "needs to check schedule"}
                    </p>
                    {!["selected", "confirmed", "active", "completed", "declined"].includes(a.status) && (
                      <button
                        onClick={() => withdraw(a.id)}
                        className="mt-2.5 rounded-full border border-line px-3.5 py-1.5 text-[11px] font-semibold text-zinc-400 transition hover:border-rose-400/40 hover:text-rose-300"
                      >
                        Withdraw application
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}
