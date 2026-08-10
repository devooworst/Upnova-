"use client";

/* ------------------------------------------------------------------ */
/*  /learn — the learning hub (LEVEL 2 home).                          */
/*                                                                     */
/*  "How would you like to learn?" — pick a path (client / provider /  */
/*  business / creator) and walk realistic scenarios in lifecycle      */
/*  order, or open any topic directly. Progress ticks per user.        */
/* ------------------------------------------------------------------ */

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import * as Lucide from "lucide-react";
import { useSession } from "@/lib/session";
import { LEARN_PATHS, LEARN_SCENARIOS, scenarioById } from "@/lib/learnScenarios";
import { openLearnGuide } from "@/components/LearnGuide"; // overlay is mounted globally in the root layout

function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = (Lucide as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] ?? Lucide.HelpCircle;
  return <Cmp className={className} />;
}

function LearnInner() {
  const { user } = useSession();
  const params = useSearchParams();
  const [learned, setLearned] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    fetch("/api/me/tours", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setLearned(d.tours ?? {}))
      .catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // deep link: /learn?path=provider auto-starts that path's first topic
  useEffect(() => {
    const pathId = params.get("path");
    if (!pathId) return;
    const p = LEARN_PATHS.find((x) => x.id === pathId);
    if (p) setTimeout(() => openLearnGuide(p.scenarioIds[0], p.id), 250);
  }, [params]);

  const isLearned = (id: string) => learned[`learn-${id}`] === "done";

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Learn UpNova</h1>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-zinc-400">
        Short, real-world walkthroughs — not a manual. You don&apos;t need to understand everything right now:
        pick what fits you, and explore at your own pace.
      </p>

      {/* ---- choose your path ---- */}
      <h2 className="mt-7 text-sm font-bold text-zinc-100">How would you like to learn?</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {LEARN_PATHS.map((p) => {
          const done = p.scenarioIds.filter(isLearned).length;
          return (
            <button
              key={p.id}
              onClick={() => openLearnGuide(p.scenarioIds[0], p.id)}
              className="card group p-4 text-left transition hover:border-zinc-600"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-400/10">
                <Icon name={p.icon} className="h-5 w-5 text-violet-300" />
              </span>
              <p className="mt-2.5 text-sm font-bold text-zinc-100 group-hover:text-lime-300">{p.label}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{p.blurb}</p>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-600">
                {p.scenarioIds.length} topics{done > 0 ? ` · ${done} learned` : ""}
              </p>
            </button>
          );
        })}
      </div>

      {/* ---- all topics ---- */}
      <h2 className="mt-8 text-sm font-bold text-zinc-100">All topics</h2>
      <p className="mt-0.5 text-[11px] text-zinc-500">Every guide answers: what is it, why use it, how it works, who it&apos;s for — with a real example.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {LEARN_SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => openLearnGuide(s.id)}
            className="group flex items-center gap-3 rounded-xl border border-line bg-card px-3.5 py-2.5 text-left transition hover:border-zinc-600"
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${isLearned(s.id) ? "border-lime-400/40 bg-lime-400/10" : "border-line bg-card-raised"}`}>
              {isLearned(s.id) ? <Lucide.Check className="h-4 w-4 text-lime-300" /> : <Icon name={s.flow[0]?.icon ?? "HelpCircle"} className="h-4 w-4 text-zinc-400" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-zinc-100 group-hover:text-lime-300">{s.title}</span>
              <span className="block truncate text-[10px] text-zinc-500">{s.tagline}</span>
            </span>
          </button>
        ))}
      </div>

    </div>
  );
}

export default function LearnPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 pt-6"><div className="h-8 w-48 animate-pulse rounded bg-card-raised" /></div>}>
      <LearnInner />
    </Suspense>
  );
}
