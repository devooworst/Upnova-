"use client";

/* ------------------------------------------------------------------ */
/*  Opportunities — DB-backed listings with real posters, real         */
/*  applications, and the poster-side applicant review entry point.    */
/*  "Apply Now", never "pitch".                                        */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Users, X, Bookmark } from "lucide-react";
import Avatar from "@/components/Avatar";

export interface OpportunityItem {
  id: string;
  title: string;
  description: string;
  budget: number | null;
  type: string;
  location: string;
  remote: boolean;
  studentFriendly: boolean;
  trustRequired: string;
  applyBy: string | null;
  eventDate: string | null;
  poster: { id: string; handle: string; displayName: string; avatarUrl: string | null };
  isMine: boolean;
  applied: boolean;
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function OpportunityList({ scope = "for-you", compact = false }: { scope?: string; compact?: boolean }) {
  const [items, setItems] = useState<OpportunityItem[] | null>(null);
  const [applying, setApplying] = useState<OpportunityItem | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/bookmarks", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) =>
        setSaved(
          new Set((d.items ?? []).filter((i: { type: string }) => i.type === "opportunity").map((i: { id: string }) => i.id))
        )
      );
  }, []);

  const toggleSave = async (id: string) => {
    const res = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "opportunity", targetId: id }),
    });
    if (!res.ok) return;
    const d = await res.json();
    setSaved((s) => {
      const next = new Set(s);
      if (d.saved) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const load = useCallback(async () => {
    const res = await fetch(`/api/opportunities?scope=${scope}`, { cache: "no-store" });
    const data = await res.json();
    setItems(data.opportunities ?? []);
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  if (items === null)
    return <div className="card animate-pulse p-5" aria-hidden><div className="h-3 w-1/2 rounded bg-card-raised" /><div className="mt-3 h-3 w-2/3 rounded bg-card-raised" /></div>;

  return (
    <div className="space-y-3">
      {items.map((o) => (
        <article key={o.id} className="card-money p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-100">{o.title}</h3>
                {o.budget != null ? (
                  <span className="font-mono text-sm font-medium tracking-[0.08em] text-lime-300">${o.budget}</span>
                ) : (
                  <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-300">
                    Collab
                  </span>
                )}
                {o.studentFriendly && (
                  <span className="rounded-full border border-violet-400/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-violet-300">
                    Student-Friendly
                  </span>
                )}
              </div>
              {!compact && <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{o.description}</p>}
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <Avatar src={o.poster.avatarUrl} initials={o.poster.displayName.charAt(0)} size="xs" />
                  <Link href={`/creator/${o.poster.handle}`} className="font-medium text-zinc-300 hover:text-violet-300">
                    {o.poster.displayName}
                  </Link>
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {o.remote ? "Remote" : o.location}
                </span>
                {o.eventDate && <span className="font-mono tracking-[0.08em]">WHEN · {fmtDate(o.eventDate)}</span>}
                {o.applyBy && <span className="font-mono tracking-[0.08em]">APPLY BY · {fmtDate(o.applyBy)}</span>}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => toggleSave(o.id)}
                title={saved.has(o.id) ? "Remove bookmark" : "Save"}
                className={`rounded-full border p-1.5 transition ${
                  saved.has(o.id)
                    ? "border-violet-400/50 text-violet-300"
                    : "border-line text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                }`}
              >
                <Bookmark className={`h-3.5 w-3.5 ${saved.has(o.id) ? "fill-violet-300" : ""}`} />
              </button>
              {o.isMine ? (
                <Link
                  href={`/opportunities/${o.id}/applicants`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 px-3.5 py-1.5 text-xs font-semibold text-violet-300 transition hover:bg-violet-400/10"
                >
                  <Users className="h-3.5 w-3.5" /> View applicants
                </Link>
              ) : o.applied ? (
                <span className="rounded-full border border-lime-400/40 bg-lime-400/10 px-3.5 py-1.5 text-xs font-semibold text-lime-300">
                  ✓ Applied
                </span>
              ) : (
                <button onClick={() => setApplying(o)} className="btn-lime px-4 py-1.5 text-xs">
                  Apply Now
                </button>
              )}
            </div>
          </div>
        </article>
      ))}
      {items.length === 0 && (
        <p className="py-10 text-center text-sm text-zinc-500">No open opportunities in this scope yet.</p>
      )}

      {applying && (
        <ApplyModal
          opp={applying}
          onClose={() => setApplying(null)}
          onDone={() => {
            setApplying(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ApplyModal({ opp, onClose, onDone }: { opp: OpportunityItem; onClose: () => void; onDone: () => void }) {
  const [message, setMessage] = useState("");
  const [availability, setAvailability] = useState<"yes" | "need_check" | null>(opp.eventDate ? null : "yes");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (opp.eventDate && !availability) {
      setError("Confirm your availability for the project date");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/opportunities/${opp.id}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, availability }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not apply");
      return;
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Apply — {opp.title}</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              {opp.budget != null
                ? `Applying accepts the listed budget of $${opp.budget}.`
                : "This is a collaboration — no payment attached."}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Why you? Keep it short — your profile and portfolio are attached automatically."
          className="mt-4 w-full resize-none rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50"
        />

        {opp.eventDate && (
          <div className="mt-3">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
              Are you available on {fmtDate(opp.eventDate)}?
            </p>
            <div className="mt-1.5 flex gap-2">
              <button
                onClick={() => setAvailability("yes")}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                  availability === "yes" ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400"
                }`}
              >
                Yes, I&apos;m available
              </button>
              <button
                onClick={() => setAvailability("need_check")}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                  availability === "need_check" ? "border-amber-400/50 bg-amber-400/10 text-amber-300" : "border-line text-zinc-400"
                }`}
              >
                Need to check my schedule
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-rose-300">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost px-4 py-1.5 text-xs">Cancel</button>
          <button onClick={submit} disabled={busy} className="btn-lime px-4 py-1.5 text-xs disabled:opacity-40">
            Submit application
          </button>
        </div>
      </div>
    </div>
  );
}
