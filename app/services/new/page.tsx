"use client";

/* ------------------------------------------------------------------ */
/*  Create a service — the configurable service engine.                */
/*  Seven questions, one listing: what you offer, how it's fulfilled,  */
/*  where it happens, what you charge (incl. travel), how scheduling   */
/*  works, what your policies are, and what the customer provides.     */
/*  UpNova compiles these choices into the customer-facing flow —      */
/*  every fee and policy is disclosed before payment.                  */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import {
  type ServiceConfig,
  DEFAULT_CONFIG,
  LOCATION_LABEL,
  travelLabel,
  policyLines,
} from "@/lib/servicePolicies";

const inputCls =
  "w-full rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-lime-400/50";

const CATEGORIES = ["creative", "music", "photography", "video", "design", "beauty", "care", "fashion", "events", "education"];
const REQUIREMENT_OPTIONS = ["References", "Photos", "Measurements", "Project brief", "Special instructions"];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        on ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"
      }`}
    >
      {children}
    </button>
  );
}

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-100">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-lime-400/10 font-mono text-[10px] font-semibold text-lime-300">
          {n}
        </span>
        {title}
      </h2>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function NewServicePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("creative");
  const [fulfillment, setFulfillment] = useState<"appointment" | "project" | "quote">("appointment");
  const [config, setConfig] = useState<ServiceConfig>(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setTravel = (patch: Partial<ServiceConfig["travel"]>) =>
    setConfig((c) => ({ ...c, travel: { ...c.travel, ...patch } }));
  const setPolicies = (patch: Partial<ServiceConfig["policies"]>) =>
    setConfig((c) => ({ ...c, policies: { ...c.policies, ...patch } }));
  const setScheduling = (patch: Partial<ServiceConfig["scheduling"]>) =>
    setConfig((c) => ({ ...c, scheduling: { ...c.scheduling, ...patch } }));

  const travelRelevant = ["client_location", "both", "flexible"].includes(config.locationMode);

  const submit = async () => {
    if (!title.trim() || !price) {
      setError("A title and base price are required");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        price: Number(price),
        category,
        fulfillment,
        reach: config.travel.radiusMi ? `${config.travel.radiusMi} mi radius` : config.locationMode === "remote" ? "Remote" : "Local",
        config,
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Could not create the service");
      if (res.status === 401) router.push("/login");
      return;
    }
    router.push("/services");
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-10">
      <div>
        <Link href="/services" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Services
        </Link>
        <h1 className="mt-2 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
            <Sparkles className="h-5 w-5 text-lime-400" />
          </span>
          Create a service
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          You decide how your business operates — UpNova builds the booking experience from your rules.
        </p>
      </div>

      <Section n={1} title="What are you offering?">
        <div className="space-y-2.5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Service name — e.g. Mobile Hair Service" className={inputCls} maxLength={80} />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What's included?" className={`${inputCls} resize-none`} />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-32">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
              <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Base price" className={`${inputCls} pl-7`} />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputCls} w-auto capitalize`}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="text-[11px] text-zinc-600">Your price is your payout — buyers pay the 5% fee on top.</span>
          </div>
        </div>
      </Section>

      <Section n={2} title="How is it fulfilled?" hint="This decides the customer's flow and the button they see.">
        <div className="flex flex-wrap gap-1.5">
          <Chip on={fulfillment === "appointment"} onClick={() => setFulfillment("appointment")}>Appointment — time slots</Chip>
          <Chip on={fulfillment === "project"} onClick={() => setFulfillment("project")}>Project — request & deliver</Chip>
          <Chip on={fulfillment === "quote"} onClick={() => setFulfillment("quote")}>Quote — price after discussion</Chip>
        </div>
      </Section>

      <Section n={3} title="Where does it happen?">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(LOCATION_LABEL) as (keyof typeof LOCATION_LABEL)[]).map((m) => (
            <Chip key={m} on={config.locationMode === m} onClick={() => setConfig((c) => ({ ...c, locationMode: m }))}>
              {LOCATION_LABEL[m]}
            </Chip>
          ))}
        </div>
      </Section>

      <Section n={4} title="Travel & service area" hint={travelRelevant ? "Your rules — free, flat, per mile, or quoted. Never dictated by UpNova." : "Travel doesn't apply to this location setting."}>
        {travelRelevant ? (
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {([
                ["none", "No travel offered"],
                ["free", "Free travel"],
                ["flat", "Flat travel fee"],
                ["per_mile", "Fee by distance"],
                ["quote", "Custom quote"],
              ] as const).map(([m, l]) => (
                <Chip key={m} on={config.travel.mode === m} onClick={() => setTravel({ mode: m })}>{l}</Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {config.travel.mode === "flat" && (
                <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                  Fee $<input value={config.travel.flatFee ?? ""} onChange={(e) => setTravel({ flatFee: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} className={`${inputCls} w-20 py-1.5`} />
                </label>
              )}
              {config.travel.mode === "per_mile" && (
                <>
                  <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                    $<input value={config.travel.perMile ?? ""} onChange={(e) => setTravel({ perMile: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} className={`${inputCls} w-16 py-1.5`} />/mile
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                    after<input value={config.travel.freeMiles ?? ""} onChange={(e) => setTravel({ freeMiles: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} className={`${inputCls} w-16 py-1.5`} />mi
                  </label>
                </>
              )}
              {config.travel.mode !== "none" && (
                <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                  Service radius<input value={config.travel.radiusMi ?? ""} onChange={(e) => setTravel({ radiusMi: Number(e.target.value.replace(/[^0-9]/g, "")) || undefined })} placeholder="mi" className={`${inputCls} w-16 py-1.5`} />mi
                </label>
              )}
            </div>
            <p className="rounded-lg border border-line-soft bg-card-raised/50 px-3 py-2 text-xs text-zinc-500">
              Customers see: <span className="font-medium text-zinc-300">{travelLabel(config.travel)}</span>
              {config.travel.mode === "per_mile" && " — UpNova calculates the exact fee from their distance."}
            </p>
          </div>
        ) : (
          <p className="text-xs text-zinc-600">—</p>
        )}
      </Section>

      {fulfillment === "appointment" && (
        <Section n={5} title="Scheduling" hint="Duration per booking and how many you'll take per day.">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              Duration
              <select
                value={config.scheduling.durationMin}
                onChange={(e) => setScheduling({ durationMin: Number(e.target.value) })}
                className={`${inputCls} w-auto py-1.5`}
              >
                {[30, 45, 60, 90, 120, 180, 240].map((m) => (
                  <option key={m} value={m}>{m >= 60 ? `${m / 60} hr${m > 60 ? "s" : ""}` : `${m} min`}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              Max bookings/day
              <input
                value={config.scheduling.maxPerDay ?? ""}
                onChange={(e) => setScheduling({ maxPerDay: Number(e.target.value.replace(/[^0-9]/g, "")) || undefined })}
                placeholder="∞"
                className={`${inputCls} w-16 py-1.5`}
              />
            </label>
          </div>
        </Section>
      )}

      <Section n={fulfillment === "appointment" ? 6 : 5} title="Your policies" hint="Shown to every customer BEFORE they pay — no surprise fees, ever.">
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Cancellation</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                ["anytime", "Free anytime"],
                ["free_24h", "Free up to 24h before"],
                ["partial_48h", "Full 48h+ · 50% after"],
                ["custom", "Custom"],
              ] as const).map(([v, l]) => (
                <Chip key={v} on={config.policies.cancellation === v} onClick={() => setPolicies({ cancellation: v })}>{l}</Chip>
              ))}
            </div>
            {config.policies.cancellation === "custom" && (
              <input
                value={config.policies.cancellationNote ?? ""}
                onChange={(e) => setPolicies({ cancellationNote: e.target.value })}
                placeholder="Describe your policy"
                className={`${inputCls} mt-2`}
                maxLength={160}
              />
            )}
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Rescheduling</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                ["free", "Free"],
                ["one_free", "One free"],
                ["fee", "Fee"],
                ["approval", "Needs approval"],
              ] as const).map(([v, l]) => (
                <Chip key={v} on={config.policies.reschedule === v} onClick={() => setPolicies({ reschedule: v })}>{l}</Chip>
              ))}
              {config.policies.reschedule === "fee" && (
                <label className="flex items-center gap-1 text-xs text-zinc-400">
                  $<input value={config.policies.rescheduleFee ?? ""} onChange={(e) => setPolicies({ rescheduleFee: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} className={`${inputCls} w-16 py-1`} />
                </label>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              Grace period
              <select value={config.policies.lateGraceMin} onChange={(e) => setPolicies({ lateGraceMin: Number(e.target.value) })} className={`${inputCls} w-auto py-1.5`}>
                {[0, 5, 10, 15, 30].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              Late fee $<input value={config.policies.lateFee || ""} onChange={(e) => setPolicies({ lateFee: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} placeholder="0" className={`${inputCls} w-16 py-1.5`} />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              No-show
              <select value={config.policies.noShow} onChange={(e) => setPolicies({ noShow: e.target.value as ServiceConfig["policies"]["noShow"] })} className={`${inputCls} w-auto py-1.5`}>
                <option value="none">No charge</option>
                <option value="partial">50% charge</option>
                <option value="full">Full charge</option>
              </select>
            </label>
          </div>
          <div className="rounded-lg border border-line-soft bg-card-raised/50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Customers will see</p>
            <ul className="mt-1 space-y-0.5 text-xs text-zinc-400">
              {policyLines(config).map((l) => (
                <li key={l} className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-zinc-600" /> {l}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section n={fulfillment === "appointment" ? 7 : 6} title="What does the customer provide?" hint="Only ask for what you actually need.">
        <div className="flex flex-wrap gap-1.5">
          {REQUIREMENT_OPTIONS.map((r) => (
            <Chip
              key={r}
              on={config.requirements.includes(r)}
              onClick={() =>
                setConfig((c) => ({
                  ...c,
                  requirements: c.requirements.includes(r) ? c.requirements.filter((x) => x !== r) : [...c.requirements, r],
                }))
              }
            >
              {r}
            </Chip>
          ))}
        </div>
      </Section>

      {error && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-rose-300">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Link href="/services" className="btn-ghost px-4 py-2 text-sm">Cancel</Link>
        <button onClick={submit} disabled={busy} className="btn-lime px-5 py-2 text-sm disabled:opacity-50">
          {busy ? "Publishing…" : "Publish service"}
        </button>
      </div>
    </div>
  );
}
