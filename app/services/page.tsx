"use client";

/* ------------------------------------------------------------------ */
/*  Services — "I'm available → Hire Me".                              */
/*  Real listings owned by real accounts. Hire Me opens the actual     */
/*  conversation with that owner (never a hardcoded user) with a       */
/*  service-specific intro, where the project lifecycle begins.        */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ShoppingBag, Zap, X, Bookmark, Check } from "lucide-react";
import Avatar from "@/components/Avatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useSession } from "@/lib/session";

interface ServiceItem {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  aiPolicy: string;
  trustRequired: string;
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
  const [saved, setSaved] = useState<Set<string>>(new Set());

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

  const toggleSave = async (id: string) => {
    const res = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "service", targetId: id }),
    });
    if (!res.ok) {
      if (res.status === 401) router.push("/login");
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
      router.push("/login");
      return;
    }
    setHiring(s);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
          <ShoppingBag className="h-5 w-5 text-lime-400" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Services</h1>
          <p className="text-sm text-zinc-400">
            Creators who are available now. Their listed price is their payout — the 5% platform fee is
            added at checkout.
          </p>
        </div>
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
                  <h3 className="text-sm font-bold text-zinc-100">{s.title}</h3>
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
              <p className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> {AI_LABEL[s.aiPolicy]}
                <span aria-hidden>·</span> {s.reach}
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
                      <Zap className="h-3.5 w-3.5" />
                      Hire Me
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
