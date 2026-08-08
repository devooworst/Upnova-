"use client";

/* ------------------------------------------------------------------ */
/*  Project page — the complete record of one engagement.              */
/*  Client, provider, brief, price, deadline, live status, payments,   */
/*  extension history, reviews, and an activity timeline. Everything   */
/*  references the same project ID used in Messages and Bookings.      */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MessageSquare, Star, Check } from "lucide-react";
import Avatar from "@/components/Avatar";

interface Detail {
  id: string;
  title: string;
  brief: string;
  amount: number;
  state: string;
  aiRequirement: string;
  deadline: string | null;
  conversationId: string | null;
  myRole: "client" | "creator";
  with: { id: string; handle: string; displayName: string; avatarUrl: string | null; roleLine: string };
  extensions: { id: string; days: number; reason: string; status: string; mine: boolean; createdAt: string }[];
  payments: { id: string; amountCents: number; feeCents: number; status: string }[];
  reviews: { rating: number; body: string; mine: boolean }[];
}

const STATE_LABEL: Record<string, string> = {
  draft: "Draft",
  offer_sent: "Awaiting acceptance",
  accepted: "Payment required",
  in_progress: "In progress",
  extension_requested: "Extension requested",
  submitted: "Delivered — awaiting review",
  approved: "Approved — release pending",
  completed: "Completed",
  reviewed: "Completed · Reviewed",
  cancelled: "Cancelled",
};

const STATE_TONE: Record<string, string> = {
  draft: "border-line text-zinc-400",
  offer_sent: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  accepted: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  in_progress: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  extension_requested: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  submitted: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  approved: "border-lime-400/40 bg-lime-400/10 text-lime-300",
  completed: "border-lime-400/40 bg-lime-400/10 text-lime-300",
  reviewed: "border-lime-400/40 bg-lime-400/10 text-lime-300",
  cancelled: "border-line text-zinc-500",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`, { cache: "no-store" });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Project not available");
      return;
    }
    setProject(d.project);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm font-semibold text-zinc-200">{error}</p>
        <p className="mt-1 text-xs text-zinc-500">Only the client and the creator can see a project.</p>
        <Link href="/calendar" className="btn-ghost mt-4 inline-flex px-4 py-1.5 text-xs">Back to Bookings</Link>
      </div>
    );

  if (!project) return <div className="card mx-auto h-64 max-w-2xl animate-pulse" aria-hidden />;

  const fee = Math.round(project.amount * 5) / 100;
  const payment = project.payments[0];

  /* activity timeline — derived from the real records */
  const activity: { label: string; detail?: string; at?: string; tone?: string }[] = [
    { label: "Project created", tone: "zinc" },
    ...project.extensions.map((e) => ({
      label:
        e.status === "pending"
          ? `Extension requested (+${e.days} days) — pending`
          : `Extension requested (+${e.days} days) → ${e.status}`,
      detail: e.reason,
      at: e.createdAt,
      tone: e.status === "approved" ? "lime" : e.status === "pending" ? "amber" : "zinc",
    })),
    ...(payment
      ? [
          {
            label:
              payment.status === "released"
                ? `Payment released — $${(payment.amountCents / 100).toFixed(2)}`
                : `Payment secured — $${(payment.amountCents / 100).toFixed(2)}, releases on approval`,
            tone: "lime",
          },
        ]
      : []),
    ...project.reviews.map((r) => ({
      label: `${r.mine ? "You" : project.with.displayName} left a ${r.rating.toFixed(1)}-star review`,
      detail: r.body,
      tone: "violet",
    })),
    { label: `Current status: ${STATE_LABEL[project.state]}`, tone: "zinc" },
  ];

  const dot: Record<string, string> = {
    zinc: "bg-zinc-500",
    lime: "bg-lime-400",
    amber: "bg-amber-400",
    violet: "bg-violet-400",
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/calendar" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Bookings
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">{project.title}</h1>
          <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${STATE_TONE[project.state]}`}>
            {STATE_LABEL[project.state]}
          </span>
        </div>
      </div>

      {/* parties + terms — a receipt, money-card DNA */}
      <div className="card-money p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {project.myRole === "client" ? "Provider" : "Client"}
            </p>
            <Link href={`/creator/${project.with.handle}`} className="mt-2 flex items-center gap-2.5">
              <Avatar src={project.with.avatarUrl} initials={project.with.displayName.charAt(0)} size="md" />
              <span>
                <span className="block text-sm font-semibold text-zinc-100">{project.with.displayName}</span>
                <span className="block text-xs text-zinc-500">{project.with.roleLine}</span>
              </span>
            </Link>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Creator payout</span>
              <span className="font-mono font-medium tracking-[0.08em] text-lime-300">${project.amount}</span>
            </div>
            {project.myRole === "client" && (
              <div className="flex justify-between text-xs text-zinc-500">
                <span>You pay (incl. 5% fee)</span>
                <span className="font-mono tracking-[0.08em]">${(project.amount + fee).toFixed(2)}</span>
              </div>
            )}
            {project.deadline && (
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Deadline</span>
                <span className="font-mono tracking-[0.08em]">{fmt(project.deadline)}</span>
              </div>
            )}
            {payment && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Payment</span>
                <span className={`inline-flex items-center gap-1.5 font-semibold ${payment.status === "released" ? "text-lime-300" : "text-amber-300"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${payment.status === "released" ? "bg-lime-400" : "bg-amber-400"}`} />
                  {payment.status === "held" ? "Secured" : payment.status === "released" ? "Released" : payment.status}
                </span>
              </div>
            )}
          </div>
        </div>

        {project.brief && (
          <div className="mt-4 border-t border-dashed border-line pt-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Brief</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{project.brief}</p>
          </div>
        )}

        <div className="mt-4 flex gap-2 border-t border-dashed border-line pt-4">
          {project.conversationId && (
            <Link href={`/messages?c=${project.conversationId}`} className="btn-lime px-4 py-1.5 text-xs">
              <MessageSquare className="h-3.5 w-3.5" /> Open conversation
            </Link>
          )}
          <Link href={`/creator/${project.with.handle}`} className="btn-ghost px-4 py-1.5 text-xs">
            View profile
          </Link>
        </div>
      </div>

      {/* transaction safety banner — every project carries it */}
      <div className="rounded-xl border border-line-soft bg-card px-4 py-2.5">
        <p className="text-[11px] leading-relaxed text-zinc-500">
          <span className="font-bold uppercase tracking-wide text-zinc-400">UpNova transaction</span> ·
          Keep communication, agreements, and payments on UpNova to maintain your transaction
          protections. Transactions completed outside UpNova may not be protected by UpNova&apos;s
          dispute or payment systems.
        </p>
      </div>

      {/* reviews */}
      {project.reviews.length > 0 && (
        <section className="card p-5">
          <h2 className="text-sm font-bold text-zinc-100">Reviews</h2>
          <div className="mt-3 space-y-2.5">
            {project.reviews.map((r, i) => (
              <div key={i} className="rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                  {r.mine ? "Your review" : `${project.with.displayName}'s review`}
                  <span className="flex items-center gap-0.5 text-amber-300">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {r.rating.toFixed(1)}
                  </span>
                </p>
                {r.body && <p className="mt-1 text-xs leading-relaxed text-zinc-400">{r.body}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* activity history */}
      <section className="card p-5">
        <h2 className="text-sm font-bold text-zinc-100">Activity</h2>
        <ol className="mt-4 space-y-3 border-l border-line pl-4">
          {activity.map((a, i) => (
            <li key={i} className="relative">
              <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card ${dot[a.tone ?? "zinc"]}`} />
              <p className="text-sm text-zinc-200">{a.label}</p>
              {a.detail && <p className="mt-0.5 text-xs text-zinc-500">{a.detail}</p>}
              {a.at && <p className="mt-0.5 font-mono text-[10px] tracking-[0.08em] text-zinc-600">{fmt(a.at)}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
