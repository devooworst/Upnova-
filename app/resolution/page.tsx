"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Clock,
  FileText,
  Flag,
  MessageSquare,
  Paperclip,
  Scale,
  ShieldCheck,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import ReportModal from "@/components/ReportModal";
import { creators, currentUser } from "@/lib/data";

/* ------------------------------------------------------------------ */
/* Resolution Center: every protected transaction is documented —      */
/* agreement, price, deadline, messages, delivery timestamps, payment  */
/* status. When something goes wrong, both sides submit evidence and   */
/* the case is investigated. Refunds are real refunds through the      */
/* payment system — never auto-replaced with credits.                  */
/* ------------------------------------------------------------------ */

const timeline = [
  { label: "Agreement created", done: true, date: "Aug 12" },
  { label: "Payment submitted", done: true, date: "Aug 12" },
  { label: "Work in progress", done: true, date: "Aug 13" },
  { label: "Delivery submitted", done: true, date: "Aug 20" },
  { label: "Client approval", done: false, date: "overdue" },
  { label: "Payout", done: false, date: "paused" },
];

export default function ResolutionPage() {
  const [reportOpen, setReportOpen] = useState(false);
  const jordan = creators.find((c) => c.id === "jordan")!;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-lime-400">
          <ShieldCheck className="h-3.5 w-3.5" /> upnova protected
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">Resolution Center</h1>
        <p className="mt-1.5 max-w-lg text-sm text-zinc-500">
          Every protected transaction is documented — agreement, price, deadline, messages,
          delivery, payment. We protect the transaction and investigate disputes fairly, for
          clients and creators.
        </p>
      </header>

      {/* active dispute */}
      <section className="card-money overflow-hidden">
        <div className="flex items-center justify-between border-b border-line-soft bg-red-500/[0.06] px-5 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-red-300">
            <Scale className="h-4 w-4" /> Payment Dispute · case UPN-2481
          </p>
          <span className="rounded-full border border-amber-400/40 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-300">
            under review
          </span>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-zinc-100">Full Music Production</p>
              <p className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                <Avatar src={jordan.avatar} initials={jordan.initials} gradient={jordan.gradient} size="xs" className="!h-5 !w-5" />
                Client: {jordan.name}
                <span>·</span>
                <Avatar src={currentUser.avatar} initials={currentUser.initials} size="xs" className="!h-5 !w-5" />
                Creator: {currentUser.name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-extrabold tracking-tight tabular-nums text-lime-400">$300</p>
              <p className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                payment under review
              </p>
            </div>
          </div>

          <p className="mt-3 rounded-md border border-line bg-card-raised p-3 text-xs leading-relaxed text-zinc-400">
            <span className="font-semibold text-zinc-200">The claim:</span> client received the
            delivery on Aug 20 and has not approved or paid out. The normal payout workflow is
            paused while the dispute is investigated, per the payment provider&apos;s rules.
          </p>

          {/* project timeline — the evidence skeleton */}
          <div className="mt-4">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
              project timeline
            </p>
            <ul className="mt-2 space-y-1.5">
              {timeline.map((t) => (
                <li key={t.label} className="flex items-center gap-2.5 text-xs">
                  <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${t.done ? "border-lime-400 bg-lime-400/20" : "border-zinc-600"}`}>
                    {t.done && <Check className="h-2.5 w-2.5 text-lime-400" />}
                  </span>
                  <span className={t.done ? "text-zinc-200" : "text-zinc-500"}>{t.label}</span>
                  <span className={`ml-auto font-mono text-[10px] ${t.date === "paused" || t.date === "overdue" ? "font-semibold text-amber-400" : "text-zinc-600"}`}>
                    {t.date}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* evidence on file */}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              { icon: FileText, label: "Project agreement", meta: "$300 · due Aug 20" },
              { icon: MessageSquare, label: "Message history", meta: "42 messages" },
              { icon: Paperclip, label: "Delivery files", meta: "final-mix.wav · Aug 20, 11:42 PM" },
              { icon: Clock, label: "Payment record", meta: "paid Aug 12 · $315 incl. fee" },
            ].map((e) => (
              <div key={e.label} className="flex items-center gap-2.5 rounded-md border border-line bg-card-raised px-3 py-2.5">
                <e.icon className="h-4 w-4 shrink-0 text-zinc-500" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-zinc-200">{e.label}</p>
                  <p className="truncate font-mono text-[10px] text-zinc-500">{e.meta}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-line-soft pt-4">
            <button className="btn-ghost px-4 py-2 text-xs">
              <Paperclip className="h-3.5 w-3.5" /> Add evidence
            </button>
            <button className="btn-ghost px-4 py-2 text-xs">
              <MessageSquare className="h-3.5 w-3.5" /> Message the other side
            </button>
          </div>

          <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
            Possible outcomes: creator wins → payout proceeds · client wins → refund through the
            payment system · partial resolution where supported. Refunds are never auto-replaced
            with credits.
          </p>
        </div>
      </section>

      {/* creative integrity */}
      <section className="card p-5">
        <h2 className="text-[15px] font-bold tracking-tight text-zinc-100">
Creative Integrity Review
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          UpNova doesn&apos;t prohibit AI — it prohibits <span className="font-semibold text-zinc-300">misrepresentation</span>.
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
          Never send payment outside UpNova. Payments made outside UpNova may not be covered by
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
        mechanisms (Stripe Connect) — UpNova never holds funds itself.{" "}
        <Link href="/settings" className="underline-offset-2 hover:underline">Payment settings</Link>
      </p>

      {reportOpen && <ReportModal context="Resolution Center" onClose={() => setReportOpen(false)} />}
    </div>
  );
}
