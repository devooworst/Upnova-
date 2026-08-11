"use client";

/* ------------------------------------------------------------------ */
/*  GUIDED INPUTS — the "here's exactly what to type" block.           */
/*  Copyable example values for every form field a QA task needs,      */
/*  plus optional "Fill example data": populates the REAL form via a   */
/*  window event and NEVER submits — the tester reviews and presses    */
/*  the actual button; the checkpoint verifies only the database.      */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import { Copy, Check, Wand2 } from "lucide-react";
import { examplesFor } from "@/lib/qaExamples";

export default function QaExampleValues({ scenarioId, stepId, compact = false }: { scenarioId: string; stepId: string; compact?: boolean }) {
  const [copied, setCopied] = useState<number | null>(null);
  const [filled, setFilled] = useState(false);
  const ex = examplesFor(scenarioId, stepId);
  if (!ex) return null;

  const copy = async (i: number, v: string) => {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(i);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* clipboard unavailable — the value is still visible */ }
  };

  return (
    <div className={compact ? "mt-1.5" : "mt-2.5"}>
      <p className={`font-mono font-bold uppercase text-zinc-600 ${compact ? "text-[8px] tracking-[0.14em]" : "text-[9px] tracking-[0.16em]"}`}>
        Use these example values
      </p>
      <div className="mt-1 space-y-0.5">
        {ex.fields.map((f, i) => (
          <button
            key={i}
            onClick={() => copy(i, f.value)}
            title="Click to copy"
            className={`flex w-full items-start gap-2 rounded-lg border border-line bg-black/30 px-2 py-1 text-left transition hover:border-zinc-600 ${compact ? "text-[9px]" : "text-[10px]"}`}
          >
            <span className="w-[38%] shrink-0 font-semibold text-zinc-500">{f.label}</span>
            <span className="min-w-0 flex-1 break-words font-mono text-zinc-200">{f.value}</span>
            {copied === i ? <Check className="mt-0.5 h-3 w-3 shrink-0 text-lime-400" /> : <Copy className="mt-0.5 h-3 w-3 shrink-0 text-zinc-600" />}
          </button>
        ))}
      </div>
      {ex.fill && (
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent("mavyn:qa-fill", { detail: ex.fill }));
            setFilled(true);
            setTimeout(() => setFilled(false), 2500);
          }}
          className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-violet-400/50 bg-violet-400/10 font-bold text-violet-200 hover:bg-violet-400/20 ${compact ? "px-2.5 py-0.5 text-[9px]" : "px-3 py-1 text-[10px]"}`}
          title="Populates the form with these values — never submits. You review and press the real button; only the database state passes the test."
        >
          <Wand2 className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
          {filled ? "Filled — review it, then submit yourself" : "Fill example data (never submits)"}
        </button>
      )}
      {ex.fill && !filled && (
        <p className={`mt-1 text-zinc-600 ${compact ? "text-[8px]" : "text-[9px]"}`}>
          Works when the form is open on screen — use &quot;Take me there&quot; first if needed.
        </p>
      )}
    </div>
  );
}
