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
  done: number;
  total: number;
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
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/qa/scenarios/${id}`, { cache: "no-store" });
    if (res.ok) setDetail(await res.json());
  }, []);

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

  const firstPending = detail?.steps.find((s) => s.status === "pending" && s.role !== "check");

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-violet-400/20 bg-gradient-to-b from-violet-400/10 to-transparent px-5 py-4">
        <p className="text-[15px] font-bold tracking-tight text-violet-300">QA Lab — play both sides yourself</p>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-400">
          Three dedicated TEST accounts with <span className="font-semibold text-zinc-300">zero automation</span> —
          nobody accepts, replies, or delivers unless you do it. Pick a scenario, act it out in the real
          UpNova interface, and watch each checkpoint verify against the actual database. A checkpoint
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
        <div className="space-y-2">
          {(scenarios ?? []).map((s) => {
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
                    <p className="text-sm font-bold text-zinc-100">{s.title}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {s.personas.map((h) => QA_LABEL[h] ?? h).join(" ↔ ")}
                      {sum.startedAt ? ` · started ${new Date(sum.startedAt).toLocaleTimeString()}` : " · not started"}
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
                        {sum.startedAt ? (
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
                          Next: {roleLabel(firstPending.role)}
                        </span>
                      )}
                      {d && !firstPending && d.done === d.total && (
                        <span className="ml-auto rounded-full border border-lime-400/40 bg-lime-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-lime-300">
                          Scenario complete — every checkpoint verified
                        </span>
                      )}
                    </div>

                    {!sum.startedAt ? (
                      <p className="mt-3 text-xs text-zinc-500">
                        Press <span className="font-semibold text-zinc-300">Start scenario</span> — it clears the QA
                        accounts&apos; old test records and begins observing. Then act it out in the real interface.
                      </p>
                    ) : d ? (
                      <ol className="mt-3 space-y-2">
                        {d.steps.map((st, idx) => {
                          const isNext = firstPending?.id === st.id;
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
