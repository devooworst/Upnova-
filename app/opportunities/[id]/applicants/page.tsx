"use client";

/* ------------------------------------------------------------------ */
/*  Applicant review + TEAM view — the poster side of Opportunities.   */
/*                                                                     */
/*  Role opportunities: applicants arrive grouped by role, capacity    */
/*  is live ("2 of 3 openings left"), Select sends an OFFER the        */
/*  applicant accepts — acceptance creates the scheduled booking and   */
/*  fills the Team board (Awaiting response → Confirmed → Paid).       */
/*  Simple opportunities keep the classic select → project flow.       */
/*  Declines always send the professional update, never a harsh one.   */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Star, Users, MessageSquare, Lock, CalendarClock, FileText, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import { ENGAGEMENT_TYPES, COMP_MODELS, cycleLabel, type EngagementConfig, type EngagementOffer, type InterviewInfo } from "@/lib/engagement";

interface Applicant {
  id: string;
  message: string;
  availability: "yes" | "no" | "need_check";
  answers?: { question?: string; answer?: string; extra?: string };
  status: "submitted" | "shortlisted" | "interview" | "selected" | "confirmed" | "active" | "completed" | "declined" | "offer_declined";
  roleId: string | null;
  interview: InterviewInfo | null;
  offer: (EngagementOffer & { cycles?: number }) | null;
  createdAt: string;
  applicant: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    roleLine: string;
    locationLabel?: string | null;
    trustLevel: string;
  };
}

interface Role {
  id: string;
  title: string;
  count: number;
  pay: number | null;
  description?: string;
  open: number;
}

interface Payload {
  opportunity: {
    id: string;
    title: string;
    budget: number | null;
    status: string;
    eventDate: string | null;
    location: string;
    roles: Role[];
    engagement: EngagementConfig | null;
  };
  applications: Applicant[];
}

const STATUS_CHIP: Record<string, string> = {
  shortlisted: "border-violet-400/40 text-violet-300",
  interview: "border-sky-400/40 text-sky-300",
  selected: "border-amber-400/40 text-amber-300",
  confirmed: "border-lime-400/40 text-lime-300",
  active: "border-lime-400/40 text-lime-300",
  completed: "border-line text-zinc-400",
  declined: "border-line text-zinc-500",
  offer_declined: "border-line text-zinc-500",
};
const STATUS_LABEL: Record<string, string> = {
  shortlisted: "Shortlisted",
  interview: "Interview",
  selected: "Offer out",
  confirmed: "Confirmed",
  active: "Active",
  completed: "Completed",
  declined: "Not selected",
  offer_declined: "Offer declined",
};

export default function ApplicantsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [interviewFor, setInterviewFor] = useState<string | null>(null);
  const [interviewAt, setInterviewAt] = useState("");
  const [offerFor, setOfferFor] = useState<Applicant | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/opportunities/${id}/applications`, { cache: "no-store" });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Not available");
      return;
    }
    setData(d);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (appId: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/applications/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok) setNotice(d.error || "Could not update");
    else if (body.action === "select" && d.conversationId) setSelectedConv(d.conversationId);
    setInterviewFor(null);
    setOfferFor(null);
    load();
  };

  const message = async (handle: string) => {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toHandle: handle }),
    });
    const d = await res.json();
    if (res.ok) router.push(`/messages?c=${d.conversationId}`);
  };

  const closeApplications = async () => {
    const res = await fetch(`/api/opportunities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    const d = await res.json();
    if (res.ok)
      setNotice(
        d.notified > 0
          ? `Applications closed — ${d.notified} applicant${d.notified === 1 ? "" : "s"} received the professional update.`
          : "Applications closed."
      );
    load();
  };

  if (error)
    return (
      <div className="mx-auto max-w-2xl py-10 text-center">
        <p className="text-sm font-semibold text-zinc-200">{error}</p>
        <p className="mt-1 text-xs text-zinc-500">Only the poster of an opportunity can review its applicants.</p>
        <button onClick={() => router.push("/opportunities")} className="btn-ghost mt-4 px-4 py-1.5 text-xs">
          Back to Opportunities
        </button>
      </div>
    );

  if (!data)
    return <div className="mx-auto max-w-2xl animate-pulse py-10"><div className="card h-32" /></div>;

  const { opportunity, applications } = data;
  const roles = opportunity.roles;
  const hasRoles = roles.length > 0;
  const team = applications.filter((a) => ["selected", "confirmed", "active"].includes(a.status));
  const order: Record<string, number> = { shortlisted: 0, submitted: 1, selected: -1, confirmed: -2, offer_declined: 2, declined: 3 };
  const sorted = [...applications].sort((a, b) => (order[a.status] ?? 1) - (order[b.status] ?? 1));

  const when = opportunity.eventDate
    ? new Date(opportunity.eventDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : null;

  const renderCard = (a: Applicant) => (
    <article
      key={a.id}
      className={`card p-4 ${["declined", "offer_declined"].includes(a.status) ? "opacity-50" : ""} ${
        a.status === "confirmed" ? "border-lime-400/40" : a.status === "selected" ? "border-amber-400/40" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <Link href={`/creator/${a.applicant.handle}`}>
          <Avatar src={a.applicant.avatarUrl} initials={a.applicant.displayName.charAt(0)} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-100">
            <Link href={`/creator/${a.applicant.handle}`} className="hover:text-violet-300">
              {a.applicant.displayName}
            </Link>
            {a.availability === "yes" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-lime-400/40 bg-lime-400/10 px-2 py-0.5 text-[10px] font-bold text-lime-300">
                <span className="h-1.5 w-1.5 rounded-full bg-lime-400" /> Available on date
              </span>
            ) : a.availability === "no" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-400/10 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> Not available on date
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Needs to check schedule
              </span>
            )}
            {a.status !== "submitted" && (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_CHIP[a.status] ?? "border-line text-zinc-500"}`}>
                {STATUS_LABEL[a.status] ?? a.status}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {a.applicant.roleLine}
            {a.applicant.locationLabel ? ` · ${a.applicant.locationLabel}` : ""}
          </p>
          {a.message && <p className="mt-2 text-xs leading-relaxed text-zinc-300">{a.message}</p>}
          {a.answers?.question && (
            <p className="mt-1.5 text-xs leading-relaxed">
              <span className="text-zinc-500">{a.answers.question}</span>{" "}
              <span className="text-zinc-300">— {a.answers.answer}</span>
            </p>
          )}
          {a.answers?.extra && (
            <p className="mt-1.5 text-xs italic leading-relaxed text-zinc-400">&ldquo;{a.answers.extra}&rdquo;</p>
          )}
        </div>
      </div>

      {a.status === "interview" && a.interview && (
        <p className="mt-2 rounded-lg border border-sky-400/25 bg-sky-400/5 px-3 py-2 text-[11px] text-zinc-300">
          {a.interview.mode === "external"
            ? "Interview happens OUTSIDE Mavyn — external process, coordinate in Messages."
            : `Interview scheduled ${a.interview.at ? new Date(a.interview.at).toLocaleDateString("en-US", { month: "long", day: "numeric" }) + " · " + new Date(a.interview.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""} — on both calendars.`}
        </p>
      )}
      {a.status === "active" && a.offer && (
        <div className="mt-2 rounded-lg border border-lime-400/25 bg-lime-400/5 px-3 py-2">
          <p className="text-[11px] text-zinc-300">
            <span className="font-semibold text-lime-300">Active</span> — {a.offer.title} ·{" "}
            {ENGAGEMENT_TYPES.find((t) => t.id === a.offer!.engagementType)?.label}
            {a.offer.classification === "external_employment"
              ? " · compensation handled OUTSIDE Mavyn"
              : ` · $${a.offer.amount} per ${cycleLabel(a.offer.compModel)} · ${a.offer.cycles ?? 0} cycle${(a.offer.cycles ?? 0) === 1 ? "" : "s"} started`}
          </p>
          {a.offer.classification !== "external_employment" && (
            <div className="mt-1.5 flex gap-2">
              <button onClick={() => act(a.id, { action: "next_cycle" })} className="btn-lime px-2.5 py-1 text-[11px]">
                Start cycle {(a.offer.cycles ?? 0) + 1} — ${a.offer.amount}
              </button>
              <Link href="/calendar" className="btn-ghost px-2.5 py-1 text-[11px]">Pay cycles in Bookings</Link>
              <button onClick={() => act(a.id, { action: "complete_engagement" })} className="rounded-full px-2.5 py-1 text-[11px] text-zinc-500 hover:text-zinc-300">
                Mark completed
              </button>
            </div>
          )}
          {a.offer.classification === "external_employment" && (
            <button onClick={() => act(a.id, { action: "complete_engagement" })} className="mt-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-zinc-400 hover:text-zinc-200">
              Mark completed
            </button>
          )}
        </div>
      )}

      {!["declined", "selected", "confirmed", "active", "completed"].includes(a.status) && opportunity.status === "open" && (
        <div className="mt-3 flex items-center gap-2 border-t border-line-soft pt-3">
          {a.status === "submitted" && (
            <button
              onClick={() => act(a.id, { action: "shortlist" })}
              data-guide="applicant-shortlist"
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 px-3.5 py-1.5 text-xs font-semibold text-violet-300 transition hover:bg-violet-400/10"
            >
              <Star className="h-3.5 w-3.5" /> Shortlist
            </button>
          )}
          {opportunity.engagement ? (
            <button onClick={() => setOfferFor(a)} data-guide="applicant-select" className="btn-lime inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" /> Send offer
            </button>
          ) : (
            <button onClick={() => act(a.id, { action: "select" })} data-guide="applicant-select" className="btn-lime inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs">
              <Check className="h-3.5 w-3.5" /> {hasRoles ? "Select — send offer" : "Select — create project"}
            </button>
          )}
          {opportunity.engagement && opportunity.engagement.interviewMode !== "none" && a.status !== "interview" && (
            interviewFor === a.id ? (
              opportunity.engagement.interviewMode === "mavyn" ? (
                <span className="flex items-center gap-1.5">
                  <input type="datetime-local" value={interviewAt} onChange={(e) => setInterviewAt(e.target.value)} className="rounded-lg border border-line bg-card-raised px-2 py-1.5 text-xs text-zinc-100 outline-none" />
                  <button onClick={() => interviewAt && act(a.id, { action: "interview", at: new Date(interviewAt).toISOString() })} className="btn-ghost px-2.5 py-1.5 text-xs">Book</button>
                  <button onClick={() => setInterviewFor(null)} className="rounded-md p-1 text-zinc-500"><X className="h-3.5 w-3.5" /></button>
                </span>
              ) : (
                <button onClick={() => act(a.id, { action: "interview", external: true })} className="btn-ghost px-3 py-1.5 text-xs">
                  Confirm external interview
                </button>
              )
            ) : (
              <button onClick={() => setInterviewFor(a.id)} className="btn-ghost px-3 py-1.5 text-xs">
                <CalendarClock className="h-3.5 w-3.5" /> Interview{opportunity.engagement.interviewMode === "external" ? " (external)" : ""}
              </button>
            )
          )}
          <button onClick={() => message(a.applicant.handle)} className="btn-ghost px-3 py-1.5 text-xs">
            <MessageSquare className="h-3.5 w-3.5" /> Message
          </button>
          <button
            onClick={() => act(a.id, { action: "decline" })}
            className="ml-auto rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition hover:text-rose-300"
          >
            Decline
          </button>
        </div>
      )}
    </article>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/opportunities" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Opportunities
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50">{hasRoles ? "Applicants & Team" : "Applicants"}</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {opportunity.title}
              {when && <span className="ml-2 text-zinc-500">· {when}</span>}
              {opportunity.location && <span className="ml-1 text-zinc-500">· {opportunity.location}</span>}
              {opportunity.budget != null && (
                <span className="ml-2 font-mono text-sm font-medium tracking-[0.08em] text-lime-300">${opportunity.budget}</span>
              )}
            </p>
          </div>
          {opportunity.status === "open" ? (
            <button onClick={closeApplications} className="btn-ghost shrink-0 px-3.5 py-1.5 text-xs" title="Un-selected applicants get the professional update, per your setting">
              <Lock className="h-3.5 w-3.5" /> Close applications
            </button>
          ) : (
            <span className="rounded-full border border-line px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              {opportunity.status}
            </span>
          )}
        </div>
      </div>

      {notice && (
        <p className="rounded-xl border border-violet-400/30 bg-violet-400/5 px-4 py-2.5 text-xs text-zinc-300">{notice}</p>
      )}
      {selectedConv && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-lime-400/40 bg-lime-400/5 px-4 py-3">
          <p className="text-sm text-zinc-200">
            <span className="font-semibold text-lime-300">Project created.</span> A conversation with your
            selected creator is ready.
          </p>
          <Link href={`/messages?c=${selectedConv}`} className="btn-lime shrink-0 px-4 py-1.5 text-xs">
            Open conversation
          </Link>
        </div>
      )}

      {/* ------------------------------ TEAM ------------------------------ */}
      {hasRoles && team.length > 0 && (
        <section className="card-event p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-zinc-100">
            <Users className="h-4 w-4 text-amber-300" /> Team
            <span className="font-normal text-zinc-500">
              {team.filter((t) => t.status === "confirmed").length} confirmed · {team.filter((t) => t.status === "selected").length} awaiting response
            </span>
          </h2>
          <ul className="mt-3 space-y-1.5">
            {roles.map((role) => {
              const members = team.filter((t) => t.roleId === role.id);
              if (!members.length) return null;
              return members.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 rounded-lg border border-line bg-card-raised/50 px-3 py-2">
                  <Avatar src={m.applicant.avatarUrl} initials={m.applicant.displayName.charAt(0)} size="xs" />
                  <span className="min-w-0 flex-1 text-xs">
                    <span className="font-semibold text-zinc-100">{m.applicant.displayName}</span>
                    <span className="text-zinc-500"> — {role.title}</span>
                    {role.pay != null && <span className="ml-1 font-mono tracking-[0.05em] text-lime-300">${role.pay}</span>}
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      m.status === "confirmed" ? "border-lime-400/40 text-lime-300" : "border-amber-400/40 text-amber-300"
                    }`}
                  >
                    {m.status === "confirmed" ? "Confirmed" : "Awaiting response"}
                  </span>
                </li>
              ));
            })}
          </ul>
          <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-600">
            Confirmed members have the booking on their calendar — secure each one with payment from{" "}
            <Link href="/calendar" className="text-lime-300 underline-offset-2 hover:underline">Bookings</Link>.
          </p>
        </section>
      )}

      {sorted.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm font-semibold text-zinc-200">No applications yet</p>
          <p className="mt-1 text-xs text-zinc-500">Applicants will appear here the moment they apply.</p>
        </div>
      )}

      {/* ---------------- applicants, grouped by role ---------------- */}
      {hasRoles ? (
        roles.map((role) => {
          const group = sorted.filter((a) => a.roleId === role.id);
          if (!group.length) return null;
          return (
            <section key={role.id} className="space-y-2.5">
              <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-zinc-100">
                {role.title}
                <span className="font-normal text-zinc-500">
                  — {group.length} applicant{group.length === 1 ? "" : "s"} ·{" "}
                  {role.open > 0 ? `${role.open} of ${role.count} opening${role.count > 1 ? "s" : ""} left` : "filled"}
                </span>
                {role.pay != null && (
                  <span className="font-mono text-xs font-medium tracking-[0.08em] text-lime-300">${role.pay} each</span>
                )}
              </h3>
              {group.map(renderCard)}
            </section>
          );
        })
      ) : (
        <div className="space-y-3">{sorted.map(renderCard)}</div>
      )}

      {offerFor && (
        <OfferModal
          applicant={offerFor}
          engagement={opportunity.engagement}
          defaultTitle={roles.find((r) => r.id === offerFor.roleId)?.title ?? opportunity.title}
          defaultAmount={roles.find((r) => r.id === offerFor.roleId)?.pay ?? opportunity.engagement?.rate ?? opportunity.budget ?? 0}
          onSend={(terms) => act(offerFor.id, { action: "offer", ...terms })}
          onClose={() => setOfferFor(null)}
        />
      )}

      <p className="text-[11px] leading-relaxed text-zinc-600">
        {hasRoles ? (
          <>
            Selecting sends an <span className="text-zinc-400">offer</span> — the applicant accepts and the
            engagement lands on both calendars as a booking. Payment secures each confirmed member; declines
            always send the professional update.
          </>
        ) : (
          <>
            Selecting an applicant closes the opportunity, notifies everyone, and creates a project in{" "}
            <span className="text-zinc-400">draft</span> — the full lifecycle continues in Messages.
          </>
        )}
      </p>
    </div>
  );
}

/* ------------------------- configurable offer ------------------------- */

function OfferModal({
  applicant,
  engagement,
  defaultTitle,
  defaultAmount,
  onSend,
  onClose,
}: {
  applicant: Applicant;
  engagement: EngagementConfig | null;
  defaultTitle: string;
  defaultAmount: number;
  onSend: (terms: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [engagementType, setEngagementType] = useState(engagement?.type ?? "one_time");
  const [compModel, setCompModel] = useState(engagement?.compModel ?? "per_project");
  const [amount, setAmount] = useState(String(defaultAmount || ""));
  const [schedule, setSchedule] = useState(engagement?.schedule ?? "");
  const [startDate, setStartDate] = useState(engagement?.startDate?.slice(0, 10) ?? "");
  const [duration, setDuration] = useState(engagement?.duration ?? "");
  const [note, setNote] = useState("");
  const classification = engagement?.classification ?? "mavyn_freelance";
  const inputCls =
    "w-full rounded-xl border border-line bg-card-raised px-3.5 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Send offer</p>
            <h3 className="mt-1 text-sm font-bold text-zinc-100">{applicant.applicant.displayName}</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:text-zinc-200"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Role / position" className={inputCls} maxLength={80} />
          <div className="grid grid-cols-2 gap-2">
            <select value={engagementType} onChange={(e) => setEngagementType(e.target.value as typeof engagementType)} className={inputCls}>
              {ENGAGEMENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <select value={compModel} onChange={(e) => setCompModel(e.target.value as typeof compModel)} className={inputCls}>
              {COMP_MODELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            $<input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Amount" className={inputCls} />
            <span className="shrink-0 text-xs text-zinc-500">per {cycleLabel(compModel)}</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Duration — e.g. 3 months" className={inputCls} maxLength={60} />
          </div>
          <input value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="Schedule — e.g. 2 videos/week" className={inputCls} maxLength={120} />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Other agreed terms (optional)" className={`${inputCls} resize-none`} />
          <p className={`rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${classification === "external_employment" ? "border-sky-400/25 bg-sky-400/5 text-sky-200" : "border-lime-400/25 bg-lime-400/5 text-zinc-300"}`}>
            {classification === "external_employment"
              ? "External employment — payroll and classification are handled by the employer OUTSIDE Mavyn. No Mavyn payment workflow."
              : "Freelance / contract through Mavyn — each cycle is secured up front and released on completion. Buyer pays the 5% fee on top."}
          </p>
          <button
            onClick={() => onSend({ title, engagementType, compModel, amount: Number(amount) || 0, schedule, startDate: startDate || undefined, duration, note, classification })}
            disabled={!title.trim() || !amount}
            className="btn-lime w-full justify-center py-2.5 text-sm disabled:opacity-40"
          >
            Send offer{amount ? ` — $${amount} per ${cycleLabel(compModel)}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
