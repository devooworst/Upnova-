"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole, Check } from "lucide-react";
import PasswordField from "@/components/PasswordField";
import { validatePassword } from "@/lib/passwordPolicy";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmState = confirm ? (confirm === password ? "match" : "differ") : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  };

  if (done)
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-lime-400/40 bg-lime-400/10">
          <Check className="h-6 w-6 text-lime-300" />
        </span>
        <h1 className="mt-3 text-xl font-bold tracking-tight text-zinc-50">Password updated</h1>
        <p className="mt-1 text-sm text-zinc-400">
          All sessions were signed out. Taking you to sign in…
        </p>
      </div>
    );

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center py-10">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-400/10">
        <LockKeyhole className="h-5 w-5 text-lime-400" />
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-50">Choose a new password</h1>
      <p className="mt-1 text-sm text-zinc-400">
        At least 12 characters. Longer passwords are stronger — spaces and passphrases welcome.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <PasswordField value={password} onChange={setPassword} placeholder="New password" autoComplete="new-password" showMeter autoFocus />
        <div>
          <PasswordField value={confirm} onChange={setConfirm} placeholder="Confirm new password" autoComplete="new-password" />
          {confirmState && (
            <p
              className={`mt-1 flex items-center gap-1.5 text-[11px] font-medium ${
                confirmState === "match" ? "text-lime-300" : "text-rose-300"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${confirmState === "match" ? "bg-lime-400" : "bg-rose-400"}`} />
              {confirmState === "match" ? "Passwords match" : "Passwords don't match"}
            </p>
          )}
        </div>
        {error && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-rose-300">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" /> {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-lime w-full justify-center py-2.5 text-sm disabled:opacity-50">
          {busy ? "One moment…" : "Set new password"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-zinc-500">
        <Link href="/login" className="font-semibold text-violet-300 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
