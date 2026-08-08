"use client";

import { useState } from "react";
import { Briefcase } from "lucide-react";
import OpportunityCard from "@/components/OpportunityCard";
import { opportunities, opportunityFilters } from "@/lib/data";

export default function OpportunitiesPage() {
  const [active, setActive] = useState<string[]>([]);

  const toggle = (f: string) =>
    setActive((a) => (a.includes(f) ? a.filter((x) => x !== f) : [...a, f]));

  const filtered = opportunities.filter((o) => {
    if (active.length === 0) return true;
    return active.every((f) => {
      switch (f) {
        case "Local":
          return ["Nearby", "Local", "City"].includes(o.reach.reach);
        case "Remote":
          return o.reach.reach === "Remote";
        case "Paid":
          return o.paid;
        case "Creative Projects":
          return ["Gig", "Collaboration", "Freelance"].includes(o.category);
        case "Events":
          return o.category === "Event Staff";
        default:
          return o.tags.includes(f) || o.category.toLowerCase().includes(f.toLowerCase());
      }
    });
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="px-1">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
            <Briefcase className="h-5 w-5 text-lime-400" />
          </span>
          Opportunities
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          <span className="font-semibold text-zinc-300">Find projects that are looking for people like you.</span>{" "}
          Brands, creators, businesses, and event organizers post paid work, collaborations, and
          project opportunities.
        </p>
      </header>

      <a
        href="/services"
        className="flex items-center gap-3 rounded-xl border border-line px-4 py-2.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300"
      >
        Want to hire someone instead? Browse Services — creators you can book directly →
      </a>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {opportunityFilters.map((f) => (
          <button
            key={f}
            onClick={() => toggle(f)}
            aria-pressed={active.includes(f)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              active.includes(f)
                ? "bg-white text-zinc-950"
                : "border border-line text-zinc-400 hover:bg-card-raised hover:text-zinc-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {filtered.map((o) => (
          <OpportunityCard key={o.id} id={o.id} />
        ))}
        {filtered.length === 0 && (
          <div className="card p-10 text-center text-sm text-zinc-500">
            No opportunities match those filters yet — try removing one.
          </div>
        )}
      </div>
    </div>
  );
}
