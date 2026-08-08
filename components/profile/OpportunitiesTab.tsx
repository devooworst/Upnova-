"use client";

import { Briefcase, ArrowRight, BadgeCheck, Star } from "lucide-react";
import { profileOpportunities, workRecords } from "@/lib/data";
import { useProfile, getProfile, saveProfile } from "@/lib/profile";

const statusStyle: Record<string, string> = {
  "Applied • Under Review": "border-amber-400/40 bg-amber-400/10 text-amber-300",
  Completed: "border-lime-400/40 bg-lime-400/10 text-lime-300",
  Open: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  "Accepting Clients": "border-lime-400/40 bg-lime-400/10 text-lime-300",
};

export default function OpportunitiesTab({ isOwner }: { isOwner: boolean }) {
  // portfolio toggles live in the shared profile store — the same record
  // Edit Profile → Professional → Portfolio writes to
  const profile = useProfile();
  const inPortfolio = (id: string) => profile.workInPortfolio.includes(id);
  const togglePortfolio = (id: string) => {
    const p = getProfile();
    saveProfile({
      ...p,
      workInPortfolio: p.workInPortfolio.includes(id)
        ? p.workInPortfolio.filter((x) => x !== id)
        : [...p.workInPortfolio, id],
    });
  };
  const applications = profileOpportunities.filter((o) => o.kind === "application");
  const listings = profileOpportunities.filter((o) => o.kind === "listing");

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        {isOwner ? (
          <>
            <span className="font-semibold text-zinc-200">Your work pipeline.</span> Applications
            you sent, completed projects, and listings you posted.
          </>
        ) : (
          <>
            <span className="font-semibold text-zinc-200">
              Here&apos;s what I&apos;m doing — and what I&apos;m looking for.
            </span>{" "}
            Applications, completed work, and open listings.
          </>
        )}
      </p>

      {/* Experience — "look what I've actually done", verified through UpNova.
          Visitors only see this when the owner shows completed projects. */}
      {(isOwner || profile.showCompletedProjects) && (
      <section>
        <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Experience · Verified UpNova Projects
        </h3>
        <div className="space-y-2.5">
          {workRecords.map((w) => (
            <article key={w.id} className="card-money flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <h4 className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-zinc-100">
                  {w.title}
                  <span className="inline-flex items-center gap-1 rounded-full border border-lime-400/40 bg-lime-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-lime-300">
                    <BadgeCheck className="h-3 w-3" /> Verified
                  </span>
                </h4>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                  Client: {w.client} · Completed {w.completed}
                  <span className="flex items-center gap-0.5 font-semibold text-zinc-300">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {w.rating.toFixed(1)}
                  </span>
                </p>
              </div>
              {isOwner ? (
                <button
                  onClick={() => togglePortfolio(w.id)}
                  className={
                    inPortfolio(w.id)
                      ? "rounded-full border border-lime-400/40 px-3 py-1.5 text-[11px] font-semibold text-lime-300"
                      : "rounded-full border border-line px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition hover:border-zinc-600"
                  }
                >
                  {inPortfolio(w.id) ? "✓ In portfolio" : "Add to portfolio"}
                </button>
              ) : (
                inPortfolio(w.id) && <span className="text-[11px] text-zinc-500">Shown in portfolio</span>
              )}
            </article>
          ))}
        </div>
        {isOwner && (
          <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
            Completed projects appear publicly only when you add them — client work is never
            auto-exposed. Reviews come exclusively from verified projects.
          </p>
        )}
      </section>
      )}

      <section>
        <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Applications
        </h3>
        <div className="space-y-2.5">
          {applications.map((o) => (
            <article key={o.id} className="card flex flex-wrap items-center gap-3 p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-card-raised text-xl">
                {o.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-zinc-100">{o.title}</h4>
                <p className="mt-0.5 text-xs text-zinc-500">{o.detail}</p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-bold ${statusStyle[o.status]}`}
              >
                {o.status}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Open Listings
        </h3>
        <div className="space-y-2.5">
          {listings.map((o) => (
            <article key={o.id} className="card flex flex-wrap items-center gap-3 p-4 transition hover:border-zinc-600">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-400/10 text-xl">
                {o.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-zinc-100">{o.title}</h4>
                <p className="mt-0.5 text-xs text-zinc-500">{o.detail}</p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-bold ${statusStyle[o.status]}`}
              >
                {o.status}
              </span>
              <button className="btn-ghost px-3 py-1.5 text-xs">
                View <ArrowRight className="h-3 w-3" />
              </button>
            </article>
          ))}
        </div>
      </section>

      {isOwner && (
      <div className="card flex items-center gap-3 border-lime-400/25 bg-lime-400/5 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-400/15">
          <Briefcase className="h-5 w-5 text-lime-400" />
        </span>
        <p className="flex-1 text-sm text-zinc-300">
          Looking for your next gig? Browse opportunities matched to your skills and reach.
        </p>
        <a href="/opportunities" className="btn-lime px-4 py-1.5 text-xs">
          Explore
        </a>
      </div>
      )}
    </div>
  );
}
