"use client";

/* ------------------------------------------------------------------ */
/*  Event Setup — the organizer chooses the model, Mavyn provides the */
/*  tools. THE FIRST CHOICE IS SCOPE:                                  */
/*    · Campus event → lives in Your Campus, visible to your school's  */
/*      verified members only. On-campus / school-associated things.   */
/*    · Public event → the wider world: the main Events section with   */
/*      categories and nearby discovery.                               */
/*  Server-enforced: campus events never leak into public Events.      */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import LocationPicker, { EMPTY_GEO_LOCATION, GeoLocationValue } from "@/components/LocationPicker";
import Link from "next/link";
import { ArrowLeft, Check, PartyPopper, GraduationCap, Globe } from "lucide-react";
import { useSession } from "@/lib/session";
import { EVENT_CATEGORIES, CAMPUS_EVENT_CATEGORIES, EVENT_KINDS, AGE_RULES } from "@/lib/events";

const fieldOptions = ["Full name", "Email", "Phone number", "Username", "Organization / company", "Additional question"];

export default function CreateEventPage() {
  const { user } = useSession();
  const [campusInfo, setCampusInfo] = useState<{ campusName: string } | null>(null);

  const [scope, setScope] = useState<"public" | "campus">("public");
  const [publicListing, setPublicListing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("Networking");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [venue, setVenue] = useState("");
  // one cascading location system (same picker as profiles) — the
  // server validates the chain and derives the display strings
  const [geoLoc, setGeoLoc] = useState<GeoLocationValue>(EMPTY_GEO_LOCATION);
  const [age, setAge] = useState("all");
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState(25);
  const [reg, setReg] = useState("rsvp");
  const [capacity, setCapacity] = useState<string>("100");
  const [waitlist, setWaitlist] = useState(true);
  const [fields, setFields] = useState<string[]>(["Full name"]);
  const [rules, setRules] = useState("No harassment\nCheck-in required");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [published, setPublished] = useState<{ slug: string; campus: boolean } | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/campus/verify").then(async (r) => {
      if (r.ok) {
        const j = await r.json();
        if (j.verified) setCampusInfo({ campusName: j.campusName });
      }
    });
  }, [user]);

  const cats = scope === "campus" ? CAMPUS_EVENT_CATEGORIES : EVENT_CATEGORIES;
  const effectiveReg = paid ? "ticket" : reg === "ticket" ? "rsvp" : reg;

  const toggleField = (f: string) =>
    setFields((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  const submit = async () => {
    setErr(null);
    setBusy(true);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: name,
        description,
        campus: scope === "campus",
        publicVisibility: scope === "campus" && publicListing,
        category: cats.includes(category as never) ? category : "Other",
        startsAt: date && time ? `${date}T${time}` : "",
        venue,
        // display strings derived from the picker; `geo` is the
        // validated chain the server re-checks relationally
        city: geoLoc.cityName,
        state: geoLoc.stateName && /^[A-Z]{2,3}$/.test(geoLoc.stateId.split("-").pop() || "") ? geoLoc.stateId.split("-").pop() : geoLoc.stateName,
        geo: { countryCode: geoLoc.countryCode, stateId: geoLoc.stateId, countyId: geoLoc.countyId, cityId: geoLoc.cityId },
        kind: effectiveReg,
        price: paid ? price : null,
        capacity: capacity || null,
        ageRule: age,
        fields: effectiveReg === "registration" ? fields : [],
        rules: rules.split("\n").map((r) => r.trim()).filter(Boolean),
        waitlist,
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(j.error || "Couldn't publish the event");
    setPublished({ slug: j.slug, campus: j.campus });
  };

  const input =
    "w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-amber-400/40";

  if (published) {
    return (
      <div className="mx-auto max-w-md pt-10 text-center">
        <PartyPopper className="mx-auto h-10 w-10 text-amber-400" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-50">{name || "Your event"} is live</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {published.campus
            ? "Published to Your Campus — visible to your school's verified members. It won't appear in the public Events section."
            : "Published to Events — discoverable by category, search, and nearby filters."}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href={`/events/${published.slug}`} className="rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-zinc-950 hover:bg-amber-300">
            View event
          </Link>
          <Link href={published.campus ? "/campus" : "/events"} className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-semibold text-zinc-300">
            {published.campus ? "Your Campus" : "All events"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="px-1">
        <Link href="/events" className="mb-2 inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.1em] text-zinc-500 hover:text-amber-300">
          <ArrowLeft className="h-3 w-3" /> EVENTS
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Create an event</h1>
        <p className="mt-1 text-sm text-zinc-500">You choose the model — free meetup to ticketed night. Nothing is forced.</p>
      </header>

      {err && <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-300">{err}</div>}

      {/* ---------------- scope: campus vs the wider world ---------------- */}
      <section className="card-event space-y-2.5 p-4">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Where does this event belong?</h2>
        <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition ${scope === "public" ? "border-amber-400/50 bg-amber-400/5" : "border-zinc-800 hover:border-zinc-700"}`}>
          <input type="radio" checked={scope === "public"} onChange={() => { setScope("public"); setCategory("Networking"); }} className="mt-0.5 accent-amber-400" />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200"><Globe className="h-4 w-4 text-amber-400" /> Public event — the wider world</span>
            <span className="block text-xs text-zinc-500">Parties, concerts, workshops, markets. Discoverable in Events by category, search, and nearby filters.</span>
          </span>
        </label>
        <label className={`flex items-start gap-2.5 rounded-lg border p-3 transition ${campusInfo ? "cursor-pointer" : "opacity-50"} ${scope === "campus" ? "border-amber-400/50 bg-amber-400/5" : "border-zinc-800 hover:border-zinc-700"}`}>
          <input type="radio" disabled={!campusInfo} checked={scope === "campus"} onChange={() => { setScope("campus"); setCategory("Campus Social"); }} className="mt-0.5 accent-amber-400" />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
              <GraduationCap className="h-4 w-4 text-amber-400" /> Campus event{campusInfo ? ` — ${campusInfo.campusName}` : ""}
            </span>
            <span className="block text-xs text-zinc-500">
              On campus or directly school-associated. Lives in Your Campus for your school&apos;s
              verified members.{!campusInfo && " Verify your school in Your Campus to unlock this."}
            </span>
          </span>
        </label>
        {scope === "campus" && (
          <label className="ml-7 flex cursor-pointer items-start gap-2.5 rounded-lg border border-line p-3 transition hover:border-zinc-600">
            <input type="checkbox" checked={publicListing} onChange={(e) => setPublicListing(e.target.checked)} className="mt-0.5 accent-amber-400" />
            <span>
              <span className="text-sm font-semibold text-zinc-200">Also list publicly (info only)</span>
              <span className="block text-xs leading-relaxed text-zinc-500">
                VISIBILITY ≠ ELIGIBILITY: anyone can see the event in the public section, badged
                &quot;{campusInfo?.campusName ?? "Campus"} members&quot; — but RSVP stays restricted to your school&apos;s
                verified members. Off = campus-only, invisible outside Your Campus.
              </span>
            </span>
          </label>
        )}
      </section>

      {/* ---------------- basics ---------------- */}
      <section className="card-event space-y-4 p-4">
        <div>
          <label className="mb-1 block font-mono text-[10px] tracking-[0.14em] text-zinc-500">EVENT NAME</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={scope === "campus" ? "Homecoming Kickback" : "Golden Hour Photo Walk"} className={input} />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] tracking-[0.14em] text-zinc-500">DESCRIPTION</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What's happening, who it's for, what to bring…" className={input} />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] tracking-[0.14em] text-zinc-500">CATEGORY</label>
          <div className="flex flex-wrap gap-1.5">
            {cats.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={`rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.08em] transition ${category === c ? "bg-amber-400 font-bold text-zinc-950" : "border border-zinc-800 text-zinc-400 hover:border-amber-400/40"}`}>
                {c.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-mono text-[10px] tracking-[0.14em] text-zinc-500">DATE</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] tracking-[0.14em] text-zinc-500">START TIME</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
          </div>
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] tracking-[0.14em] text-zinc-500">
            {scope === "campus" ? "WHERE ON CAMPUS" : "VENUE"}
          </label>
          <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder={scope === "campus" ? "Student Center Ballroom" : "The Assembly Room"} className={input} />
        </div>
        {scope === "public" && (
          <div>
            <label className="mb-1 block font-mono text-[10px] tracking-[0.14em] text-zinc-500">WHERE — COUNTRY, STATE, CITY</label>
            <LocationPicker value={geoLoc} onChange={setGeoLoc} showCounty={false} />
          </div>
        )}
      </section>

      {/* ---------------- model ---------------- */}
      <section className="card-event space-y-3 p-4">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Entry model</h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="accent-amber-400" />
          Paid event
        </label>
        {paid ? (
          <div className="flex items-center gap-3">
            <label className="font-mono text-[10px] tracking-[0.14em] text-zinc-500">TICKET PRICE $</label>
            <input type="number" min={1} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-28 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-amber-400/40" />
            <span className="text-[11px] text-zinc-600">Ticket checkout ships with the payments pass — attendees can save the event meanwhile.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {EVENT_KINDS.filter((k) => k.id !== "ticket").map((k) => (
              <label key={k.id} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition ${reg === k.id ? "border-amber-400/50 bg-amber-400/5" : "border-zinc-800 hover:border-zinc-700"}`}>
                <input type="radio" checked={reg === k.id} onChange={() => setReg(k.id)} className="mt-0.5 accent-amber-400" />
                <span>
                  <span className="block text-sm font-semibold text-zinc-200">{k.label}</span>
                  <span className="block text-xs text-zinc-500">{k.desc}</span>
                </span>
              </label>
            ))}
          </div>
        )}
        {effectiveReg === "registration" && (
          <div>
            <p className="mb-1.5 font-mono text-[10px] tracking-[0.14em] text-zinc-500">REGISTRATION FIELDS</p>
            <div className="flex flex-wrap gap-1.5">
              {fieldOptions.map((f) => (
                <button key={f} onClick={() => toggleField(f)} className={`rounded-full px-3 py-1 text-[11px] transition ${fields.includes(f) ? "bg-amber-400/20 font-semibold text-amber-200" : "border border-zinc-800 text-zinc-400"}`}>
                  {fields.includes(f) && <Check className="mr-1 inline h-3 w-3" />}{f}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block font-mono text-[10px] tracking-[0.14em] text-zinc-500">CAPACITY (OPTIONAL)</label>
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} className={input} />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] tracking-[0.14em] text-zinc-500">AGE RULE</label>
            <select value={age} onChange={(e) => setAge(e.target.value)} className={input}>
              {AGE_RULES.map((a) => (
                <option key={a} value={a}>{a === "all" ? "All ages" : a}</option>
              ))}
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 pt-5 text-sm text-zinc-300">
            <input type="checkbox" checked={waitlist} onChange={(e) => setWaitlist(e.target.checked)} className="accent-amber-400" />
            Waitlist when full
          </label>
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] tracking-[0.14em] text-zinc-500">EVENT RULES (ONE PER LINE)</label>
          <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={2} className={input} />
        </div>
      </section>

      <button
        disabled={busy || name.trim().length < 3 || !date || !venue.trim()}
        onClick={() => void submit()}
        className="w-full rounded-full bg-amber-400 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-40"
      >
        {busy ? "Publishing…" : scope === "campus" ? "Publish to Your Campus" : "Publish event"}
      </button>
    </div>
  );
}
