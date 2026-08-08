"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Check,
  QrCode as QrIcon,
  ScanLine,
  Search,
  Settings2,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import Avatar from "./Avatar";
import { events, creators } from "@/lib/data";
import { feeFor, money } from "@/lib/fees";

/* The organizer's side: attendees, tickets, check-in, payments,
   settings, analytics. The event runs on the rules they chose. */

const sections = [
  { id: "attendees", label: "Attendees", icon: Users },
  { id: "tickets", label: "Tickets", icon: Ticket },
  { id: "checkin", label: "Check-in", icon: ScanLine },
  { id: "payments", label: "Payments", icon: Wallet },
  { id: "settings", label: "Settings", icon: Settings2 },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
] as const;
type SectionId = (typeof sections)[number]["id"];

const extraNames = ["Maya Reyes", "K. Boateng", "Sasha Green", "Devon Price", "Toni Alvarez"];

export default function EventManager({ id }: { id: string }) {
  const event = events.find((e) => e.id === id)!;
  const [section, setSection] = useState<SectionId>("attendees");
  const [query, setQuery] = useState("");
  const [checkedIn, setCheckedIn] = useState<Record<string, boolean>>({ "Ava Chen": true, "Maya Reyes": true });

  const ga = event.ticketTypes?.find((t) => t.id === "ga") ?? event.ticketTypes?.[0];
  const revenue = ga ? event.attending * ga.price : 0;
  const fees = feeFor(revenue);

  const attendees = [
    ...creators.slice(0, 4).map((c) => ({ name: c.name, avatar: c.avatar, initials: c.initials, gradient: c.gradient, ticket: ga?.name ?? "RSVP" })),
    ...extraNames.map((n) => ({ name: n, avatar: null, initials: n[0], gradient: "from-zinc-600 to-zinc-800", ticket: ga?.name ?? "RSVP" })),
  ].filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));

  const checkedCount = Object.values(checkedIn).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <Link href={`/events/${event.id}`} className="flex w-fit items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" /> back to event
        </Link>
        <p className="mt-2 font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-amber-400">
          event manager
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">{event.title}</h1>
        <div className="mt-3 flex flex-wrap gap-6 text-sm">
          <p>
            <span className="text-xl font-extrabold tabular-nums tracking-tight text-zinc-50">{event.attending}</span>
            <span className="text-zinc-500"> / {event.capacity} attendees</span>
          </p>
          {revenue > 0 && (
            <p>
              <span className="text-xl font-extrabold tabular-nums tracking-tight text-lime-400">${revenue.toLocaleString()}</span>
              <span className="text-zinc-500"> ticket revenue</span>
            </p>
          )}
          <p>
            <span className="text-xl font-extrabold tabular-nums tracking-tight text-zinc-50">{checkedCount}</span>
            <span className="text-zinc-500"> checked in</span>
          </p>
        </div>
      </header>

      {/* section nav */}
      <nav className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-line-soft pb-2">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              section === s.id ? "bg-white text-zinc-950" : "text-zinc-400 hover:bg-card-raised hover:text-zinc-200"
            }`}
          >
            <s.icon className="h-3.5 w-3.5" /> {s.label}
          </button>
        ))}
      </nav>

      {section === "attendees" && (
        <section className="card-event overflow-hidden">
          <div className="relative border-b border-line-soft p-3">
            <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search attendees…"
              className="input-dark pl-9"
            />
          </div>
          <ul className="divide-y divide-line-soft">
            {attendees.map((a) => (
              <li key={a.name} className="flex items-center gap-3 px-4 py-3">
                <Avatar src={a.avatar} initials={a.initials} gradient={a.gradient} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-100">{a.name}</p>
                  <p className="text-xs text-zinc-500">{a.ticket}</p>
                </div>
                <button
                  onClick={() => setCheckedIn((m) => ({ ...m, [a.name]: !m[a.name] }))}
                  className={
                    checkedIn[a.name]
                      ? "flex items-center gap-1 rounded-full border border-lime-400/40 px-3 py-1 text-[11px] font-semibold text-lime-300"
                      : "rounded-full border border-line px-3 py-1 text-[11px] font-medium text-zinc-400 transition hover:border-zinc-600"
                  }
                >
                  {checkedIn[a.name] ? (<><Check className="h-3 w-3" /> Checked in</>) : "Check in"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {section === "tickets" && (
        <section className="card-money p-5">
          <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Ticket types</h2>
          <ul className="mt-3">
            {(event.ticketTypes ?? []).map((t, i) => (
              <li key={t.id} className="flex items-baseline justify-between border-t border-dashed border-zinc-700/60 py-3 first:border-t-0">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{t.name}</p>
                  <p className="font-mono text-[10px] font-medium text-zinc-500">
                    {[58, 61, 18][i] ?? 12} sold
                  </p>
                </div>
                <p className="text-lg font-extrabold tabular-nums tracking-tight text-lime-400">${t.price}</p>
              </li>
            ))}
            {!event.ticketTypes && <li className="py-3 text-sm text-zinc-500">Free event — no ticket types.</li>}
          </ul>
          <button className="btn-ghost mt-2 w-full py-2 text-xs">+ Add ticket type</button>
        </section>
      )}

      {section === "checkin" && (
        <section className="card-event p-5 text-center">
          <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-amber-400/40">
            <QrIcon className="h-10 w-10 text-amber-400" />
          </span>
          <h2 className="mt-4 text-[15px] font-bold tracking-tight text-zinc-50">Scan QR Code</h2>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
            Point your camera at an attendee&apos;s ticket. Valid tickets check in instantly;
            invalid or duplicate codes are flagged.
          </p>
          <button className="mx-auto mt-4 flex items-center gap-2 rounded-full bg-amber-400 px-6 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-300 hover:shadow-glow-amber">
            <ScanLine className="h-4 w-4" /> Open Scanner
          </button>
          <div className="mx-auto mt-5 max-w-xs">
            <div className="h-1.5 overflow-hidden rounded-full bg-card-raised">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.round((checkedCount / event.attending) * 100)}%` }} />
            </div>
            <p className="mt-1.5 font-mono text-[10px] font-medium text-zinc-500">
              {checkedCount} / {event.attending} checked in
            </p>
          </div>
        </section>
      )}

      {section === "payments" && (
        <section className="card-money p-5">
          <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Payments</h2>
          <div className="mt-3 space-y-1.5 text-sm">
            <p className="flex justify-between text-zinc-400"><span>Gross ticket sales</span><span className="font-bold tabular-nums text-zinc-100">${revenue.toLocaleString()}</span></p>
            <p className="flex justify-between text-xs text-zinc-500"><span>UpNova event fee (5%, paid by buyers)</span><span className="tabular-nums">{money(fees)}</span></p>
            <p className="flex justify-between text-xs text-zinc-500"><span>Refunds</span><span className="tabular-nums">$0.00</span></p>
            <div className="border-t border-zinc-600" />
            <div className="mt-[3px] border-t border-zinc-600" />
            <p className="flex items-baseline justify-between pt-1.5">
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-400">your payout</span>
              <span className="text-xl font-extrabold tabular-nums tracking-tight text-lime-400">${revenue.toLocaleString()}</span>
            </p>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
            Payouts run through the payment processor after the event. Buyers paid the platform fee
            on top of your ticket prices — your listed price is what you earn.
          </p>
        </section>
      )}

      {section === "settings" && (
        <section className="card-event p-5">
          <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Event Settings</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Capacity</label>
              <input defaultValue={event.capacity} className="input-dark mt-1.5 tabular-nums" />
            </div>
            <div>
              <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Age requirement</label>
              <select defaultValue={event.age} className="input-dark mt-1.5">
                <option value="all">All ages</option>
                <option value="16+">16+</option>
                <option value="18+">18+</option>
                <option value="21+">21+</option>
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Registration model</label>
              <select defaultValue={event.registration} className="input-dark mt-1.5">
                <option value="rsvp">One-click RSVP</option>
                <option value="registration">Registration required</option>
                <option value="ticket">Paid ticket</option>
                <option value="approval">Request to attend</option>
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Waitlist</label>
              <select defaultValue={event.waitlist ? "on" : "off"} className="input-dark mt-1.5">
                <option value="on">Enabled</option>
                <option value="off">Disabled</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Rules (one per line)</label>
            <textarea defaultValue={event.rules.join("\n")} rows={4} className="input-dark mt-1.5 resize-none" />
          </div>
          <div className="mt-4 flex justify-end">
            <button className="btn-lime rounded-md px-5 py-2 text-xs">Save changes</button>
          </div>
        </section>
      )}

      {section === "analytics" && (
        <section className="card-event p-5">
          <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Analytics</h2>
          <ul className="mt-3 divide-y divide-line-soft text-sm">
            {[
              ["Event page views", "2,418"],
              ["RSVPs / tickets", `${event.attending}`],
              ["Conversion", `${Math.round((event.attending / 2418) * 100)}%`],
              ["Revenue", revenue > 0 ? `$${revenue.toLocaleString()}` : "Free event"],
              ["Check-in rate", `${Math.round((checkedCount / event.attending) * 100)}%`],
              ["Capacity filled", `${Math.round((event.attending / event.capacity) * 100)}%`],
            ].map(([k, v]) => (
              <li key={k} className="flex items-baseline justify-between py-2.5">
                <span className="text-zinc-400">{k}</span>
                <span className="font-bold tabular-nums tracking-tight text-zinc-100">{v}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
