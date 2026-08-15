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

interface Limits {
  plan: "free" | "business_pro";
  enforced: boolean;
  limits: Record<string, number>;
  proLimits: Record<string, number>;
  usage: Record<string, number>;
  atLimit: Record<string, boolean>;
}
interface SavedTalent {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  primaryRole: string;
  skills: string[];
  openToWork: boolean;
  serviceId: string | null;
  savedAt: string;
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
  const [limits, setLimits] = useState<Limits | null>(null);
  const [saved, setSaved] = useState<SavedTalent[] | null>(null);
  const [saveHandle, setSaveHandle] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = () => {
    fetch("/api/business/hiring", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.counts && setData(d))
      .catch(() => {});
    fetch("/api/business/limits", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.limits && setLimits(d))
      .catch(() => {});
    fetch("/api/business/talent-saves", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.saved && setSaved(d.saved))
      .catch(() => {});
  };
  useEffect(() => {
    if (user) load();
  }, [!!user]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveTalent = async () => {
    if (!saveHandle.trim()) return;
    setSaveMsg(null);
    const res = await fetch("/api/business/talent-saves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: saveHandle.replace(/^@/, "").trim() }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setSaveMsg(d.error || "Couldn't save");
    setSaveHandle("");
    load();
  };

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

      {/* capacity — honest numbers, never a deletion, never a surprise */}
      {limits && (
        <div className={`rounded-xl border px-4 py-2.5 ${Object.values(limits.atLimit).some(Boolean) && limits.enforced ? "border-amber-400/40 bg-amber-400/5" : "border-line bg-card"}`}>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-sky-300">
              {limits.plan === "business_pro" ? "Business Pro" : "Business Free"}
            </span>
            {(
              [
                ["activeOpportunities", "Opportunities"],
                ["activeHires", "Active hires"],
                ["teamMembers", "Team"],
                ["savedTalent", "Saved talent"],
                ["admins", "Admins"],
              ] as const
            ).map(([k, label]) => (
              <span key={k} className={limits.atLimit[k] ? "font-semibold text-amber-300" : "text-zinc-400"}>
                {label}{" "}
                <span className="font-mono tracking-[0.06em]">
                  {limits.usage[k]}/{limits.limits[k]}
                </span>
              </span>
            ))}
            {limits.plan === "free" && (
              <Link href="/plans" className="ml-auto font-semibold text-sky-300 hover:underline">
                Business Pro raises these to {limits.proLimits.activeOpportunities}/{limits.proLimits.activeHires}/{limits.proLimits.teamMembers}/{limits.proLimits.savedTalent}/{limits.proLimits.admins} →
              </Link>
            )}
            {!limits.enforced && (
              <span className="text-[10px] text-zinc-600">Demo Mode: limits shown, not enforced — Simulation Mode enforces them</span>
            )}
          </p>
          {limits.enforced && limits.atLimit.activeOpportunities && (
            <p className="mt-1.5 text-[11px] text-amber-200">
              You&apos;ve reached your {limits.plan === "free" ? "Business Free" : "Business Pro"} limit — active opportunities:{" "}
              {limits.usage.activeOpportunities}/{limits.limits.activeOpportunities}.
              {limits.plan === "free" && <> Business Pro: up to {limits.proLimits.activeOpportunities} active opportunities.</>}{" "}
              Existing records stay fully accessible — nothing is ever deleted.
            </p>
          )}
        </div>
      )}

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

      {/* saved talent — the private prospect pool */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-100">
              <Search className="h-4 w-4 text-violet-300" /> Saved talent
            </h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Your private prospect pool — nobody sees who you save.
              {limits && <span className="ml-1 font-mono text-[10px] text-zinc-600">{limits.usage.savedTalent}/{limits.limits.savedTalent}</span>}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              value={saveHandle}
              onChange={(e) => setSaveHandle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveTalent()}
              placeholder="@handle"
              className="input-dark w-36 py-1.5 text-xs"
            />
            <button onClick={saveTalent} className="btn-ghost px-3 py-1.5 text-xs">Save</button>
          </div>
        </div>
        {saveMsg && <p className="mt-2 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">{saveMsg}</p>}
        {saved === null ? (
          <div className="mt-3 h-12 animate-pulse rounded-xl bg-card-raised" />
        ) : saved.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">Nobody saved yet — find someone in Discover and save them here for later.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {saved.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-line bg-card-raised px-3 py-2">
                <Link href={`/creator/${s.handle}`}><Avatar src={s.avatarUrl} initials={s.displayName.charAt(0)} size="xs" /></Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/creator/${s.handle}`} className="text-xs font-semibold text-zinc-100 hover:underline">{s.displayName}</Link>
                  <span className="ml-1.5 text-[10px] text-zinc-500">{s.primaryRole}{s.openToWork ? " · open to work" : ""}</span>
                </div>
                <Link href={`/messages?to=${s.handle}`} className="text-[11px] font-semibold text-sky-300 hover:underline">Message</Link>
                {s.serviceId && <Link href={`/services/${s.serviceId}`} className="text-[11px] font-semibold text-lime-300 hover:underline">Hire</Link>}
                <button
                  onClick={async () => {
                    await fetch("/api/business/talent-saves", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: s.id }) });
                    load();
                  }}
                  className="text-[11px] font-semibold text-zinc-500 hover:text-rose-300"
                >
                  Remove
                </button>
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
