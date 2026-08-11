"use client";

/* ------------------------------------------------------------------ */
/*  QA persona bar — always visible while you're inside a TEST         */
/*  persona, so two-sided testing never leaves you wondering who you   */
/*  are. Switch sides in one click; exit back to your own account.     */
/*  Renders only on demo deployments, only for QA personas.            */
/*                                                                     */
/*  THE TEST SESSION IS CLOSED BY DEFAULT. The compact bar always      */
/*  shows the scenario, the current test number, and the objective —   */
/*  the full briefing panel opens ONLY when the user clicks "Open      */
/*  session", and closes when they click again or press "Start task".  */
/*  It never auto-opens: not on page load, not after navigation, not   */
/*  after a refresh, not after switching personas.                     */
/*                                                                     */
/*  The current task comes from the server's strict sequential         */
/*  progression (tasks unlock 1 → 2 → 3 …) — exactly ONE step is ever  */
/*  "pending", so the bar can never present Test 4 on a fresh run.     */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FlaskConical, LogOut, RefreshCw, ArrowRight } from "lucide-react";
import { useSession } from "@/lib/session";
import { QA_HANDLES, QA_LABEL, isQaHandle, switchPersona, exitQa, stashedReturn } from "@/lib/qaLab";
import { buildBriefing, type MissionBriefing } from "@/lib/qaBriefing";

export default function QaPersonaBar() {
  const { user } = useSession();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* the guided thread: while you act in the real UI, the bar knows your
     ONE current checkpoint — the strictly sequential next task */
  const [nextTask, setNextTask] = useState<{ scenario: string; title: string; href: string; idx: number; total: number; mine: boolean; role: string; id: string; brief: MissionBriefing } | null>(null);
  /* the briefing panel: CLOSED unless the user explicitly opens it.
     No auto-open on load, navigation, refresh, or persona switch. */
  const [briefOpen, setBriefOpen] = useState(false);
  const [seenTask, setSeenTask] = useState<string | null>(null);
  const [passedFlash, setPassedFlash] = useState(false);

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
            scenario: String(d.title ?? "").split(" — ")[0],
            title: pick.title,
            href: pick.href && pick.href !== "#" ? pick.href : "/simulation",
            idx: steps.findIndex((x: { id: string }) => x.id === pick.id) + 1,
            total: steps.length,
            mine: pick.role === user.handle,
            role: pick.role,
            brief: buildBriefing(pick),
          } : null);
      } catch { /* the bar never breaks the page */ }
    };
    poll();
    const t = setInterval(poll, 6000);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => { dead = true; clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [user?.handle]); // eslint-disable-line react-hooks/exhaustive-deps

  // when the current task changes, the previous one VERIFIED — flash the
  // pass. The panel's open/closed state is untouched: no auto-open.
  useEffect(() => {
    if (nextTask && nextTask.id !== seenTask) {
      if (seenTask !== null) {
        setPassedFlash(true);
        setTimeout(() => setPassedFlash(false), 6000);
      }
      setSeenTask(nextTask.id);
    }
    if (!nextTask) setBriefOpen(false);
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

  return (
    <div className="fixed bottom-3 left-1/2 z-[90] w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2">
      <div className="rounded-2xl border border-amber-400/40 bg-[#141217]/95 px-3 py-2 shadow-2xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">
            <FlaskConical className="h-3.5 w-3.5" />
            Test session · {QA_LABEL[user.handle] ?? user.handle}
          </p>
          <div className="flex flex-wrap items-center gap-1">
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
        </div>
        {/* ---- THE MISSION BRIEFING — who am I · what do I do · where ·
             what does success look like. Opens ONLY on user request. ---- */}
        {nextTask && briefOpen && (
          <div className="mb-2 rounded-xl border border-amber-400/30 bg-black/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-amber-300">
                {nextTask.scenario} · Test {nextTask.idx} of {nextTask.total}
              </p>
              <button onClick={() => setBriefOpen(false)} className="font-mono text-[10px] text-zinc-500 hover:text-zinc-300" aria-label="Close session panel">✕</button>
            </div>
            {nextTask.role === "check" ? (
              <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-300">
                <span className="font-bold text-zinc-100">Automatic cross-check:</span> {nextTask.title}. This verifies
                itself against the database — no action needed. Waiting for: <span className="font-mono text-amber-300">{nextTask.brief.success}</span>
              </p>
            ) : (
              <>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-violet-400/40 bg-violet-400/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-violet-200">
                    {nextTask.brief.roleLabel}
                  </span>
                  {user.handle === nextTask.brief.role ? (
                    <span className="font-mono text-[9px] font-semibold text-lime-300">✓ you are testing as {nextTask.brief.roleLabel}</span>
                  ) : (
                    <button disabled={busy} onClick={() => go(nextTask.brief.role)} className="rounded-full border border-violet-400/50 px-2 py-0.5 text-[9px] font-bold text-violet-200 hover:bg-violet-400/15">
                      Switch to {nextTask.brief.roleLabel} →
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] font-bold text-zinc-100">{nextTask.brief.objective}</p>
                <ol className="mt-1 space-y-px">
                  {nextTask.brief.steps.map((line, i) => (
                    <li key={i} className="flex gap-1.5 text-[10px] leading-relaxed text-zinc-400">
                      <span className="font-mono text-zinc-600">{i + 1}.</span> {line}
                    </li>
                  ))}
                </ol>
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

        {/* the compact session line: scenario · test N of M · objective —
            always useful while the panel stays closed */}
        {nextTask && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 border-t border-amber-400/15 pt-1.5">
            <p className="min-w-0 flex-1 truncate text-[10px] text-zinc-400">
              {passedFlash && (
                <span className="mr-1.5 animate-pulse rounded-full border border-lime-400/60 bg-lime-400/15 px-2 py-px font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-lime-300">
                  ✓ Task passed
                </span>
              )}
              <span className="font-mono font-bold uppercase tracking-[0.1em] text-zinc-500">
                {nextTask.scenario} · test {nextTask.idx} of {nextTask.total}
              </span>{" "}
              — {nextTask.role === "check" ? `auto-check verifying: ${nextTask.title}` : nextTask.mine ? nextTask.title : `waiting on ${QA_LABEL[nextTask.role] ?? nextTask.role}: ${nextTask.title}`}
            </p>
            <button
              onClick={() => setBriefOpen((v) => !v)}
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition ${briefOpen ? "border-amber-400/60 bg-amber-400/15 text-amber-200" : "border-line text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"}`}
              title="The full briefing: persona, task number, objective, steps, success condition"
            >
              {briefOpen ? "Close session" : "Open session"}
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
  );
}
