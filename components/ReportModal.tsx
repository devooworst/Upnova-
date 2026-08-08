"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Flag, Paperclip, X } from "lucide-react";

/* Report / Get Help — reachable from messages, projects, payments,
   profiles, opportunities, services, events, and community content.
   Two-sided by design: clients and creators both have a path. */

const groups: { label: string; items: string[] }[] = [
  {
    label: "Payment problem",
    items: [
      "I paid but the creator didn't start",
      "I paid but didn't receive the work",
      "The work doesn't match the agreement",
      "I was charged incorrectly",
      "Unauthorized payment",
      "Refund request",
    ],
  },
  {
    label: "Creator problem",
    items: [
      "Client hasn't paid",
      "Client received work but refuses to pay",
      "Client asked me to work outside UpNova",
      "Client changed the agreement",
      "Client is attempting fraud",
    ],
  },
  {
    label: "Safety / abuse",
    items: [
      "Scam or fraud",
      "Harassment",
      "Threats",
      "Impersonation",
      "Stolen work",
      "Copyright / IP issue",
      "Inappropriate content",
      "Off-platform payment request",
      "Other",
    ],
  },
];

export default function ReportModal({
  context,
  onClose,
}: {
  /** what's being reported, e.g. "Project · Event Photography" */
  context: string;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const caseId = "UPN-2481";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="card max-h-[90dvh] w-full max-w-md overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {submitted ? (
          <div className="py-4 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lime-400/15">
              <Check className="h-6 w-6 text-lime-400" />
            </span>
            <h2 className="mt-3 text-[15px] font-bold tracking-tight text-zinc-50">
              Report submitted
            </h2>
            <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-zinc-500">
              Case <span className="font-mono font-semibold text-zinc-300">{caseId}</span> is open.
              We review the project agreement, messages, payment records, and delivery timestamps —
              both sides can submit evidence.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Link href="/resolution" onClick={onClose} className="btn-lime rounded-md px-4 py-2 text-xs">
                Track in Resolution Center
              </Link>
              <button onClick={onClose} className="btn-ghost px-4 py-2 text-xs">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-50">
                <Flag className="h-4 w-4 text-red-400" /> Report / Get Help
              </h2>
              <button onClick={onClose} className="icon-btn h-8 w-8" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">{context}</p>

            <p className="mt-4 text-sm font-semibold text-zinc-200">What&apos;s wrong?</p>
            <div className="mt-2 space-y-3">
              {groups.map((g) => (
                <div key={g.label}>
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                    {g.label}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {g.items.map((item) => (
                      <button
                        key={item}
                        onClick={() => setCategory(item)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                          category === item
                            ? "border-red-400/60 bg-red-500/10 text-red-300"
                            : "border-line text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <label htmlFor="report-desc" className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                Describe what happened
              </label>
              <textarea
                id="report-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Dates, amounts, what was agreed, what actually happened…"
                className="input-dark mt-1.5 resize-none"
              />
            </div>

            <button className="mt-2.5 flex items-center gap-2 rounded-md border border-dashed border-line px-3 py-2 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300">
              <Paperclip className="h-3.5 w-3.5" /> Attach screenshots / files
            </button>

            <button
              onClick={() => category && setSubmitted(true)}
              disabled={!category}
              className={`mt-4 w-full rounded-full py-2.5 text-sm font-bold transition ${
                category
                  ? "bg-red-500 text-white hover:bg-red-400"
                  : "cursor-not-allowed bg-card-raised text-zinc-600"
              }`}
            >
              Submit Report
            </button>
            <p className="mt-2.5 text-center text-[10px] leading-relaxed text-zinc-600">
              UpNova protects the transaction and investigates disputes fairly — for clients and
              creators.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
