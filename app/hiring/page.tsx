"use client";

/* ------------------------------------------------------------------ */
/*  Hiring — the business hiring dashboard. Every number is computed   */
/*  server-side from the same records the product writes: open         */
/*  opportunities, applications, shortlists, active + completed hires, */
/*  distinct people hired, and the real application activity trail.    */
/*  "Find talent" leads into the real discovery surface; every name    */
/*  links to the correct person and record by id.                      */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  UserPlus,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import { useSession } from "@/lib/session";

interface Hiring {
  counts: { openOpportunities: number; applications: number; shortlisted: number; activeHires: number; completedHires: number; peopleHired: number };
  opportunities: { id: string; title: string; status: string; budget: number | null; applications: number; createdAt: string }[];
  activeEngagements: { kind: string; id: string; title: string; state: string; with: { id: string; handle: string; displayName: string; avatarUrl: string | null }; href: string }[];
  activity: { id: string; applicant: { handle: string; displayName: string; avatarUrl: string | null }; opportunityId: string; opportunityTitle: string; status: string; at: string }[];
}

const timeAgo = (iso: string) => {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const APP_TONE: Record<string, string> = {
  submitted: "text-zinc-400",
  shortlisted: "text-amber-300",
  interview: "text-amber-300",
  selected: "text-lime-300",
  confirmed: "text-lime-300",
  active: "text-lime-300",
  completed: "text-zinc-300",
  declined: "text-zinc-500",
  offer_declined: "text-zinc-500",
};

export default function HiringPage() {
  const { user } = useSession();
  const [data, setData] = useState<Hiring | null>(null);

  const load = () =>
    fetch("/api/business/hiring", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.counts && setData(d))
      .catch(() => {});
  useEffect(() => {
    if (user) load();
  }, [!!user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm font-semibold text-zinc-200">Sign in to manage hiring.</p>
        <Link href="/login" className="btn-lime mt-4 inline-flex px-5 py-2 text-xs">Sign in</Link>
      </div>
    );

  const c = data?.counts;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-300">business</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">Hiring</h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Find talent, post opportunities, review applicants, and manage every hire — all in one place,
            computed live from your real records.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/discover" className="btn-lime px-4 py-2 text-xs">
            <Search className="h-3.5 w-3.5" /> Find talent
          </Link>
          <Link href="/opportunities/new" className="btn-ghost px-4 py-2 text-xs">
            <Plus className="h-3.5 w-3.5" /> Post opportunity
          </Link>
          <button onClick={load} className="btn-ghost px-3 py-2 text-xs" aria-label="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* the strip — every number reads from real rows */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ["Open opportunities", c?.openOpportunities],
            ["Applications", c?.applications],
            ["Shortlisted", c?.shortlisted],
            ["Active hires", c?.activeHires],
            ["Completed hires", c?.completedHires],
            ["People hired", c?.peopleHired],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="card p-3 text-center">
            <p className="font-mono text-xl font-bold tracking-tight text-zinc-50">{n ?? "—"}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
          </div>
        ))}
      </div>

      {/* opportunities */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-100">
          <Briefcase className="h-4 w-4 text-amber-400" /> Your opportunities
        </h2>
        {data === null ? (
          <div className="mt-3 h-16 animate-pulse rounded-xl bg-card-raised" />
        ) : data.opportunities.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">
            No opportunities yet — post one and applicants land here with real profiles and work history.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.opportunities.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link href={`/opportunities/${o.id}`} className="text-sm font-semibold text-zinc-100 hover:underline">{o.title}</Link>
                  <p className="font-mono text-[10px] tracking-[0.06em] text-zinc-500">
                    {o.status.toUpperCase()} {o.budget != null ? `· $${o.budget}` : ""} · {timeAgo(o.createdAt)}
                  </p>
                </div>
                <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[10px] font-bold text-zinc-300">
                  {o.applications} application{o.applications === 1 ? "" : "s"}
                </span>
                <Link href={`/opportunities/${o.id}/applicants`} className="btn-ghost px-3 py-1.5 text-xs">
                  Review applicants
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* active hires */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-100">
          <UserPlus className="h-4 w-4 text-lime-400" /> Active hires & engagements
        </h2>
        {data === null ? (
          <div className="mt-3 h-16 animate-pulse rounded-xl bg-card-raised" />
        ) : data.activeEngagements.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">Nothing in flight. Select an applicant or open a project with a creator and it appears here.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.activeEngagements.map((e) => (
              <li key={`${e.kind}:${e.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
                <Link href={`/creator/${e.with.handle}`}>
                  <Avatar src={e.with.avatarUrl} initials={e.with.displayName.charAt(0)} size="sm" />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-100">{e.title}</p>
                  <p className="text-[11px] text-zinc-500">
                    <Link href={`/creator/${e.with.handle}`} className="hover:underline">{e.with.displayName}</Link>
                    {" · "}
                    <span className="font-mono text-[10px] uppercase tracking-wide text-violet-300">{e.state.replace(/_/g, " ")}</span>
                    {" · "}{e.kind}
                  </p>
                </div>
                <Link href={e.href} className="btn-ghost px-3 py-1.5 text-xs">
                  <ExternalLink className="h-3 w-3" /> Open
                </Link>
                <Link href={`/messages?to=${e.with.handle}`} className="btn-ghost px-3 py-1.5 text-xs">Message</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* hiring activity */}
      <section className="card p-5">
        <h2 className="text-sm font-bold text-zinc-100">Hiring activity</h2>
        <p className="mt-0.5 text-[11px] text-zinc-500">The real application trail — newest first.</p>
        {data === null ? (
          <div className="mt-3 h-16 animate-pulse rounded-xl bg-card-raised" />
        ) : data.activity.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">No applications yet.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {data.activity.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 text-xs">
                <Avatar src={a.applicant.avatarUrl} initials={a.applicant.displayName.charAt(0)} size="xs" />
                <Link href={`/creator/${a.applicant.handle}`} className="font-semibold text-zinc-200 hover:underline">
                  {a.applicant.displayName}
                </Link>
                <span className="text-zinc-500">applied to</span>
                <Link href={`/opportunities/${a.opportunityId}`} className="truncate text-zinc-300 hover:underline">{a.opportunityTitle}</Link>
                <span className={`font-mono text-[10px] font-bold uppercase tracking-wide ${APP_TONE[a.status] ?? "text-zinc-400"}`}>{a.status.replace(/_/g, " ")}</span>
                <span className="ml-auto font-mono text-[10px] text-zinc-600">{timeAgo(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
