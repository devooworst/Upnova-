"use client";

/* ------------------------------------------------------------------ */
/*  PaymentDirection — the ONE banner that says which side of a        */
/*  transaction you're on, everywhere money changes hands.             */
/*                                                                     */
/*    paying    (sky)  — you are the CLIENT sending money              */
/*    receiving (lime) — you are the PROVIDER/CREATOR earning it       */
/*                                                                     */
/*  Sky = the Service/client-action color in Mavyn's category system;  */
/*  lime = money/earning. Accent-level treatment only: a labeled strip */
/*  with icon + names + amount — pages stay dark, nav stays Mavyn.     */
/*  Color is never the only signal: the words say the direction too.  */
/* ------------------------------------------------------------------ */

import { ArrowUpRight, ArrowDownLeft } from "lucide-react";

export function PaymentDirection({
  side,
  name,
  context,
  amount,
  status,
  className = "",
}: {
  side: "paying" | "receiving";
  /** the OTHER party — who you pay / who pays you */
  name: string;
  /** what the money is for — service/booking/order/project title */
  context?: string;
  /** formatted amount, e.g. "$126.00" */
  amount?: string;
  /** receiving side: payment status, e.g. "secured — releases on completion" */
  status?: string;
  className?: string;
}) {
  const paying = side === "paying";
  return (
    <div
      data-guide={paying ? "payment-paying" : "payment-receiving"}
      className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${
        paying ? "border-sky-400/40 bg-sky-400/10" : "border-lime-400/40 bg-lime-400/10"
      } ${className}`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
          paying ? "border-sky-400/40 bg-sky-400/15 text-sky-300" : "border-lime-400/40 bg-lime-400/15 text-lime-300"
        }`}
      >
        {paying ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-mono text-[9px] font-bold uppercase tracking-[0.16em] ${paying ? "text-sky-300" : "text-lime-300"}`}>
          {paying ? "You're paying" : "You're receiving payment"}
        </span>
        <span className="block truncate text-sm font-semibold text-zinc-100">
          {paying ? name : `from ${name}`}
        </span>
        {(context || status) && (
          <span className="block truncate text-[11px] text-zinc-400">
            {context}
            {context && status ? " · " : ""}
            {status}
          </span>
        )}
      </span>
      {amount && (
        <span className={`shrink-0 font-mono text-sm font-bold tracking-[0.04em] ${paying ? "text-sky-300" : "text-lime-300"}`}>
          {amount}
        </span>
      )}
    </div>
  );
}
