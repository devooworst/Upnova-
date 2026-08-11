"use client";

/* ------------------------------------------------------------------ */
/*  Services — "I'm available → Hire Me".                              */
/*  Real listings owned by real accounts. Hire Me opens the actual     */
/*  conversation with that owner (never a hardcoded user) with a       */
/*  service-specific intro, where the project lifecycle begins.        */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import AvailabilityStrip from "@/components/AvailabilityStrip";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ShoppingBag, Zap, X, Bookmark, CalendarDays, Plus } from "lucide-react";
import { policyLines, travelLabel, computeSelection, menuSummary, type ServiceConfig } from "@/lib/servicePolicies";
import Avatar from "@/components/Avatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useSession } from "@/lib/session";
import { promptJoin } from "@/components/GuestGate";

interface ServiceItem {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  aiPolicy: string;
  trustRequired: string;
  fulfillment?: string; // appointment | project | quote
  cta?: string; // from the listing's fulfillment configuration
  promoted?: boolean;
  config?: ServiceConfig;
  distanceMi?: number | null;
  travelEstimate?: number;
  travelNote?: string | null;
  reach: string;
  owner: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    verified: boolean;
    roleLine: string;
    city: string | null;
    state: string | null;
    locationLabel?: string | null;
    trustLevel: string;
  };
  isMine: boolean;
}

const AI_LABEL: Record<string, string> = {
  "no-ai": "No AI — fully original",
  disclosure: "AI disclosed when used",
  assisted: "AI-assisted workflow",
  "client-decides": "AI policy: client decides",
};

export default function ServicesPage() {
  const router = useRouter();
  const { user: me } = useSession();
  const [items, setItems] = useState<ServiceItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [hiring, setHiring] = useState<ServiceItem | null>(null);
  const [booking, setBooking] = useState<ServiceItem | null>(null);
  const [bookingDate, setBookingDate] = useState<string | null>(null); // pre-picked on the service page — never re-asked
  const [saved, setSaved] = useState<Set<string>>(new Set());

  // category deep links: /services?category=beauty acts as the category page
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("category");
    if (c) setCategory(c);
  }, []);

  useEffect(() => {
    fetch("/api/services", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setItems(d.services ?? []));
    fetch("/api/bookmarks", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) =>
        setSaved(new Set((d.items ?? []).filter((i: { type: string }) => i.type === "service").map((i: { id: string }) => i.id)))
      );
  }, []);

  // resume-after-auth: a guest who pressed Book/Request signed up and came
  // back to /services?book=<id> — reopen the exact flow they attempted
  useEffect(() => {
    if (!me || !items) return;
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get("book");
    const hireId = params.get("hire");
    const dateParam = params.get("date"); // the date already chosen on the calendar
    if (!bookId && !hireId) return;
    const target = items.find((s) => s.id === (bookId ?? hireId));
    window.history.replaceState(null, "", "/services"); // one-shot
    if (!target || target.isMine) return;
    if (bookId && target.fulfillment === "appointment") {
      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) setBookingDate(dateParam);
      setBooking(target);
    }
    else if (target) setHiring(target);
  }, [me, items]);

  const toggleSave = async (id: string) => {
    if (me === null) return promptJoin("save"); // UX only — the API 401s regardless
    const res = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "service", targetId: id }),
    });
    if (!res.ok) {
      if (res.status === 401) promptJoin("save");
      return;
    }
    const d = await res.json();
    setSaved((s) => {
      const next = new Set(s);
      if (d.saved) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const categories = ["All", ...Array.from(new Set((items ?? []).map((s) => s.category)))];

  const filtered = (items ?? []).filter((s) => {
    const q = query.trim().toLowerCase();
    const matchesQ =
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.owner.displayName.toLowerCase().includes(q);
    return (category === "All" || s.category === category) && matchesQ;
  });

  const hire = (s: ServiceItem) => {
    if (!me) {
      // contextual, not a generic wall — and auth returns them HERE with
      // the exact flow reopened (?book= / ?hire= resume below)
      promptJoin(
        s.fulfillment === "appointment" ? "book" : "hire",
        `/services?${s.fulfillment === "appointment" ? "book" : "hire"}=${s.id}`
      );
      return;
    }
    // service-view signal for the recommendation engine
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "service", targetId: s.id, action: "service_view" }),
    }).catch(() => {});
    // fulfillment model decides the flow — appointments book time slots,
    // project work sends a project request. Never force a calendar.
    if (s.fulfillment === "appointment") setBooking(s);
    else setHiring(s);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
          <ShoppingBag className="h-5 w-5 text-lime-400" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Services</h1>
          <p className="text-sm text-zinc-400">
            Creators who are available now. Their listed price is their payout — the 5% platform fee is
            added at checkout.
          </p>
        </div>
        <Link href="/services/new" className="btn-lime shrink-0 px-4 py-1.5 text-xs sm:text-sm">
          <Plus className="h-4 w-4" /> Create service
        </Link>
      </div>

      {/* search + categories */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services or creators…"
            className="w-full rounded-full border border-line bg-card py-2 pl-10 pr-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-lime-400/40"
          />
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
                category === c
                  ? "border-lime-400/50 bg-lime-400/10 font-semibold text-lime-300"
                  : "border-line text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* listings — money cards, receipt DNA */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {items === null ? (
          [0, 1, 2, 3].map((i) => <div key={i} className="card-money h-44 animate-pulse" aria-hidden />)
        ) : (
          filtered.map((s) => (
            <article key={s.id} className="card-money flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {s.promoted && (
                    <p className="mb-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Promoted
                    </p>
                  )}
                  <h3 className="text-sm font-bold text-zinc-100">
                    <Link href={`/services/${s.id}`} className="transition hover:text-lime-300">{s.title}</Link>
                  </h3>
                  <p className="font-mono text-sm font-medium tracking-[0.08em] text-lime-300">
                    From ${s.price}
                  </p>
                </div>
                {s.trustRequired === "high-trust" && (
                  <span className="shrink-0 rounded-full border border-lime-400/40 bg-lime-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-lime-300">
                    High-Trust
                  </span>
                )}
              </div>
              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-zinc-400">{s.description}</p>
              {menuSummary(s.config?.menu) && (
                <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.05em] text-zinc-500">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-lime-400/60" />
                  <span className="truncate">Add-ons: {menuSummary(s.config?.menu)}</span>
                </p>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> {AI_LABEL[s.aiPolicy]}
                <span aria-hidden>·</span> {s.reach}
                <span aria-hidden>·</span>
                <span className="font-medium text-zinc-400">
                  {s.fulfillment === "appointment" ? "Appointment" : s.price >= 500 ? "Quote" : "Project"}
                </span>
              </p>

              <div className="mt-3 flex items-center gap-2 border-t border-dashed border-line pt-3">
                <Link href={`/creator/${s.owner.handle}`} className="flex min-w-0 flex-1 items-center gap-2">
                  <Avatar src={s.owner.avatarUrl} initials={s.owner.displayName.charAt(0)} size="xs" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 truncate text-xs font-semibold text-zinc-200">
                      {s.owner.displayName}
                      {s.owner.verified && <VerifiedBadge className="h-3 w-3" />}
                    </span>
                    <span className="block truncate text-[10px] text-zinc-500">
                      {s.owner.locationLabel ?? s.owner.roleLine}
                    </span>
                  </span>
                </Link>
                {s.isMine ? (
                  <Link href="/profile/edit" className="btn-ghost shrink-0 px-3 py-1.5 text-[11px]">
                    Manage
                  </Link>
                ) : (
                  <span className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => toggleSave(s.id)}
                      title={saved.has(s.id) ? "Remove bookmark" : "Save"}
                      className={`rounded-full border p-1.5 transition ${
                        saved.has(s.id)
                          ? "border-violet-400/50 text-violet-300"
                          : "border-line text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                      }`}
                    >
                      <Bookmark className={`h-3.5 w-3.5 ${saved.has(s.id) ? "fill-violet-300" : ""}`} />
                    </button>
                    <button onClick={() => hire(s)} className="btn-lime px-3.5 py-1.5 text-xs">
                      {s.fulfillment === "appointment" ? (
                        <CalendarDays className="h-3.5 w-3.5" />
                      ) : (
                        <Zap className="h-3.5 w-3.5" />
                      )}
                      {s.cta ?? "Request Project"}
                    </button>
                  </span>
                )}
              </div>
            </article>
          ))
        )}
        {items !== null && filtered.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-zinc-500">No services match.</p>
        )}
      </div>

      {hiring && <HireWizard service={hiring} onClose={() => setHiring(null)} />}
      {booking && <BookWizard service={booking} initialDate={bookingDate} onClose={() => { setBooking(null); setBookingDate(null); }} />}
    </div>
  );
}

/* ------------------------------ book a slot ------------------------------ */
/* Appointment services: pick a date and time. The provider accepts, you
   pay, the calendar locks the slot — the server rejects double-booking. */

const SLOT_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17];
const DEFAULT_DURATION: Record<string, number> = {
  care: 60,
  beauty: 90,
  photography: 120,
  events: 240,
};

function BookWizard({ service, initialDate, onClose }: { service: ServiceItem; initialDate?: string | null; onClose: () => void }) {
  const router = useRouter();
  const firstName = service.owner.displayName.split(" ")[0];
  const menu = service.config?.menu;
  const hasMenu = !!menu && (menu.addons.length > 0 || menu.packages.length > 0);
  const [step, setStep] = useState<"options" | "slot" | "review" | "pay" | "done" | "requested">(hasMenu ? "options" : "slot");
  const [pkgId, setPkgId] = useState<string | null>(null);
  const [addonIds, setAddonIds] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(initialDate ?? "");
  const [hour, setHour] = useState<number | null>(null);
  // THE TIME LAYER — real slots from the availability API (the same rules
  // the booking POST enforces): available · booked · too soon · past.
  const [daySlots, setDaySlots] = useState<{ dayStatus: string; reason?: string; opensAt?: string; slots: { hour: number; label: string; status: string; reason?: string }[] } | null>(null);
  const [changingDate, setChangingDate] = useState(false);
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [convId, setConvId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // duration + slots come from the creator's scheduling config
  const sched = service.config?.scheduling;
  // the customer's selection, priced with the SAME calculator the server
  // uses — add-ons change the total AND the reserved appointment time
  const selection = service.config
    ? computeSelection(service.config, { title: service.title, price: service.price }, { packageId: pkgId, addonIds: Array.from(addonIds) })
    : null;
  const durationMin = selection?.durationMin ?? sched?.durationMin ?? DEFAULT_DURATION[service.category] ?? 60;
  const travelFee = service.travelEstimate ?? 0;
  const slotHours = sched?.startHour != null && sched?.endHour != null
    ? Array.from({ length: Math.max(0, sched.endHour - sched.startHour) }, (_, i) => sched.startHour! + i)
    : SLOT_HOURS;
  const allowedDays = sched?.days && sched.days.length ? sched.days : null;
  const dayAllowed = !date || !allowedDays || allowedDays.includes(new Date(`${date}T12:00:00`).getDay());

  useEffect(() => {
    if (!date) { setDaySlots(null); return; }
    let dead = false;
    setDaySlots(null);
    setHour(null);
    fetch(`/api/services/${service.id}/availability?date=${date}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!dead) setDaySlots(d); })
      .catch(() => { if (!dead) setDaySlots({ dayStatus: "booking_closed", reason: "Couldn't load times — try again.", slots: [] }); });
    return () => { dead = true; };
  }, [date, service.id]);

  const fmtHour = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" });
  const startDate = date && hour != null ? new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`) : null;
  const endDate = startDate ? new Date(startDate.getTime() + durationMin * 60_000) : null;
  const payout = selection?.payout ?? service.price;
  const subtotal = payout + travelFee;
  const fee = Math.round(subtotal * 5) / 100;
  const pkg = pkgId ? menu?.packages.find((p) => p.id === pkgId) : null;
  const toggleAddon = (id: string) =>
    setAddonIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* step 3 → create the shared record: conversation + booking */
  const request = async () => {
    if (!startDate) return;
    setBusy(true);
    setError(null);
    const picked = selection?.lines.slice(1).map((l) => l.label).filter(Boolean) ?? [];
    const convRes = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toHandle: service.owner.handle,
        firstMessage: `Hi ${firstName}! I'd like to book ${pkg ? `${service.title} (${pkg.name})` : service.title} for ${startDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })} at ${fmtHour(hour!)}.${picked.length ? ` Adding: ${picked.join(", ")}.` : ""}${note.trim() ? ` ${note.trim()}` : ""}`,
      }),
    });
    const conv = await convRes.json();
    if (!convRes.ok) {
      setBusy(false);
      setError(conv.error || "Could not reach the provider");
      return;
    }
    setConvId(conv.conversationId);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: service.id,
        startsAt: startDate.toISOString(),
        durationMin,
        packageId: pkgId,
        addonIds: Array.from(addonIds),
        location,
        conversationId: conv.conversationId,
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Could not book");
      return;
    }
    setBookingId(d.id);
    // demo providers accept instantly → straight to payment; real
    // providers leave the request pending
    setStep(d.status === "accepted" ? "pay" : "requested");
  };

  const pay = async () => {
    if (!bookingId) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // the client approves THIS amount — the server refuses if it changed
      body: JSON.stringify({ action: "pay", expectedTotal: +(subtotal + fee).toFixed(2) }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Payment failed");
      return;
    }
    setStep("done");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => !busy && onClose()}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {step === "options" ? "Build your service" : step === "slot" ? "Choose appointment" : step === "review" ? "Booking details" : step === "pay" ? "Demo payment" : step === "done" ? "Confirmed" : "Request sent"}
            </p>
            <h3 className="mt-1 text-sm font-bold text-zinc-100">{service.title}</h3>
            <p className="text-xs text-zinc-500">{service.owner.displayName}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ----------------------- 0 · options (menu) ----------------------- */}
        {step === "options" && menu && (
          <div className="mt-4 space-y-3">
            {/* packages — the creator's own bundles, one tap */}
            {menu.packages.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Choose your service</p>
                <div className="mt-1.5 space-y-1.5">
                  <button
                    onClick={() => setPkgId(null)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition ${
                      pkgId === null ? "border-lime-400/50 bg-lime-400/5" : "border-line hover:border-zinc-600"
                    }`}
                  >
                    <span className={`text-sm font-semibold ${pkgId === null ? "text-lime-300" : "text-zinc-200"}`}>
                      {service.title}
                      <span className="block text-[10px] font-normal text-zinc-500">Base service · {sched?.durationMin ?? 60} min</span>
                    </span>
                    <span className="font-mono text-sm tracking-[0.08em] text-zinc-200">${service.price}</span>
                  </button>
                  {menu.packages.map((p) => {
                    const inclNames = p.includes
                      .map((id) => menu.addons.find((a) => a.id === id)?.name)
                      .filter(Boolean);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setPkgId(p.id)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition ${
                          pkgId === p.id ? "border-lime-400/50 bg-lime-400/5" : "border-line hover:border-zinc-600"
                        }`}
                      >
                        <span className={`text-sm font-semibold ${pkgId === p.id ? "text-lime-300" : "text-zinc-200"}`}>
                          {p.name}
                          {inclNames.length > 0 && (
                            <span className="block text-[10px] font-normal text-zinc-500">Includes {inclNames.join(" + ")}</span>
                          )}
                        </span>
                        <span className="font-mono text-sm tracking-[0.08em] text-zinc-200">${p.price}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* add-ons — priced and timed by the creator */}
            {menu.addons.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Add-ons</p>
                <div className="mt-1.5 space-y-1">
                  {menu.addons.map((a) => {
                    const inPkg = !!pkg && pkg.includes.includes(a.id);
                    const on = a.required || inPkg || addonIds.has(a.id);
                    const priceTxt = a.priceMode === "quote" ? "Quote" : a.priceMode === "starting" ? `from $${a.price}` : `+$${a.price}`;
                    return (
                      <label
                        key={a.id}
                        className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 transition ${
                          on ? "border-lime-400/40 bg-lime-400/5" : "border-line hover:border-zinc-600"
                        } ${a.required || inPkg ? "cursor-default opacity-80" : ""}`}
                      >
                        <span className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={a.required || inPkg}
                            onChange={() => toggleAddon(a.id)}
                            className="accent-lime-400"
                          />
                          <span className="text-xs font-medium text-zinc-200">
                            {a.name}
                            <span className="ml-1.5 text-[10px] font-normal text-zinc-500">
                              {inPkg ? "included in package" : a.required ? "required" : a.timeMin > 0 ? `+${a.timeMin} min` : ""}
                            </span>
                          </span>
                        </span>
                        <span className={`font-mono text-[11px] tracking-[0.08em] ${a.priceMode === "quote" ? "text-amber-300" : "text-zinc-300"}`}>
                          {inPkg ? "—" : priceTxt}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {selection?.hasQuoted && (
              <p className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[11px] leading-relaxed text-amber-300">
                Quote-priced items aren&apos;t charged now — {firstName} prices them with you in the conversation before any extra payment.
              </p>
            )}

            {/* running total — recalculated as you build */}
            <div className="flex items-center justify-between rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
              <span className="text-xs text-zinc-400">
                {durationMin >= 60 ? `${Math.floor(durationMin / 60)}h${durationMin % 60 ? ` ${durationMin % 60}m` : ""}` : `${durationMin} min`} reserved
              </span>
              <span className="font-mono text-sm font-medium tracking-[0.08em] text-lime-300">
                ${payout}{travelFee > 0 ? ` + $${travelFee} travel` : ""}
              </span>
            </div>
            <button onClick={() => setStep("slot")} className="btn-lime w-full justify-center py-2.5 text-sm">
              Continue to date &amp; time
            </button>
          </div>
        )}

        {/* ------------------------- 1 · slot -------------------------
            Two layers, never redundant: the CALENDAR picks the date (or it
            arrived pre-picked from the service page); the TIME GRID picks
            the time. The chosen date persists to the end of the flow. */}
        {step === "slot" && (
          <div className="mt-4 space-y-3">
            {!date || changingDate ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Select a date</p>
                <div className="mt-1.5">
                  <AvailabilityStrip
                    serviceId={service.id}
                    selectedDate={date || null}
                    onSelectDate={(d) => { setDate(d); setChangingDate(false); }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-lime-400/30 bg-lime-400/5 px-3.5 py-2">
                <p className="text-sm font-semibold text-zinc-100">
                  {new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </p>
                <button onClick={() => setChangingDate(true)} className="text-[11px] font-semibold text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">
                  Change date
                </button>
              </div>
            )}
            {date && !changingDate && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Available times</p>
                {daySlots === null ? (
                  <div className="mt-1.5 h-16 animate-pulse rounded-xl bg-card-raised" />
                ) : daySlots.slots.length === 0 ? (
                  <p className="mt-1.5 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs leading-relaxed text-amber-300">
                    {daySlots.reason ?? "No times are available on this day."}
                    {daySlots.opensAt ? ` Bookings open ${new Date(daySlots.opensAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.` : ""}{" "}
                    Pick another date above.
                  </p>
                ) : (
                  <>
                    <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                      {daySlots.slots.map((s) => (
                        <button
                          key={s.hour}
                          disabled={s.status !== "available"}
                          onClick={() => setHour(s.hour)}
                          title={s.reason ?? (s.status === "available" ? "Available" : undefined)}
                          className={`rounded-lg border px-2 py-1.5 font-mono text-xs tracking-[0.05em] transition ${
                            hour === s.hour
                              ? "border-lime-400/50 bg-lime-400/10 text-lime-300"
                              : s.status === "available"
                                ? "border-line text-zinc-400 hover:border-zinc-600"
                                : s.status === "booked"
                                  ? "cursor-not-allowed border-rose-400/25 bg-rose-400/5 text-rose-300/60 line-through"
                                  : "cursor-not-allowed border-line text-zinc-700"
                          }`}
                        >
                          {s.label}
                          {s.status === "booked" ? " · booked" : s.status === "too_soon" ? " · too soon" : ""}
                        </button>
                      ))}
                    </div>
                    {daySlots.slots.every((s) => s.status !== "available") && (
                      <p className="mt-1.5 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs text-amber-300">
                        Every time on this day is taken or too soon — pick another date above.
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-zinc-600">
                      Times come from {firstName}&apos;s real calendar — only bookable slots are selectable.
                    </p>
                  </>
                )}
              </div>
            )}
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (optional)"
              className="w-full rounded-xl border border-line bg-card-raised px-3.5 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50"
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={`Anything ${firstName} should know? (optional)`}
              className="w-full resize-none rounded-xl border border-line bg-card-raised px-3.5 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50"
            />
            <button onClick={() => setStep("review")} disabled={!date || hour == null || !dayAllowed} className="btn-lime w-full justify-center py-2.5 text-sm disabled:opacity-40">
              Continue
            </button>
            {hasMenu && (
              <button onClick={() => setStep("options")} className="btn-ghost w-full justify-center py-2 text-xs">
                Back to options
              </button>
            )}
          </div>
        )}

        {/* ------------------------ 2 · review ------------------------ */}
        {step === "review" && startDate && endDate && (
          <div className="mt-4 space-y-3">
            <dl className="space-y-1.5 rounded-xl border border-line bg-card-raised p-3.5 text-sm">
              <div className="flex justify-between"><dt className="text-zinc-500">Date</dt><dd className="text-zinc-200">{startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Time</dt><dd className="font-mono text-xs tracking-[0.08em] text-zinc-200">{startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – {endDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</dd></div>
              {(selection?.lines ?? [{ label: service.title, amount: service.price }]).map((l, i) => (
                <div key={i} className="flex justify-between">
                  <dt className="text-zinc-500">{l.label}</dt>
                  <dd className={`font-mono tracking-[0.08em] ${l.amount == null ? "text-amber-300" : i === 0 ? "font-medium text-lime-300" : "text-zinc-200"}`}>
                    {l.amount == null ? "Quoted" : `$${l.amount}`}
                  </dd>
                </div>
              ))}
              {travelFee > 0 && service.distanceMi != null && (
                <div className="flex justify-between"><dt className="text-zinc-500">Travel ({service.distanceMi} mi)</dt><dd className="font-mono tracking-[0.08em] text-zinc-200">${travelFee}</dd></div>
              )}
            </dl>
            {/* the creator's actual policies — before any commitment */}
            <div className="rounded-lg border border-line-soft bg-card-raised/50 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{firstName}&apos;s policies</p>
              <ul className="mt-1 space-y-0.5 text-[11px] text-zinc-400">
                {service.config && (
                  <li className="flex items-center gap-1.5">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-zinc-600" /> {travelLabel(service.config.travel)}
                  </li>
                )}
                {(service.config ? policyLines(service.config) : []).map((l) => (
                  <li key={l} className="flex items-center gap-1.5">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-zinc-600" /> {l}
                  </li>
                ))}
                <li className="flex items-center gap-1.5">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-zinc-600" /> Payment secured up front, released after completion
                </li>
              </ul>
            </div>
            {service.travelNote && (
              <p className="text-[11px] text-amber-300">{service.travelNote}</p>
            )}
            {error && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-rose-300">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" /> {error}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep("slot")} className="btn-ghost px-4 py-2 text-xs">Back</button>
              <button onClick={request} disabled={busy} className="btn-lime flex-1 justify-center py-2 text-sm disabled:opacity-40">
                {busy ? "Requesting…" : "Continue to Payment"}
              </button>
            </div>
          </div>
        )}

        {/* ------------------------- 3 · payment ------------------------- */}
        {step === "pay" && (
          <div className="mt-4 space-y-3">
            <p className="rounded-lg border border-violet-400/25 bg-violet-400/5 px-3 py-2 text-[11px] text-zinc-400">
              <span className="font-bold text-violet-300">Demo payment.</span> This is a simulated
              transaction — no real money is charged. {firstName} accepted your request.
            </p>
            <dl className="space-y-1.5 rounded-xl border border-line bg-card-raised p-3.5 text-sm">
              {(selection?.lines ?? [{ label: service.title, amount: service.price }]).map((l, i) => (
                <div key={i} className="flex justify-between">
                  <dt className="text-zinc-500">{l.label}</dt>
                  <dd className={`font-mono tracking-[0.08em] ${l.amount == null ? "text-amber-300" : "text-zinc-200"}`}>
                    {l.amount == null ? "Quoted later" : `$${l.amount.toFixed(2)}`}
                  </dd>
                </div>
              ))}
              {travelFee > 0 && (
                <div className="flex justify-between"><dt className="text-zinc-500">Travel{service.distanceMi != null ? ` (${service.distanceMi} mi)` : ""}</dt><dd className="font-mono tracking-[0.08em] text-zinc-200">${travelFee.toFixed(2)}</dd></div>
              )}
              <div className="flex justify-between"><dt className="text-zinc-500">Mavyn fee (5%)</dt><dd className="font-mono tracking-[0.08em] text-zinc-200">${fee.toFixed(2)}</dd></div>
              <div className="flex justify-between border-t border-dashed border-line pt-1.5 font-semibold"><dt className="text-zinc-200">Total</dt><dd className="font-mono tracking-[0.08em] text-lime-300">${(subtotal + fee).toFixed(2)}</dd></div>
            </dl>
            {error && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-rose-300">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" /> {error}
              </p>
            )}
            <button onClick={pay} disabled={busy} className="btn-lime w-full justify-center py-2.5 text-sm disabled:opacity-40">
              {busy ? "Processing…" : `Pay $${(subtotal + fee).toFixed(2)}`}
            </button>
          </div>
        )}

        {/* ------------------------- 4 · secured ------------------------- */}
        {step === "done" && (
          <div className="mt-4 space-y-3 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-lime-400/40 bg-lime-400/10">
              <CalendarDays className="h-6 w-6 text-lime-300" />
            </span>
            <div>
              <h4 className="text-sm font-bold text-lime-300">Payment secured</h4>
              <p className="mx-auto mt-1 max-w-[260px] text-xs leading-relaxed text-zinc-400">
                ${(subtotal + fee).toFixed(2)} secured{travelFee > 0 ? ` (incl. $${travelFee} travel)` : ""} until the booking is completed. You&apos;re confirmed
                {startDate && ` for ${startDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`}.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => router.push("/calendar")} className="btn-lime flex-1 justify-center py-2 text-xs">View Booking</button>
              <button onClick={() => router.push(convId ? `/messages?c=${convId}` : "/messages")} className="btn-ghost flex-1 justify-center py-2 text-xs">
                Message {firstName}
              </button>
            </div>
          </div>
        )}

        {/* --------------------- request sent (real provider) --------------------- */}
        {step === "requested" && (
          <div className="mt-4 space-y-3 text-center">
            <h4 className="text-sm font-bold text-zinc-100">Request sent</h4>
            <p className="mx-auto max-w-[260px] text-xs leading-relaxed text-zinc-400">
              {firstName} has to accept before you pay. You&apos;ll get a notification the moment they respond.
            </p>
            <div className="flex gap-2">
              <button onClick={() => router.push("/calendar")} className="btn-lime flex-1 justify-center py-2 text-xs">View in Bookings</button>
              <button onClick={() => router.push(convId ? `/messages?c=${convId}` : "/messages")} className="btn-ghost flex-1 justify-center py-2 text-xs">Open conversation</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ hire wizard ------------------------------ */
/* Adaptive intake — the form matches the job, not a universal template:
     · simple   — most services: what you need, when, anything else
     · detailed — bigger builds (>= $500): scope, materials, deadline, budget
     · care     — trust services: date, duration, who's being cared for
   Profile info is never re-asked. Deeper details come AFTER the provider
   responds (progressive disclosure) — the project brief starts the talk. */

type IntakePreset = "simple" | "detailed" | "care";

function presetFor(s: ServiceItem): IntakePreset {
  if (["care", "beauty"].includes(s.category)) return "care";
  if (s.price >= 500) return "detailed";
  return "simple";
}

const TIMING = [
  { l: "This week", days: 7 },
  { l: "Within 2 weeks", days: 14 },
  { l: "This month", days: 30 },
  { l: "Flexible", days: 0 },
] as const;

function HireWizard({ service, onClose }: { service: ServiceItem; onClose: () => void }) {
  const router = useRouter();
  const preset = presetFor(service);
  const firstName = service.owner.displayName.split(" ")[0];

  const [needs, setNeeds] = useState("");
  const [timing, setTiming] = useState<string | null>(null);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [extra, setExtra] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const [budget, setBudget] = useState(String(service.price));
  const [editBudget, setEditBudget] = useState(false);
  const [references, setReferences] = useState("");
  // detailed preset
  const [scope, setScope] = useState<string[]>([]);
  const [materials, setMaterials] = useState<string[]>([]);
  // care preset
  const [duration, setDuration] = useState<string | null>(null);
  const [careInfo, setCareInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const scopeOptions = ["design", "web", "development"].some((k) => service.category.includes(k) || service.title.toLowerCase().includes(k))
    ? ["Design", "Development", "Both", "Not sure"]
    : ["Full project", "Part of a project", "Consultation", "Not sure"];
  const materialOptions = ["Logo", "Brand guidelines", "Content", "Domain", "Nothing yet"];
  const budgetRanges = [
    { l: `$${service.price} (listed)`, v: service.price },
    { l: `$${service.price}–${service.price * 2}`, v: Math.round(service.price * 1.5) },
    { l: `$${service.price * 2}–${Math.round(service.price * 3.5)}`, v: Math.round(service.price * 2.5) },
    { l: `$${Math.round(service.price * 3.5)}+`, v: Math.round(service.price * 4) },
  ];

  const send = async () => {
    if (!needs.trim()) {
      setError(preset === "care" ? `Tell ${firstName} who they'll be caring for` : "Describe what you're looking for");
      return;
    }
    if (preset === "care" && !deadlineDate) {
      setError("Pick the date you need");
      return;
    }
    setBusy(true);
    setError(null);

    const timingDays = TIMING.find((t) => t.l === timing)?.days ?? 0;
    const deadline =
      deadlineDate ||
      (timingDays > 0 ? new Date(Date.now() + timingDays * 86400_000).toISOString().slice(0, 10) : "");

    const briefParts = [
      needs.trim(),
      scope.length ? `Looking for: ${scope.join(", ")}` : "",
      materials.length ? `Existing materials: ${materials.join(", ")}` : "",
      duration ? `Duration: ${duration}` : "",
      careInfo.trim() ? `Details: ${careInfo.trim()}` : "",
      timing && !deadlineDate ? `Timing: ${timing}` : "",
      references.trim() ? `References: ${references.trim()}` : "",
      extra.trim() ? `Notes: ${extra.trim()}` : "",
    ].filter(Boolean);

    const convRes = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toHandle: service.owner.handle,
        firstMessage: `Hi ${firstName}! I'd like to hire you for ${service.title}. ${needs.trim()}`,
      }),
    });
    const conv = await convRes.json();
    if (!convRes.ok) {
      setBusy(false);
      setError(conv.error || "Could not open the conversation");
      return;
    }
    const projRes = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorHandle: service.owner.handle,
        serviceId: service.id,
        conversationId: conv.conversationId,
        title: service.title,
        amount: Number(budget) || service.price,
        brief: briefParts.join("\n"),
        deadline: deadline || undefined,
      }),
    });
    const proj = await projRes.json();
    setBusy(false);
    if (!projRes.ok) {
      setError(proj.error || "Could not create the request");
      return;
    }
    router.push(`/messages?c=${conv.conversationId}`);
  };

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-medium transition ${
      active ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Hire {service.owner.displayName}</h3>
            <p className="mt-0.5 text-xs text-zinc-400">
              {service.title} · starting at{" "}
              <span className="font-mono font-medium tracking-[0.08em] text-lime-300">${service.price}</span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* trust banner for care services — verification is the provider's, shown as a badge only */}
        {preset === "care" && (
          <p className="mt-3 flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-400/5 px-3.5 py-2 text-xs text-zinc-400">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
            {service.trustRequired === "high-trust"
              ? `${firstName} is identity-verified for trust services.`
              : `Trust service — extra details help ${firstName} say yes faster.`}
          </p>
        )}

        <div className="mt-4 space-y-3">
          {/* 1 · what you need — every preset */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
              {preset === "care" ? `Who or what needs care?` : "What are you looking for?"}
            </p>
            <textarea
              value={needs}
              onChange={(e) => setNeeds(e.target.value)}
              rows={3}
              placeholder={
                preset === "care"
                  ? `e.g. "Two dogs — a calm lab and an energetic corgi. Midday walks near Towson."`
                  : `Tell ${firstName} what you need and what you're trying to accomplish.`
              }
              className="mt-1.5 w-full resize-none rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50"
            />
          </div>

          {/* detailed: scope + materials */}
          {preset === "detailed" && (
            <>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">What do you need?</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {scopeOptions.map((o) => (
                    <button key={o} onClick={() => toggle(scope, setScope, o)} className={chip(scope.includes(o))}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Do you have existing materials?</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {materialOptions.map((o) => (
                    <button key={o} onClick={() => toggle(materials, setMaterials, o)} className={chip(materials.includes(o))}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* care: duration */}
          {preset === "care" && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Approximate duration</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {["30 min", "1 hour", "2+ hours", "Overnight", "Recurring"].map((o) => (
                  <button key={o} onClick={() => setDuration(duration === o ? null : o)} className={chip(duration === o)}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2 · timing */}
          {preset === "simple" ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">When do you need it?</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {TIMING.map((t) => (
                  <button key={t.l} onClick={() => setTiming(timing === t.l ? null : t.l)} className={chip(timing === t.l)}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                {preset === "care" ? "What date?" : "Target deadline"}
              </p>
              <input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-card-raised px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-lime-400/50"
              />
            </div>
          )}

          {/* detailed: budget ranges */}
          {preset === "detailed" && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Budget</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {budgetRanges.map((b) => (
                  <button key={b.l} onClick={() => setBudget(String(b.v))} className={chip(Number(budget) === b.v)}>
                    {b.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* care: special requirements */}
          {preset === "care" && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                Special requirements <span className="font-normal normal-case text-zinc-600">(optional)</span>
              </p>
              <input
                value={careInfo}
                onChange={(e) => setCareInfo(e.target.value)}
                placeholder="Medication, gate codes to share later, quirks…"
                className="mt-1.5 w-full rounded-xl border border-line bg-card-raised px-3.5 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50"
              />
            </div>
          )}

          {/* references — optional, one line */}
          <input
            value={references}
            onChange={(e) => setReferences(e.target.value)}
            placeholder="Link to references or examples (optional)"
            className="w-full rounded-xl border border-line bg-card-raised px-3.5 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50"
          />

          {/* anything else — progressive */}
          {!showExtra ? (
            <button onClick={() => setShowExtra(true)} className="text-xs font-medium text-zinc-500 hover:text-zinc-300">
              + Anything else? (optional)
            </button>
          ) : (
            <textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              rows={2}
              autoFocus
              placeholder="Anything else…"
              className="w-full resize-none rounded-xl border border-line bg-card-raised px-3.5 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50"
            />
          )}

          {/* budget line — visible, editable, never a surprise */}
          <div className="flex items-center justify-between rounded-xl border border-line-soft bg-card-raised/50 px-3.5 py-2">
            <p className="text-xs text-zinc-500">
              Budget{" "}
              <span className="font-mono font-medium tracking-[0.08em] text-lime-300">${budget || 0}</span>
              <span className="text-zinc-600"> · you pay ${(Number(budget || 0) * 1.05).toFixed(2)} incl. 5% fee</span>
            </p>
            {!editBudget ? (
              <button onClick={() => setEditBudget(true)} className="text-[11px] font-semibold text-violet-300 hover:underline">
                Change
              </button>
            ) : (
              <input
                value={budget}
                onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))}
                autoFocus
                className="w-20 rounded-lg border border-line bg-card px-2 py-1 text-right font-mono text-xs text-zinc-100 outline-none"
              />
            )}
          </div>

          <p className="text-[10px] leading-relaxed text-zinc-600">
            {firstName} reviews your request and sends the offer — you only pay after you accept it.
            Finer details get worked out in the conversation.
          </p>

          {error && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-rose-300">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" /> {error}
            </p>
          )}

          <button onClick={send} disabled={busy || !needs.trim()} className="btn-lime w-full justify-center py-2.5 text-sm disabled:opacity-40">
            {busy ? "Sending…" : "Send Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
