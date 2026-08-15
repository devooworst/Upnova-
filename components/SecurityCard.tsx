"use client";

/* ------------------------------------------------------------------ */
/*  Account security — real controls, not decorative rows.             */
/*  Password reset goes through the actual single-use token flow;      */
/*  two-factor is real TOTP that works with any authenticator app.     */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, KeyRound, Copy, Check } from "lucide-react";

export default function SecurityCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [code, setCode] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/me/mfa", { cache: "no-store" });
    if (res.ok) setEnabled((await res.json()).enabled);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (body: object) => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/me/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return null;
    }
    return data;
  };

  return (
    <div className="space-y-3">
      {/* password */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card-raised px-4 py-3">
        <div className="flex items-center gap-2.5">
          <KeyRound className="h-4 w-4 shrink-0 text-zinc-500" />
          <div>
            <p className="text-sm font-medium text-zinc-200">Password</p>
            <p className="text-xs text-zinc-500">
              Passwords never expire on a timer — change it if you suspect compromise.
            </p>
          </div>
        </div>
        <Link href="/forgot" className="btn-ghost shrink-0 px-3.5 py-1.5 text-xs">
          Change password
        </Link>
      </div>

      {/* two-factor */}
      <div className="rounded-xl border border-line bg-card-raised px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className={`h-4 w-4 shrink-0 ${enabled ? "text-lime-400" : "text-zinc-500"}`} />
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                Two-factor authentication
                {enabled && (
                  <span className="rounded-full border border-lime-400/40 bg-lime-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-lime-300">
                    On
                  </span>
                )}
              </p>
              <p className="text-xs text-zinc-500">
                A 6-digit code from your authenticator app, required at every sign-in.
              </p>
            </div>
          </div>
          {enabled === false && !setup && (
            <button
              disabled={busy}
              onClick={async () => {
                const d = await act({ action: "setup" });
                if (d) setSetup(d);
              }}
              className="btn-lime shrink-0 px-3.5 py-1.5 text-xs disabled:opacity-50"
            >
              Enable
            </button>
          )}
          {enabled === true && !disabling && (
            <button
              onClick={() => setDisabling(true)}
              className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-zinc-400 transition hover:border-rose-400/40 hover:text-rose-300"
            >
              Disable
            </button>
          )}
        </div>

        {/* setup flow */}
        {setup && enabled === false && (
          <div className="mt-3 space-y-2.5 border-t border-line-soft pt-3">
            <p className="text-xs text-zinc-400">
              1 · Add this secret to any authenticator app (Google Authenticator, 1Password, Authy…):
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-card px-3 py-2 font-mono text-xs tracking-[0.15em] text-lime-300">
                {setup.secret}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(setup.secret);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="btn-ghost shrink-0 px-2.5 py-2 text-xs"
                title="Copy secret"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-lime-300" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-xs text-zinc-400">2 · Enter the current 6-digit code to confirm:</p>
            <div className="flex items-center gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                className="w-32 rounded-lg border border-line bg-card px-3 py-2 font-mono text-sm tracking-[0.3em] text-zinc-100 outline-none focus:border-lime-400/50"
              />
              <button
                disabled={busy || code.length !== 6}
                onClick={async () => {
                  const d = await act({ action: "enable", code });
                  if (d) {
                    setSetup(null);
                    setCode("");
                    load();
                  }
                }}
                className="btn-lime px-3.5 py-2 text-xs disabled:opacity-50"
              >
                Confirm & enable
              </button>
              <button onClick={() => setSetup(null)} className="text-xs text-zinc-500 hover:text-zinc-300">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* disable flow */}
        {disabling && enabled === true && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
            <p className="w-full text-xs text-zinc-400">Enter a current code to turn two-factor off:</p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              className="w-32 rounded-lg border border-line bg-card px-3 py-2 font-mono text-sm tracking-[0.3em] text-zinc-100 outline-none focus:border-rose-400/50"
            />
            <button
              disabled={busy || code.length !== 6}
              onClick={async () => {
                const d = await act({ action: "disable", code });
                if (d) {
                  setDisabling(false);
                  setCode("");
                  load();
                }
              }}
              className="rounded-full bg-rose-500 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-rose-400 disabled:opacity-50"
            >
              Disable MFA
            </button>
            <button onClick={() => setDisabling(false)} className="text-xs text-zinc-500 hover:text-zinc-300">
              Cancel
            </button>
          </div>
        )}

        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-300">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {error}
          </p>
        )}
      </div>
    </div>
  );
}
