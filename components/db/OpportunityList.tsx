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
import PosterBadge, { PosterOverline, type PosterType } from "@/components/PosterBadge";
import { useSession, fetchSession } from "@/lib/session";
import { engagementTypeLabel, compLabel, type EngagementConfig } from "@/lib/engagement";
import { promptJoin } from "@/components/GuestGate";

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
  applyConfig?: { requireMessage?: boolean; question?: string };
  roles?: { id: string; title: string; count: number; pay: number | null; description?: string; open: number }[];
  engagement?: EngagementConfig | null;
  posterType?: PosterType;
  poster: { id: string; handle: string; displayName: string; avatarUrl: string | null; locationLabel?: string | null };
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
  const { user: me } = useSession();

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
    if (me === null) return promptJoin("save"); // UX only — the API 401s regardless
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

  // resume-after-auth: guest pressed Apply → signed up → returned to
  // /opportunities?apply=<id> — open that application straight away
  useEffect(() => {
    if (!me || !items) return;
    const params = new URLSearchParams(window.location.search);
    const applyId = params.get("apply");
    if (!applyId) return;
    window.history.replaceState(null, "", window.location.pathname); // one-shot
    const target = items.find((o) => o.id === applyId);
    if (target && !target.isMine && !target.applied) setApplying(target);
  }, [me, items]);

  if (items === null)
    return <div className="card animate-pulse p-5" aria-hidden><div className="h-3 w-1/2 rounded bg-card-raised" /><div className="mt-3 h-3 w-2/3 rounded bg-card-raised" /></div>;

  return (
    <div className="space-y-3">
      {items.map((o) => (
        <article
          key={o.id}
          className={`card-money p-4 sm:p-5 ${
            o.posterType === "verified_business" ? "border-l-2 border-l-sky-400/70" : ""
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {o.posterType && <PosterOverline type={o.posterType} />}
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-100">
                  <Link href={`/opportunities/${o.id}`} className="transition hover:text-amber-300">{o.title}</Link>
                </h3>
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
              {o.engagement && o.engagement.type !== "one_time" && (
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="rounded-full border border-sky-400/30 bg-sky-400/5 px-2 py-0.5 font-mono tracking-[0.05em] text-sky-300">
                    {engagementTypeLabel(o.engagement)}
                  </span>
                  {o.engagement.rate != null && (
                    <span className="rounded-full border border-line px-2 py-0.5 font-mono tracking-[0.05em] text-lime-300">{compLabel(o.engagement)}</span>
                  )}
                  {o.engagement.workload && <span className="rounded-full border border-line px-2 py-0.5 text-zinc-400">{o.engagement.workload}</span>}
                  {o.engagement.classification === "external_employment" && (
                    <span className="rounded-full border border-line px-2 py-0.5 text-zinc-500">pay handled by employer</span>
                  )}
                </p>
              )}
              {(o.roles?.length ?? 0) > 0 && (
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {o.roles!.map((r) => (
                    <span
                      key={r.id}
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.05em] ${
                        r.open < 1 ? "border-line-soft text-zinc-600 line-through" : "border-amber-400/30 bg-amber-400/5 text-amber-300"
                      }`}
                    >
                      {r.title} ×{r.count}{r.pay != null ? ` · $${r.pay}` : ""}
                    </span>
                  ))}
                </p>
              )}
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <Avatar src={o.poster.avatarUrl} initials={o.poster.displayName.charAt(0)} size="xs" />
                  <Link
                    href={`/creator/${o.poster.handle}`}
                    className={`font-medium hover:underline ${
                      o.posterType === "verified_business" ? "text-sky-300" : "text-zinc-300 hover:text-violet-300"
                    }`}
                  >
                    {o.poster.displayName}
                  </Link>
                  {o.posterType && o.posterType !== "verified_business" && o.posterType !== "business_pending" && (
                    <PosterBadge type={o.posterType} locationLabel={o.poster.locationLabel} />
                  )}
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
                <button
                  onClick={() => (me === null ? promptJoin("apply", `/opportunities?apply=${o.id}`) : setApplying(o))}
                  className="btn-lime px-4 py-1.5 text-xs"
                >
                  {o.budget == null ? "Express Interest" : "Apply Now"}
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
  /* Short by design: "I want to be considered for this." Profile, skills,
     and portfolio attach automatically — never re-typed. The poster's
     applyConfig decides what's required beyond that. */
  const [message, setMessage] = useState("");
  const roles = opp.roles ?? [];
  const [roleId, setRoleId] = useState<string | null>(roles.length === 1 ? roles[0].id : null);
  const [availability, setAvailability] = useState<"yes" | "no" | "need_check" | null>(
    opp.eventDate ? null : "yes"
  );
  const [questionAnswer, setQuestionAnswer] = useState("");
  const [extra, setExtra] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const [profileMeta, setProfileMeta] = useState<{ skills: number; portfolio: number; rating: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requireMessage = opp.applyConfig?.requireMessage !== false;
  const question = opp.applyConfig?.question;

  useEffect(() => {
    // what's auto-attached — shown, not re-asked
    // the SHARED session store — same source of truth as the navbar; and
    // every parse is failure-safe: a bad response degrades to "no meta",
    // never a page crash
    Promise.all([
      fetchSession().catch(() => null),
      fetch("/api/me/portfolio", { cache: "no-store" })
        .then((r) => (r.ok ? r.json().catch(() => ({ items: [] })) : { items: [] }))
        .catch(() => ({ items: [] })),
    ]).then(([sessionUser, pf]) => {
      if (!sessionUser) return;
      fetch(`/api/users/${sessionUser.handle}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json().catch(() => ({})) : {}) as Promise<{ stats?: { rating?: number | null } }>)
        .then((d) =>
          setProfileMeta({
            skills: sessionUser.profile.skills.length,
            portfolio: (pf.items ?? []).length,
            rating: d?.stats?.rating ?? null,
          })
        )
        .catch(() => {});
    });
  }, []);

  const submit = async () => {
    if (roles.length > 0 && !roleId) {
      setError("Pick the role you're applying for");
      return;
    }
    if (requireMessage && !message.trim()) {
      setError("Tell them why you're a good fit");
      return;
    }
    if (opp.eventDate && !availability) {
      setError("Confirm your availability for the date");
      return;
    }
    if (question && !questionAnswer.trim()) {
      setError("Answer the poster's question");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/opportunities/${opp.id}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, availability, questionAnswer, extra, roleId }),
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
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            {opp.posterType && <PosterOverline type={opp.posterType} />}
            <h3 className="text-sm font-bold text-zinc-100">Apply — {opp.title}</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              {opp.posterType === "verified_business" ? `${opp.poster.displayName} · ` : ""}
              {opp.budget != null
                ? `Applying accepts the listed budget of $${opp.budget}.`
                : "This is a collaboration — no payment attached."}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 0 · which role — the applicant chooses; capacity shown live */}
        {roles.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Which role are you applying for?</p>
            <div className="mt-1.5 space-y-1.5">
              {roles.map((r) => {
                const full = r.open < 1;
                return (
                  <button
                    key={r.id}
                    disabled={full}
                    onClick={() => setRoleId(r.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                      full
                        ? "cursor-not-allowed border-line-soft opacity-50"
                        : roleId === r.id
                          ? "border-lime-400/50 bg-lime-400/5"
                          : "border-line hover:border-zinc-600"
                    }`}
                  >
                    <span>
                      <span className={`block text-sm font-semibold ${roleId === r.id ? "text-lime-300" : "text-zinc-200"}`}>
                        {r.title}
                      </span>
                      <span className="block text-[11px] text-zinc-500">
                        {full ? "Filled" : `${r.open} of ${r.count} opening${r.count > 1 ? "s" : ""} left`}
                        {r.description ? ` · ${r.description}` : ""}
                      </span>
                    </span>
                    {r.pay != null && (
                      <span className="shrink-0 font-mono text-sm font-medium tracking-[0.08em] text-lime-300">${r.pay}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 1 · why you */}
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
            Why are you a good fit?{!requireMessage && <span className="ml-1 font-normal normal-case text-zinc-600">(optional)</span>}
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Keep it short — your profile does the heavy lifting."
            className="mt-1.5 w-full resize-none rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50"
          />
        </div>

        {/* 2 · availability, only when the gig has a date */}
        {opp.eventDate && (
          <div className="mt-3">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
              Are you available on {fmtDate(opp.eventDate)}?
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(
                [
                  { v: "yes", l: "Yes", cls: "border-lime-400/50 bg-lime-400/10 text-lime-300" },
                  { v: "no", l: "No", cls: "border-rose-400/50 bg-rose-400/10 text-rose-300" },
                  { v: "need_check", l: "Need to confirm", cls: "border-amber-400/50 bg-amber-400/10 text-amber-300" },
                ] as const
              ).map((o) => (
                <button
                  key={o.v}
                  onClick={() => setAvailability(o.v)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                    availability === o.v ? o.cls : "border-line text-zinc-400"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3 · the poster's one question, if they set one */}
        {question && (
          <div className="mt-3">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">{question}</p>
            <input
              value={questionAnswer}
              onChange={(e) => setQuestionAnswer(e.target.value)}
              placeholder="Short answer"
              className="mt-1.5 w-full rounded-xl border border-line bg-card-raised px-3.5 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50"
            />
          </div>
        )}

        {/* 4 · portfolio & profile — attached, never re-typed */}
        <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-violet-400/25 bg-violet-400/5 px-3.5 py-2.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
          <p className="text-xs text-zinc-400">
            <span className="font-semibold text-violet-300">Attached automatically:</span> your profile
            {profileMeta && (
              <>
                {" "}· {profileMeta.skills} skills · {profileMeta.portfolio} portfolio piece
                {profileMeta.portfolio === 1 ? "" : "s"}
                {profileMeta.rating != null && ` · ${profileMeta.rating.toFixed(1)}★`}
              </>
            )}
          </p>
        </div>

        {/* anything else — hidden until wanted */}
        {!showExtra ? (
          <button onClick={() => setShowExtra(true)} className="mt-2 text-xs font-medium text-zinc-500 hover:text-zinc-300">
            + Anything else? (optional)
          </button>
        ) : (
          <textarea
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            rows={2}
            autoFocus
            placeholder="Anything else they should know…"
            className="mt-2 w-full resize-none rounded-xl border border-line bg-card-raised px-3.5 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50"
          />
        )}

        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-rose-300">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost px-4 py-1.5 text-xs">Cancel</button>
          <button onClick={submit} disabled={busy} className="btn-lime px-4 py-1.5 text-xs disabled:opacity-40">
            Submit Application
          </button>
        </div>
      </div>
    </div>
  );
}
