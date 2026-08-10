"use client";

/* ------------------------------------------------------------------ */
/*  LearnGuide — the scenario overlay (LEVEL 2 learning).              */
/*                                                                     */
/*  Opened from anywhere via openLearnGuide(id) — the Learn hub, a     */
/*  FeatureTour's "Learn more", or a help link. Renders the scenario   */
/*  as a story + a visual step chain + What/Why/How/Who — friendly     */
/*  words, zero jargon. "Got it" marks it learned (per user, per       */
/*  feature); closing is just closing. When opened from a learning     */
/*  path, "Next topic" walks the whole lifecycle.                      */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import Link from "next/link";
import * as Lucide from "lucide-react";
import { useSession } from "@/lib/session";
import { scenarioById, LEARN_PATHS, type LearnScenario } from "@/lib/learnScenarios";

const EVENT = "upnova:learn";

export function openLearnGuide(id: string, pathId?: string) {
  window.dispatchEvent(new CustomEvent<{ id: string; pathId?: string }>(EVENT, { detail: { id, pathId } }));
}

function FlowIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = (Lucide as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] ?? Lucide.HelpCircle;
  return <Cmp className={className} />;
}

export default function LearnGuide() {
  const { user } = useSession();
  const [open, setOpen] = useState<{ s: LearnScenario; pathId?: string } | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const { id, pathId } = (e as CustomEvent<{ id: string; pathId?: string }>).detail;
      const s = scenarioById(id);
      if (s) setOpen({ s, pathId });
    };
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, []);

  if (!open) return null;
  const { s, pathId } = open;

  const path = pathId ? LEARN_PATHS.find((p) => p.id === pathId) : null;
  const idx = path ? path.scenarioIds.indexOf(s.id) : -1;
  const nextId = path && idx >= 0 && idx < path.scenarioIds.length - 1 ? path.scenarioIds[idx + 1] : null;
  const next = nextId ? scenarioById(nextId) : null;

  const markLearned = () => {
    if (user)
      fetch("/api/me/tours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: `learn-${s.id}`, status: "done" }),
      }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setOpen(null)}>
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            {path && (
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-violet-300">
                {path.label} · {idx + 1}/{path.scenarioIds.length}
              </p>
            )}
            <h2 className="mt-0.5 text-lg font-bold tracking-tight text-zinc-50">{s.title}</h2>
            <p className="text-xs text-zinc-500">{s.tagline}</p>
          </div>
          <button onClick={() => setOpen(null)} className="rounded-md p-1 text-zinc-500 hover:text-zinc-200" aria-label="Close guide">
            <Lucide.X className="h-4 w-4" />
          </button>
        </div>

        {/* the story — a real situation, not a definition */}
        <div className="mt-4 rounded-xl border border-violet-400/20 bg-violet-400/5 p-3.5">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-violet-300">Real-world example</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-300">{s.story}</p>
        </div>

        {/* the visual chain */}
        <div className="mt-4 rounded-xl border border-line bg-card-raised p-3.5">
          <ol className="space-y-0">
            {s.flow.map((f, i) => (
              <li key={i}>
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-lime-400/30 bg-lime-400/10">
                    <FlowIcon name={f.icon} className="h-4 w-4 text-lime-300" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-100">{f.label}</p>
                    {f.note && <p className="text-[10px] text-zinc-500">{f.note}</p>}
                  </div>
                </div>
                {i < s.flow.length - 1 && <div className="ml-4 h-3.5 w-px bg-lime-400/25" aria-hidden />}
              </li>
            ))}
          </ol>
        </div>

        {/* what / why / how / who */}
        <div className="mt-4 space-y-2.5">
          {([
            ["What is this?", s.what],
            ["Why would I use it?", s.why],
            ["How does it work?", s.how],
            ["Who uses it?", s.who],
          ] as const).map(([q, a]) => (
            <div key={q}>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">{q}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{a}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
          {next ? (
            <button onClick={() => { markLearned(); setOpen({ s: next, pathId }); }} className="btn-lime px-4 py-2 text-xs">
              Next topic: {next.title}
            </button>
          ) : (
            <button onClick={() => { markLearned(); setOpen(null); }} className="btn-lime px-4 py-2 text-xs">
              Got it
            </button>
          )}
          {s.href && (
            <Link href={s.href} onClick={() => { markLearned(); setOpen(null); }} className="btn-ghost px-3.5 py-2 text-xs">
              Open that page
            </Link>
          )}
          <button onClick={() => setOpen(null)} className="ml-auto text-[10px] text-zinc-500 hover:text-zinc-300">
            Close
          </button>
        </div>
        <p className="mt-2 text-[10px] text-zinc-600">You don&apos;t need to understand everything right now — explore UpNova at your own pace.</p>
      </div>
    </div>
  );
}
