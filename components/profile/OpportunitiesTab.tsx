"use client";

/* ------------------------------------------------------------------ */
/*  Profile → Opportunities: the user's REAL work pipeline.            */
/*  Verified projects, applications, and posted listings all come      */
/*  from the same records the rest of the app drives.                  */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, ArrowRight, BadgeCheck, Star } from "lucide-react";

interface ProjectRow {
  id: string;
  title: string;
  amount: number;
  state: string;
  myRole: "client" | "creator";
  with: { displayName: string };
  updatedAt: string;
}

interface ApplicationRow {
  id: string;
  status: string;
  createdAt: string;
  opportunity: { id: string; title: string; budget: number | null; poster: string };
}

interface ListingRow {
  id: string;
  title: string;
  budget: number | null;
  status: string;
  isMine: boolean;
}

interface PortfolioProject {
  id: string;
  title: string;
  client: string;
  rating: number | null;
  inPortfolio: boolean;
}

const APP_LABEL: Record<string, { label: string; cls: string }> = {
  submitted: { label: "Under Review", cls: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  shortlisted: { label: "Shortlisted", cls: "border-violet-400/40 bg-violet-400/10 text-violet-300" },
  selected: { label: "Accepted", cls: "border-lime-400/40 bg-lime-400/10 text-lime-300" },
  declined: { label: "Declined", cls: "border-line text-zinc-500" },
};

export default function OpportunitiesTab({ isOwner }: { isOwner: boolean }) {
  const [completed, setCompleted] = useState<PortfolioProject[] | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [listings, setListings] = useState<ListingRow[]>([]);

  const load = useCallback(async () => {
    const [pf, apps, opps] = await Promise.all([
      fetch("/api/me/portfolio", { cache: "no-store" }),
      fetch("/api/me/applications", { cache: "no-store" }),
      fetch("/api/opportunities", { cache: "no-store" }),
    ]);
    if (pf.ok) setCompleted((await pf.json()).completedProjects ?? []);
    else setCompleted([]);
    if (apps.ok) setApplications((await apps.json()).applications ?? []);
    if (opps.ok) setListings(((await opps.json()).opportunities ?? []).filter((o: ListingRow) => o.isMine));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const togglePortfolio = async (p: PortfolioProject) => {
    if (p.inPortfolio) {
      // find the item id to remove
      const res = await fetch("/api/me/portfolio", { cache: "no-store" });
      const d = await res.json();
      const item = (d.items ?? []).find((i: { projectId: string | null }) => i.projectId === p.id);
      if (item) await fetch(`/api/me/portfolio?id=${item.id}`, { method: "DELETE" });
    } else {
      await fetch("/api/me/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: p.id }),
      });
    }
    load();
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        {isOwner ? (
          <>
            <span className="font-semibold text-zinc-200">Your work pipeline.</span> Verified
            projects, applications you sent, and listings you posted — all live records.
          </>
        ) : (
          <>
            <span className="font-semibold text-zinc-200">
              Here&apos;s what I&apos;m doing — and what I&apos;m looking for.
            </span>{" "}
            Verified work and open listings.
          </>
        )}
      </p>

      {/* Verified Mavyn projects — the real completed record */}
      <section>
        <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Experience · Verified Mavyn Projects
        </h3>
        {completed === null ? (
          <div className="card h-16 animate-pulse" aria-hidden />
        ) : completed.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-4 text-xs text-zinc-500">
            No completed projects yet. Finish a project and it appears here as verified history.
          </p>
        ) : (
          <div className="space-y-2.5">
            {completed.map((w) => (
              <article key={w.id} className="card-money flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <h4 className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-zinc-100">
                    {w.title}
                    <span className="inline-flex items-center gap-1 rounded-full border border-lime-400/40 bg-lime-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-lime-300">
                      <BadgeCheck className="h-3 w-3" /> Verified
                    </span>
                  </h4>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                    Client: {w.client}
                    {w.rating != null && (
                      <span className="flex items-center gap-0.5 font-semibold text-zinc-300">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {w.rating.toFixed(1)}
                      </span>
                    )}
                  </p>
                </div>
                {isOwner ? (
                  <button
                    onClick={() => togglePortfolio(w)}
                    className={
                      w.inPortfolio
                        ? "rounded-full border border-lime-400/40 px-3 py-1.5 text-[11px] font-semibold text-lime-300"
                        : "rounded-full border border-line px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition hover:border-zinc-600"
                    }
                  >
                    {w.inPortfolio ? "✓ In portfolio" : "Add to portfolio"}
                  </button>
                ) : (
                  <Link href={`/projects/${w.id}`} className="btn-ghost px-3 py-1.5 text-[11px]">
                    View <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}
        {isOwner && completed !== null && completed.length > 0 && (
          <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
            Completed projects appear publicly only when you add them — client work is never
            auto-exposed. Reviews come exclusively from verified projects.
          </p>
        )}
      </section>

      {/* Applications — same records as Opportunities → My Applications */}
      {isOwner && (
        <section>
          <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Applications
          </h3>
          {applications.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-4 text-xs text-zinc-500">
              Nothing pending.{" "}
              <Link href="/opportunities" className="text-lime-300 hover:underline">
                Browse opportunities →
              </Link>
            </p>
          ) : (
            <div className="space-y-2.5">
              {applications.map((a) => (
                <article key={a.id} className="card flex flex-wrap items-center gap-3 p-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-card-raised">
                    <Briefcase className="h-4 w-4 text-lime-400" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-zinc-100">{a.opportunity.title}</h4>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {a.opportunity.poster}
                      {a.opportunity.budget != null && ` · $${a.opportunity.budget}`} · applied{" "}
                      {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${APP_LABEL[a.status]?.cls}`}>
                    {APP_LABEL[a.status]?.label ?? a.status}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Listings I posted */}
      <section>
        <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Open Listings
        </h3>
        {listings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-4 text-xs text-zinc-500">
            No open listings.
          </p>
        ) : (
          <div className="space-y-2.5">
            {listings.map((o) => (
              <article key={o.id} className="card flex flex-wrap items-center gap-3 p-4 transition hover:border-zinc-600">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-400/10">
                  <Briefcase className="h-4 w-4 text-lime-400" />
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-zinc-100">{o.title}</h4>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {o.budget != null ? `$${o.budget}` : "Collaboration"} ·{" "}
                    {o.status === "open" ? "Accepting applications" : o.status}
                  </p>
                </div>
                {isOwner && (
                  <Link href={`/opportunities/${o.id}/applicants`} className="btn-ghost px-3 py-1.5 text-xs">
                    Applicants <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {isOwner && (
        <div className="card flex items-center gap-3 border-lime-400/25 bg-lime-400/5 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-400/15">
            <Briefcase className="h-5 w-5 text-lime-400" />
          </span>
          <p className="flex-1 text-sm text-zinc-300">
            Looking for your next gig? Browse opportunities matched to your skills and reach.
          </p>
          <Link href="/opportunities" className="btn-lime px-4 py-1.5 text-xs">
            Explore
          </Link>
        </div>
      )}
    </div>
  );
}
