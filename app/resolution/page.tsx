"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Flag,
  MessageSquare,
  Paperclip,
  Scale,
  ShieldCheck,
} from "lucide-react";
import ReportModal from "@/components/ReportModal";
import { useSession } from "@/lib/session";
import { DISPUTE_STATUS_LABEL } from "@/lib/protection";

/* ------------------------------------------------------------------ */
/* Resolution Center: every protected transaction is documented —      */
/* agreement, price, deadline, messages, delivery timestamps, payment  */
/* status. When something goes wrong, both sides submit evidence and   */
/* the case is investigated. Refunds are real refunds through the      */
/* payment system — never auto-replaced with credits.                  */
/* ------------------------------------------------------------------ */

/* Real dispute cases from /api/me/disputes — the SAME records the order
   pages and platform review work from. Open cases first, newest first. */
interface DisputeCase {
  id: string;
  kind: string;
  reason: string;
  status: string;
  openedByMe: boolean;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string;
  evidenceCount: number;
  order: { id: string; title: string; amount: number; myRole: "buyer" | "seller"; with: string };
}

const OPEN_STATES = ["open", "under_review", "return_authorized", "return_in_transit"];

export default function ResolutionPage() {
  const [reportOpen, setReportOpen] = useState(false);
  const { user } = useSession();
  // null = loading (or signed out) — the cases section waits, never fakes
  const [cases, setCases] = useState<DisputeCase[] | null>(null);
  useEffect(() => {
    if (!user) {
      setCases(null);
      return;
    }
    let cancelled = false;
    fetch("/api/me/disputes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && Array.isArray(d?.disputes)) setCases(d.disputes);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [!!user]); // eslint-disable-line react-hooks/exhaustive-deps

  const ordered = (cases ?? []).slice().sort((a, b) => {
    const ao = OPEN_STATES.includes(a.status) ? 0 : 1;
    const bo = OPEN_STATES.includes(b.status) ? 0 : 1;
    return ao - bo || +new Date(b.createdAt) - +new Date(a.createdAt);
  });
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-lime-400">
          <ShieldCheck className="h-3.5 w-3.5" /> mavyn protected
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">Resolution Center</h1>
        <p className="mt-1.5 max-w-lg text-sm text-zinc-500">
          Every protected transaction is documented — agreement, price, deadline, messages,
          delivery, payment. We protect the transaction and investigate disputes fairly, for
          clients and creators.
        </p>
      </header>

      {/* your cases — real records from /api/me/disputes */}
      <section className="card-money overflow-hidden">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-zinc-100">
            <Scale className="h-4 w-4 text-zinc-400" /> Your cases
          </p>
          {ordered.length > 0 && (
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              {ordered.filter((c) => OPEN_STATES.includes(c.status)).length} open · {ordered.length} total
            </span>
          )}
        </div>

        {/* loading / signed out */}
        {cases === null && (
          <div className="p-5" aria-busy="true">
            <div className="h-16 animate-pulse rounded-xl bg-card-raised" />
          </div>
        )}

        {/* the polished empty state — most accounts, honestly */}
        {cases !== null && ordered.length === 0 && (
          <div className="p-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/30 bg-lime-400/10">
              <ShieldCheck className="h-5 w-5 text-lime-400" />
            </span>
            <p className="mt-3 text-sm font-semibold text-zinc-100">No open cases</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-zinc-500">
              Nothing is in dispute on your account. If something goes wrong with an order,
              open a case from that order — the payout freezes and both sides submit evidence.
            </p>
            <Link href="/orders" className="btn-ghost mt-4 inline-flex px-4 py-1.5 text-xs">
              View your orders
            </Link>
          </div>
        )}

        {/* real cases, open first */}
        {ordered.length > 0 && (
          <ul className="divide-y divide-line-soft">
            {ordered.map((c) => {
              const open = OPEN_STATES.includes(c.status);
              return (
                <li key={c.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                        {c.kind === "return" ? "Return request" : "Problem report"} · {c.order.title}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {c.order.myRole === "buyer" ? "Seller" : "Buyer"}: {c.order.with} · opened{" "}
                        {c.openedByMe ? "by you" : "by them"} {fmtDate(c.createdAt)} ·{" "}
                        {c.evidenceCount} evidence {c.evidenceCount === 1 ? "entry" : "entries"}
                      </p>
                      <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                        <span className="font-semibold text-zinc-300">Reason:</span> {c.reason.replaceAll("_", " ")}
                      </p>
                      {c.resolutionNote && (
                        <p className="mt-1.5 rounded-md border border-line bg-card-raised px-3 py-2 text-xs leading-relaxed text-zinc-400">
                          <span className="font-semibold text-zinc-200">Resolution:</span> {c.resolutionNote}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xl font-extrabold tracking-tight tabular-nums text-lime-400">
                        ${c.order.amount.toLocaleString()}
                      </p>
                      <span
                        className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${
                          open ? "border-amber-400/40 text-amber-300" : "border-line text-zinc-500"
                        }`}
                      >
                        {DISPUTE_STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line-soft pt-3">
                    <Link href="/orders" className="btn-ghost px-4 py-2 text-xs">
                      <Paperclip className="h-3.5 w-3.5" /> {open ? "Add evidence" : "View order"}
                    </Link>
                    <Link href="/messages" className="btn-ghost px-4 py-2 text-xs">
                      <MessageSquare className="h-3.5 w-3.5" /> Message the other side
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="border-t border-line-soft px-5 py-3 text-[10px] leading-relaxed text-zinc-600">
          Possible outcomes: creator wins → payout proceeds · client wins → refund through the
          payment system · partial resolution where supported. Refunds are never auto-replaced
          with credits. While a case is open, the normal payout workflow is paused rather than
          automatically favoring either side.
        </p>
      </section>

      {/* creative integrity */}
      <section className="card p-5">
        <h2 className="text-[15px] font-bold tracking-tight text-zinc-100">
Creative Integrity Review
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Mavyn doesn&apos;t prohibit AI — it prohibits <span className="font-semibold text-zinc-300">misrepresentation</span>.
          Every project records its agreed AI policy. If a client believes the policy was violated
          (&ldquo;this hand-painted illustration looks AI-generated&rdquo;), they can open a review.
          We don&apos;t claim automatic AI detection — reviews rely on the agreement, disclosures,
          and reasonable evidence of the creative process:
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["Sketches & drafts", "Source / project files", "Progress screenshots", "Layers", "Time-lapse / process footage", "Original files & metadata"].map((e) => (
            <span key={e} className="chip px-2 py-0.5 text-[11px]">{e}</span>
          ))}
        </div>
        <p className="mt-3 border-t border-line-soft pt-3 text-[10px] leading-relaxed text-zinc-600">
          Not every creator has to document every second of their work — evidence is requested
          where appropriate. While a review is open, the normal payout workflow is paused rather
          than automatically favoring either side.
        </p>
      </section>

      {/* protected transactions */}
      <section className="card p-5">
        <h2 className="text-[15px] font-bold tracking-tight text-zinc-100">Protected transactions</h2>
        <ul className="mt-2 divide-y divide-line-soft">
          {[
            { title: "Event Photography · Ava Chen", amount: "$315", status: "In progress", ok: true },
            { title: "Mixing session · Maya Reyes", amount: "$200", status: "Completed · paid out", ok: true },
            { title: "After Dark Baltimore · 137 tickets", amount: "$4,110", status: "Payout after event", ok: true },
          ].map((t) => (
            <li key={t.title} className="flex items-center gap-3 py-3">
              <ShieldCheck className="h-4 w-4 shrink-0 text-lime-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-200">{t.title}</p>
                <p className="text-xs text-zinc-500">{t.status}</p>
              </div>
              <span className="font-bold tabular-nums tracking-tight text-zinc-100">{t.amount}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* stay protected */}
      <section className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-amber-300">⚠️ Stay protected</p>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
          Never send payment outside Mavyn. Payments made outside Mavyn may not be covered by
          transaction protections. If someone asks you to pay through Cash App, Venmo, or Zelle
          instead — that&apos;s a red flag. <button onClick={() => setReportOpen(true)} className="font-semibold text-amber-300 underline-offset-2 hover:underline">Report it</button>.
        </p>
      </section>

      <div className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
        <p className="text-xs text-zinc-500">Something else going on?</p>
        <button onClick={() => setReportOpen(true)} className="flex items-center gap-1.5 rounded-full border border-red-400/40 px-3.5 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10">
          <Flag className="h-3.5 w-3.5" /> Report / Get Help
        </button>
      </div>

      <p className="text-center text-[10px] leading-relaxed text-zinc-600">
        Production dispute handling runs on the payment provider&apos;s hold, refund, and dispute
        mechanisms (Stripe Connect) — Mavyn never holds funds itself.{" "}
        <Link href="/settings" className="underline-offset-2 hover:underline">Payment settings</Link>
      </p>

      {reportOpen && <ReportModal context="Resolution Center" onClose={() => setReportOpen(false)} />}
    </div>
  );
}
