"use client";

/* ------------------------------------------------------------------ */
/*  Create Service — a dynamic wizard, not a business application      */
/*  form. "Tell us what you're offering, and we'll build the listing   */
/*  around it."                                                        */
/*                                                                     */
/*  The architecture rule:                                             */
/*    Category           = recommendations/defaults only               */
/*    Fulfillment model  = determines the workflow + next questions    */
/*    Creator settings   = determine the actual service                */
/*  Retwist → Beauty + Appointment. Logo → Design + Project. Same      */
/*  underlying Service system, never 20 hard-coded forms.              */
/* ------------------------------------------------------------------ */

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Sparkles, ImagePlus, X, Check, MapPin, BadgeCheck, Plus } from "lucide-react";
import { useSession } from "@/lib/session";
import ShareSheet from "@/components/ShareSheet";
import {
  type ServiceConfig,
  type ServiceMenu,
  type MenuAddon,
  type MenuPackage,
  DEFAULT_CONFIG,
  EMPTY_MENU,
  LOCATION_LABEL,
  travelLabel,
  policyLines,
  priceLabel,
  availabilityLabel,
  DAY_LABELS,
  OFFICIAL_CATEGORIES,
  normalizeCategory,
  VISIBILITY_OPTIONS,
  type ServiceVisibility,
} from "@/lib/servicePolicies";

const inputCls =
  "w-full rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-lime-400/50";

const CATEGORIES = [...OFFICIAL_CATEGORIES];

/* category → sensible defaults. Suggestions only — never a different system. */
const CATEGORY_DEFAULTS: Record<string, { fulfillment: "appointment" | "project" | "quote"; durationMin: number }> = {
  beauty: { fulfillment: "appointment", durationMin: 90 },
  care: { fulfillment: "appointment", durationMin: 60 },
  photography: { fulfillment: "appointment", durationMin: 120 },
  education: { fulfillment: "appointment", durationMin: 60 },
  events: { fulfillment: "appointment", durationMin: 240 },
  music: { fulfillment: "project", durationMin: 60 },
  design: { fulfillment: "project", durationMin: 60 },
  video: { fulfillment: "project", durationMin: 60 },
  fashion: { fulfillment: "project", durationMin: 60 },
  creative: { fulfillment: "project", durationMin: 60 },
};

const HIGH_TRUST_CATEGORIES = ["care"];

const STEPS = ["Service", "Fulfillment", "Availability", "Location", "Pricing & policies", "Service menu", "Show your work", "Preview"];

function readImage(file: File, maxW: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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

export default function NewServicePage() {
  const router = useRouter();
  const { user } = useSession();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("creative");
  const [customMode, setCustomMode] = useState(false);
  const [customCat, setCustomCat] = useState("");
  const [visibility, setVisibility] = useState<ServiceVisibility>("public");
  const [fulfillment, setFulfillment] = useState<"appointment" | "project" | "quote">("project");
  const [config, setConfig] = useState<ServiceConfig>(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
  const [media, setMedia] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [liveId, setLiveId] = useState<string | null>(null);
  // publishing IS the feed presence — one canonical service, one linked
  // post (Share to feed, default ON; the CTA opens the real listing)
  const [shareToFeed, setShareToFeed] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  const setTravel = (patch: Partial<ServiceConfig["travel"]>) => setConfig((c) => ({ ...c, travel: { ...c.travel, ...patch } }));
  const setPolicies = (patch: Partial<ServiceConfig["policies"]>) => setConfig((c) => ({ ...c, policies: { ...c.policies, ...patch } }));
  const setScheduling = (patch: Partial<ServiceConfig["scheduling"]>) => setConfig((c) => ({ ...c, scheduling: { ...c.scheduling, ...patch } }));
  const setPricing = (patch: Partial<NonNullable<ServiceConfig["pricing"]>>) =>
    setConfig((c) => ({ ...c, pricing: { type: "starting", ...c.pricing, ...patch } }));

  /* --- the creator's own menu: add-ons + packages, all optional --- */
  const menu: ServiceMenu = config.menu ?? EMPTY_MENU;
  const setMenu = (m: ServiceMenu) =>
    setConfig((c) => ({ ...c, menu: m.addons.length || m.packages.length ? m : undefined }));
  const newId = () => Math.random().toString(36).slice(2, 10);
  const addAddon = () =>
    setMenu({ ...menu, addons: [...menu.addons, { id: newId(), name: "", priceMode: "fixed", price: 0, timeMin: 0 }] });
  const patchAddon = (id: string, patch: Partial<MenuAddon>) =>
    setMenu({ ...menu, addons: menu.addons.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  const rmAddon = (id: string) =>
    setMenu({
      addons: menu.addons.filter((a) => a.id !== id),
      packages: menu.packages.map((p) => ({ ...p, includes: p.includes.filter((x) => x !== id) })),
    });
  const addPackage = () =>
    setMenu({ ...menu, packages: [...menu.packages, { id: newId(), name: "", price: 0, includes: [] }] });
  const patchPackage = (id: string, patch: Partial<MenuPackage>) =>
    setMenu({ ...menu, packages: menu.packages.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const rmPackage = (id: string) => setMenu({ ...menu, packages: menu.packages.filter((p) => p.id !== id) });
  const togglePkgInclude = (pid: string, aid: string) => {
    const p = menu.packages.find((x) => x.id === pid);
    if (!p) return;
    patchPackage(pid, { includes: p.includes.includes(aid) ? p.includes.filter((x) => x !== aid) : [...p.includes, aid] });
  };

  const pickCategory = (c: string) => {
    setCustomMode(false);
    setCustomCat("");
    setCategory(c);
    const d = CATEGORY_DEFAULTS[c];
    if (d) {
      setFulfillment(d.fulfillment);
      setScheduling({ durationMin: d.durationMin });
    }
  };

  /* steps that apply given the fulfillment model */
  const activeSteps = STEPS.filter((s) => s !== "Availability" || fulfillment === "appointment");
  const stepName = activeSteps[step];
  const needsHighTrust = HIGH_TRUST_CATEGORIES.includes(category);
  const trustOk = !needsHighTrust || user?.profile.trustLevel === "high-trust";
  const travelRelevant = ["client_location", "both", "flexible"].includes(config.locationMode);

  const next = () => {
    setError(null);
    if (stepName === "Service" && (!title.trim() || !description.trim())) {
      setError("Give it a name and tell clients what they'll receive");
      return;
    }
    if (stepName === "Service" && customMode && !normalizeCategory(customCat)) {
      setError("Name your custom category (or pick an existing one)");
      return;
    }
    if (stepName === "Pricing & policies" && fulfillment !== "quote" && !price) {
      setError("Set your price");
      return;
    }
    // leaving the menu step: silently drop unfinished rows
    if (stepName === "Service menu")
      setMenu({
        addons: menu.addons.filter((a) => a.name.trim()),
        packages: menu.packages.filter((p) => p.name.trim() && p.price > 0),
      });
    setStep((s) => Math.min(s + 1, activeSteps.length - 1));
  };

  const publish = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        price: fulfillment === "quote" ? Number(price) || 1 : Number(price),
        category,
        fulfillment,
        visibility,
        reach: config.travel.radiusMi ? `${config.travel.radiusMi} mi radius` : config.locationMode === "remote" ? "Remote" : "Local",
        config,
        media,
        shareToFeed,
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Could not publish");
      if (res.status === 401) router.push("/login");
      return;
    }
    setLiveId(d.id);
  };

  /* ------------------------------ live screen ------------------------------ */
  if (liveId) {
    const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/services/${liveId}` : `/services/${liveId}`;
    return (
      <div className="mx-auto max-w-md space-y-4 py-10 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-lime-400/40 bg-lime-400/10">
          <Check className="h-6 w-6 text-lime-300" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-50">
            {visibility === "draft" ? "Draft saved" : "Your service is live"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {visibility === "draft" ? (
              <>
                <span className="font-semibold text-zinc-200">{title}</span> is private — only you can see it.
                Publish it anytime from your profile.
              </>
            ) : visibility === "unlisted" ? (
              <>
                <span className="font-semibold text-zinc-200">{title}</span> is unlisted — share the link and
                anyone with it can view and book. It won&apos;t appear in the directory or on your profile.
              </>
            ) : visibility === "followers" ? (
              <>
                <span className="font-semibold text-zinc-200">{title}</span> is visible to your followers on
                your profile and in their directory.
              </>
            ) : (
              <>
                <span className="font-semibold text-zinc-200">{title}</span> is now available for{" "}
                {fulfillment === "appointment" ? "booking" : "requests"} — on your profile, in Services, in
                search, and eligible for the feed.
              </>
            )}
          </p>
        </div>

        {visibility !== "draft" && (
          <div className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Share it</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Permanent link — anyone can view it, no account needed. Booking brings them back here.
            </p>
            <div className="mt-2 flex justify-center">
              <ShareSheet path={`/services/${liveId}`} title={`${title} — book on UpNova`} text={priceLabel(config, Number(price) || 0)} />
            </div>
          </div>
        )}

        {visibility === "public" && shareToFeed && (
          <p className="rounded-xl border border-lime-400/30 bg-lime-400/5 px-4 py-3 text-sm text-lime-300">
            It&apos;s in the For You feed and on your profile grid — one listing, one feed card, and the
            card&apos;s CTA opens this exact service.
          </p>
        )}
        <div className="flex justify-center gap-2">
          {visibility !== "draft" && (
            <Link href={`/services/${liveId}`} className="btn-lime px-5 py-2 text-sm">View service page</Link>
          )}
          <Link href="/" className="btn-ghost px-5 py-2 text-sm">See it in your feed</Link>
          <Link href="/profile/edit" className="btn-ghost px-5 py-2 text-sm">Manage</Link>
        </div>
      </div>
    );
  }

  /* -------------------------------- wizard -------------------------------- */
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
          Create Service
        </h1>
      </div>

      {/* step rail */}
      <div className="flex items-center gap-1">
        {activeSteps.map((s, i) => (
          <button
            key={s}
            onClick={() => i < step && setStep(i)}
            className={`h-1.5 flex-1 rounded-full transition ${i <= step ? "bg-lime-400" : "bg-card-raised"}`}
            title={s}
          />
        ))}
      </div>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Step {step + 1} of {activeSteps.length} — {stepName}
      </p>

      {/* ============================ 1 · SERVICE ============================ */}
      {stepName === "Service" && (
        <section className="card space-y-3 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">What are you offering?</p>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Retwist, Portrait Session, Logo Design" className={`${inputCls} mt-1.5`} maxLength={80} autoFocus />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Category</p>
            <p className="text-[11px] text-zinc-600">Sets smart defaults — you can change everything after.</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <Chip key={c} on={!customMode && category === c} onClick={() => pickCategory(c)}>
                  <span className="capitalize">{c}</span>
                </Chip>
              ))}
              {/* custom category — works immediately for THIS service;
                  frequent ones get promoted to official later, never silently */}
              <Chip
                on={customMode}
                onClick={() => {
                  setCustomMode(true);
                  if (customCat) setCategory(normalizeCategory(customCat));
                }}
              >
                + Add category
              </Chip>
            </div>
            {customMode && (
              <div className="mt-2">
                <input
                  value={customCat}
                  onChange={(e) => {
                    setCustomCat(e.target.value);
                    setCategory(normalizeCategory(e.target.value) || "creative");
                  }}
                  placeholder="Your category — e.g. Crochet, Tattoo, Car Detailing"
                  maxLength={24}
                  autoFocus
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-zinc-600">
                  Custom categories work right away for your service — they filter and organize it everywhere.
                  Popular ones can become official categories later.
                </p>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Describe your service</p>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Tell clients what they'll receive. e.g. Full retwist for locs. Includes washing and basic styling." className={`${inputCls} mt-1.5 resize-none`} />
          </div>

          {/* verification — explained, never just thrown at people */}
          <div className={`rounded-xl border px-3.5 py-2.5 ${needsHighTrust && !trustOk ? "border-amber-400/40 bg-amber-400/5" : "border-line-soft bg-card-raised/50"}`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Verification</p>
            {needsHighTrust ? (
              trustOk ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-lime-300">
                  <BadgeCheck className="h-3.5 w-3.5" /> High-Trust verified — you can publish care services.
                </p>
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-amber-300">
                  Care services need High-Trust identity verification before publishing — clients are trusting
                  you with their homes, pets, or people.{" "}
                  <Link href="/settings" className="underline">Verify in Settings</Link>. Only the badge is ever shown, never your documents.
                </p>
              )
            ) : (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
                <Check className="h-3.5 w-3.5 text-lime-400" /> Standard verification — nothing extra needed for this category.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ========================== 2 · FULFILLMENT ========================== */}
      {stepName === "Fulfillment" && (
        <section className="card space-y-2 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">How do clients get this service?</p>
          {(
            [
              { v: "appointment", t: "Appointment", d: "Clients choose a date and time from your availability." },
              { v: "project", t: "Project request", d: "Clients describe what they need; you deliver by a deadline." },
              { v: "quote", t: "Quote", d: "You review the request and set the price before anything starts." },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              onClick={() => setFulfillment(o.v)}
              className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                fulfillment === o.v ? "border-lime-400/50 bg-lime-400/5" : "border-line hover:border-zinc-600"
              }`}
            >
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${fulfillment === o.v ? "bg-lime-400" : "bg-zinc-700"}`} />
              <span>
                <span className={`block text-sm font-semibold ${fulfillment === o.v ? "text-lime-300" : "text-zinc-200"}`}>{o.t}</span>
                <span className="block text-xs text-zinc-500">{o.d}</span>
              </span>
            </button>
          ))}
          <p className="pt-1 text-[11px] leading-relaxed text-zinc-600">
            The rest of this wizard adapts to your choice — appointments get availability and booking rules;
            projects and quotes skip straight to location and pricing.
          </p>
        </section>
      )}

      {/* ========================== 3 · AVAILABILITY ========================== */}
      {stepName === "Availability" && (
        <section className="card space-y-4 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Days</p>
            <div className="mt-1.5 flex gap-1.5">
              {DAY_LABELS.map((d, i) => (
                <button
                  key={d}
                  onClick={() =>
                    setScheduling({
                      days: (config.scheduling.days ?? []).includes(i)
                        ? (config.scheduling.days ?? []).filter((x) => x !== i)
                        : [...(config.scheduling.days ?? []), i],
                    })
                  }
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition ${
                    (config.scheduling.days ?? []).includes(i)
                      ? "border-lime-400/50 bg-lime-400/10 text-lime-300"
                      : "border-line text-zinc-500"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              Hours
              <select value={config.scheduling.startHour} onChange={(e) => setScheduling({ startHour: Number(e.target.value) })} className={`${inputCls} w-auto py-1.5`}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{new Date(2000, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" })}</option>
                ))}
              </select>
              –
              <select value={config.scheduling.endHour} onChange={(e) => setScheduling({ endHour: Number(e.target.value) })} className={`${inputCls} w-auto py-1.5`}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{new Date(2000, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" })}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              Length
              <select value={config.scheduling.durationMin} onChange={(e) => setScheduling({ durationMin: Number(e.target.value) })} className={`${inputCls} w-auto py-1.5`}>
                {[30, 45, 60, 90, 120, 180, 240].map((m) => (
                  <option key={m} value={m}>{m >= 60 ? `${m / 60} hr${m > 60 ? "s" : ""}` : `${m} min`}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              Buffer
              <select value={config.scheduling.bufferMin} onChange={(e) => setScheduling({ bufferMin: Number(e.target.value) })} className={`${inputCls} w-auto py-1.5`}>
                {[0, 15, 30, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              Max/day
              <input value={config.scheduling.maxPerDay ?? ""} onChange={(e) => setScheduling({ maxPerDay: Number(e.target.value.replace(/[^0-9]/g, "")) || undefined })} placeholder="∞" className={`${inputCls} w-14 py-1.5`} />
            </label>
          </div>
          <div className="border-t border-line-soft pt-3">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Booking rules</p>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" checked={config.scheduling.sameDayBooking !== false} onChange={(e) => setScheduling({ sameDayBooking: e.target.checked })} className="accent-lime-400" />
                Allow same-day booking
              </label>
              <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                Advance notice
                <select value={config.scheduling.advanceNoticeHours} onChange={(e) => setScheduling({ advanceNoticeHours: Number(e.target.value) })} className={`${inputCls} w-auto py-1.5`}>
                  {[0, 1, 2, 4, 12, 24, 48].map((h) => <option key={h} value={h}>{h} hr{h === 1 ? "" : "s"}</option>)}
                </select>
              </label>
            </div>
          </div>
        </section>
      )}

      {/* ============================ 4 · LOCATION ============================ */}
      {stepName === "Location" && (
        <section className="card space-y-4 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Where do you provide this service?</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(Object.keys(LOCATION_LABEL) as (keyof typeof LOCATION_LABEL)[]).map((m) => (
                <Chip key={m} on={config.locationMode === m} onClick={() => setConfig((c) => ({ ...c, locationMode: m }))}>
                  {LOCATION_LABEL[m]}
                </Chip>
              ))}
            </div>
          </div>
          {travelRelevant && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Do you charge a travel fee?</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {([["none", "No"], ["free", "Travel included"], ["flat", "Flat fee"], ["per_mile", "Distance-based"], ["quote", "Custom"]] as const).map(([m, l]) => (
                  <Chip key={m} on={config.travel.mode === m} onClick={() => setTravel({ mode: m })}>{l}</Chip>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {config.travel.mode === "flat" && (
                  <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                    Fee $<input value={config.travel.flatFee ?? ""} onChange={(e) => setTravel({ flatFee: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} className={`${inputCls} w-20 py-1.5`} />
                  </label>
                )}
                {config.travel.mode === "per_mile" && (
                  <>
                    <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                      $<input value={config.travel.perMile ?? ""} onChange={(e) => setTravel({ perMile: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} className={`${inputCls} w-14 py-1.5`} />/mi
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                      after<input value={config.travel.freeMiles ?? ""} onChange={(e) => setTravel({ freeMiles: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} className={`${inputCls} w-14 py-1.5`} />mi
                    </label>
                  </>
                )}
                {config.travel.mode !== "none" && (
                  <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                    Radius<input value={config.travel.radiusMi ?? ""} onChange={(e) => setTravel({ radiusMi: Number(e.target.value.replace(/[^0-9]/g, "")) || undefined })} placeholder="mi" className={`${inputCls} w-14 py-1.5`} />mi
                  </label>
                )}
              </div>
            </div>
          )}
          <div className="rounded-xl border border-line-soft bg-card-raised/50 px-3.5 py-2.5">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              <MapPin className="h-3 w-3" /> Location visibility
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Clients see your <span className="font-medium text-zinc-300">service area</span>, never your address.
              Your public location is controlled by your{" "}
              <Link href="/profile/edit" className="text-violet-300 underline">profile setting</Link>
              {user ? <> (currently: <span className="capitalize text-zinc-300">{user.profile.locationVisibility}</span>)</> : null}.
            </p>
          </div>
        </section>
      )}

      {/* ======================= 5 · PRICING & POLICIES ======================= */}
      {stepName === "Pricing & policies" && (
        <section className="card space-y-4 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">How do you charge?</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {([["fixed", "Fixed price"], ["starting", "Starting at"], ["hourly", "Hourly"], ["quote", "Custom quote"]] as const).map(([v, l]) => (
                <Chip key={v} on={(config.pricing?.type ?? "starting") === v} onClick={() => setPricing({ type: v })}>{l}</Chip>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {config.pricing?.type !== "quote" && (
                <div className="relative w-32">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
                  <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder={config.pricing?.type === "hourly" ? "per hour" : "price"} className={`${inputCls} pl-7`} />
                </div>
              )}
              {config.pricing?.type === "quote" && (
                <div className="relative w-40">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
                  <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="typical from…" className={`${inputCls} pl-7`} />
                </div>
              )}
              <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                Deposit (optional) $
                <input value={config.pricing?.deposit ?? ""} onChange={(e) => setPricing({ deposit: Number(e.target.value.replace(/[^0-9]/g, "")) || undefined })} className={`${inputCls} w-20 py-1.5`} />
              </label>
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-600">Your price is your payout — buyers pay the 5% UpNova fee on top.</p>
          </div>

          <div className="border-t border-line-soft pt-3">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Your policies</p>
            <div className="mt-2 space-y-3">
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Cancellation</p>
                <div className="flex flex-wrap gap-1.5">
                  {([["anytime", "Free anytime"], ["free_24h", "Free up to 24h"], ["partial_48h", "Full 48h+ · 50% after"], ["custom", "Custom"]] as const).map(([v, l]) => (
                    <Chip key={v} on={config.policies.cancellation === v} onClick={() => setPolicies({ cancellation: v })}>{l}</Chip>
                  ))}
                </div>
                {config.policies.cancellation === "custom" && (
                  <input value={config.policies.cancellationNote ?? ""} onChange={(e) => setPolicies({ cancellationNote: e.target.value })} placeholder="Describe your policy" className={`${inputCls} mt-2`} maxLength={160} />
                )}
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Rescheduling</p>
                <div className="flex flex-wrap gap-1.5">
                  {([["free", "Free"], ["one_free", "One free"], ["fee", "Fee"], ["approval", "Needs approval"]] as const).map(([v, l]) => (
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
                  Grace
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
            </div>
          </div>
        </section>
      )}

      {/* =========================== 6 · SERVICE MENU =========================== */}
      {stepName === "Service menu" && (
        <section className="card space-y-4 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Build your menu</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-600">
              Price your business the way you actually run it — a base service, add-ons that change the price
              {fulfillment === "appointment" ? " and the appointment time" : ""}, and packages that bundle them.
              All optional: skip this if you have one price.
            </p>
          </div>

          {/* base service — set in earlier steps, shown for context */}
          <div className="flex items-center justify-between rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
            <span className="text-sm font-semibold text-zinc-100">
              {title || "Your service"}
              <span className="block text-[10px] font-normal text-zinc-500">
                Base service{fulfillment === "appointment" ? ` · ${config.scheduling.durationMin} min` : ""}
              </span>
            </span>
            <span className="font-mono text-sm tracking-[0.08em] text-lime-300">${price || 0}</span>
          </div>

          {/* add-ons */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Add-ons</p>
            <div className="mt-1.5 space-y-2">
              {menu.addons.map((a) => (
                <div key={a.id} className="rounded-xl border border-line p-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      value={a.name}
                      onChange={(e) => patchAddon(a.id, { name: e.target.value })}
                      placeholder="e.g. Wash, Style, Loc repair"
                      className={`${inputCls} flex-1 py-1.5 text-xs`}
                      maxLength={60}
                    />
                    <button onClick={() => rmAddon(a.id)} className="rounded-md p-1 text-zinc-500 hover:text-rose-300">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <select
                      value={a.priceMode}
                      onChange={(e) => patchAddon(a.id, { priceMode: e.target.value as MenuAddon["priceMode"] })}
                      className={`${inputCls} w-auto py-1.5 text-xs`}
                    >
                      <option value="fixed">Fixed price</option>
                      <option value="starting">Starting at</option>
                      <option value="quote">Quote required</option>
                    </select>
                    {a.priceMode !== "quote" && (
                      <label className="flex items-center gap-1 text-xs text-zinc-400">
                        $
                        <input
                          value={a.price || ""}
                          onChange={(e) => patchAddon(a.id, { price: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                          placeholder="0"
                          className={`${inputCls} w-16 py-1.5 text-xs`}
                        />
                      </label>
                    )}
                    {fulfillment === "appointment" && (
                      <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                        Adds
                        <select
                          value={a.timeMin}
                          onChange={(e) => patchAddon(a.id, { timeMin: Number(e.target.value) })}
                          className={`${inputCls} w-auto py-1.5 text-xs`}
                        >
                          {[0, 10, 15, 20, 30, 45, 60, 90, 120].map((m) => (
                            <option key={m} value={m}>{m === 0 ? "no time" : `${m} min`}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <input
                        type="checkbox"
                        checked={!!a.required}
                        onChange={(e) => patchAddon(a.id, { required: e.target.checked || undefined })}
                        className="accent-lime-400"
                      />
                      Required
                    </label>
                  </div>
                </div>
              ))}
              <button onClick={addAddon} className="btn-ghost w-full justify-center py-2 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add an add-on
              </button>
            </div>
          </div>

          {/* packages */}
          <div className="border-t border-line-soft pt-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Packages</p>
            <p className="text-[11px] text-zinc-600">
              Bundle the base service with add-ons at your own price — clients pick one option instead of you
              publishing four separate services.
            </p>
            <div className="mt-1.5 space-y-2">
              {menu.packages.map((p) => (
                <div key={p.id} className="rounded-xl border border-line p-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      value={p.name}
                      onChange={(e) => patchPackage(p.id, { name: e.target.value })}
                      placeholder={`e.g. ${title || "Service"} + Wash`}
                      className={`${inputCls} flex-1 py-1.5 text-xs`}
                      maxLength={80}
                    />
                    <label className="flex items-center gap-1 text-xs text-zinc-400">
                      $
                      <input
                        value={p.price || ""}
                        onChange={(e) => patchPackage(p.id, { price: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                        placeholder="0"
                        className={`${inputCls} w-16 py-1.5 text-xs`}
                      />
                    </label>
                    <button onClick={() => rmPackage(p.id)} className="rounded-md p-1 text-zinc-500 hover:text-rose-300">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {menu.addons.filter((a) => a.name.trim()).length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] text-zinc-600">Includes (base service always included):</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {menu.addons.filter((a) => a.name.trim()).map((a) => (
                          <Chip key={a.id} on={p.includes.includes(a.id)} onClick={() => togglePkgInclude(p.id, a.id)}>
                            {a.name}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button onClick={addPackage} className="btn-ghost w-full justify-center py-2 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add a package
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ========================= 7 · SHOW YOUR WORK ========================= */}
      {stepName === "Show your work" && (
        <section className="card space-y-3 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Show your work</p>
            <p className="text-[11px] text-zinc-600">Add photos of what you do — up to 3. Optional but powerful.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {media.map((m, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m} alt={`Work example ${i + 1}`} className="h-24 w-24 rounded-xl border border-line object-cover" />
                <button onClick={() => setMedia(media.filter((_, x) => x !== i))} className="absolute -right-1.5 -top-1.5 rounded-full border border-line bg-ink p-1 text-zinc-400 hover:text-rose-300">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {media.length < 3 && (
              <button onClick={() => fileInput.current?.click()} className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300">
                <ImagePlus className="h-5 w-5" />
                <span className="text-[10px] font-semibold">Add media</span>
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const img = await readImage(f, 900);
                  setMedia((m) => (m.length < 3 ? [...m, img] : m));
                }
                e.target.value = "";
              }}
            />
          </div>
        </section>
      )}

      {/* ============================ 7 · PREVIEW ============================ */}
      {stepName === "Preview" && (
        <section className="space-y-3">
          <p className="text-xs text-zinc-500">This is what clients will see. Publish when it looks right.</p>
          <article className="card-money p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-zinc-50">{title || "Untitled service"}</h3>
                <p className="font-mono text-sm font-medium tracking-[0.08em] text-lime-300">
                  {priceLabel(config, Number(price) || 0)}
                </p>
              </div>
              <span className="rounded-full border border-line px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400 capitalize">
                {fulfillment}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">{description}</p>
            {(menu.addons.some((a) => a.name.trim()) || menu.packages.some((p) => p.name.trim())) && (
              <div className="mt-3 rounded-xl border border-line-soft bg-card-raised/50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Menu</p>
                <ul className="mt-1.5 space-y-1 text-[11px]">
                  {menu.packages.filter((p) => p.name.trim()).map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span className="text-zinc-300">{p.name}</span>
                      <span className="font-mono tracking-[0.08em] text-lime-300">${p.price}</span>
                    </li>
                  ))}
                  {menu.addons.filter((a) => a.name.trim()).map((a) => (
                    <li key={a.id} className="flex justify-between gap-2">
                      <span className="text-zinc-400">
                        {a.name}{a.required ? " (required)" : ""}{fulfillment === "appointment" && a.timeMin > 0 ? ` · +${a.timeMin} min` : ""}
                      </span>
                      <span className="font-mono tracking-[0.08em] text-zinc-300">
                        {a.priceMode === "quote" ? "Quote" : a.priceMode === "starting" ? `from $${a.price}` : `+$${a.price}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {media.length > 0 && (
              <div className="mt-3 flex gap-2">
                {media.map((m, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={m} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" />
                ))}
              </div>
            )}
            <div className="mt-3 space-y-1 border-t border-dashed border-line pt-3 text-[11px] text-zinc-500">
              {fulfillment === "appointment" && (
                <p>{availabilityLabel(config.scheduling)} · {config.scheduling.durationMin! >= 60 ? `${config.scheduling.durationMin! / 60} hr` : `${config.scheduling.durationMin} min`}{config.scheduling.maxPerDay ? ` · max ${config.scheduling.maxPerDay}/day` : ""}</p>
              )}
              <p>{LOCATION_LABEL[config.locationMode]}{travelRelevant ? ` · ${travelLabel(config.travel)}` : ""}</p>
              {config.pricing?.deposit ? <p>Deposit ${config.pricing.deposit}</p> : null}
              {policyLines(config).map((l) => <p key={l}>{l}</p>)}
              {user?.profile.city && <p>Serving {user.profile.city}, {user.profile.state}</p>}
            </div>
          </article>

          {/* who can see it — publishing is a visibility choice, not a fork:
              ONE canonical record either way */}
          <div className="card space-y-1.5 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Who can see this?</p>
            {visibility === "public" && (
              <label className="mb-1.5 flex items-center justify-between gap-3 rounded-xl border border-line-soft bg-card-raised/50 px-3.5 py-2">
                <span className="text-xs text-zinc-300">
                  Share to feed
                  <span className="block text-[10px] text-zinc-600">One linked feed card — its CTA opens this listing. Default on.</span>
                </span>
                <input type="checkbox" checked={shareToFeed} onChange={(e) => setShareToFeed(e.target.checked)} className="accent-lime-400" />
              </label>
            )}
            {VISIBILITY_OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => setVisibility(o.id)}
                className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                  visibility === o.id ? "border-lime-400/50 bg-lime-400/5" : "border-line hover:border-zinc-600"
                }`}
              >
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${visibility === o.id ? "bg-lime-400" : "bg-zinc-700"}`} />
                <span>
                  <span className={`block text-sm font-semibold ${visibility === o.id ? "text-lime-300" : "text-zinc-200"}`}>{o.label}</span>
                  <span className="block text-xs text-zinc-500">{o.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-rose-300">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {error}
        </p>
      )}

      {/* nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => (step === 0 ? router.push("/services") : setStep(step - 1))} className="btn-ghost px-4 py-2 text-sm">
          <ArrowLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}
        </button>
        {stepName !== "Preview" ? (
          <button onClick={next} className="btn-lime px-5 py-2 text-sm">
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={publish} disabled={busy || (needsHighTrust && !trustOk)} className="btn-lime px-6 py-2 text-sm disabled:opacity-40">
            {busy ? "Publishing…" : visibility === "draft" ? "Save Draft" : "Publish Service"}
          </button>
        )}
      </div>
    </div>
  );
}
