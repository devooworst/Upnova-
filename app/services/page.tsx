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
/* Hire Me is never a dead end: service → project details → a real project
   (draft) attached to the real conversation with the provider.            */

function HireWizard({ service, onClose }: { service: ServiceItem; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [needs, setNeeds] = useState("");
  const [requirements, setRequirements] = useState("");
  const [deadline, setDeadline] = useState("");
  const [budget, setBudget] = useState(String(service.price));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    // 1) the real conversation with this provider
    const convRes = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toHandle: service.owner.handle,
        firstMessage: `Hi ${service.owner.displayName.split(" ")[0]}! I'd like to hire you for ${service.title}. ${needs.trim()}`,
      }),
    });
    const conv = await convRes.json();
    if (!convRes.ok) {
      setBusy(false);
      setError(conv.error || "Could not open the conversation");
      return;
    }
    // 2) the real project (draft) — the provider responds with the offer
    const projRes = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorHandle: service.owner.handle,
        serviceId: service.id,
        conversationId: conv.conversationId,
        title: service.title,
        amount: Number(budget) || service.price,
        brief: [needs.trim(), requirements.trim() && `Requirements: ${requirements.trim()}`]
          .filter(Boolean)
          .join("\n"),
        deadline: deadline || undefined,
      }),
    });
    const proj = await projRes.json();
    setBusy(false);
    if (!projRes.ok) {
      setError(proj.error || "Could not create the project");
      return;
    }
    router.push(`/messages?c=${conv.conversationId}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Hire · step {step} of 2
            </p>
            <h3 className="mt-1 text-sm font-bold text-zinc-100">
              {service.owner.displayName} — {service.title}
            </h3>
            <p className="font-mono text-xs font-medium tracking-[0.08em] text-lime-300">
              Starting at ${service.price}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 1 ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs leading-relaxed text-zinc-400">{service.description}</p>
            <div className="rounded-xl border border-line-soft bg-card-raised/50 px-3.5 py-2.5 text-xs text-zinc-400">
              How it works: you describe the project, {service.owner.displayName.split(" ")[0]} reviews it and
              sends an offer, you accept and secure payment, work begins. Funds release only when you approve
              the delivery.
            </div>
            <button onClick={() => setStep(2)} className="btn-lime w-full justify-center py-2 text-sm">
              Continue — project details
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            <textarea
              value={needs}
              onChange={(e) => setNeeds(e.target.value)}
              rows={3}
              placeholder="What do you need? Be specific — this becomes the project brief."
              className="w-full resize-none rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50"
            />
            <input
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="Requirements or references (optional)"
              className="w-full rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50"
            />
            <div className="flex gap-2.5">
              <div className="flex-1">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Deadline</p>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full rounded-xl border border-line bg-card-raised px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-lime-400/50"
                />
              </div>
              <div className="w-32">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Budget</p>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
                  <input
                    value={budget}
                    onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full rounded-xl border border-line bg-card-raised py-2 pl-7 pr-3 text-sm text-zinc-100 outline-none focus:border-lime-400/50"
                  />
                </div>
              </div>
            </div>
            <p className="font-mono text-[11px] tracking-[0.08em] text-zinc-500">
              PAYOUT ${budget || 0} · YOU PAY ${(Number(budget || 0) * 1.05).toFixed(2)} INCL. 5% FEE
            </p>
            {error && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-rose-300">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {error}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="btn-ghost px-4 py-2 text-xs">
                Back
              </button>
              <button
                onClick={send}
                disabled={busy || !needs.trim() || !budget}
                className="btn-lime flex-1 justify-center py-2 text-sm disabled:opacity-40"
              >
                {busy ? "Sending…" : "Send project"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
