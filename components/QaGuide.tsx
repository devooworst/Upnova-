"use client";

/* ------------------------------------------------------------------ */
/*  "SHOW ME WHERE" overlay — visual guidance that NEVER acts.         */
/*                                                                     */
/*  · Spotlights the next required control (ring + pulse + arrow +     */
/*    short instruction + step counter).                               */
/*  · Knows where the user is: steps whose reach-condition is already  */
/*    met are skipped, so someone already on Messages starts at        */
/*    "Open the Test Creator conversation", not at step 1.             */
/*  · The overlay is pointer-events-none: every click lands on the     */
/*    REAL interface. It cannot click, type, submit, or complete       */
/*    anything — the user performs every action; the database is the   */
/*    only judge.                                                      */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowDown, ArrowUp, X, Check } from "lucide-react";
import type { GuideStep } from "@/lib/qaGuides";

function findAnchor(name: string): HTMLElement | null {
  if (!name) return null;
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-guide="${name}"], [data-tour="${name}"]`)
  );
  return (
    nodes.find((n) => {
      const r = n.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && n.offsetParent !== null;
    }) ?? null
  );
}

export default function QaGuide({
  taskLabel,
  steps,
  onExit,
}: {
  taskLabel: string; // e.g. "PROJECT · TEST 1 OF 12"
  steps: GuideStep[];
  onExit: () => void;
}) {
  const pathname = usePathname();
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  // one gentle scroll per step — if the target exists but sits under the
  // fixed navbar or below the fold, bring it into view (a view adjustment,
  // never an action: nothing is clicked, typed, or submitted)
  const scrolledFor = useRef<string | null>(null);

  const compute = useCallback(() => {
    // the guide knows where you are: the active step is the FIRST one
    // whose reach-condition isn't met yet — already-satisfied steps
    // (right page, panel already open) are skipped automatically
    let active = steps.length - 1;
    for (let i = 0; i < steps.length; i++) {
      const u = steps[i].until;
      const reached = u?.path
        ? (pathname ?? "").startsWith(u.path)
        : u?.visible
          ? !!findAnchor(u.visible)
          : false;
      if (!reached) {
        active = i;
        break;
      }
    }
    setIdx(active);
    const el = findAnchor(steps[active]?.target ?? "");
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    // covered by the fixed navbar (top ~72px) or cut off by the viewport /
    // Test Session bar? Scroll it to center ONCE for this step — the
    // spotlight must never point at something the user cannot see.
    const key = `${pathname}:${active}:${steps[active]?.target}`;
    const hidden = r.top < 80 || r.bottom > window.innerHeight - 90;
    if (hidden && scrolledFor.current !== key) {
      scrolledFor.current = key;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [steps, pathname]);

  useEffect(() => {
    compute();
    const t = setInterval(compute, 350);
    const onScroll = () => compute();
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      clearInterval(t);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [compute]);

  const step = steps[idx];
  if (!step) return null;

  // tooltip placement: below the target if there's room, else above
  const below = rect ? rect.top + rect.height + 170 < window.innerHeight : false;
  const cardTop = rect ? (below ? rect.top + rect.height + 34 : undefined) : undefined;
  const cardBottom = rect && !below ? window.innerHeight - rect.top + 34 : undefined;
  const cardLeft = rect ? Math.min(Math.max(rect.left, 12), window.innerWidth - 332) : undefined;

  return (
    <div className="pointer-events-none fixed inset-0 z-[95]">
      {rect ? (
        <>
          {/* spotlight ring — dimmed everything else, target stays hot */}
          <div
            className="absolute rounded-xl border-2 border-amber-400 transition-all duration-200"
            style={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.55), 0 0 24px rgba(251,191,36,0.4)",
            }}
          />
          <div
            className="absolute animate-ping rounded-xl border-2 border-amber-400/60"
            style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
          />
          {/* the arrow */}
          <div
            className="absolute animate-bounce text-amber-300"
            style={
              below
                ? { top: rect.top + rect.height + 6, left: rect.left + rect.width / 2 - 10 }
                : { top: rect.top - 28, left: rect.left + rect.width / 2 - 10 }
            }
          >
            {below ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}
          </div>
        </>
      ) : null}

      {/* instruction card — the only interactive part of the overlay */}
      <div
        className="pointer-events-auto absolute w-80 rounded-2xl border border-amber-400/50 bg-[#141217] p-3.5 shadow-2xl"
        style={
          rect
            ? { top: cardTop, bottom: cardBottom, left: cardLeft }
            : { bottom: 88, left: "50%", transform: "translateX(-50%)" }
        }
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-amber-300">
            Guide · step {idx + 1} of {steps.length}
          </p>
          <button onClick={onExit} className="text-zinc-500 hover:text-zinc-200" aria-label="Exit guide" title="Exit guide">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-zinc-600">{taskLabel}</p>
        {idx > 0 && (
          <p className="mt-1.5 flex items-center gap-1 font-mono text-[9px] font-semibold text-lime-300">
            <Check className="h-3 w-3" /> Step {idx} complete
          </p>
        )}
        <p className="mt-1.5 text-xs font-semibold leading-relaxed text-zinc-100">{step.text}</p>
        {!rect && step.target && (
          <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500">
            Can&apos;t highlight it from this page — follow the instruction above, or use &quot;Take me there&quot; in the Test Session bar.
          </p>
        )}
        <p className="mt-2 border-t border-line pt-1.5 text-[9px] leading-relaxed text-zinc-600">
          The guide only points — you click. The checkpoint verifies your real action automatically.
        </p>
      </div>
    </div>
  );
}
