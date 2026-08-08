"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { invalidateSession } from "@/lib/session";

/**
 * Shared login/signup form — real authentication against the database.
 * Dev seed accounts: devin@upnova.dev / ava@upnova.dev / jordanmiles@… ·
 * password upnova123 (listed on the login screen in dev only).
 */
export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "login" ? { email, password } : { email, password, displayName, handle }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }
    invalidateSession();
    router.push("/");
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
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-1 text-sm text-zinc-400">
        {mode === "login"
          ? "Sign in to your UpNova account."
          : "Find what's happening around you — and the people who can make it happen."}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        {mode === "signup" && (
          <>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className={inputCls} required />
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500">@</span>
              <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} placeholder="username" className={`${inputCls} pl-8`} required />
            </div>
          </>
        )}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={inputCls} required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"} className={inputCls} required />
        {error && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-rose-300">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-lime w-full justify-center py-2.5 text-sm disabled:opacity-50">
          {busy ? "One moment…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-zinc-500">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/signup" className="font-semibold text-violet-300 hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-violet-300 hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>

      {mode === "login" && (
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
