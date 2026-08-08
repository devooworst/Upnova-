"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }
    setSent(true);
    setDevUrl(data.devResetUrl ?? null);
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center py-10">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-400/10">
        <KeyRound className="h-5 w-5 text-violet-400" />
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-50">Reset your password</h1>

      {!sent ? (
        <>
          <p className="mt-1 text-sm text-zinc-400">
            Enter your account email and we&apos;ll send a reset link. The link works once and
            expires in 30 minutes.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="w-full rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-lime-400/50"
              required
            />
            {error && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-rose-300">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {error}
              </p>
            )}
            <button type="submit" disabled={busy} className="btn-lime w-full justify-center py-2.5 text-sm disabled:opacity-50">
              {busy ? "One moment…" : "Send reset link"}
            </button>
          </form>
        </>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="rounded-xl border border-lime-400/30 bg-lime-400/5 px-4 py-3 text-sm text-zinc-300">
            If an account exists for <span className="font-semibold text-zinc-100">{email}</span>,
            a reset link is on its way.
          </p>
          {devUrl && (
            <div className="rounded-xl border border-line-soft bg-card p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                Dev sandbox — no email service
              </p>
              <p className="mt-1.5 text-xs text-zinc-400">
                In production this link is emailed. For the demo, open it directly:
              </p>
              <Link href={devUrl} className="mt-2 inline-block text-xs font-semibold text-violet-300 hover:underline">
                Open reset link →
              </Link>
            </div>
          )}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-zinc-500">
        <Link href="/login" className="font-semibold text-violet-300 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
