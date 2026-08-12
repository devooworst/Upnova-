"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FlaskConical,
  CalendarCheck,
  Briefcase,
  GraduationCap,
  Sparkles,
  MessageSquare,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { useSession } from "@/lib/session";
import QaLab from "@/components/QaLab";

interface ActItem {
  kind: "booking" | "purchase" | "project" | "application";
  id: string; title: string; myRole: string;
  with: { handle: string; displayName: string };
  status: string; stageIndex: number; stages: string[];
  paymentStatus: string | null; conversationId: string | null;
}

/* ------------------------------------------------------------------ */
/* Simulation / Test Center — developer tooling for the DEMO           */
/* deployment. Every scenario card shows LIVE state pulled from your   */
/* real account records (bookings, applications, conversations,        */
/* verification, plan) — this page orchestrates and verifies the REAL  */
/* end-to-end flows, it never fakes a state. Hidden in production      */
/* (demoTools=false).                                                  */
/* ------------------------------------------------------------------ */

interface BookingRow {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  price: number;
  conversationId: string | null;
  myRole: string;
  with: { handle: string; displayName: string };
  paymentStatus: string | null;
}
interface AppRow { id: string; status: string; opportunity?: { title?: string } | null }
interface ConvRow { id: string; unread: number; with: { handle: string; displayName: string } | null; booking: { status: string } | null }

const bookingStage = (b: BookingRow) =>
  b.status === "completed" ? "Completed — payout released"
  : b.status === "confirmed" ? "Confirmed — payment secured (TEST)"
  : b.status === "accepted" ? "Accepted — awaiting test payment"
  : b.status === "pending" ? "Requested — awaiting the provider"
  : b.status;

export default function SimulationPage() {
  const { user } = useSession();
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [apps, setApps] = useState<AppRow[] | null>(null);
  const [convos, setConvos] = useState<ConvRow[] | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [activity, setActivity] = useState<ActItem[] | null>(null);
  const [ftBusy, setFtBusy] = useState(false);
  const [ft, setFt] = useState<{ summary: { passed: number; failed: number; blocked: number; notTested?: number; critical?: number; durationMs: number }; categories: { name: string; ok: boolean; passed?: number; failed?: number; blocked?: number; notTested?: number; steps: { name: string; status: string; expected?: string; actual?: string; route?: string; record?: string; severity?: string }[] }[] } | null>(null);
  const [ftOpen, setFtOpen] = useState<string | null>(null);
  const runFullTest = async () => {
    setFtBusy(true);
    setFt(null);
    try {
      const res = await fetch("/api/demo/fulltest", { method: "POST" });
      const d = await res.json();
      if (res.ok) setFt(d);
      else setAdvMsg(`✗ ${d.error || "Full test could not run"}`);
    } catch {
      setAdvMsg("✗ Network error running the full test");
    }
    setFtBusy(false);
    refresh();
  };
  const advanceClock = async (ms: number, label: string, scope?: "qa") => {
    setBusy(true);
    const res = await fetch("/api/demo/clock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ advanceMs: ms, ...(scope ? { scope } : {}) }) });
    const d = await res.json();
    setAdvMsg(res.ok ? `✓ Simulated ${label} passing${scope === "qa" ? " for the QA Lab records" : ""} — ${d.recordsAged} record(s) aged. Reload the relevant views.` : `✗ ${d.error}`);
    setBusy(false);
    refresh();
  };
  const [advMsg, setAdvMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const advance = async (item: ActItem) => {
    setBusy(true);
    setAdvMsg(null);
    try {
      const res = await fetch("/api/demo/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: item.kind, id: item.id }),
      });
      const d = await res.json();
      if (!res.ok) setAdvMsg(`✗ ${d.error || "Could not advance"}`);
      else if (d.requiresAction) setAdvMsg(`→ Your step, never simulated: ${d.requiresAction}`);
      else setAdvMsg(`✓ ${item.title}: now "${d.stage}" — check the conversation, notification, and Activity timeline`);
    } catch {
      setAdvMsg("✗ Network error");
    }
    setBusy(false);
    refresh();
  };

  const resetScenario = async (kind: string) => {
    if (!window.confirm(`Reset your ${kind} test transactions with seed accounts? Conversations stay as history; auth, verification, and plan are untouched.`)) return;
    setBusy(true);
    const res = await fetch("/api/demo/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
    const d = await res.json();
    setAdvMsg(res.ok ? `✓ Reset ${d.reset} ${kind} record(s)` : `✗ ${d.error || "Reset failed"}`);
    setBusy(false);
    refresh();
  };

  const refresh = () => {
    fetch("/api/activity", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d.bookings) setActivity([...d.bookings, ...d.purchases, ...d.projects, ...d.applications]);
    }).catch(() => {});
    fetch("/api/bookings", { cache: "no-store" }).then((r) => r.json()).then((d) => setBookings(d.bookings ?? [])).catch(() => setBookings([]));
    fetch("/api/me/applications", { cache: "no-store" }).then((r) => r.json()).then((d) => setApps(d.applications ?? [])).catch(() => setApps([]));
    fetch("/api/conversations", { cache: "no-store" }).then((r) => r.json()).then((d) => setConvos(d.conversations ?? [])).catch(() => setConvos([]));
    setRefreshedAt(new Date());
  };
  useEffect(() => {
    if (user) refresh();
  }, [!!user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (user === undefined)
    return (
      <div className="mx-auto max-w-3xl pt-10" aria-busy="true">
        <div className="h-8 w-64 animate-pulse rounded bg-card-raised" />
        <div className="mt-4 h-40 animate-pulse rounded-xl bg-card-raised" />
      </div>
    );

  if (!user || !user.demoTools)
    return (
      <div className="mx-auto max-w-md pt-12 text-center">
        <h1 className="text-xl font-bold text-zinc-50">Not available</h1>
        <p className="mt-2 text-sm text-zinc-500">The Test Center only exists on demo deployments{!user ? " — and requires signing in" : ""}.</p>
      </div>
    );

  const latestBooking = bookings?.filter((b) => b.myRole === "client").slice(-1)[0] ?? null;
  const latestApp = apps?.[0] ?? null;
  const unread = (convos ?? []).reduce((n, c) => n + c.unread, 0);

  const chain = (parts: string[]) => (
    <p className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-zinc-500">
      {parts.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {p}
          {i < parts.length - 1 && <ArrowRight className="h-2.5 w-2.5 text-zinc-700" />}
        </span>
      ))}
    </p>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="pt-2">
        <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-300">
          <FlaskConical className="h-3.5 w-3.5" /> demo deployment · developer tool
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Simulation / Test Center</h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-500">
              End-to-end stateful scenarios. Every status below is read live from your real account
              records — nothing here is a mockup. Actions cause the next state.
            </p>
          </div>
          <button onClick={refresh} className="btn-ghost px-3.5 py-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh live state
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className={`rounded-full border px-2.5 py-1 font-semibold ${user.testerMode !== "simulation" ? "border-amber-400/40 bg-amber-400/10 text-amber-300" : "border-sky-400/40 bg-sky-400/10 text-sky-300"}`}>
            {user.testerMode !== "simulation" ? "DEMO MODE — gates open" : "SIMULATION MODE — realistic gates"}
          </span>
          <span className="rounded-full border border-line px-2.5 py-1 text-zinc-300">Plan: <span className="font-semibold capitalize">{user.plan === "college" ? "College+" : user.plan}</span></span>
          <span className="rounded-full border border-line px-2.5 py-1 text-zinc-300">
            {user.campus ? `Verified: ${user.campus.name}${user.campus.affiliation === "alumni" ? " (Alumni)" : ""}` : "Not verified"}
          </span>
          {refreshedAt && <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[10px] text-zinc-600">state as of {refreshedAt.toLocaleTimeString()}</span>}
        </div>
      </header>

      {/* QA LAB — play both sides yourself; checkpoints verify the real DB */}
      <QaLab viewerHandle={user.handle} />

      {/* FULL SYSTEM TEST — the whole ecosystem, real HTTP, real sessions */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-lime-400/20 bg-gradient-to-b from-lime-400/10 to-transparent px-5 py-4">
          <div>
            <p className="text-[15px] font-bold tracking-tight text-lime-300">Full Mavyn System Test</p>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-400">
              Plays Mavyn as three real people (rachel · lena · Harbor &amp; Oak), each with their own
              authenticated session, over real HTTP: message ↔ reply, booking ↔ both sides, test
              payment held → released, full project lifecycle with a revision, review, provider
              progress updates ↔ ETA changes ↔ extension approval, the private Preferred Clients
              loop (eligibility, benefits, Preferred Early Access windows, preferred pricing,
              removal), first-time onboarding state, business opportunity ↔ application ↔ selection,
              business People categorization (talent ≠ employee) + team authz + payments view,
              notification destinations, activity on both sides, plan/verification gates, logout &amp;
              session isolation, and database integrity. Time is simulated, never waited for.
              Designated test records reset at the start of every run — real accounts and auth are
              never touched.
            </p>
          </div>
          <button onClick={runFullTest} disabled={ftBusy} className="btn-lime shrink-0 rounded-md px-5 py-2.5 text-sm disabled:opacity-50">
            {ftBusy ? "Running…" : "Run Full Website QA"}
          </button>
        </div>
        {ft && (
          <div className="p-5">
            <p className="flex flex-wrap gap-3 text-xs font-bold">
              <span className="text-lime-300">PASSED {ft.summary.passed}</span>
              <span className={ft.summary.failed ? "text-red-300" : "text-zinc-600"}>FAILED {ft.summary.failed}</span>
              <span className={ft.summary.blocked ? "text-amber-300" : "text-zinc-600"}>BLOCKED {ft.summary.blocked}</span>
              <span className={ft.summary.notTested ? "text-zinc-300" : "text-zinc-600"}>NOT TESTED {ft.summary.notTested ?? 0}</span>
              <span className={(ft.summary.critical ?? 0) > 0 ? "rounded bg-red-500/20 px-1.5 text-red-300" : "text-zinc-600"}>CRITICAL {ft.summary.critical ?? 0}</span>
              <span className="ml-auto font-mono text-[10px] font-medium text-zinc-500">{(ft.summary.durationMs / 1000).toFixed(1)}s</span>
            </p>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {ft.categories.map((c) => (
                <div key={c.name}>
                  <button onClick={() => setFtOpen(ftOpen === c.name ? null : c.name)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-bold transition ${c.ok ? "border-lime-400/25 text-lime-300 hover:bg-lime-400/5" : (c.notTested ?? 0) > 0 && !(c.failed ?? 0) ? "border-line text-zinc-400 hover:bg-card-raised" : "border-red-500/40 text-red-300 hover:bg-red-500/5"}`}>
                    <span>{c.ok ? "✓" : (c.notTested ?? 0) > 0 && !(c.failed ?? 0) ? "·" : "✕"}</span> {c.name}
                    <span className="ml-auto font-mono text-[9px] font-medium text-zinc-600">
                      {c.passed != null ? `${c.passed}✓${c.failed ? ` ${c.failed}✕` : ""}${c.blocked ? ` ${c.blocked}◌` : ""}${c.notTested ? ` ${c.notTested}·` : ""}` : `${c.steps.length} steps`}
                    </span>
                  </button>
                  {ftOpen === c.name && (
                    <ul className="mt-1 space-y-1 rounded-lg border border-line bg-card-raised p-2">
                      {c.steps.map((st, i) => (
                        <li key={i} className="text-[11px]">
                          <span className={st.status === "PASSED" ? "text-lime-300" : st.status === "BLOCKED" ? "text-amber-300" : st.status === "NOT_TESTED" ? "text-zinc-500" : "text-red-300"}>{st.status === "PASSED" ? "✓" : st.status === "BLOCKED" ? "◌" : st.status === "NOT_TESTED" ? "·" : "✕"}</span>{" "}
                          <span className="text-zinc-300">{st.name}</span>
                          {st.severity && st.status === "FAILED" && (
                            <span className={`ml-1.5 rounded px-1 font-mono text-[8px] font-bold ${st.severity === "CRITICAL" ? "bg-red-500/20 text-red-300" : st.severity === "HIGH" ? "bg-amber-400/20 text-amber-300" : "bg-zinc-500/20 text-zinc-300"}`}>{st.severity}</span>
                          )}
                          {st.status !== "PASSED" && (
                            <span className="block pl-4 text-[10px] text-zinc-500">
                              {st.expected && <>expected: <span className="text-zinc-300">{st.expected}</span> · </>}
                              {st.actual && <>actual: <span className={st.status === "NOT_TESTED" ? "text-zinc-400" : "text-red-300"}>{st.actual}</span> · </>}
                              {st.route && <>route: {st.route} · </>}
                              {st.record && <>record: {st.record}</>}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* TIME SIMULATION — age your test records instead of waiting */}
      <section className="card space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-2 text-xs font-bold text-zinc-100">Time simulation</p>
          <p className="mr-2 text-[10px] text-zinc-500">ages YOUR live test records (bookings, deadlines, protection windows) — never the real clock</p>
          {(([["1 minute", 60e3], ["5 minutes", 300e3], ["1 hour", 3600e3], ["1 day", 86400e3]]) as const).map(([label, ms]) => (
            <button key={label} onClick={() => advanceClock(ms, label)} disabled={busy} className="rounded-full border border-line px-3 py-1 text-[11px] font-semibold text-zinc-300 transition hover:border-zinc-600 disabled:opacity-50">
              +{label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-2">
          <p className="mr-2 text-[10px] text-zinc-500">
            <span className="font-bold text-violet-300">QA Lab records</span> — ages the TEST personas&apos; bookings, project deadlines &amp; ETAs (test overdue states without waiting)
          </p>
          {(([["1 day", 86400e3], ["2 days", 2 * 86400e3], ["1 week", 7 * 86400e3]]) as const).map(([label, ms]) => (
            <button key={label} onClick={() => advanceClock(ms, label, "qa")} disabled={busy} className="rounded-full border border-violet-400/30 px-3 py-1 text-[11px] font-semibold text-violet-300 transition hover:bg-violet-400/10 disabled:opacity-50">
              +{label}
            </button>
          ))}
        </div>
      </section>

      {/* live transactions — advance the SEED counterpart step by step */}
      <section className="card overflow-hidden">
        <div className="border-b border-amber-400/20 bg-gradient-to-b from-amber-400/10 to-transparent px-5 py-4">
          <p className="text-[15px] font-bold tracking-tight text-amber-300">Live test transactions — advance &amp; reset</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            &quot;Advance&quot; plays the seed counterpart&apos;s next REAL action (accept, prepare, start, ship,
            deliver, complete, shortlist…) through the same code the organic flow uses — messages,
            notifications, payment states, and the Activity timeline all update for real. Your own
            steps (like paying) are never simulated: the button points you at the real UI instead.
            Records with the QA TEST personas don&apos;t belong here — you play both sides of those in
            the QA Lab above. Reset removes only your test records with seed accounts — never auth,
            verification, or plan.
          </p>
        </div>
        <div className="p-5">
          {advMsg && <p className="mb-3 rounded-md border border-line bg-card-raised px-3 py-2 text-xs text-zinc-300">{advMsg}</p>}
          {activity === null ? (
            <p className="text-xs text-zinc-500">Loading…</p>
          ) : activity.length === 0 ? (
            <p className="text-xs text-zinc-500">No transactions yet — start one with the scenario cards below, then advance it here stage by stage.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {activity.slice(0, 10).map((i) => (
                <li key={`${i.kind}:${i.id}`} className="flex flex-wrap items-center gap-2 py-2.5">
                  <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide text-zinc-500">{i.kind}</span>
                  <span className="min-w-0 flex-1 truncate text-xs">
                    <span className="font-semibold text-zinc-100">{i.title}</span>
                    <span className="text-zinc-500"> · @{i.with.handle} · </span>
                    <span className="font-semibold text-lime-300">{i.stageIndex < 0 ? i.status : i.stages[Math.min(i.stageIndex, i.stages.length - 1)]}</span>
                    {i.paymentStatus && <span className="text-zinc-500"> · payment {i.paymentStatus} (test)</span>}
                  </span>
                  <Link href={`/activity?focus=${i.kind}:${i.id}`} className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-200">Timeline</Link>
                  {i.conversationId && <Link href={`/messages?c=${i.conversationId}`} className="text-[11px] font-semibold text-sky-300 hover:underline">Thread</Link>}
                  {i.kind !== "project" && i.stageIndex >= 0 && i.stageIndex < i.stages.length - 1 && (
                    <button onClick={() => advance(i)} disabled={busy} className="rounded-md bg-amber-400/15 px-2.5 py-1 text-[11px] font-bold text-amber-300 transition hover:bg-amber-400/25 disabled:opacity-50">
                      Advance stage →
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line-soft pt-3">
            {["booking", "purchase", "application"].map((k) => (
              <button key={k} onClick={() => resetScenario(k)} disabled={busy} className="rounded-full border border-red-500/30 px-3 py-1 text-[11px] font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50">
                Reset {k} scenario
              </button>
            ))}
            <span className="ml-auto self-center font-mono text-[9px] uppercase tracking-wide text-zinc-600">projects advance through their real in-thread flow</span>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* booking */}
        <section className="card-money p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-lime-300">
            <CalendarCheck className="h-4 w-4" /> Booking scenario
          </h2>
          {chain(["Customer", "Creator", "Service", "Booking", "Test payment", "Progress", "Completion"])}
          <div className="mt-3 rounded-lg border border-line bg-card-raised p-3 text-xs">
            {latestBooking ? (
              <>
                <p className="font-semibold text-zinc-100">{latestBooking.title} — with {latestBooking.with.displayName} (@{latestBooking.with.handle})</p>
                <p className="mt-1 text-zinc-400">{bookingStage(latestBooking)} · ${latestBooking.price}{latestBooking.paymentStatus ? ` · payment ${latestBooking.paymentStatus} (TEST)` : ""}</p>
                <div className="mt-2 flex gap-3 text-[11px] font-semibold">
                  {latestBooking.conversationId && (
                    <Link href={`/messages?c=${latestBooking.conversationId}`} className="text-lime-300 hover:underline">
                      Open @{latestBooking.with.handle}&apos;s conversation →
                    </Link>
                  )}
                  <Link href="/calendar" className="text-zinc-300 hover:underline">Booking record →</Link>
                </div>
              </>
            ) : (
              <p className="text-zinc-500">No bookings yet as a customer. Book any creator — a seed provider accepts instantly and their conversation carries every update.</p>
            )}
          </div>
          <Link href="/services" className="btn-lime mt-3 flex w-full justify-center rounded-md py-2 text-xs">
            Start: browse services →
          </Link>
        </section>

        {/* opportunity */}
        <section className="card p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-100">
            <Briefcase className="h-4 w-4 text-amber-400" /> Opportunity scenario
          </h2>
          {chain(["Creator", "Opportunity", "Application", "Accepted", "Work", "Completion"])}
          <div className="mt-3 rounded-lg border border-line bg-card-raised p-3 text-xs">
            {latestApp ? (
              <p className="text-zinc-400">
                <span className="font-semibold text-zinc-100">{latestApp.opportunity?.title ?? "Application"}</span> — status:{" "}
                <span className="font-semibold capitalize text-amber-300">{latestApp.status.replace("_", " ")}</span>
              </p>
            ) : (
              <p className="text-zinc-500">No applications yet. Apply to any opportunity; seed posters respond so the flow completes.</p>
            )}
          </div>
          <Link href="/opportunities" className="btn-ghost mt-3 flex w-full justify-center py-2 text-xs">
            Start: browse opportunities →
          </Link>
        </section>

        {/* student */}
        <section className="card-people p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-violet-300">
            <GraduationCap className="h-4 w-4" /> Student scenario
          </h2>
          {chain(["Unverified", "Verification", "Verified student", "Your Campus", "Graduate", "Alumni"])}
          <div className="mt-3 rounded-lg border border-line bg-card-raised p-3 text-xs">
            <p className="text-zinc-400">
              Current: <span className="font-semibold text-violet-300">{user.campus ? `${user.campus.name} · ${user.campus.affiliation === "alumni" ? "Alumni" : "Current Student"}${user.campus.gradYear ? ` · Class of ${user.campus.gradYear}` : ""}` : "Not verified"}</span>
            </p>
            <p className="mt-1 text-zinc-600">Switch states instantly in Settings → Demo Controls, or run the real verification on /campus (Simulation Mode shows the real gate).</p>
          </div>
          <div className="mt-3 flex gap-2">
            <Link href="/campus" className="flex flex-1 justify-center rounded-md bg-violet-400 py-2 text-xs font-bold text-zinc-950 hover:bg-violet-300">Your Campus →</Link>
            <Link href="/settings" className="btn-ghost flex-1 justify-center py-2 text-xs">Demo Controls →</Link>
          </div>
        </section>

        {/* subscription */}
        <section className="card p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-100">
            <Sparkles className="h-4 w-4 text-lime-400" /> Subscription scenario
          </h2>
          {chain(["Free", "College+ / Pro", "Test payment", "Active", "Cancel", "Free"])}
          <div className="mt-3 rounded-lg border border-line bg-card-raised p-3 text-xs">
            <p className="text-zinc-400">
              Current plan: <span className="font-semibold capitalize text-lime-300">{user.plan === "college" ? "College+" : user.plan}</span>.
              Checkout runs the full TEST-PAYMENT flow (review → processing → active); cancelling re-locks the perks in Simulation Mode.
            </p>
          </div>
          <div className="mt-3 flex gap-2">
            <Link href="/pro?intent=college" className="btn-ghost flex-1 justify-center py-2 text-xs">College+ checkout →</Link>
            <Link href="/pro" className="btn-lime flex-1 justify-center rounded-md py-2 text-xs">Plans →</Link>
          </div>
        </section>

        {/* messaging */}
        <section className="card p-5 md:col-span-2">
          <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-100">
            <MessageSquare className="h-4 w-4 text-sky-400" /> Messaging scenario
          </h2>
          {chain(["You", "Person (by id)", "Their conversation", "Replies", "Booking updates in-thread", "Notifications"])}
          <div className="mt-3 rounded-lg border border-line bg-card-raised p-3 text-xs">
            <p className="text-zinc-400">
              {convos === null ? "Loading…" : `${convos.length} conversation${convos.length === 1 ? "" : "s"} · ${unread} unread.`}{" "}
              Every thread is keyed to its participant ids — booking updates always land with the person you booked, never anyone else. Seed creators reply and ask real next-step questions.
            </p>
            {(convos ?? []).slice(0, 3).map((c) => (
              <p key={c.id} className="mt-1.5 text-[11px]">
                <Link href={`/messages?c=${c.id}`} className="font-semibold text-sky-300 hover:underline">
                  @{c.with?.handle ?? "?"} — {c.with?.displayName ?? "?"}
                </Link>
                {c.booking && <span className="text-zinc-500"> · booking {c.booking.status}</span>}
                {c.unread > 0 && <span className="text-lime-300"> · {c.unread} unread</span>}
              </p>
            ))}
          </div>
          <Link href="/messages" className="btn-ghost mt-3 flex w-full justify-center py-2 text-xs">
            Open Messages →
          </Link>
        </section>
      </div>

      <p className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-[11px] leading-relaxed text-zinc-400">
        <span className="font-semibold text-amber-300">How to read this page:</span> every card queries
        the same APIs the product uses. If a scenario shows the wrong person, wrong status, or loses
        state after a refresh, that&apos;s a real bug — report it exactly as you see it here.
      </p>
    </div>
  );
}
