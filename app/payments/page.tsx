"use client";

/* ------------------------------------------------------------------ */
/*  Payments — the money view. Totals and the transaction history,     */
/*  every row tied to its real booking/project/order and counterpart.  */
/*  EVERYTHING here is a TEST payment — this environment never moves   */
/*  real money, and every amount is labeled accordingly.               */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, RefreshCw, Wallet } from "lucide-react";
import { useSession } from "@/lib/session";

interface Payments {
  summary: { totalSpent: number; pendingOut: number; refunded: number; totalEarned: number; pendingIn: number };
  transactions: {
    id: string;
    direction: "in" | "out";
    amountCents: number;
    feeCents: number;
    status: string;
    title: string;
    with: { handle: string; displayName: string };
    record: { kind: string; id: string } | null;
    at: string;
  }[];
}

const STATUS_TONE: Record<string, string> = {
  held: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  released: "border-lime-400/40 bg-lime-400/10 text-lime-300",
  refunded: "border-line bg-card-raised text-zinc-400",
};

const recordHref = (r: { kind: string; id: string } | null): string => {
  if (!r) return "/activity";
  if (r.kind === "project") return `/projects/${r.id}`;
  if (r.kind === "booking") return `/activity?focus=booking:${r.id}`;
  return "/orders";
};

export default function PaymentsPage() {
  const { user } = useSession();
  const [data, setData] = useState<Payments | null>(null);

  const load = () =>
    fetch("/api/me/payments", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.summary && setData(d))
      .catch(() => {});
  useEffect(() => {
    if (user) load();
  }, [!!user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm font-semibold text-zinc-200">Sign in to see your payments.</p>
        <Link href="/login" className="btn-lime mt-4 inline-flex px-5 py-2 text-xs">Sign in</Link>
      </div>
    );

  const s = data?.summary;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-300">business · money</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-50">
            <Wallet className="h-6 w-6 text-lime-400" /> Payments
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Every amount below is a <span className="font-semibold text-amber-300">TEST payment</span> — no real money exists in this environment.
          </p>
        </div>
        <button onClick={load} className="btn-ghost px-3 py-2 text-xs" aria-label="Refresh"><RefreshCw className="h-3.5 w-3.5" /></button>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(
          [
            ["Total spent", s?.totalSpent, "text-zinc-100"],
            ["Pending out (secured)", s?.pendingOut, "text-amber-300"],
            ["Refunded", s?.refunded, "text-zinc-400"],
            ["Total earned", s?.totalEarned, "text-lime-300"],
            ["Pending in (secured)", s?.pendingIn, "text-amber-300"],
          ] as const
        ).map(([label, n, tone]) => (
          <div key={label} className="card p-3 text-center">
            <p className={`font-mono text-lg font-bold tracking-tight ${tone}`}>{n != null ? `$${n}` : "—"}</p>
            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
          </div>
        ))}
      </div>

      <section className="card overflow-hidden">
        <p className="border-b border-line-soft px-5 py-3 text-sm font-bold text-zinc-100">Transaction history</p>
        {data === null ? (
          <div className="m-5 h-24 animate-pulse rounded-xl bg-card-raised" />
        ) : data.transactions.length === 0 ? (
          <p className="px-5 py-6 text-xs text-zinc-500">No transactions yet — bookings, projects, and purchases appear here as they happen.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {data.transactions.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${t.direction === "in" ? "border-lime-400/40 bg-lime-400/10 text-lime-300" : "border-line bg-card-raised text-zinc-400"}`}>
                  {t.direction === "in" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-100">
                    <Link href={recordHref(t.record)} className="hover:underline">{t.title}</Link>
                  </p>
                  <p className="font-mono text-[10px] tracking-[0.06em] text-zinc-500">
                    {t.direction === "in" ? "from" : "to"}{" "}
                    <Link href={`/creator/${t.with.handle}`} className="text-zinc-400 hover:underline">{t.with.displayName}</Link>
                    {" · "}{new Date(t.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {t.direction === "out" && t.feeCents > 0 ? ` · incl. $${(t.feeCents / 100).toFixed(2)} fee` : ""}
                  </p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wide ${STATUS_TONE[t.status] ?? "border-line text-zinc-400"}`}>
                  {t.status} · test
                </span>
                <span className={`font-mono text-sm font-bold tracking-[0.06em] ${t.direction === "in" ? "text-lime-300" : "text-zinc-200"}`}>
                  {t.direction === "in" ? "+" : "−"}${((t.amountCents + (t.direction === "out" ? t.feeCents : 0)) / 100).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
