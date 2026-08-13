"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FlaskConical, Eye, Check, Beaker } from "lucide-react";
import { useSession, invalidateSession } from "@/lib/session";

/* ------------------------------------------------------------------ */
/* DEMO MODE / SIMULATION MODE — the master switch (top-left chip).    */
/*                                                                     */
/*   DEMO MODE       — unrestricted developer testing: access gates    */
/*                     (verification, affiliation, campus) open so     */
/*                     every feature can be exercised.                 */
/*   SIMULATION MODE — the realistic user experience: every real gate  */
/*                     applies exactly as it would in production.      */
/*                                                                     */
/* The mode is an ACCOUNT fact (users.tester_mode) — persists across   */
/* refreshes/devices, enforced SERVER-side, and controls feature       */
/* access only. It never reads or writes auth/session state. The       */
/* whole switch exists only on demo deployments; production ignores    */
/* it and always enforces.                                             */
/* ------------------------------------------------------------------ */

export default function DemoModeSwitch() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const mode = user?.testerMode === "simulation" ? "simulation" : "demo";

  const setMode = async (next: "demo" | "simulation") => {
    if (next === mode || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/demo/mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Switch failed");
        return;
      }
      invalidateSession(); // soft refetch — permissions update everywhere
      setOpen(false);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  // guests AND unauthorized accounts: the plain informational chip —
  // mode switching is a development tool (server enforces this too)
  if (!user || !user.demoTools) {
    return (
      <span
        className="ml-1 inline rounded border border-line px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-zinc-500"
        title="Demo deployment — simulated payments and responses. No real money moves."
      >
        demo
      </span>
    );
  }

  return (
    <div ref={ref} className="relative ml-1">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        data-guide="demo-mode-switch"
        className={`flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.15em] transition ${
          mode === "demo"
            ? "border-amber-400/50 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
            : "border-sky-400/50 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20"
        } ${busy ? "opacity-60" : ""}`}
        title={
          mode === "demo"
            ? "DEMO MODE — unrestricted developer testing. Click to switch."
            : "SIMULATION MODE — realistic user experience, all restrictions apply. Click to switch."
        }
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {mode === "demo" ? <FlaskConical className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
        {mode === "demo" ? "demo mode" : "simulation"}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-50 max-h-[70dvh] overflow-y-auto rounded-xl border border-line bg-card p-2 shadow-xl sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:w-72">
          <p className="px-2 pb-1.5 pt-1 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Testing mode — this account
          </p>
          <button
            onClick={() => setMode("demo")}
            disabled={busy}
            className={`flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition ${
              mode === "demo" ? "bg-amber-400/10" : "hover:bg-card-raised"
            }`}
          >
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                DEMO MODE {mode === "demo" && <Check className="h-3 w-3" />}
              </span>
              <span className="mt-0.5 block text-[10px] leading-relaxed text-zinc-500">
                Unrestricted developer testing — verification, campus, and plan gates open so you
                can exercise everything. Clearly labeled; never a real production state.
              </span>
            </span>
          </button>
          <button data-guide="demo-mode-simulation"
            onClick={() => setMode("simulation")}
            disabled={busy}
            className={`mt-1 flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition ${
              mode === "simulation" ? "bg-sky-400/10" : "hover:bg-card-raised"
            }`}
          >
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                SIMULATION MODE {mode === "simulation" && <Check className="h-3 w-3" />}
              </span>
              <span className="mt-0.5 block text-[10px] leading-relaxed text-zinc-500">
                The realistic user experience — every restriction applies: verification required
                for campus, College+ requires College+, Pro requires Pro. Payments stay test-only.
              </span>
            </span>
          </button>
          {error && (
            <p className="mx-2 mb-1 mt-1.5 rounded-md border border-red-500/30 bg-red-500/5 px-2 py-1.5 text-[10px] text-red-300">
              {error}
            </p>
          )}
          <Link
            href="/simulation"
            onClick={() => setOpen(false)}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg p-2.5 text-left transition hover:bg-card-raised"
          >
            <Beaker className="h-4 w-4 shrink-0 text-zinc-400" />
            <span className="text-xs font-semibold text-zinc-200">Open Test Center →</span>
          </Link>
          <p className="border-t border-line-soft px-2 pb-1 pt-1.5 text-[9px] leading-relaxed text-zinc-600">
            Feature access only — your sign-in session is never touched. Persists across refreshes.
          </p>
        </div>
      )}
    </div>
  );
}
