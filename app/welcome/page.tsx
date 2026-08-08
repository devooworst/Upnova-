import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Welcome back",
};

/** Logged-out landing. Covers the app chrome — you're outside the app now. */
export default function WelcomePage() {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink p-4">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <p className="text-4xl leading-none text-lime-400" aria-hidden>
            ✦
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-zinc-50">
            UpNova
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Find what&apos;s happening around you — and the people who can make it happen.
          </p>
        </div>

        <div className="card-money mt-8 p-5">
          <p className="text-center font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
            You&apos;ve been logged out. Everything is saved.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                Email or username
              </label>
              <input defaultValue="@devin" className="input-dark mt-1.5" />
            </div>
            <div>
              <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                Password
              </label>
              <input type="password" defaultValue="••••••••••" className="input-dark mt-1.5" />
            </div>
          </div>
          <Link href="/" className="btn-lime mt-4 flex w-full rounded-md py-2.5 text-sm">
            Log in
          </Link>
          <p className="mt-3 text-center text-xs text-zinc-500">
            New here?{" "}
            <Link href="/" className="font-semibold text-lime-400 hover:text-lime-300">
              Join UpNova
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center font-mono text-[10px] text-zinc-600">
          © 2026 UpNova, Baltimore MD
        </p>
      </div>
    </div>
  );
}
