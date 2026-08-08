"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock,
  Hourglass,
  ListChecks,
  Lock,
  MapPin,
  Settings2,
  Ticket,
  Users,
  X,
} from "lucide-react";
import Avatar from "./Avatar";
import ReportModal from "./ReportModal";
import Perforation from "./Perforation";
import QrCode from "./QrCode";
import { events, creators, currentUser, type UpEvent, type TicketType } from "@/lib/data";
import { feeFor, totalFor, money } from "@/lib/fees";

/* ------------------------------------------------------------------ */
/* One event page, four registration models. The organizer set the     */
/* rules; the UI adapts: rsvp = one click, registration = form,        */
/* ticket = type → info (+age check) → checkout → QR, approval =       */
/* request → pending. Capacity gates everything; waitlist optional.    */
/* ------------------------------------------------------------------ */

type FlowState = "idle" | "form" | "checkout" | "confirmed" | "pending" | "waitlisted";

const minAge: Record<string, number> = { "16+": 16, "18+": 18, "21+": 21 };

const ctaLabel: Record<UpEvent["registration"], string> = {
  rsvp: "RSVP",
  registration: "Register",
  ticket: "Get Tickets",
  approval: "Request to Attend",
};

export default function EventDetail({ id }: { id: string }) {
  const event = events.find((e) => e.id === id)!;
  const [flow, setFlow] = useState<FlowState>("idle");
  const [modalOpen, setModalOpen] = useState(false);
  const [ticket, setTicket] = useState<TicketType | null>(event.ticketTypes?.[1] ?? event.ticketTypes?.[0] ?? null);
  const [dob, setDob] = useState("");
  const [ageError, setAgeError] = useState(false);
  const [rulesAck, setRulesAck] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({
    "Full name": currentUser.name,
    Email: "devin@upnova.app",
  });

  const going = flow === "confirmed" ? 1 : 0;
  const claimed = event.attending + going;
  const soldOut = claimed >= event.capacity && flow !== "confirmed";
  const spotsLeft = Math.max(event.capacity - claimed, 0);
  const needsAge = event.age !== "all";
  const needsRulesAck = event.rules.length > 0 && event.registration !== "rsvp";
  const organizer = creators.find((c) => c.name === event.host);

  const price = ticket?.price ?? (Number(event.price.replace(/[^0-9.]/g, "")) || 0);

  const ageOk = useMemo(() => {
    if (!needsAge) return true;
    const m = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return false;
    const birth = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const ref = new Date(2026, 7, 8); // today
    let age = ref.getFullYear() - birth.getFullYear();
    if (ref < new Date(ref.getFullYear(), birth.getMonth(), birth.getDate())) age -= 1;
    return age >= (minAge[event.age] ?? 0);
  }, [dob, needsAge, event.age]);

  const startFlow = () => {
    if (soldOut) {
      if (event.waitlist) setFlow("waitlisted");
      return;
    }
    if (event.registration === "rsvp") {
      setFlow("confirmed");
    } else {
      setModalOpen(true);
      setFlow("form");
    }
  };

  const submitForm = () => {
    if (needsAge && event.registration !== "rsvp" && !ageOk) {
      setAgeError(true);
      return;
    }
    if (event.registration === "ticket") setFlow("checkout");
    else if (event.registration === "approval") {
      setFlow("pending");
      setModalOpen(false);
    } else {
      setFlow("confirmed");
      setModalOpen(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* cover */}
      <header className="card-event overflow-hidden">
        <div className="relative h-44 sm:h-56">
          {event.image ? (
            <>
              <Image src={event.image} alt="" fill sizes="768px" className="object-cover" priority />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
            </>
          ) : (
            <div className={`h-full bg-gradient-to-br ${event.gradient}`} />
          )}
          <Link
            href="/events"
            className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/70"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Events
          </Link>
          {/* the rules the organizer chose, worn on the cover */}
          <div className="absolute bottom-3 left-4 flex flex-wrap items-center gap-2">
            {needsAge && (
              <span className="rounded-md bg-red-500/90 px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-white">
{event.age} EVENT
              </span>
            )}
            <span className="rounded-md bg-black/60 px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-white backdrop-blur">
{event.price === "Free" ? "FREE" : event.price}
            </span>
            <span className="rounded-md bg-black/60 px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white backdrop-blur">
              {claimed} / {event.capacity} spots
            </span>
          </div>
        </div>

        <div className="p-5">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-amber-400">
            {event.category} · hosted by {event.host}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">{event.title}</h1>
          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-zinc-300">
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-zinc-500" /> {event.location}</span>
            <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-amber-400" /> {event.date}</span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-400" /> {event.time}
              {event.endTime && ` – ${event.endTime}`}
            </span>
            <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-violet-400" /> {claimed} going</span>
          </div>

          {/* CTA zone */}
          <div className="mt-4 border-t border-line-soft pt-4">
            {flow === "confirmed" ? (
              <div className="card-event flex flex-wrap items-center gap-4 border-lime-400/30 p-4">
                <QrCode seed={`${event.id}-${currentUser.id}`} className="h-24 w-24 shrink-0 rounded-md" />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-lime-300">
                    <Check className="h-4 w-4" /> You&apos;re going!
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {event.registration === "ticket" && ticket
                      ? `${ticket.name} · ${currentUser.name}`
                      : `Your spot is reserved · ${currentUser.name}`}
                  </p>
                  <p className="mt-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                    qr check-in code · valid admission{needsAge && ` · ${event.age}`}
                  </p>
                </div>
              </div>
            ) : flow === "pending" ? (
              <p className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-300">
                <Hourglass className="h-4 w-4" /> Request sent — {event.host} approves attendees for this event.
              </p>
            ) : flow === "waitlisted" ? (
              <p className="flex items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm text-zinc-300">
                <Check className="h-4 w-4 text-lime-400" /> You&apos;re on the waitlist — we&apos;ll notify you if a spot opens.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={startFlow}
                  className={
                    soldOut && !event.waitlist
                      ? "cursor-not-allowed rounded-full bg-card-raised px-6 py-2.5 text-sm font-bold text-zinc-600"
                      : "inline-flex items-center gap-2 rounded-full bg-amber-400 px-6 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-300 hover:shadow-glow-amber active:scale-[0.98]"
                  }
                  disabled={soldOut && !event.waitlist}
                >
                  <Ticket className="h-4 w-4" />
                  {soldOut ? (event.waitlist ? "Join Waitlist" : "Sold Out") : ctaLabel[event.registration]}
                </button>
                {soldOut ? (
                  <span className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-red-400">SOLD OUT</span>
                ) : (
                  <span className="text-xs text-zinc-500">
                    {spotsLeft} spots left
                    {event.registration === "approval" && " · organizer approval required"}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* organizer dashboard door */}
      {event.organizedByYou && (
        <Link
          href={`/events/${event.id}/manage`}
          className="flex items-center gap-3 rounded-xl border border-lime-400/30 bg-lime-400/5 px-4 py-3 text-sm font-semibold text-lime-300 transition hover:bg-lime-400/10"
        >
          <Settings2 className="h-4 w-4" /> You organize this event — open the Event Manager →
        </Link>
      )}

      <div className="grid gap-5 md:grid-cols-5">
        <div className="space-y-5 md:col-span-3">
          {/* about */}
          <section className="card-event p-5">
            <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">About</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{event.description}</p>
          </section>

          {/* schedule */}
          {event.schedule && (
            <section className="card-event p-5">
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Schedule</h2>
              <ol className="mt-3 space-y-2.5">
                {event.schedule.map((s) => (
                  <li key={s.time} className="flex gap-3 text-sm">
                    <span className="w-20 shrink-0 font-mono text-xs font-medium text-amber-400">{s.time}</span>
                    <span className="text-zinc-300">{s.item}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* rules */}
          <section className="card-event p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-50">
              <ListChecks className="h-4 w-4 text-amber-400" /> Event Rules
            </h2>
            <ul className="mt-3 space-y-2">
              {event.rules.map((r) => (
                <li key={r} className="flex items-start gap-2.5 text-sm text-zinc-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /> {r}
                </li>
              ))}
            </ul>
            {needsAge && (
              <p className="mt-3 border-t border-line-soft pt-3 text-xs text-zinc-500">
                {event.age} · Valid government-issued ID may be required at entry. The organizer
                defines the rules; UpNova enforces them at registration and check-in.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-5 md:col-span-2">
          {/* tickets */}
          {event.ticketTypes && (
            <section className="card-event p-5">
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Tickets</h2>
              <ul className="mt-3 space-y-2">
                {event.ticketTypes.map((t) => (
                  <li key={t.id} className="flex items-baseline justify-between border-b border-dashed border-zinc-700/60 pb-2 text-sm last:border-0">
                    <span className="text-zinc-300">{t.name}</span>
                    <span className="font-bold tabular-nums tracking-tight text-zinc-100">${t.price}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-zinc-600">+ applicable fees, shown before checkout</p>
            </section>
          )}

          {/* attendees */}
          <section className="card-event p-5">
            <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Attendees</h2>
            <div className="mt-3 flex items-center">
              {creators.slice(0, 4).map((c, i) => (
                <Avatar key={c.id} src={c.avatar} initials={c.initials} gradient={c.gradient} size="sm" className={i > 0 ? "-ml-2 ring-2 ring-card" : "ring-2 ring-card"} />
              ))}
              <span className="ml-3 text-xs text-zinc-500">+{Math.max(claimed - 4, 0)} going</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-card-raised">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min((claimed / event.capacity) * 100, 100)}%` }} />
            </div>
            <p className="mt-1.5 font-mono text-[10px] font-medium text-zinc-500">
              {claimed} / {event.capacity} spots claimed
            </p>
          </section>

          {/* organizer */}
          <section className="card-event p-5">
            <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Organizer</h2>
            <div className="mt-3 flex items-center gap-3">
              {organizer ? (
                <>
                  <Avatar src={organizer.avatar} initials={organizer.initials} gradient={organizer.gradient} size="sm" className="ring-1 ring-line" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-100">{organizer.name}</p>
                    <p className="truncate text-xs text-zinc-500">{organizer.role}</p>
                  </div>
                  <Link href={`/creator/${organizer.id}`} className="btn-ghost px-3 py-1.5 text-xs">View</Link>
                </>
              ) : (
                <p className="text-sm text-zinc-300">{event.host}</p>
              )}
            </div>
          </section>

          <button
            onClick={() => setReportOpen(true)}
            className="w-full rounded-xl border border-line py-2 text-xs text-zinc-500 transition hover:border-red-500/40 hover:text-red-300"
          >
            Report / Get Help
          </button>
        </div>
      </div>

      {reportOpen && (
        <ReportModal context={`Event · ${event.title}`} onClose={() => setReportOpen(false)} />
      )}

      {/* ---------------- registration / ticket modal ---------------- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => setModalOpen(false)}>
          <div className="card-event max-h-[90dvh] w-full max-w-md overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">
                {flow === "checkout" ? "Ticket Checkout" : event.registration === "approval" ? "Request to Attend" : "Registration"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="icon-btn h-8 w-8" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">{event.title} · {event.date}</p>

            {flow === "form" && (
              <>
                {/* ticket type */}
                {event.registration === "ticket" && event.ticketTypes && (
                  <div className="mt-4 space-y-1.5">
                    {event.ticketTypes.map((t) => (
                      <label key={t.id} className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2.5 text-sm transition ${ticket?.id === t.id ? "border-amber-400/50 bg-amber-400/5 text-zinc-100" : "border-line bg-card-raised text-zinc-300"}`}>
                        <span className="flex items-center gap-2.5">
                          <input type="radio" checked={ticket?.id === t.id} onChange={() => setTicket(t)} className="accent-amber-400" />
                          {t.name}
                        </span>
                        <span className="font-bold tabular-nums tracking-tight">${t.price}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* only the fields the organizer required */}
                <div className="mt-4 space-y-3">
                  {event.requiredFields.map((f) => {
                    if (f === "Date of birth") return null; // rendered below with the age gate
                    const isQuestion = f.endsWith("?");
                    return (
                      <div key={f}>
                        <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">{f}</label>
                        {isQuestion ? (
                          <textarea rows={2} value={answers[f] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [f]: e.target.value }))} className="input-dark mt-1.5 resize-none" />
                        ) : (
                          <input value={answers[f] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [f]: e.target.value }))} className="input-dark mt-1.5" />
                        )}
                      </div>
                    );
                  })}

                  {needsAge && (
                    <div>
                      <label htmlFor="ev-dob" className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                        Date of birth · this is a {event.age} event
                      </label>
                      <input
                        id="ev-dob"
                        type="date"
                        value={dob}
                        onChange={(e) => { setDob(e.target.value); setAgeError(false); }}
                        className="input-dark mt-1.5"
                      />
                      {ageError && (
                        <p className="mt-1.5 text-xs font-semibold text-red-400">
                          You must be {event.age.replace("+", " or older")} to attend this event.
                        </p>
                      )}
                      <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
                        Production uses an age/identity-verification provider — a typed birthday is
                        the demo placeholder, not the real control.
                      </p>
                    </div>
                  )}
                </div>

                {/* rules acknowledgement */}
                {needsRulesAck && (
                  <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-md border border-line bg-card-raised px-3 py-2.5 text-xs text-zinc-400">
                    <input type="checkbox" checked={rulesAck} onChange={(e) => setRulesAck(e.target.checked)} className="mt-0.5 accent-amber-400" />
                    <span>I&apos;ve read and agree to the event rules{needsAge && ` and confirm I meet the ${event.age} age requirement`}.</span>
                  </label>
                )}

                <button
                  onClick={submitForm}
                  disabled={needsRulesAck && !rulesAck}
                  className={`mt-4 w-full rounded-full py-2.5 text-sm font-bold transition ${
                    needsRulesAck && !rulesAck
                      ? "cursor-not-allowed bg-card-raised text-zinc-600"
                      : "bg-amber-400 text-zinc-950 hover:bg-amber-300 hover:shadow-glow-amber"
                  }`}
                >
                  {event.registration === "ticket" ? "Continue to Checkout" : event.registration === "approval" ? "Submit Request" : "Complete Registration"}
                </button>
              </>
            )}

            {flow === "checkout" && ticket && (
              <>
                <div className="mt-4 space-y-1.5 text-sm">
                  <p className="flex justify-between text-zinc-400">
                    <span>{ticket.name} × 1</span>
                    <span className="font-bold tabular-nums text-zinc-100">${ticket.price}.00</span>
                  </p>
                  <p className="flex justify-between text-xs text-zinc-500">
                    <span>UpNova / event fees</span>
                    <span className="tabular-nums">{money(feeFor(ticket.price))}</span>
                  </p>
                  <p className="flex justify-between border-t border-line-soft pt-2 text-zinc-200">
                    <span className="text-xs">Total</span>
                    <span className="text-lg font-extrabold tracking-tight tabular-nums text-amber-400">{money(totalFor(ticket.price))}</span>
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-2.5 rounded-md border border-line bg-card-raised px-3 py-2.5 text-sm text-zinc-200">
                  <span className="font-mono font-medium">•••• 4242</span>
                  <span className="ml-auto text-base font-extrabold tabular-nums tracking-tight text-amber-400">{money(totalFor(ticket.price))}</span>
                </div>
                <button
                  onClick={() => { setFlow("confirmed"); setModalOpen(false); }}
                  className="mt-4 w-full rounded-full bg-amber-400 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-300 hover:shadow-glow-amber"
                >
                  Pay &amp; Get Ticket
                </button>
                <p className="mt-2.5 flex items-center justify-center gap-1.5 font-mono text-[10px] font-medium text-zinc-500">
                  <Lock className="h-3 w-3" /> secure payment · organizer payout runs through the platform
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
