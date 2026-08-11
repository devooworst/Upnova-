"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, ArrowUpRight, Sparkles, FlaskConical } from "lucide-react";
import { analytics } from "@/lib/data";
import { useSession } from "@/lib/session";

interface Summary {
  revenue: { thisMonth: number; lastMonth: number; delta: number; allTime: number };
  avgValue: number;
  clients: number;
  repeatClients: number;
  completedEngagements: number;
  followers: number;
  followersNewThisMonth: number;
}

export default function AnalyticsPage() {
  const max = Math.max(...analytics.weeklyReach.map((d) => d.value));
  const { user } = useSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => {
    if (!user) return;
    fetch("/api/analytics/summary", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.revenue && setSummary(d))
      .catch(() => {});
  }, [!!user]); // eslint-disable-line react-hooks/exhaustive-deps
  // Advanced Analytics is a PRO feature. SIMULATION MODE enforces it like
  // production; DEMO MODE opens it for testing (clearly labeled below).
  const demoUnrestricted = !!user && user.testerMode !== "simulation";
  const hasPro = user?.plan === "pro";

  if (user === undefined) {
    return (
      <div className="mx-auto max-w-4xl pt-10" aria-busy="true">
        <div className="h-8 w-56 animate-pulse rounded bg-card-raised" />
        <div className="mt-4 h-40 animate-pulse rounded-xl bg-card-raised" />
      </div>
    );
  }

  if (!hasPro && !demoUnrestricted) {
    return (
      <div className="mx-auto max-w-md pt-12 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-400/30 bg-lime-400/10">
          <BarChart3 className="h-7 w-7 text-lime-400" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-50">Advanced Analytics</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
          Profile views, application rates, earnings breakdowns, and audience location are part of
          Mavyn Pro. Your current plan: <span className="font-semibold text-zinc-300">{user?.plan === "college" ? "College+" : "Free"}</span>.
        </p>
        <Link
          href="/pro"
          className="btn-lime mt-5 inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-sm"
        >
          <Sparkles className="h-4 w-4" /> Upgrade to Pro
        </Link>
        <p className="mt-3 text-[10px] text-zinc-600">
          Earning is never paywalled — analytics is a growth perk, not an earnings gate.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="px-1">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
            <BarChart3 className="h-5 w-5 text-lime-400" />
          </span>
          Analytics
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          How you&apos;re performing over time — trends, growth, and business insight.
          (Live workflows and money in motion live in Activity.)
        </p>
      </header>

      {/* YOUR REAL PERFORMANCE — computed from your actual records */}
      {summary && (
        <section className="card p-5">
          <h2 className="flex items-center justify-between text-sm font-bold text-zinc-100">
            Your performance
            <span className="font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-lime-400">real records</span>
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div>
              <p className="text-2xl font-extrabold tabular-nums tracking-tight text-lime-400">${summary.revenue.thisMonth}</p>
              <p className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500">revenue this month</p>
              <p className={`mt-0.5 text-[11px] font-semibold ${summary.revenue.delta >= 0 ? "text-lime-400" : "text-red-400"}`}>
                {summary.revenue.delta >= 0 ? "+" : "−"}${Math.abs(summary.revenue.delta)} vs last month (${summary.revenue.lastMonth})
              </p>
            </div>
            <div>
              <p className="text-2xl font-extrabold tabular-nums tracking-tight text-zinc-50">${summary.revenue.allTime}</p>
              <p className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500">released all-time</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">avg ${summary.avgValue} / engagement</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold tabular-nums tracking-tight text-zinc-50">{summary.repeatClients}<span className="text-sm text-zinc-500">/{summary.clients}</span></p>
              <p className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500">repeat clients</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">{summary.completedEngagements} completed engagements</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold tabular-nums tracking-tight text-violet-300">{summary.followers}</p>
              <p className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500">followers</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">+{summary.followersNewThisMonth} this month</p>
            </div>
          </div>
          <p className="mt-3 border-t border-line-soft pt-2 text-[10px] text-zinc-600">
            Computed live from your payments, bookings, projects, and follows. Views/reach tracking
            isn&apos;t collected yet — the sample dashboard below shows what it will look like.
          </p>
        </section>
      )}

      <p className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
        Sample dashboard — demo visuals until view tracking ships
      </p>

      {!hasPro && demoUnrestricted && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-400/25 bg-amber-400/5 px-4 py-3">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-[11px] leading-relaxed text-zinc-400">
            <span className="font-semibold text-amber-300">DEMO MODE</span> — this is a Pro feature
            and your plan is {user?.plan === "college" ? "College+" : "Free"}. Access is open for
            testing; switch to Simulation Mode (top-left) to see the real Pro gate.
          </p>
        </div>
      )}

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {analytics.stats.map((s) => (
          <div key={s.label} className="card p-3.5">
            <p className="text-xs text-zinc-500">{s.label}</p>
            <p className="mt-0.5 text-2xl font-bold tracking-tight text-zinc-50">{s.value}</p>
            <p className={`mt-0.5 flex items-center gap-1 text-xs font-semibold ${s.label === "Service Revenue" ? "text-lime-400" : "text-amber-400"}`}>
              <ArrowUpRight className="h-3.5 w-3.5" />
              {s.delta}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* weekly reach chart */}
        <section className="card p-4">
          <h2 className="text-sm font-bold text-zinc-100">Post Reach</h2>
          <p className="text-xs text-zinc-500">Impressions by day</p>
          <div className="mt-3 flex h-36 items-end gap-2">
            {analytics.weeklyReach.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className={`w-full rounded-lg transition-all ${
                    d.value === max
                      ? "bg-amber-400"
                      : "bg-zinc-700/60 hover:bg-zinc-600"
                  }`}
                  style={{ height: `${(d.value / max) * 100}%` }}
                  title={`${d.value * 100} impressions`}
                />
                <span className="text-[10px] text-zinc-500">{d.day}</span>
              </div>
            ))}
          </div>
        </section>

        {/* audience */}
        <section className="card p-4">
          <h2 className="text-sm font-bold text-zinc-100">Audience Locations</h2>
          <p className="text-xs text-zinc-500">Where your reach comes from</p>
          <ul className="mt-5 space-y-3.5">
            {analytics.audience.map((a) => (
              <li key={a.place}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-300">{a.place}</span>
                  <span className="text-zinc-500">{a.pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-violet-400/80" style={{ width: `${a.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* top posts */}
      <section className="card p-5">
        <h2 className="text-sm font-bold text-zinc-100">Top Posts</h2>
        <div className="mt-3 divide-y divide-line-soft">
          {analytics.topPosts.map((p, i) => (
            <div key={p.title} className="flex items-center gap-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-card-raised text-sm font-bold text-lime-400">
                {i + 1}
              </span>
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-200">{p.title}</p>
              <p className="hidden text-xs text-zinc-500 sm:block">{p.reach} reach</p>
              <p className="text-xs font-semibold text-amber-400">{p.engagement}</p>
            </div>
          ))}
        </div>
      </section>
      {/* business — what a creator actually needs to know */}
      <section className="card p-4">
        <h2 className="text-sm font-bold text-zinc-100">Business</h2>
        <div className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {([
            ["Service views", "1,842"],
            ["Hire requests", "17"],
            ["Conversion", "4.2%"],
            ["Applications sent", "6"],
            ["Repeat clients", "5"],
            ["Avg. project", "$212"],
          ] as [string, string][]).map(([k, v]) => (
            <p key={k} className="flex items-baseline justify-between border-b border-line-soft pb-1.5">
              <span className="text-xs text-zinc-500">{k}</span>
              <span className="font-bold tabular-nums tracking-tight text-zinc-100">{v}</span>
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
