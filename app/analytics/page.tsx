import { BarChart3, ArrowUpRight } from "lucide-react";
import { analytics } from "@/lib/data";

export const metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  const max = Math.max(...analytics.weeklyReach.map((d) => d.value));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="px-1">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
            <BarChart3 className="h-5 w-5 text-lime-400" />
          </span>
          Analytics
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Last 7 days • UpNova Pro unlocks deeper insights.</p>
      </header>

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
