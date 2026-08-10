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

  const refresh = () => {
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
