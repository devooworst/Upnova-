"use client";

/* ------------------------------------------------------------------ */
/*  Auth — NIST/OWASP-aligned UX. Length over composition rules,       */
/*  passphrases welcome (spaces included), live strength feedback,     */
/*  show/hide, confirm-match, forgot-password, and an MFA code step    */
/*  when the account has two-factor enabled. Security happens server-  */
/*  side: scrypt hashing, common-password blocking, rate limiting.     */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchSession } from "@/lib/session";
import { ShieldCheck } from "lucide-react";
import PasswordField from "@/components/PasswordField";
import { PASSWORD_MIN, HANDLE_RULE, validatePassword } from "@/lib/passwordPolicy";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [accountType, setAccountType] = useState<"individual" | "business">("individual");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaStep, setMfaStep] = useState(false);
  const [showOpenTab, setShowOpenTab] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmState = mode === "signup" && confirm ? (confirm === password ? "match" : "differ") : null;
  // carry the return destination across the login<->signup switch
  const nextQ =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("next")
      ? `?next=${encodeURIComponent(new URLSearchParams(window.location.search).get("next")!)}`
      : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "signup") {
      const pwError = validatePassword(password);
      if (pwError) {
        setError(pwError);
        return;
      }
      if (password !== confirm) {
        setError("Passwords don't match");
        return;
      }
    }

    setBusy(true);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "login"
          ? { email, password, ...(mfaStep ? { code: mfaCode } : {}) }
          : { email, password, displayName, handle, accountType }
      ),
    });
    const data = await res.json();
    setBusy(false);

    if (res.ok && data.mfaRequired) {
      setMfaStep(true);
      return;
    }
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }
    // CONFIRM the session actually persisted before navigating anywhere —
    // never pretend to be logged in. If the server authenticated us but
    // the browser refused the session cookie (some browsers block all
    // third-party cookies inside embedded views), say exactly that and
    // offer the first-party escape hatch.
    setBusy(true);
    const who = await fetchSession(true);
    setBusy(false);
    if (!who) {
      setError(
        "Signed in, but your browser didn't keep the session cookie — this happens in embedded previews when third-party cookies are blocked. Open UpNova in its own tab and sign in there."
      );
      setShowOpenTab(true);
      return;
    }
    // return the user to what they were doing before auth (e.g. the
    // opportunity they tried to apply to). Path-only — no open redirects.
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    router.push(safeNext);
    router.refresh();
  };

  const inputCls =
    "w-full rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-lime-400/50";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center py-10">
      <p className="font-syne text-xl font-bold text-zinc-50">
        UpNova <span className="text-lime-400">✦</span>
      </p>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-50">
        {mfaStep ? "Two-factor code" : mode === "login" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-1 text-sm text-zinc-400">
        {mfaStep
          ? "Enter the 6-digit code from your authenticator app."
          : mode === "login"
            ? "Sign in to your UpNova account."
            : "Find what's happening around you — and the people who can make it happen."}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        {mfaStep ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-violet-400/30 bg-violet-400/5 px-3.5 py-3">
            <ShieldCheck className="h-4 w-4 shrink-0 text-violet-300" />
            <input
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              autoFocus
              className="w-full bg-transparent font-mono text-lg tracking-[0.4em] text-zinc-100 outline-none placeholder:text-zinc-600"
            />
          </div>
        ) : (
          <>
            {mode === "signup" && (
              <>
                <div className="flex gap-1.5 rounded-xl border border-line bg-card-raised p-1">
                  <button
                    type="button"
                    onClick={() => setAccountType("individual")}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                      accountType === "individual" ? "bg-lime-400/15 text-lime-300" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Individual creator
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountType("business")}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                      accountType === "business" ? "bg-sky-400/15 text-sky-300" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Business
                  </button>
                </div>
                {accountType === "business" && (
                  <p className="text-[11px] leading-relaxed text-zinc-500">
                    Business accounts start unverified. The Verified Business badge comes from
                    UpNova&apos;s verification process — it is never included with a subscription.
                  </p>
                )}
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={accountType === "business" ? "Organization name" : "Display name"}
                  autoComplete="name"
                  className={inputCls}
                  required
                />
                <div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                      @
                    </span>
                    <input
                      value={handle}
                      onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                      placeholder="username"
                      autoComplete="username"
                      maxLength={30}
                      className={`${inputCls} pl-8`}
                      required
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">{HANDLE_RULE}</p>
                </div>
              </>
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              className={inputCls}
              required
            />
            <div>
              <PasswordField
                value={password}
                onChange={setPassword}
                placeholder="Password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                showMeter={mode === "signup"}
              />
              {mode === "signup" && !password && (
                <p className="mt-1 text-[11px] text-zinc-500">
                  At least {PASSWORD_MIN} characters. Longer passwords are stronger — spaces and
                  passphrases welcome.
                </p>
              )}
            </div>
            {mode === "signup" && (
              <div>
                <PasswordField
                  value={confirm}
                  onChange={setConfirm}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                />
                {confirmState && (
                  <p
                    className={`mt-1 flex items-center gap-1.5 text-[11px] font-medium ${
                      confirmState === "match" ? "text-lime-300" : "text-rose-300"
                    }`}
                    aria-live="polite"
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${confirmState === "match" ? "bg-lime-400" : "bg-rose-400"}`}
                    />
                    {confirmState === "match" ? "Passwords match" : "Passwords don't match"}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {showOpenTab && (
          <a
            href={typeof window !== "undefined" ? window.location.href : "/login"}
            target="_blank"
            rel="noopener"
            className="btn-lime mb-2 w-full justify-center py-2.5 text-sm"
          >
            Open UpNova in its own tab
          </a>
        )}
        {error && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-rose-300" aria-live="assertive">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" /> {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || (mfaStep && mfaCode.length !== 6)}
          className="btn-lime w-full justify-center py-2.5 text-sm disabled:opacity-50"
        >
          {busy ? "One moment…" : mfaStep ? "Verify code" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        {mode === "login" && !mfaStep && (
          <p className="text-center">
            <Link href="/forgot" className="text-xs font-medium text-zinc-500 hover:text-zinc-300">
              Forgot password?
            </Link>
          </p>
        )}
      </form>

      {!mfaStep && (
        <p className="mt-4 text-center text-xs text-zinc-500">
          {mode === "login" ? (
            <>
              New here?{" "}
              <Link href={`/signup${nextQ}`} className="font-semibold text-violet-300 hover:underline">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href={`/login${nextQ}`} className="font-semibold text-violet-300 hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      )}

      {mode === "login" && !mfaStep && (
        <div className="mt-6 rounded-xl border border-line-soft bg-card p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Development seed accounts</p>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
            devin@upnova.dev (admin) · ava@upnova.dev · jordanmiles@upnova.dev · marcusj@upnova.dev ·
            nia@upnova.dev · lena@upnova.dev — password{" "}
            <span className="font-mono font-medium tracking-[0.08em] text-zinc-300">upnova123</span>
          </p>
        </div>
      )}
    </div>
  );
}
