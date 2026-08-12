"use client";

/* ------------------------------------------------------------------ */
/*  "SHOW ME WHERE" overlay — visual guidance that NEVER acts.         */
/*                                                                     */
/*  · Resolves each step's TARGET against the actual rendered DOM      */
/*    (data-guide / data-tour anchors) — never screen coordinates, so  */
/*    it survives scrolling, resizing, and responsive layouts.         */
/*  · Auto-scrolls off-screen targets into view, rings them with a     */
/*    pulse + arrow + short instruction, dims the rest for "click"     */
/*    steps, and stays attached (undimmed) while you work on "form"    */
/*    steps.                                                           */
/*  · Wrong click on a click-step → gentle correction, the guide and   */
/*    your test stay exactly where they were.                          */
/*  · Correct click → acknowledged; the DATABASE checkpoint remains    */
/*    the only judge of completion.                                    */
/*  · Target missing on the right page → an honest "Guide can't        */
/*    locate this control" report (expected target + page) instead of  */
/*    pointing at empty space — the Test Center QA's the UI itself.    */
/*  · pointer-events-none everywhere except the small card: it cannot  */
/*    click, type, submit, or complete anything for you.               */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowDown, ArrowUp, X, Check, TriangleAlert } from "lucide-react";
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
  const [minimized, setMinimized] = useState(false);
  const [wrongHint, setWrongHint] = useState(false);
  const [clickedOk, setClickedOk] = useState<number | null>(null); // step idx acknowledged
  const cardRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const scrolledFor = useRef<string | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMinimized(false); setClickedOk(null); }, [taskLabel]);

  const compute = useCallback(() => {
    // location-aware: the active step is the FIRST whose reach-condition
    // isn't met — already-satisfied steps (right page, panel open) skip
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
    // covered by the fixed navbar or outside the viewport? scroll it to
    // center ONCE per step — the spotlight never points at hidden space
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

  // INTERACTIVE: watch where the user actually clicks. Correct control →
  // acknowledge (verification still comes only from the database). Wrong
  // control on a click-step → gentle correction; the step never moves.
  useEffect(() => {
    const onDown = (e: Event) => {
      const t = e.target as Node;
      if (cardRef.current?.contains(t) || pillRef.current?.contains(t)) return; // guide UI itself
      const step = steps[idx];
      if (!step || minimized) return;
      const mode = step.kind ?? (step.until ? "click" : "click");
      if (mode !== "click") return; // form/visit steps: free interaction, no judgement
      const el = findAnchor(step.target);
      if (el && el.contains(t)) {
        setClickedOk(idx);
        setWrongHint(false);
      } else if (el) {
        setWrongHint(true);
        if (wrongTimer.current) clearTimeout(wrongTimer.current);
        wrongTimer.current = setTimeout(() => setWrongHint(false), 2600);
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [idx, steps, minimized]);

  const step = steps[idx];
  if (!step) return null;

  const mode: "click" | "form" | "visit" = step.kind ?? "click";
  const acknowledged = clickedOk === idx;
  // dim only while a single exact click is awaited; forms and post-click
  // phases stay bright so the page is fully usable while the guide watches
  const dimmed = mode === "click" && !acknowledged;

  if (minimized)
    return (
      <div ref={pillRef} className="fixed bottom-14 right-3 z-[95] flex items-center gap-2 rounded-full border border-amber-400/50 bg-[#141217]/95 px-3 py-1.5 shadow-2xl backdrop-blur">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-amber-300">Guide standing by</p>
        <button onClick={() => setMinimized(false)} className="rounded-full border border-line px-2 py-0.5 text-[10px] font-bold text-zinc-300 hover:border-zinc-500">
          Show
        </button>
        <button onClick={onExit} className="text-zinc-500 hover:text-zinc-200" aria-label="Exit guide" title="Exit guide">
          <X className="h-3 w-3" />
        </button>
      </div>
    );

  const missing = !!step.target && !rect; // target defined but not rendered here

  // card placement: adjacent for pinpoint clicks, corner-docked for forms
  const below = rect ? rect.top + rect.height + 190 < window.innerHeight : false;
  const adjacent = rect && mode === "click" && !acknowledged;
  const cardTop = adjacent ? (below ? rect.top + rect.height + 34 : undefined) : undefined;
  const cardBottom = adjacent && !below ? window.innerHeight - rect.top + 34 : undefined;
  const cardLeft = adjacent ? Math.min(Math.max(rect.left, 12), window.innerWidth - 332) : undefined;

  return (
    <div className="pointer-events-none fixed inset-0 z-[95]">
      {rect && mode !== "visit" ? (
        <>
          {/* spotlight ring — dim for exact clicks, bright for form work */}
          <div
            className={`absolute rounded-xl border-2 transition-all duration-200 ${acknowledged ? "border-lime-400" : "border-amber-400"}`}
            style={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
              boxShadow: dimmed
                ? "0 0 0 9999px rgba(0,0,0,0.55), 0 0 24px rgba(251,191,36,0.4)"
                : "0 0 18px rgba(251,191,36,0.35)",
            }}
          />
          <div
            className={`absolute animate-ping rounded-xl border-2 ${acknowledged ? "border-lime-400/50" : "border-amber-400/60"}`}
            style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
          />
          <div
            className={`absolute animate-bounce ${acknowledged ? "text-lime-300" : "text-amber-300"}`}
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
        ref={cardRef}
        className={`pointer-events-auto absolute w-80 rounded-2xl border p-3.5 shadow-2xl ${missing ? "border-rose-400/60 bg-[#1a1215]" : "border-amber-400/50 bg-[#141217]"}`}
        style={
          adjacent
            ? { top: cardTop, bottom: cardBottom, left: cardLeft }
            : { bottom: 88, left: 16 }
        }
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-amber-300">
            {missing ? "Guide problem" : `Showing you · step ${idx + 1} of ${steps.length}`}
          </p>
          <span className="flex items-center gap-2">
            <button onClick={() => setMinimized(true)} className="font-mono text-[9px] font-bold uppercase tracking-wide text-zinc-500 hover:text-zinc-200" title="Minimize — the page stays fully usable">
              Minimize
            </button>
            <button onClick={onExit} className="text-zinc-500 hover:text-zinc-200" aria-label="Exit guide" title="Exit guide">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
        <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-zinc-600">{taskLabel}</p>

        {missing ? (
          /* ---- HONEST FAILURE: never point at empty space ---- */
          <div className="mt-2">
            <p className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
              <TriangleAlert className="h-3.5 w-3.5" /> Guide can&apos;t locate this control
            </p>
            <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-zinc-400">
              expected: <span className="text-zinc-200">{step.label}</span>
              <br />
              target: <span className="text-zinc-200">{step.target}</span>
              <br />
              current page: <span className="text-zinc-200">{pathname}</span>
            </p>
            <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500">
              The control may be hidden on this screen size, behind a state this account isn&apos;t in — or this is a Test
              Center guidance bug. If it should exist right here, that&apos;s exactly the kind of UI bug this Lab exists to
              catch: report it.
            </p>
          </div>
        ) : (
          <>
            {idx > 0 && (
              <p className="mt-1.5 flex items-center gap-1 font-mono text-[9px] font-semibold text-lime-300">
                <Check className="h-3 w-3" /> Step {idx} complete
              </p>
            )}
            <p className="mt-1.5 text-xs font-semibold leading-relaxed text-zinc-100">{step.text}</p>
            {acknowledged && (
              <p className="mt-1.5 flex items-center gap-1 font-mono text-[9px] font-bold text-lime-300">
                <Check className="h-3 w-3" /> Clicked — the checkpoint verifies against the database automatically
              </p>
            )}
            {wrongHint && !acknowledged && (
              <p className="mt-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold text-amber-200">
                That&apos;s not the control for this step — use the highlighted one. Nothing broke; your test is still on this step.
              </p>
            )}
          </>
        )}

        <div className="mt-2 flex items-center justify-between border-t border-line pt-1.5">
          <p className="text-[9px] leading-relaxed text-zinc-600">
            {mode === "form" && !missing
              ? "Work freely — the guide stays attached and never blocks the form."
              : "The guide only points — you click. Only real database state passes the test."}
          </p>
          <button onClick={onExit} className="ml-2 shrink-0 rounded-full border border-lime-400/50 bg-lime-400/10 px-2.5 py-0.5 text-[10px] font-bold text-lime-300 hover:bg-lime-400/20">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
