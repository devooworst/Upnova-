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
import { Search, ShoppingBag, Zap } from "lucide-react";
import Avatar from "@/components/Avatar";
import VerifiedBadge from "@/components/VerifiedBadge";

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
  const [items, setItems] = useState<ServiceItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/services", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setItems(d.services ?? []));
  }, []);

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

  const hire = async (s: ServiceItem) => {
    setBusyId(s.id);
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toHandle: s.owner.handle,
        firstMessage: `Hi ${s.owner.displayName.split(" ")[0]}! I'm interested in your ${s.title} service ($${s.price}).`,
      }),
    });
    const data = await res.json();
    setBusyId(null);
    if (res.ok) router.push(`/messages?c=${data.conversationId}`);
    else if (res.status === 401) router.push("/login");
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
                      {s.owner.city ? `${s.owner.city}${s.owner.state ? `, ${s.owner.state}` : ""}` : s.owner.roleLine}
                    </span>
                  </span>
                </Link>
                {s.isMine ? (
                  <Link href="/profile/edit" className="btn-ghost shrink-0 px-3 py-1.5 text-[11px]">
                    Manage
                  </Link>
                ) : (
                  <button
                    onClick={() => hire(s)}
                    disabled={busyId === s.id}
                    className="btn-lime shrink-0 px-3.5 py-1.5 text-xs disabled:opacity-50"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Hire Me
                  </button>
                )}
              </div>
            </article>
          ))
        )}
        {items !== null && filtered.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-zinc-500">No services match.</p>
        )}
      </div>
    </div>
  );
}
