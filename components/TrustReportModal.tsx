"use client";

/* ------------------------------------------------------------------ */
/*  ReportModal — suspected stolen work, impersonation, false service  */
/*  claims, copyright, or anything else. Reports go into a human       */
/*  moderation queue: filing one never auto-accuses or auto-bans the   */
/*  creator, and automated similarity checks are advisory signals for  */
/*  the reviewer, never proof.                                         */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import { X, Flag, Check } from "lucide-react";
import { REPORT_REASONS, type ReportReason } from "@/lib/trust";

export default function TrustReportModal({
  targetType,
  targetId,
  targetLabel,
  onClose,
}: {
  targetType: "post" | "user" | "service" | "opportunity";
  targetId: string;
  targetLabel: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason) return setError("Pick what happened");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, category: reason, details }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Could not file the report");
      return;
    }
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {done ? (
          <div className="space-y-3 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-lime-400/40 bg-lime-400/10">
              <Check className="h-5 w-5 text-lime-300" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Report received</h3>
              <p className="mx-auto mt-1 max-w-[260px] text-xs leading-relaxed text-zinc-400">
                A human moderator will review it. Reports never automatically accuse or penalize anyone —
                the creator isn&apos;t notified unless review finds a problem.
              </p>
            </div>
            <button onClick={onClose} className="btn-ghost mx-auto px-5 py-2 text-xs">Close</button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Report</p>
                <h3 className="mt-1 flex items-center gap-1.5 text-sm font-bold text-zinc-100">
                  <Flag className="h-4 w-4 text-rose-300" /> What happened?
                </h3>
                <p className="mt-0.5 text-[11px] text-zinc-500">Reporting the {targetLabel}</p>
              </div>
              <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:text-zinc-200" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setReason(r.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-xs font-medium transition ${
                    reason === r.id ? "border-rose-400/50 bg-rose-400/5 text-rose-200" : "border-line text-zinc-300 hover:border-zinc-600"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${reason === r.id ? "bg-rose-400" : "bg-zinc-700"}`} />
                  {r.label}
                </button>
              ))}
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder="Anything that helps review — links to your original work, dates, context (optional)"
              className="mt-3 w-full resize-none rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-rose-400/40"
            />

            <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
              Goes to human review. Automated checks (like duplicate-image matching) only add context for
              the reviewer — they are never treated as proof.
            </p>

            {error && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-300">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" /> {error}
              </p>
            )}
            <button onClick={submit} disabled={busy} className="btn-lime mt-3 w-full justify-center py-2.5 text-sm disabled:opacity-40">
              {busy ? "Filing…" : "Submit report"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
