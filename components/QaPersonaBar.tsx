"use client";

/* ------------------------------------------------------------------ */
/*  QA persona bar — always visible while you're inside a TEST         */
/*  persona, so two-sided testing never leaves you wondering who you   */
/*  are. Switch sides in one click; exit back to your own account.     */
/*  Renders only on demo deployments, only for QA personas.            */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FlaskConical, LogOut, RefreshCw, ArrowRight } from "lucide-react";
import { useSession } from "@/lib/session";
import { QA_HANDLES, QA_LABEL, isQaHandle, switchPersona, exitQa, stashedReturn } from "@/lib/qaLab";

export default function QaPersonaBar() {
  const { user } = useSession();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* the guided thread: while you act in the real UI, the bar knows your
     next checkpoint — no trips back to the Lab to find where you left off */
  const [nextTask, setNextTask] = useState<{ scenario: string; title: string; href: string; idx: number; total: number; mine: boolean; role: string } | null>(null);

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
        const mine = steps.find((x: { status: string; role: string }) => x.status === "pending" && x.role === user.handle);
        const any = steps.find((x: { status: string; role: string }) => x.status === "pending" && x.role !== "check");
        const pick = mine ?? any;
        if (!dead)
          setNextTask(pick ? {
            scenario: String(d.title ?? "").split(" — ")[0],
            title: pick.title,
            href: pick.href && pick.href !== "#" ? pick.href : "/simulation",
            idx: steps.findIndex((x: { id: string }) => x.id === pick.id) + 1,
            total: steps.length,
            mine: !!mine,
            role: pick.role,
          } : null);
      } catch { /* the bar never breaks the page */ }
    };
    poll();
    const t = setInterval(poll, 15000);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => { dead = true; clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [user?.handle]); // eslint-disable-line react-hooks/exhaustive-deps

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
        {/* the next checkpoint, right where you're working */}
        {nextTask && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 border-t border-amber-400/15 pt-1.5">
            <p className="min-w-0 flex-1 truncate text-[10px] text-zinc-400">
              <span className="font-mono font-bold uppercase tracking-[0.1em] text-zinc-500">
                {nextTask.scenario} · test {nextTask.idx}/{nextTask.total}
              </span>{" "}
              — {nextTask.mine ? nextTask.title : `waiting on ${QA_LABEL[nextTask.role] ?? nextTask.role}: ${nextTask.title}`}
            </p>
            {nextTask.mine ? (
              <a href={nextTask.href} className="flex shrink-0 items-center gap-1 rounded-full border border-lime-400/50 bg-lime-400/10 px-2.5 py-0.5 text-[10px] font-bold text-lime-300 hover:bg-lime-400/20">
                Next task <ArrowRight className="h-3 w-3" />
              </a>
            ) : (
              <button
                disabled={busy}
                onClick={() => go(nextTask.role)}
                className="flex shrink-0 items-center gap-1 rounded-full border border-violet-400/50 bg-violet-400/10 px-2.5 py-0.5 text-[10px] font-bold text-violet-300 hover:bg-violet-400/20"
              >
                Switch &amp; continue <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
        {err && <p className="mt-1 text-[10px] font-medium text-rose-300">{err}</p>}
      </div>
    </div>
  );
}
