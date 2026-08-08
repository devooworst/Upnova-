"use client";

/* ------------------------------------------------------------------ */
/*  Opportunities — "we're looking for someone → Apply Now".           */
/*  Every listing is a DB record with a real poster; applying creates  */
/*  a real application; posters review applicants and select — which   */
/*  auto-creates the project.                                          */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import { Briefcase } from "lucide-react";
import OpportunityList from "@/components/db/OpportunityList";

interface MyApplication {
  id: string;
  status: "submitted" | "shortlisted" | "selected" | "declined";
  availability: string;
  message: string;
  createdAt: string;
  opportunity: { id: string; title: string; budget: number | null; location: string; status: string; poster: string };
}

const APP_STATUS: Record<string, { label: string; cls: string }> = {
  submitted: { label: "Under Review", cls: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  shortlisted: { label: "Shortlisted", cls: "border-violet-400/40 bg-violet-400/10 text-violet-300" },
  selected: { label: "Accepted", cls: "border-lime-400/40 bg-lime-400/10 text-lime-300" },
  declined: { label: "Declined", cls: "border-line text-zinc-500" },
};

export default function OpportunitiesPage() {
  const [scope, setScope] = useState("for-you");
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
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
          <Briefcase className="h-4.5 w-4.5 h-5 w-5 text-lime-400" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Opportunities</h1>
          <p className="text-sm text-zinc-400">Paid work and collaborations from real posters. Apply Now — never pitch.</p>
        </div>
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
                      {a.opportunity.budget != null && (
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
                {expanded === a.id && (
                  <div className="mt-3 border-t border-line-soft pt-3">
                    {a.message && <p className="text-xs leading-relaxed text-zinc-400">&ldquo;{a.message}&rdquo;</p>}
                    <p className="mt-1.5 text-[11px] text-zinc-500">
                      Availability: {a.availability === "yes" ? "confirmed for the date" : "needs to check schedule"}
                    </p>
                    {a.status !== "selected" && a.status !== "declined" && (
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
