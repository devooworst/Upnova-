"use client";

/* ------------------------------------------------------------------ */
/*  QA Lab — the interactive testing ground of the Test Center.        */
/*                                                                     */
/*  · Three TEST personas (real accounts, zero bot behavior). "View    */
/*    as" swaps your session so you personally play BOTH sides.        */
/*  · Guided scenarios: each checkpoint tells you who acts and where,  */
/*    then verifies the REAL database. Nothing turns green because a   */
/*    button was clicked — only because the expected state exists.     */
/*  · Stuck checkpoints read like bug reports: expected vs actual vs   */
/*    related record, with "open affected page" and "retry".           */
/*  · "Do this step for me" drives the same public HTTP routes as the  */
/*    correct persona — even automation goes through the real app.     */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from "react";
import { buildBriefing } from "@/lib/qaBriefing";
import { UserRound as PersonaIcon, Scissors, Building2, Target, ListChecks, CheckCircle2 } from "lucide-react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  ExternalLink,
  Play,
  RefreshCw,
  RotateCcw,
  UserRound,
  Wand2,
} from "lucide-react";
import { QA_LABEL, switchPersona } from "@/lib/qaLab";

interface Persona {
  handle: string;
  label: string;
  displayName: string;
  role: string;
  active: boolean;
}
interface ScenarioSummary {
  id: string;
  title: string;
  personas: string[];
  description: string;
  startedAt: string | null;
  completed?: boolean;
  done: number;
  total: number;
}
interface Overall {
  done: number;
  total: number;
  completedScenarios: number;
  scenarioCount: number;
}
interface StepState {
  id: string;
  role: string;
  title: string;
  instruction: string;
  expected: string;
  href: string;
  canAuto: boolean;
  status: "done" | "pending";
  actual: string;
  record: string | null;
}
interface ScenarioDetail extends ScenarioSummary {
  steps: StepState[];
}

const ROLE_STYLE: Record<string, string> = {
  testcustomer: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  testcreator: "border-lime-400/40 bg-lime-400/10 text-lime-300",
  testbusiness: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  check: "border-line bg-card-raised text-zinc-500",
};
const roleLabel = (r: string) => (r === "check" ? "AUTO CHECK" : QA_LABEL[r] ?? r);

export default function QaLab({ viewerHandle }: { viewerHandle: string }) {
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioSummary[] | null>(null);
  const [overall, setOverall] = useState<Overall | null>(null);

  /* "✓ Passed" moment: when a checkpoint flips pending→done between
     evaluations, flash it — the user sees the pass WITHOUT navigating
     anywhere, then continues on their own click. */
  const prevSteps = useRef<Record<string, Record<string, string>>>({});
  const [justPassed, setJustPassed] = useState<Set<string>>(new Set());
  const trackPasses = (d: { id: string; steps?: StepState[] }) => {
    if (!d.steps) return;
    const prev = prevSteps.current[d.id] ?? {};
    const flipped = d.steps.filter((s) => s.status === "done" && prev[s.id] === "pending").map((s) => s.id);
    prevSteps.current[d.id] = Object.fromEntries(d.steps.map((s) => [s.id, s.status]));
    if (flipped.length) {
      setJustPassed((old) => new Set([...Array.from(old), ...flipped]));
      setTimeout(() => setJustPassed((old) => { const n = new Set(Array.from(old)); flipped.forEach((f) => n.delete(f)); return n; }), 6000);
    }
  };

  /** persisted progress is the source of truth — whenever a scenario's
      fresh state arrives, the summary row updates with it, so collapsed
      cards always show the real score */
  const syncSummary = (d: { id: string; done: number; total: number; startedAt: string | null; completed?: boolean }) =>
    setScenarios((prev) =>
      prev ? prev.map((x) => (x.id === d.id ? { ...x, done: d.done, total: d.total, startedAt: d.startedAt, completed: d.completed } : x)) : prev
    );
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<ScenarioDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadState = useCallback(async () => {
    const res = await fetch("/api/qa/state", { cache: "no-store" });
    if (!res.ok) return;
    const d = await res.json();
    setPersonas(d.personas);
    setScenarios(d.scenarios);
    setOverall(d.overall ?? null);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/qa/scenarios/${id}`, { cache: "no-store" });
    if (res.ok) {
      const d = await res.json();
      setDetail(d);
      syncSummary(d);
      trackPasses(d);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadState();
  }, [loadState]);

  // live polling while a scenario is open — checkpoints flip as you act
  // in the real UI (in another persona, another tab, or after returning)
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (!open) return;
    loadDetail(open);
    timer.current = setInterval(() => loadDetail(open), 3000);
    const onFocus = () => loadDetail(open);
    window.addEventListener("focus", onFocus);
    return () => {
      if (timer.current) clearInterval(timer.current);
      window.removeEventListener("focus", onFocus);
    };
  }, [open, loadDetail]);

  const act = async (id: string, body: Record<string, unknown>, busyKey: string) => {
    setBusy(busyKey);
    setMsg(null);
    const res = await fetch(`/api/qa/scenarios/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMsg(`✗ ${d.error || "That didn't work"}`);
      return;
    }
    setDetail(d);
    syncSummary(d);
    trackPasses(d);
    loadState();
  };

  const openAs = async (handle: string, href: string) => {
    if (handle === viewerHandle) {
      window.open(href, "_blank");
      return;
    }
    setBusy(`switch:${handle}`);
    const e = await switchPersona(handle, href);
    if (e) {
      setMsg(`✗ ${e}`);
      setBusy(null);
    }
  };

  /* PERSONA LENS — a completely separate testing environment per persona.
     Selecting Test Customer shows ONLY customer scenarios and customer
     steps; other personas' steps stay hidden until you switch. The lens
     follows whoever you're currently viewing as, and can be changed here. */
  const [lens, setLens] = useState<string | null>(null);
  useEffect(() => {
    if (lens) return;
    const active = (personas ?? []).find((p) => p.active);
    if (active) setLens(active.handle);
    else if (personas?.length) setLens(personas[0].handle);
  }, [personas, lens]);

  const lensScenarios = (scenarios ?? []).filter((s) => lens && s.personas.includes(lens));
  const otherCount = (scenarios ?? []).length - lensScenarios.length;

  const mySteps = (steps: StepState[]) => steps.filter((s) => s.role === lens || s.role === "check");
  const firstPending = detail?.steps.find((s) => s.status === "pending" && s.role !== "check");
  const firstPendingMine = detail?.steps.find((s) => s.status === "pending" && s.role === lens);

  /** the curriculum decides where you go next — never hunt for it:
      the next unfinished scenario in this persona's track */
  const nextScenarioAfter = (currentId: string | null) => {
    const list = lensScenarios;
    if (!list.length) return null;
    const start = currentId ? list.findIndex((s) => s.id === currentId) + 1 : 0;
    for (let i = 0; i < list.length; i++) {
      const s = list[(start + i) % list.length];
      if (s.id !== currentId && !s.completed) return s;
    }
    return null;
  };
  const continueTo = async (id: string) => {
    setOpen(id);
    await act(id, { action: "start" }, `arm:${id}`);
  };

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-violet-400/20 bg-gradient-to-b from-violet-400/10 to-transparent px-5 py-4">
        <p className="text-[15px] font-bold tracking-tight text-violet-300">QA Lab — play both sides yourself</p>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-400">
          Three dedicated TEST accounts with <span className="font-semibold text-zinc-300">zero automation</span> —
          nobody accepts, replies, or delivers unless you do it. Pick a scenario, act it out in the real
          Mavyn interface, and watch each checkpoint verify against the actual database. A checkpoint
          only turns green when the expected state truly exists. Real accounts are never touched, and
          every scenario resets cleanly.
        </p>
      </div>

      <div className="space-y-4 p-5">
        {/* personas */}
        <div className="grid gap-2 sm:grid-cols-3">
          {(personas ?? []).map((p) => (
            <div key={p.handle} className={`rounded-xl border p-3 ${p.active ? "border-amber-400/50 bg-amber-400/5" : "border-line bg-card-raised"}`}>
              <p className={`font-mono text-[9px] font-bold uppercase tracking-[0.14em] ${p.active ? "text-amber-300" : "text-zinc-500"}`}>
                {p.label} {p.active && "· you are here"}
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">{p.displayName}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500">{p.role}</p>
              {!p.active && (
                <button
                  disabled={busy === `switch:${p.handle}`}
                  onClick={() => openAs(p.handle, "/")}
                  className="btn-ghost mt-2 w-full justify-center py-1.5 text-[11px]"
                >
                  <UserRound className="h-3 w-3" /> View as {p.label.replace("TEST ", "").toLowerCase()}
                </button>
              )}
            </div>
          ))}
          {personas === null && <div className="col-span-3 h-24 animate-pulse rounded-xl bg-card-raised" />}
        </div>

        {msg && <p className="rounded-md border border-line bg-card-raised px-3 py-2 text-xs text-zinc-300">{msg}</p>}

        {/* scenarios */}
        {/* ---- OVERALL PROGRESSION: the curriculum view — completed
             stages count forever, moving on never resets them ---- */}
        {overall && (
          <div className="rounded-xl border border-line bg-card-raised px-4 py-3" data-tut="qa-progress">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Lab progression</p>
              <p className="font-mono text-[11px] font-bold tracking-[0.08em] text-zinc-200">
                {overall.done}/{overall.total} checks verified ·{" "}
                <span className={overall.completedScenarios > 0 ? "text-lime-300" : "text-zinc-400"}>
                  {overall.completedScenarios} of {overall.scenarioCount} stages complete
                </span>
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
              <div className="h-full rounded-full bg-lime-400 transition-all" style={{ width: `${overall.total ? (overall.done / overall.total) * 100 : 0}%` }} />
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
              Complete a stage and it stays complete — verified snapshots survive collapsing, refreshing, moving to the
              next stage, and redeploys. Only replaying a stage resets it.
            </p>
          </div>
        )}

        {/* the lens switcher — three separate environments, zero mixing */}
        <div className="flex flex-wrap items-center gap-1.5" data-tut="qa-lens">
          <span className="mr-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Testing as</span>
          {(personas ?? []).map((p) => (
            <button
              key={p.handle}
              onClick={() => { setLens(p.handle); setOpen(null); }}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                lens === p.handle ? "border-violet-400/60 bg-violet-400/15 text-violet-200" : "border-line text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {p.label}
            </button>
          ))}
          {otherCount > 0 && (
            <span className="ml-auto text-[10px] text-zinc-600">
              {otherCount} scenario{otherCount === 1 ? "" : "s"} live in the other personas&apos; environments
            </span>
          )}
        </div>

        {/* ---- the curriculum at a glance: done → current → next ---- */}
        {lensScenarios.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" data-tut="qa-curriculum">
            {lensScenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => setOpen(open === s.id ? null : s.id)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.04em] transition ${
                  s.completed
                    ? "border-lime-400/50 bg-lime-400/10 text-lime-300"
                    : s.startedAt
                      ? "border-amber-400/50 bg-amber-400/10 text-amber-200"
                      : "border-line text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                } ${open === s.id ? "ring-1 ring-zinc-400/50" : ""}`}
                title={s.title}
              >
                <span aria-hidden>{s.completed ? "✓" : s.startedAt ? "→" : "○"}</span>
                <span className="max-w-[9rem] truncate normal-case">{s.title.split(" — ")[0]}</span>
                <span className="text-[9px] opacity-80">{s.done}/{s.total}</span>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {lensScenarios.map((s) => {
            const isOpen = open === s.id;
            const d = isOpen && detail?.id === s.id ? detail : null;
            const sum = d ?? s;
            return (
              <div key={s.id} className={`rounded-xl border ${isOpen ? "border-violet-400/30" : "border-line"}`}>
                <button
                  onClick={() => setOpen(isOpen ? null : s.id)}
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-bold text-zinc-100">
                      {s.title}
                      {sum.completed && (
                        <span className="rounded-full border border-lime-400/50 bg-lime-400/10 px-2 py-px font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-lime-300">
                          ✓ Complete
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {s.personas.map((h) => QA_LABEL[h] ?? h).join(" ↔ ")}
                      {sum.completed ? " · stage complete — progress kept" : sum.startedAt ? ` · started ${new Date(sum.startedAt).toLocaleTimeString()}` : " · not started"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-black/40">
                      <span className="block h-full rounded-full bg-lime-400 transition-all" style={{ width: `${(sum.done / sum.total) * 100}%` }} />
                    </span>
                    <span className="font-mono text-[11px] font-bold tracking-[0.08em] text-zinc-300">
                      {sum.done}/{sum.total}
                    </span>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-line-soft px-4 py-3">
                    <p className="text-[11px] leading-relaxed text-zinc-500">{s.description}</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <button
                        disabled={busy === `arm:${s.id}`}
                        onClick={() => act(s.id, { action: sum.startedAt ? "reset" : "start" }, `arm:${s.id}`)}
                        className={`${sum.startedAt ? "btn-ghost" : "btn-lime"} px-4 py-1.5 text-xs`}
                      >
                        {sum.completed ? (
                          <>
                            <RotateCcw className="h-3.5 w-3.5" /> Replay stage (resets ITS records — other completed stages keep their progress)
                          </>
                        ) : sum.startedAt ? (
                          <>
                            <RotateCcw className="h-3.5 w-3.5" /> Reset scenario (wipes QA test records)
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5" /> Start scenario
                          </>
                        )}
                      </button>
                      <button onClick={() => loadDetail(s.id)} className="btn-ghost px-3 py-1.5 text-xs">
                        <RefreshCw className="h-3 w-3" /> Re-verify now
                      </button>
                      {d && firstPending && (
                        <span className="ml-auto rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                          {firstPendingMine && firstPendingMine.id === firstPending.id
                            ? "Next: your move"
                            : `Next: ${roleLabel(firstPending.role)}${firstPending.role !== lens ? " (other side)" : ""}`}
                        </span>
                      )}
                      {d && !firstPending && d.done === d.total && (
                        <span className="ml-auto rounded-full border border-lime-400/40 bg-lime-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-lime-300">
                          Scenario complete — every checkpoint verified
                        </span>
                      )}
                    </div>

                    {/* ---- GUIDED FLOW: complete → confirm → continue.
                         The card always knows the one right next action —
                         the user never hunts for where they left off. ---- */}
                    {d && d.completed && (() => {
                      const nxt = nextScenarioAfter(s.id);
                      return (
                        <div className="mt-3 rounded-xl border border-lime-400/40 bg-lime-400/10 p-4">
                          <p className="flex items-center gap-2 text-sm font-bold text-lime-300">
                            <Check className="h-4 w-4" /> Scenario Complete — {d.done} / {d.total} tests passed
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-400">
                            This stays completed permanently — collapse, refresh, move on: the score keeps.
                          </p>
                          {nxt ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <p className="min-w-0 flex-1 text-xs text-zinc-300">
                                Next: <span className="font-semibold text-zinc-100">{nxt.title.split(" — ")[0]}</span>
                                <span className="font-mono text-[10px] text-zinc-500"> — {nxt.done}/{nxt.total}</span>
                              </p>
                              <button
                                disabled={busy === `arm:${nxt.id}`}
                                onClick={() => continueTo(nxt.id)}
                                className="btn-lime shrink-0 px-4 py-1.5 text-xs"
                              >
                                Continue → {busy === `arm:${nxt.id}` ? "…" : ""}
                              </button>
                            </div>
                          ) : (
                            <p className="mt-2 text-xs font-semibold text-lime-200">
                              Every stage in this track is complete — the whole system is verified. Switch personas to run the other tracks.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                    {d && !d.completed && sum.startedAt && (() => {
                      const my = d.steps.filter((x) => x.role === lens);
                      const myDone = my.filter((x) => x.status === "done").length;
                      const overallIdx = firstPending ? d.steps.findIndex((x) => x.id === firstPending.id) : -1;
                      if (firstPendingMine) {
                        /* ---- MISSION BRIEFING: who am I · what do I do ·
                             where · what does success look like ---- */
                        const brief = buildBriefing(firstPendingMine);
                        const iAmRole = viewerHandle === brief.role;
                        const RoleGlyph = brief.role === "testcreator" ? Scissors : brief.role === "testbusiness" ? Building2 : PersonaIcon;
                        return (
                          <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/5 p-4" data-tut="qa-briefing">
                            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-amber-300">
                              {s.title.split(" — ")[0]} · Test {d.steps.findIndex((x) => x.id === firstPendingMine.id) + 1} of {d.total}
                            </p>

                            {/* YOUR ROLE — prominent, with the switch built in */}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="flex items-center gap-1.5 rounded-lg border border-violet-400/40 bg-violet-400/10 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-violet-200">
                                <RoleGlyph className="h-3.5 w-3.5" /> {brief.roleLabel}
                              </span>
                              {iAmRole ? (
                                <span className="flex items-center gap-1 font-mono text-[10px] font-semibold text-lime-300">
                                  <Check className="h-3 w-3" /> You are currently testing as {brief.roleLabel}
                                </span>
                              ) : (
                                <button
                                  disabled={busy === `switch:${brief.role}`}
                                  onClick={() => openAs(brief.role, brief.href)}
                                  className="rounded-full border border-violet-400/50 bg-violet-400/10 px-3 py-1 text-[10px] font-bold text-violet-200 hover:bg-violet-400/20"
                                >
                                  Switch to {brief.roleLabel} →
                                </button>
                              )}
                            </div>

                            {/* OBJECTIVE */}
                            <p className="mt-3 flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                              <Target className="h-3 w-3" /> Objective
                            </p>
                            <p className="mt-0.5 text-sm font-bold text-zinc-100">{brief.objective}</p>

                            {/* WHAT TO DO */}
                            <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                              <ListChecks className="h-3 w-3" /> What to do
                            </p>
                            <ol className="mt-1 space-y-0.5">
                              {brief.steps.map((line, i) => (
                                <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-zinc-300">
                                  <span className="font-mono text-[10px] text-zinc-600">{i + 1}.</span> {line}
                                </li>
                              ))}
                            </ol>

                            {/* SUCCESS CONDITION */}
                            <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                              <CheckCircle2 className="h-3 w-3" /> Success condition
                            </p>
                            <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-lime-300/90">✓ {brief.success}</p>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {iAmRole ? (
                                <a href={brief.href} target="_blank" rel="noreferrer" className="btn-lime px-4 py-1.5 text-xs">Start task →</a>
                              ) : (
                                <button
                                  disabled={busy === `switch:${brief.role}`}
                                  onClick={() => openAs(brief.role, brief.href)}
                                  className="btn-lime px-4 py-1.5 text-xs"
                                >
                                  Switch &amp; start task →
                                </button>
                              )}
                              <span className="font-mono text-[10px] text-zinc-500">your side: {myDone}/{my.length} done</span>
                            </div>
                          </div>
                        );
                      }
                      if (firstPending) {
                        return (
                          <div className="mt-3 rounded-xl border border-violet-400/30 bg-violet-400/5 p-4">
                            <p className="flex items-center gap-2 text-xs font-bold text-violet-200">
                              <Check className="h-3.5 w-3.5 text-lime-400" /> Your side is done ({myDone}/{my.length}) — test {overallIdx + 1} of {d.total} happens on {roleLabel(firstPending.role)}&apos;s side
                            </p>
                            <button
                              disabled={busy === `switch:${firstPending.role}`}
                              onClick={() => openAs(firstPending.role, firstPending.href && firstPending.href !== "#" ? firstPending.href : "/")}
                              className="btn-ghost mt-2 px-4 py-1.5 text-xs"
                            >
                              Continue as {roleLabel(firstPending.role)} →
                            </button>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {!sum.startedAt ? (
                      <p className="mt-3 text-xs text-zinc-500">
                        Press <span className="font-semibold text-zinc-300">Start scenario</span> — it clears the QA
                        accounts&apos; old test records and begins observing. Then act it out in the real interface.
                      </p>
                    ) : d ? (
                      <ol className="mt-3 space-y-2">
                        {d.steps.map((st, idx) => {
                          const isNext = firstPending?.id === st.id;
                          /* the other persona's step: shown only as a slim
                             marker — its instructions belong to THAT
                             persona's environment */
                          if (st.role !== "check" && st.role !== lens) {
                            return (
                              <li key={st.id} className={`flex items-center gap-2 rounded-lg border border-dashed px-3 py-1.5 ${st.status === "done" ? "border-lime-400/20 text-zinc-600" : "border-line text-zinc-600"}`}>
                                <span className="font-mono text-[9px]">{idx + 1}</span>
                                <span className="text-[10px]">
                                  {st.status === "done" ? "Done" : "Waiting"} on {roleLabel(st.role)}&apos;s side — switch personas to {st.status === "done" ? "review" : "play"} it
                                </span>
                                {st.status === "done" && <span className="ml-auto font-mono text-[9px] text-lime-400/70">verified</span>}
                              </li>
                            );
                          }
                          return (
                            <li
                              key={st.id}
                              className={`rounded-xl border p-3 ${
                                st.status === "done"
                                  ? "border-lime-400/20 bg-lime-400/[0.03]"
                                  : isNext
                                    ? "border-amber-400/40 bg-amber-400/5"
                                    : "border-line bg-card-raised"
                              }`}
                            >
                              <div className="flex flex-wrap items-start gap-2">
                                {st.status === "done" ? (
                                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />
                                ) : (
                                  <Circle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isNext ? "text-amber-400" : "text-zinc-600"}`} />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-100">
                                    <span className="font-mono text-[9px] text-zinc-600">{idx + 1}.</span>
                                    {st.title}
                                    <span className={`rounded-full border px-1.5 py-px font-mono text-[8px] font-bold uppercase tracking-wide ${ROLE_STYLE[st.role]}`}>
                                      {roleLabel(st.role)}
                                    </span>
                                    {justPassed.has(st.id) && (
                                      <span className="animate-pulse rounded-full border border-lime-400/60 bg-lime-400/15 px-2 py-px font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-lime-300">
                                        ✓ Test passed
                                      </span>
                                    )}
                                  </p>
                                  {st.status !== "done" && (
                                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{st.instruction}</p>
                                  )}
                                  <p className="mt-1 font-mono text-[10px] leading-relaxed tracking-[0.02em]">
                                    <span className="text-zinc-600">expected:</span>{" "}
                                    <span className="text-zinc-400">{st.expected}</span>
                                    <br />
                                    <span className="text-zinc-600">actual:</span>{" "}
                                    <span className={st.status === "done" ? "text-lime-300" : "text-amber-300"}>{st.actual}</span>
                                    {st.record && (
                                      <>
                                        {" "}
                                        <span className="text-zinc-600">· record:</span>{" "}
                                        <span className="text-zinc-500">{st.record.slice(0, 12)}…</span>
                                      </>
                                    )}
                                  </p>
                                </div>
                                {st.status !== "done" && st.role !== "check" && (
                                  <div className="flex shrink-0 flex-col gap-1">
                                    <button
                                      disabled={busy === `switch:${st.role}`}
                                      onClick={() => openAs(st.role, st.href)}
                                      className="btn-lime justify-center px-2.5 py-1 text-[10px]"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      {st.role === viewerHandle ? "Open page" : `Open as ${QA_LABEL[st.role]?.replace("TEST ", "")}`}
                                    </button>
                                    {st.canAuto && (
                                      <button
                                        disabled={busy === `auto:${st.id}`}
                                        onClick={() => act(s.id, { action: "auto", step: st.id }, `auto:${st.id}`)}
                                        className="btn-ghost justify-center px-2.5 py-1 text-[10px]"
                                        title="Runs this one action through the real routes as the correct persona"
                                      >
                                        <Wand2 className="h-3 w-3" /> Do it for me
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <div className="mt-3 h-20 animate-pulse rounded-xl bg-card-raised" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {scenarios === null && <div className="h-32 animate-pulse rounded-xl bg-card-raised" />}
        </div>

        <p className="text-[10px] leading-relaxed text-zinc-600">
          Switching personas moves THIS browser session — the amber bar at the bottom always shows who you
          are, switches sides in one click, and takes you back to your own account. Checkpoints re-verify
          every few seconds while a scenario is open. All payments in scenarios are TEST payments; no real
          money exists anywhere in this environment.
        </p>
      </div>
    </section>
  );
}
