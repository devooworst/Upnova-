"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Sparkles, FlaskConical } from "lucide-react";
import { useSession } from "@/lib/session";

interface Summary {
  revenue: { thisMonth: number; lastMonth: number; delta: number; allTime: number };
  avgValue: number;
  clients: number;
  repeatClients: number;
  completedEngagements: number;
  followers: number;
  followersNewThisMonth: number;
  engagement: {
    profileViews: number;
    profileViews7d: number;
    contentViews: number;
    serviceViews: number;
    likesReceived: number;
    commentsReceived: number;
    weekly: { day: string; contentViews: number; profileViews: number }[];
    topPosts: { id: string; title: string; likes: number; comments: number; views: number; engagement: number }[];
    audience: { place: string; count: number; pct: number }[];
    applicationsSent: number;
  };
}

export default function AnalyticsPage() {
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
  // engagement block from the extended summary API (real interactions data)
  const eng = summary?.engagement ?? null;
  const weekTotal = eng ? eng.weekly.reduce((n, d) => n + d.contentViews + d.profileViews, 0) : 0;
  const weekMax = eng ? Math.max(...eng.weekly.map((d) => d.contentViews + d.profileViews)) : 0;

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
            Computed live from your payments, bookings, projects, follows, and recorded view events.
            Views are counted from signed-in browsing only — real numbers, honestly small when they&apos;re small.
          </p>
        </section>
      )}

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

      {/* engagement stat cards — each labeled as EXACTLY what it counts */}
      {eng && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([
            { label: "Profile Views", value: eng.profileViews, sub: `${eng.profileViews7d} in the last 7 days` },
            { label: "Content Views", value: eng.contentViews, sub: "views recorded on your posts" },
            { label: "Likes Received", value: eng.likesReceived, sub: `${eng.commentsReceived} comments received` },
            { label: "Service Views", value: eng.serviceViews, sub: "views on your listings" },
          ] as { label: string; value: number; sub: string }[]).map((s) => (
            <div key={s.label} className="card p-3.5">
              <p className="text-xs text-zinc-500">{s.label}</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-zinc-50">{s.value.toLocaleString()}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* last-7-days views chart — real daily buckets */}
        <section className="card p-4">
          <h2 className="text-sm font-bold text-zinc-100">Views · last 7 days</h2>
          <p className="text-xs text-zinc-500">Recorded views of your posts and profile, by day</p>
          {eng && weekTotal > 0 ? (
            <div className="mt-3 flex h-36 items-end gap-2">
              {eng.weekly.map((d) => {
                const v = d.contentViews + d.profileViews;
                return (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className={`w-full rounded-lg transition-all ${
                        v === weekMax && v > 0 ? "bg-amber-400" : "bg-zinc-700/60 hover:bg-zinc-600"
                      }`}
                      style={{ height: `${weekMax > 0 ? Math.max((v / weekMax) * 100, v > 0 ? 6 : 2) : 2}%` }}
                      title={`${d.contentViews} post views · ${d.profileViews} profile views`}
                    />
                    <span className="text-[10px] text-zinc-500">{d.day}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-6 pb-4 text-center text-xs leading-relaxed text-zinc-500">
              Not enough activity yet — views appear here as people find your posts and profile.
            </p>
          )}
        </section>

        {/* audience — where the people who ENGAGED with you are from */}
        <section className="card p-4">
          <h2 className="text-sm font-bold text-zinc-100">Audience Locations</h2>
          <p className="text-xs text-zinc-500">Where the accounts that engaged with you are located</p>
          {eng && eng.audience.length > 0 ? (
            <ul className="mt-5 space-y-3.5">
              {eng.audience.map((a) => (
                <li key={a.place}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-300">{a.place}</span>
                    <span className="text-zinc-500">{a.count} {a.count === 1 ? "person" : "people"} · {a.pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-violet-400/80" style={{ width: `${a.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 pb-4 text-center text-xs leading-relaxed text-zinc-500">
              Not enough activity yet — locations show up once people view, like, or follow you
              (only for accounts that share their location).
            </p>
          )}
        </section>
      </div>

      {/* top posts — ranked by real engagement */}
      <section className="card p-5">
        <h2 className="text-sm font-bold text-zinc-100">Top Posts</h2>
        <p className="text-xs text-zinc-500">Your posts ranked by likes + comments + recorded views</p>
        {eng && eng.topPosts.length > 0 ? (
          <div className="mt-3 divide-y divide-line-soft">
            {eng.topPosts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card-raised text-sm font-bold text-lime-400">
                  {i + 1}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-200">{p.title}</p>
                <p className="hidden text-xs text-zinc-500 sm:block">{p.views} {p.views === 1 ? "view" : "views"}</p>
                <p className="text-xs font-semibold text-amber-400">{p.likes} ♥ · {p.comments} 💬</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 pb-2 text-center text-xs leading-relaxed text-zinc-500">
            Not enough activity yet — your most-engaged posts will rank here.
          </p>
        )}
      </section>

      {/* business — real counts from your actual records */}
      {summary && (
        <section className="card p-4">
          <h2 className="text-sm font-bold text-zinc-100">Business</h2>
          <div className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {([
              ["Service views", String(eng?.serviceViews ?? 0)],
              ["Clients", String(summary.clients)],
              ["Repeat clients", String(summary.repeatClients)],
              ["Applications sent", String(eng?.applicationsSent ?? 0)],
              ["Completed engagements", String(summary.completedEngagements)],
              ["Avg. engagement", `$${summary.avgValue}`],
            ] as [string, string][]).map(([k, v]) => (
              <p key={k} className="flex items-baseline justify-between border-b border-line-soft pb-1.5">
                <span className="text-xs text-zinc-500">{k}</span>
                <span className="font-bold tabular-nums tracking-tight text-zinc-100">{v}</span>
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
