"use client";

/* ------------------------------------------------------------------ */
/*  QA persona bar — always visible while you're inside a TEST         */
/*  persona, so two-sided testing never leaves you wondering who you   */
/*  are. Switch sides in one click; exit back to your own account.     */
/*  Renders only on demo deployments, only for QA personas.            */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import { usePathname } from "next/navigation";
import { FlaskConical, LogOut, RefreshCw } from "lucide-react";
import { useSession } from "@/lib/session";
import { QA_HANDLES, QA_LABEL, isQaHandle, switchPersona, exitQa, stashedReturn } from "@/lib/qaLab";

export default function QaPersonaBar() {
  const { user } = useSession();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
        {err && <p className="mt-1 text-[10px] font-medium text-rose-300">{err}</p>}
      </div>
    </div>
  );
}
