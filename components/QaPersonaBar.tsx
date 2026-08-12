"use client";

/* ------------------------------------------------------------------ */
/*  QA persona bar — always visible while you're inside a TEST         */
/*  persona, so two-sided testing never leaves you wondering who you   */
/*  are. Switch sides in one click; exit back to your own account.     */
/*  Renders only on demo deployments, only for QA personas.            */
/*                                                                     */
/*  THE TEST SESSION IS CLOSED BY DEFAULT. The compact bar always      */
/*  shows the scenario, the current test number, and the objective —   */
/*  the full briefing panel opens ONLY when the user asks (Open        */
/*  briefing / Need help?). It never auto-opens: not on page load,     */
/*  not after navigation, not after a refresh or persona switch.       */
/*                                                                     */
/*  GUIDANCE ("Show me where"): a visual spotlight that points at the  */
/*  exact control for the current step — and never acts. The user      */
/*  performs everything; the database is the only judge.               */
/*                                                                     */
/*  The current task comes from the server's strict sequential         */
/*  progression (tasks unlock 1 → 2 → 3 …) — exactly ONE step is ever  */
/*  "pending", so the bar can never present Test 4 on a fresh run.     */
/*  When a task verifies, the bar holds on "✓ TASK COMPLETE" until     */
/*  the user presses "Next task →" — nothing jumps ahead by itself.    */
/* ------------------------------------------------------------------ */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { FlaskConical, LogOut, RefreshCw, ArrowRight, Check, LifeBuoy, Crosshair, BookOpen, Target as TargetIcon, XCircle } from "lucide-react";
import { useSession } from "@/lib/session";
import { QA_HANDLES, QA_LABEL, isQaHandle, switchPersona, exitQa, stashedReturn } from "@/lib/qaLab";
import { buildBriefing, type MissionBriefing } from "@/lib/qaBriefing";
import { guideFor, guideBreadcrumb, type GuideStep } from "@/lib/qaGuides";
import QaGuide from "@/components/QaGuide";
import QaExampleValues from "@/components/QaExampleValues";

type NextTask = {
  id: string; // "<scenario>:<step>"
  sid: string;
  stepId: string;
  scenario: string;
  title: string;
  href: string;
  idx: number;
  total: number;
  mine: boolean;
  role: string;
  brief: MissionBriefing;
  instruction: string;
  blocked: string | null;
  repairable: boolean;
};

const GUIDE_KEY = "mavyn-qa-guide"; // sessionStorage: task id the guide is active for

export default function QaPersonaBar() {
  const { user } = useSession();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nextTask, setNextTask] = useState<NextTask | null>(null);
  /* COLLAPSED BY DEFAULT — the Test Session lives in a tiny corner pill
     until explicitly opened, and folds back the moment you interact
     with the page, so it can never block a submit button, a form
     field, or any control a test needs. Pure presentation: checkpoint
     logic, progression, and verification are untouched. */
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  /* CLOSED unless the user explicitly opens it — never auto-opens */
  const [briefOpen, setBriefOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  /* visual guide — active only for the task the user asked about */
  const [guideTask, setGuideTask] = useState<string | null>(null);
  /* §AFTER SUCCESS: hold the pass on screen until the user continues */
  const [justDone, setJustDone] = useState<{ title: string; idx: number; total: number; scenario: string; resumeGuide: boolean } | null>(null);
  const prevTask = useRef<NextTask | null>(null);

  const stopGuide = () => {
    setGuideTask(null);
    try { sessionStorage.removeItem(GUIDE_KEY); } catch {}
  };

  // THE PANEL GETS OUT OF THE WAY: any interaction with the real page
  // (a click outside the panel) folds it back to the corner pill —
  // it can never sit on top of the control you're about to press.
  useEffect(() => {
    if (!panelOpen) return;
    const onDown = (e: Event) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setPanelOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [panelOpen]);

  useEffect(() => {
    if (!user || !isQaHandle(user.handle)) return;
    let dead = false;
    const poll = async () => {
      try {
        const st = await (await fetch("/api/qa/state", { cache: "no-store" })).json();
        const armed = (st.scenarios ?? []).find((s: { startedAt: string | null; completed?: boolean }) => s.startedAt && !s.completed);
        if (!armed) { if (!dead) setNextTask(null); return; }
        const d = await (await fetch(`/api/qa/scenarios/${armed.id}`, { cache: "no-store" })).json();
        const steps = d.steps ?? [];
        // strict order: the server marks exactly ONE step "pending" —
        // that IS the current task, whoever's move it is
        const pick = steps.find((x: { status: string }) => x.status === "pending");
        if (!dead)
          setNextTask(pick ? {
            id: `${armed.id}:${pick.id}`,
            sid: armed.id,
            stepId: pick.id,
            scenario: String(d.title ?? "").split(" — ")[0],
            title: pick.title,
            href: pick.href && pick.href !== "#" ? pick.href : "/simulation",
            idx: steps.findIndex((x: { id: string }) => x.id === pick.id) + 1,
            total: steps.length,
            mine: pick.role === user.handle,
            role: pick.role,
            brief: buildBriefing(pick),
            instruction: pick.instruction,
            blocked: pick.blocked ?? null,
            repairable: !!pick.repairable,
          } : null);
      } catch { /* the bar never breaks the page */ }
    };
    poll();
    const t = setInterval(poll, 6000);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => { dead = true; clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [user?.handle]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Show me where" can also be requested from the Test Center card
  useEffect(() => {
    const onGuide = (e: Event) => {
      const id = (e as CustomEvent).detail?.task;
      if (typeof id === "string") { setGuideTask(id); try { sessionStorage.setItem(GUIDE_KEY, id); } catch {} }
    };
    window.addEventListener("mavyn:qa-guide", onGuide);
    // resume a guide the user had running before a reload
    try { const saved = sessionStorage.getItem(GUIDE_KEY); if (saved) setGuideTask(saved); } catch {}
    return () => window.removeEventListener("mavyn:qa-guide", onGuide);
  }, []);

  // the current task CHANGED → the previous one VERIFIED. Hold the pass
  // on screen; the user moves on with "Next task →" — no auto-jump.
  useEffect(() => {
    const prev = prevTask.current;
    if (nextTask && prev && prev.id !== nextTask.id) {
      if (prev.sid === nextTask.sid && nextTask.idx > prev.idx) {
        setJustDone({ title: prev.title, idx: prev.idx, total: prev.total, scenario: prev.scenario, resumeGuide: guideTask === prev.id });
      }
      // a finished task's guide is obsolete — never point at stale UI
      if (guideTask === prev.id) stopGuide();
      setBriefOpen(false);
      setHelpOpen(false);
    }
    if (!nextTask) { setBriefOpen(false); setHelpOpen(false); }
    prevTask.current = nextTask;
  }, [nextTask?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || !user.demoTools || !isQaHandle(user.handle)) return null;
  if (pathname?.startsWith("/profile/studio/world")) return null; // full-screen editor stays clean

  const ret = typeof window !== "undefined" ? stashedReturn() : null;

  const go = async (h: string) => {
    if (h === user.handle) return;
    setBusy(true);
    setErr(null);
    const e = await switchPersona(h, pathname || "/");
    if (e) {
      setErr(e);
      setBusy(false);
    }
  };

  const startGuide = () => {
    if (!nextTask) return;
    setGuideTask(nextTask.id);
    try { sessionStorage.setItem(GUIDE_KEY, nextTask.id); } catch {}
    setBriefOpen(false);
    setHelpOpen(false);
  };

  // guidance only ever renders for the CURRENT task — never a stale one
  const guideSteps: GuideStep[] | null =
    nextTask && guideTask === nextTask.id && nextTask.mine && !justDone
      ? guideFor(nextTask.sid, nextTask.stepId, nextTask.href, nextTask.brief.steps[0] ?? nextTask.title)
      : null;
  const youWill = nextTask ? guideBreadcrumb(nextTask.sid, nextTask.stepId, nextTask.href, nextTask.title) : "";

  return (
    <>
      {guideSteps && nextTask && (
        <QaGuide taskLabel={`${nextTask.scenario} · Test ${nextTask.idx} of ${nextTask.total}`} persona={QA_LABEL[user.handle] ?? user.handle} steps={guideSteps} onExit={stopGuide} />
      )}
      {!panelOpen ? (
        /* ---- COLLAPSED (default): a tiny corner pill — the whole page
             stays usable. Status at a glance, one click to open. ---- */
        <button
          onClick={() => setPanelOpen(true)}
          className="fixed bottom-3 right-3 z-[90] flex items-center gap-2 rounded-full border border-amber-400/50 bg-[#141217]/95 px-3 py-1.5 shadow-2xl backdrop-blur transition hover:border-amber-300/70"
          title="Open the Test Session panel"
        >
          <FlaskConical className="h-3.5 w-3.5 text-amber-300" />
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-amber-300">
            {(QA_LABEL[user.handle] ?? user.handle).replace("TEST ", "")}
          </span>
          {justDone ? (
            <span className="rounded-full border border-lime-400/60 bg-lime-400/15 px-1.5 py-px font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-lime-300">
              <Check className="mr-0.5 inline h-2.5 w-2.5 align-[-1px]" /> Task done
            </span>
          ) : nextTask ? (
            <span className={`font-mono text-[9px] font-bold tracking-[0.08em] ${nextTask.blocked ? "text-rose-300" : "text-zinc-400"}`}>
              {nextTask.blocked ? "state needs restore" : `Task ${nextTask.idx}/${nextTask.total}`}
            </span>
          ) : (
            <span className="font-mono text-[9px] text-zinc-500">no scenario armed</span>
          )}
          <span className="rounded-full border border-line px-2 py-px text-[9px] font-bold text-zinc-300">Open</span>
        </button>
      ) : (
        /* ---- EXPANDED: a corner panel (bottom sheet on small screens),
             scrollable, with an explicit Minimize — and it auto-folds on
             any page interaction so it never blocks a control. ---- */
        <div ref={panelRef} className="fixed bottom-2 right-2 z-[90] w-[calc(100vw-1rem)] sm:bottom-3 sm:right-3 sm:w-[min(30rem,calc(100vw-1.5rem))]">
          <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-amber-400/40 bg-[#141217]/95 px-3 py-2 shadow-2xl backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">
                <FlaskConical className="h-3.5 w-3.5" />
                Test session · {QA_LABEL[user.handle] ?? user.handle}
              </p>
              <button
                onClick={() => setPanelOpen(false)}
                className="rounded-full border border-line px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                title="Minimize to the corner pill — your place in the scenario is kept"
              >
                Minimize
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {QA_HANDLES.map((h) => (
                <button
                  key={h}
                  disabled={busy || h === user.handle}
                  onClick={() => go(h)}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
                    h === user.handle
                      ? "border-amber-400/60 bg-amber-400/15 text-amber-200"
                      : "border-line text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  {busy ? <RefreshCw className="h-3 w-3 animate-spin" /> : QA_LABEL[h].replace("TEST ", "")}
                </button>
              ))}
              <a href="/simulation" className="rounded-full border border-lime-400/40 bg-lime-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-lime-300 hover:bg-lime-400/20">
                Test Center
              </a>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const e = await exitQa();
                  if (e) {
                    setErr(e);
                    setBusy(false);
                  }
                }}
                className="rounded-full border border-line px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400 hover:border-rose-400/40 hover:text-rose-300"
                title={ret ? `Back to @${ret.handle}` : "Exit test session"}
              >
                <LogOut className="mr-1 inline h-3 w-3 align-[-2px]" />
                Exit{ret ? ` → @${ret.handle}` : ""}
              </button>
            </div>

          {/* ---- NEED HELP? — the confusion exit ramp ---- */}
          {nextTask && helpOpen && !justDone && (
            <div className="mb-2 rounded-xl border border-line bg-black/40 p-3">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-400">How can we help?</p>
              <div className="mt-2 grid gap-1.5">
                {nextTask.mine && (
                  <button onClick={startGuide} className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-1.5 text-left text-[11px] font-semibold text-amber-200 hover:bg-amber-400/15">
                    <Crosshair className="h-3.5 w-3.5 shrink-0" /> Show me where — spotlight the exact button, step by step (you still click everything yourself)
                  </button>
                )}
                <button onClick={() => { setBriefOpen(true); setHelpOpen(false); }} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-left text-[11px] font-semibold text-zinc-300 hover:border-zinc-500">
                  <BookOpen className="h-3.5 w-3.5 shrink-0" /> Show the instructions — reopen the full task briefing
                </button>
                <button onClick={() => { setBriefOpen(true); setHelpOpen(false); }} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-left text-[11px] font-semibold text-zinc-300 hover:border-zinc-500">
                  <TargetIcon className="h-3.5 w-3.5 shrink-0" /> What am I trying to accomplish? — the objective and success condition
                </button>
                {guideTask && (
                  <button onClick={() => { stopGuide(); setHelpOpen(false); }} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-left text-[11px] font-semibold text-zinc-400 hover:border-zinc-500">
                    <XCircle className="h-3.5 w-3.5 shrink-0" /> Exit guide
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ---- THE MISSION BRIEFING — who am I · what do I do · where ·
               what does success look like. Opens ONLY on user request. ---- */}
          {nextTask && briefOpen && !justDone && (
            <div className="mb-2 rounded-xl border border-amber-400/30 bg-black/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-amber-300">
                  {nextTask.scenario} · Test {nextTask.idx} of {nextTask.total}
                </p>
                <button onClick={() => setBriefOpen(false)} className="font-mono text-[10px] text-zinc-500 hover:text-zinc-300" aria-label="Close briefing">✕</button>
              </div>
              {nextTask.role === "check" ? (
                <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-300">
                  <span className="font-bold text-zinc-100">Automatic cross-check:</span> {nextTask.title}. This verifies
                  itself against the database — no action needed. Waiting for: <span className="font-mono text-amber-300">{nextTask.brief.success}</span>
                </p>
              ) : (
                <>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-zinc-600">You are testing as</span>
                    <span className="rounded-md border border-violet-400/40 bg-violet-400/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-violet-200">
                      {nextTask.brief.roleLabel}
                    </span>
                    {user.handle === nextTask.brief.role ? (
                      <span className="font-mono text-[9px] font-semibold text-lime-300">✓ that&apos;s you, right now</span>
                    ) : (
                      <button disabled={busy} onClick={() => go(nextTask.brief.role)} className="rounded-full border border-violet-400/50 px-2 py-0.5 text-[9px] font-bold text-violet-200 hover:bg-violet-400/15">
                        Switch to {nextTask.brief.roleLabel} →
                      </button>
                    )}
                  </div>
                  {nextTask.blocked && (
                    <div className="mt-2 rounded-lg border border-rose-400/40 bg-rose-400/5 p-2.5">
                      <p className="font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-rose-300">Required state missing</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-300">{nextTask.blocked}.</p>
                      {nextTask.repairable && (
                        <button
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await fetch(`/api/qa/scenarios/${nextTask.sid}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "repair" }) });
                            } catch {}
                            setBusy(false);
                          }}
                          className="mt-1.5 rounded-full border border-rose-400/50 bg-rose-400/10 px-2.5 py-1 text-[10px] font-bold text-rose-200 hover:bg-rose-400/20"
                        >
                          Restore required state
                        </button>
                      )}
                    </div>
                  )}
                  <p className="mt-2 font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-zinc-600">Your goal</p>
                  <p className="mt-0.5 text-[11px] font-bold text-zinc-100">{nextTask.brief.objective}</p>
                  {youWill && (
                    <p className="mt-1 font-mono text-[9px] tracking-[0.04em] text-zinc-500">
                      <span className="font-bold uppercase tracking-[0.14em] text-zinc-600">You will:</span> {youWill}
                    </p>
                  )}
                  <p className="mt-2 font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-zinc-600">What to do</p>
                  <ol className="mt-0.5 space-y-px">
                    {nextTask.brief.steps.map((line, i) => (
                      <li key={i} className="flex gap-1.5 text-[10px] leading-relaxed text-zinc-400">
                        <span className="font-mono text-zinc-600">{i + 1}.</span> {line}
                      </li>
                    ))}
                  </ol>
                  <QaExampleValues scenarioId={nextTask.sid} stepId={nextTask.stepId} compact />
                  <p className="mt-1.5 font-mono text-[9px] leading-relaxed text-lime-300/90">success: ✓ {nextTask.brief.success}</p>
                  {user.handle === nextTask.brief.role && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setBriefOpen(false)}
                        className="inline-flex items-center gap-1 rounded-full border border-lime-400/50 bg-lime-400/10 px-3 py-1 text-[10px] font-bold text-lime-300 hover:bg-lime-400/20"
                        title="Closes the briefing so you can perform the task — completion is verified from the database, never from this button"
                      >
                        Start task <ArrowRight className="h-3 w-3" />
                      </button>
                      <button
                        onClick={startGuide}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-400/10 px-3 py-1 text-[10px] font-bold text-amber-200 hover:bg-amber-400/20"
                        title="A visual spotlight points at the exact control for each step — it never clicks or completes anything for you"
                      >
                        <Crosshair className="h-3 w-3" /> Show me where
                      </button>
                      {pathname !== nextTask.brief.href.split("?")[0] && (
                        <a
                          href={nextTask.brief.href}
                          className="rounded-full border border-line px-2.5 py-1 text-[10px] font-semibold text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                          title="Optional: jump to the page where this task happens"
                        >
                          Take me there
                        </a>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ---- ✓ TASK COMPLETE — held until the user continues ---- */}
          {justDone && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 border-t border-lime-400/20 pt-1.5">
              <p className="min-w-0 flex-1 truncate text-[10px]">
                <span className="mr-1.5 rounded-full border border-lime-400/60 bg-lime-400/15 px-2 py-px font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-lime-300">
                  <Check className="mr-0.5 inline h-2.5 w-2.5 align-[-1px]" /> Task complete
                </span>
                <span className="font-mono font-bold uppercase tracking-[0.1em] text-zinc-500">
                  {justDone.scenario} · test {justDone.idx} of {justDone.total}
                </span>{" "}
                <span className="text-zinc-400">— {justDone.title}</span>
              </p>
              <button
                onClick={() => {
                  const resume = justDone.resumeGuide;
                  setJustDone(null);
                  setBriefOpen(true); // the user asked to continue — show the next briefing
                  if (resume && nextTask) { setGuideTask(nextTask.id); try { sessionStorage.setItem(GUIDE_KEY, nextTask.id); } catch {} }
                }}
                className="flex shrink-0 items-center gap-1 rounded-full border border-lime-400/50 bg-lime-400/10 px-2.5 py-0.5 text-[10px] font-bold text-lime-300 hover:bg-lime-400/20"
              >
                Next task <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* the compact session line: scenario · test N of M · objective —
              always useful while the panel stays closed */}
          {nextTask && !justDone && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 border-t border-amber-400/15 pt-1.5">
              <p className="min-w-0 flex-1 truncate text-[10px] text-zinc-400">
                <span className="font-mono font-bold uppercase tracking-[0.1em] text-zinc-500">
                  {nextTask.scenario} · test {nextTask.idx} of {nextTask.total}
                </span>{" "}
                — {nextTask.blocked ? `required state missing — open the briefing to restore it` : nextTask.role === "check" ? `auto-check verifying: ${nextTask.title}` : nextTask.mine ? nextTask.title : `waiting on ${QA_LABEL[nextTask.role] ?? nextTask.role}: ${nextTask.title}`}
              </p>
              {nextTask.mine && nextTask.role !== "check" && (
                <button
                  onClick={() => { setHelpOpen((v) => !v); if (briefOpen) setBriefOpen(false); }}
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition ${helpOpen ? "border-amber-400/60 bg-amber-400/15 text-amber-200" : "border-line text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"}`}
                  title="Confused? Get a spotlight guide or the instructions"
                >
                  <LifeBuoy className="mr-1 inline h-3 w-3 align-[-2px]" />
                  Need help?
                </button>
              )}
              <button
                onClick={() => { setBriefOpen((v) => !v); if (helpOpen) setHelpOpen(false); }}
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition ${briefOpen ? "border-amber-400/60 bg-amber-400/15 text-amber-200" : "border-line text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"}`}
                title="The full briefing: persona, task number, objective, steps, success condition"
              >
                {briefOpen ? "Close briefing" : "Open briefing"}
              </button>
              {nextTask.role !== "check" && (nextTask.mine ? (
                <a href={nextTask.href} className="flex shrink-0 items-center gap-1 rounded-full border border-lime-400/50 bg-lime-400/10 px-2.5 py-0.5 text-[10px] font-bold text-lime-300 hover:bg-lime-400/20">
                  Go to task <ArrowRight className="h-3 w-3" />
                </a>
              ) : (
                <button
                  disabled={busy}
                  onClick={() => go(nextTask.role)}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-violet-400/50 bg-violet-400/10 px-2.5 py-0.5 text-[10px] font-bold text-violet-300 hover:bg-violet-400/20"
                >
                  Switch &amp; continue <ArrowRight className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
          {err && <p className="mt-1 text-[10px] font-medium text-rose-300">{err}</p>}
          </div>
        </div>
      )}
    </>
  );
}
