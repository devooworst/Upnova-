"use client";

/* ------------------------------------------------------------------ */
/*  Opportunities — "we're looking for someone → Apply Now".           */
/*  Every listing is a DB record with a real poster; applying creates  */
/*  a real application; posters review applicants and select — which   */
/*  auto-creates the project.                                          */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { Briefcase } from "lucide-react";
import OpportunityList from "@/components/db/OpportunityList";

export default function OpportunitiesPage() {
  const [scope, setScope] = useState("for-you");

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
    </div>
  );
}
