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
import { ArrowLeft, Check, Star, Users, MessageSquare, Lock } from "lucide-react";
import Avatar from "@/components/Avatar";

interface Applicant {
  id: string;
  message: string;
  availability: "yes" | "no" | "need_check";
  answers?: { question?: string; answer?: string; extra?: string };
  status: "submitted" | "shortlisted" | "selected" | "confirmed" | "declined" | "offer_declined";
  roleId: string | null;
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
  };
  applications: Applicant[];
}

const STATUS_CHIP: Record<string, string> = {
  shortlisted: "border-violet-400/40 text-violet-300",
  selected: "border-amber-400/40 text-amber-300",
  confirmed: "border-lime-400/40 text-lime-300",
  declined: "border-line text-zinc-500",
  offer_declined: "border-line text-zinc-500",
};
const STATUS_LABEL: Record<string, string> = {
  shortlisted: "Shortlisted",
  selected: "Awaiting acceptance",
  confirmed: "Confirmed",
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

  const act = async (appId: string, action: "shortlist" | "select" | "decline") => {
    const res = await fetch(`/api/applications/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const d = await res.json();
    if (!res.ok) setNotice(d.error || "Could not update");
    else if (action === "select" && d.conversationId) setSelectedConv(d.conversationId);
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
  const team = applications.filter((a) => ["selected", "confirmed"].includes(a.status));
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

      {!["declined", "selected", "confirmed"].includes(a.status) && opportunity.status === "open" && (
        <div className="mt-3 flex items-center gap-2 border-t border-line-soft pt-3">
          {a.status === "submitted" && (
            <button
              onClick={() => act(a.id, "shortlist")}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 px-3.5 py-1.5 text-xs font-semibold text-violet-300 transition hover:bg-violet-400/10"
            >
              <Star className="h-3.5 w-3.5" /> Shortlist
            </button>
          )}
          <button onClick={() => act(a.id, "select")} className="btn-lime inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs">
            <Check className="h-3.5 w-3.5" /> {hasRoles ? "Select — send offer" : "Select — create project"}
          </button>
          <button onClick={() => message(a.applicant.handle)} className="btn-ghost px-3 py-1.5 text-xs">
            <MessageSquare className="h-3.5 w-3.5" /> Message
          </button>
          <button
            onClick={() => act(a.id, "decline")}
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
