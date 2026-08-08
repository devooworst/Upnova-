"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, PartyPopper } from "lucide-react";
import { feeFor, money } from "@/lib/fees";

/* Event Setup: the organizer chooses the model — UpNova provides the
   tools. A free meetup stays one-click; a paid 21+ party gets tickets,
   age gates, and QR check-in. Nothing is forced. */

const categories = ["Party / Nightlife", "Concert", "Creative / Art", "Networking", "Photoshoot", "Workshop", "Competition", "Sports", "Gaming", "Pop-up / Market", "Other"];
const ages = [
  { id: "all", label: "All ages" },
  { id: "16+", label: "16+" },
  { id: "18+", label: "18+" },
  { id: "21+", label: "21+" },
];
const regModels = [
  { id: "rsvp", label: "One-click RSVP", desc: "Click RSVP, done. Best for casual meetups." },
  { id: "registration", label: "Registration required", desc: "Attendees fill in the info you choose." },
  { id: "ticket", label: "Paid ticket", desc: "Select ticket → checkout → QR ticket issued." },
  { id: "approval", label: "Request to attend", desc: "You approve every attendee." },
];
const fieldOptions = ["Full name", "Email", "Phone number", "Username", "Organization / company", "Additional question"];

export default function CreateEventPage() {
  const [published, setPublished] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[3]);
  const [age, setAge] = useState("all");
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState(25);
  const [reg, setReg] = useState("rsvp");
  const [capacity, setCapacity] = useState(100);
  const [waitlist, setWaitlist] = useState(true);
  const [fields, setFields] = useState<string[]>(["Full name"]);
  const [rules, setRules] = useState("No harassment\nCheck-in required");

  const toggleField = (f: string) =>
    setFields((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  const effectiveReg = paid && reg === "rsvp" ? "ticket" : reg;

  if (published) {
    return (
      <div className="mx-auto max-w-md pt-10 text-center">
        <PartyPopper className="mx-auto h-10 w-10 text-amber-400" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-50">
          {name || "Your event"} is live
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          {age !== "all" && `${age} · `}
          {paid ? `$${price} · ` : "Free · "}
          {capacity} spots · {regModels.find((r) => r.id === effectiveReg)?.label}.
          {" "}Your rules are enforced at registration{effectiveReg === "ticket" && " and QR check-in"}.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/events" className="btn-lime rounded-md px-5 py-2 text-xs">See it on Events</Link>
          <button onClick={() => setPublished(false)} className="btn-ghost px-5 py-2 text-xs">Edit setup</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <Link href="/events" className="flex w-fit items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Events
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-50">Event Setup</h1>
        <p className="mt-1 text-sm text-zinc-500">
          You control the rules — admission, age, capacity, registration. UpNova enforces them.
        </p>
      </header>

      {/* 1 · basic info */}
      <section className="card-event p-5">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-400">1 · Basic information</h2>
        <div className="mt-3 space-y-3">
          <div>
            <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Event name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Baltimore Creator Meetup" className="input-dark mt-1.5" />
          </div>
          <div>
            <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Description</label>
            <textarea rows={2} placeholder="A networking night for local photographers, producers, models…" className="input-dark mt-1.5 resize-none" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Type</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-dark mt-1.5">
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Date</label><input placeholder="Sep 12" className="input-dark mt-1.5" /></div>
            <div><label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Time</label><input placeholder="8:00 PM – 1:00 AM" className="input-dark mt-1.5" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Location</label><input placeholder="Baltimore, MD" className="input-dark mt-1.5" /></div>
            <div>
              <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Format</label>
              <select className="input-dark mt-1.5"><option>In person</option><option>Online</option><option>Hybrid</option></select>
            </div>
          </div>
        </div>
      </section>

      {/* 2 · age */}
      <section className="card-event p-5">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-400">2 · Age requirement</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {ages.map((a) => (
            <button
              key={a.id}
              onClick={() => setAge(a.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                age === a.id ? "bg-red-500/90 text-white" : "border border-line text-zinc-400 hover:bg-card-raised"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        {age !== "all" && (
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            Displayed prominently on the event. People below {age} can&apos;t complete registration.
            Date of birth is added to the registration form automatically — and only because this
            event needs it.
          </p>
        )}
      </section>

      {/* 3 · admission */}
      <section className="card-event p-5">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-400">3 · Admission</h2>
        <div className="mt-3 flex gap-2">
          <button onClick={() => setPaid(false)} className={`flex-1 rounded-xl border p-3 text-left transition ${!paid ? "border-lime-400/50 bg-lime-400/5" : "border-line hover:border-zinc-600"}`}>
            <p className="text-sm font-semibold text-zinc-100">Free</p>
            <p className="mt-0.5 text-xs text-zinc-500">No payment. RSVP or registration.</p>
          </button>
          <button onClick={() => setPaid(true)} className={`flex-1 rounded-xl border p-3 text-left transition ${paid ? "border-lime-400/50 bg-lime-400/5" : "border-line hover:border-zinc-600"}`}>
            <p className="text-sm font-semibold text-zinc-100">Paid</p>
            <p className="mt-0.5 text-xs text-zinc-500">Tickets, checkout, QR admission.</p>
          </button>
        </div>
        {paid && (
          <div className="mt-3">
            <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Ticket price</label>
            <div className="relative mt-1.5 max-w-[10rem]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
              <input value={price} onChange={(e) => setPrice(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} inputMode="numeric" className="input-dark pl-7 tabular-nums" />
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Buyers see <span className="font-semibold text-zinc-300">${price} + {money(feeFor(price))} fees</span> before
              checkout. You never collect money through DMs — payouts run through the platform.
            </p>
            <button className="btn-ghost mt-2 px-3 py-1.5 text-[11px]">+ Add ticket types (GA / VIP / Early Bird)</button>
          </div>
        )}
      </section>

      {/* 4 · registration */}
      <section className="card-event p-5">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-400">4 · Registration</h2>
        <div className="mt-3 space-y-1.5">
          {regModels.map((r) => {
            const disabled = paid && r.id === "rsvp";
            const active = effectiveReg === r.id;
            return (
              <button
                key={r.id}
                disabled={disabled}
                onClick={() => setReg(r.id)}
                className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition ${
                  active ? "border-amber-400/50 bg-amber-400/5" : disabled ? "cursor-not-allowed border-line opacity-40" : "border-line hover:border-zinc-600"
                }`}
              >
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${active ? "border-amber-400 bg-amber-400/20" : "border-zinc-600"}`}>
                  {active && <Check className="h-2.5 w-2.5 text-amber-400" />}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-zinc-100">{r.label}{disabled && " · needs a free event"}</span>
                  <span className="block text-xs text-zinc-500">{r.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Maximum attendees</label>
            <input value={capacity} onChange={(e) => setCapacity(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} inputMode="numeric" className="input-dark mt-1.5 tabular-nums" />
            <p className="mt-1 text-[10px] text-zinc-600">Free doesn&apos;t mean unlimited. Registration closes automatically at capacity.</p>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 self-start rounded-md border border-line bg-card-raised px-3 py-2.5 text-sm text-zinc-300 sm:mt-6">
            <input type="checkbox" checked={waitlist} onChange={(e) => setWaitlist(e.target.checked)} className="accent-amber-400" />
            Enable waitlist when sold out
          </label>
        </div>
      </section>

      {/* 5 · attendee info */}
      <section className="card-event p-5">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-400">5 · Attendee information</h2>
        <p className="mt-1.5 text-xs text-zinc-500">Only ask for what the event actually needs.</p>
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {fieldOptions.map((f) => (
            <label key={f} className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition ${fields.includes(f) ? "border-line bg-card-raised text-zinc-200" : "border-line-soft text-zinc-500 hover:text-zinc-300"}`}>
              <input type="checkbox" checked={fields.includes(f)} onChange={() => toggleField(f)} className="accent-amber-400" />
              {f}
            </label>
          ))}
          {age !== "all" && (
            <span className="flex items-center gap-2.5 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
              <Check className="h-4 w-4" /> Date of birth — required by the {age} restriction
            </span>
          )}
        </div>
      </section>

      {/* 6 · rules */}
      <section className="card-event p-5">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-400">6 · Event rules</h2>
        <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={4} className="input-dark mt-3 resize-none" placeholder={"No outside alcohol\nNo weapons\nNo harassment"} />
        <p className="mt-2 text-xs text-zinc-500">
          Attendees acknowledge these before registering. You define the rules; UpNova communicates
          and enforces the registration requirements.
        </p>
      </section>

      <button onClick={() => setPublished(true)} className="w-full rounded-full bg-amber-400 py-3 text-sm font-bold text-zinc-950 transition hover:bg-amber-300 hover:shadow-glow-amber">
        Publish Event
      </button>
    </div>
  );
}
