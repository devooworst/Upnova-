"use client";

import { useState } from "react";
import Link from "next/link";
import { Briefcase, Check, Clock, Search, ShoppingBag, Star, Zap } from "lucide-react";
import Avatar from "@/components/Avatar";
import HireModal from "@/components/HireModal";
import AiPolicyBadge from "@/components/AiPolicyBadge";
import TrustBadge from "@/components/TrustBadge";
import VerifiedBadge from "@/components/VerifiedBadge";
import { serviceCatalog, creators, type CatalogService } from "@/lib/data";

const categories = ["All", "Music", "Video", "Photography", "Design", "Fashion", "Writing", "Care"] as const;

export default function ServicesPage() {
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [query, setQuery] = useState("");
  const [hiring, setHiring] = useState<CatalogService | null>(null);
  const [safetyFor, setSafetyFor] = useState<CatalogService | null>(null);

  const items = serviceCatalog.filter((svc) => {
    const creator = creators.find((c) => c.id === svc.creatorId);
    const matchesCat = category === "All" || svc.category === category;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      svc.title.toLowerCase().includes(q) ||
      svc.description.toLowerCase().includes(q) ||
      (creator?.name.toLowerCase().includes(q) ?? false);
    return matchesCat && matchesQuery;
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="px-1">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
            <ShoppingBag className="h-5 w-5 text-lime-400" />
          </span>
          Services
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          <span className="font-semibold text-zinc-300">You need something made?</span> Hire a
          creator directly — set services, clear starting prices, protected payment.
        </p>
      </header>

      {/* the inverse door */}
      <Link
        href="/opportunities"
        className="flex items-center gap-3 rounded-xl border border-line px-4 py-2.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300"
      >
        <Briefcase className="h-4 w-4 shrink-0 text-zinc-500" />
        Looking to get hired instead? Browse Opportunities — projects looking for people →
      </Link>

      {/* search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search services or creators…"
          className="w-full rounded-2xl border border-line bg-card py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/15"
        />
      </div>

      {/* category chips */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              category === c
                ? "bg-white text-zinc-950"
                : "border border-line text-zinc-400 hover:bg-card-raised hover:text-zinc-200"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* creator catalog */}
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((svc) => {
          const c = creators.find((cr) => cr.id === svc.creatorId);
          if (!c) return null;
          return (
            <article key={svc.id} className="card-people card-lift flex flex-col p-4 hover:border-zinc-600">
              {/* creator-forward: the person is the product */}
              <div className="flex items-center gap-3">
                <Avatar src={c.avatar} initials={c.initials} gradient={c.gradient} size="md" className="ring-1 ring-line" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
                    {c.name} {c.verified && <VerifiedBadge />}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-zinc-500">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {c.rating} ({c.reviews}) · {c.location.split(",")[0]}
                    {c.distanceMi !== undefined && c.distanceMi <= 40 && (
                      <span className="font-mono font-medium text-zinc-400">· {c.distanceMi} mi</span>
                    )}
                  </p>
                </div>
              </div>

              <h2 className="mt-2.5 text-base font-bold tracking-tight text-zinc-50">{svc.title}</h2>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-zinc-400">{svc.description}</p>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="chip px-2 py-0.5 text-[11px]">{svc.category}</span>
                <span className="chip px-2 py-0.5 text-[11px]">
                  <Clock className="h-3 w-3" /> {svc.delivery}
                </span>
                <span className="chip border-lime-400/25 px-2 py-0.5 text-[11px] text-lime-300">
                  <Check className="h-3 w-3" /> {c.availability}
                </span>
                <AiPolicyBadge policy={svc.aiPolicy} />
                <TrustBadge level={svc.trustLevel} />
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-line-soft pt-3">
                <p className="text-xs text-zinc-500">
                  Starting at{" "}
                  <span className="text-lg font-extrabold tracking-tight tabular-nums text-lime-400">
                    ${svc.startingAt}
                  </span>
                </p>
                <button
                  onClick={() => (svc.trustLevel === "high-trust" ? setSafetyFor(svc) : setHiring(svc))}
                  className="btn-lime px-4 py-1.5 text-xs"
                >
                  <Zap className="h-3.5 w-3.5" /> {svc.trustLevel === "high-trust" ? "Book" : "Hire Me"}
                </button>
              </div>
            </article>
          );
        })}
        {items.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-zinc-500">
            No services match. Try another category — or post it as an opportunity and let creators
            apply.
          </p>
        )}
      </div>

      <p className="border-t border-line-soft pt-4 text-center text-xs text-zinc-600">
        Every hire runs through the protected UpNova flow: agree on scope in Messages, pay securely,
        approve the work, then both sides review.
      </p>

      {/* safety interstitial — verification shown BEFORE the customer pays */}
      {safetyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSafetyFor(null)}>
          <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-lime-400">
safety verification required
            </p>
            <h2 className="mt-1.5 text-[15px] font-bold tracking-tight text-zinc-50">
              {safetyFor.title}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              This service involves unsupervised access to your pet or property.{" "}
              <span className="font-semibold text-zinc-200">
                {creators.find((c) => c.id === safetyFor.creatorId)?.name}
              </span>{" "}
              has completed the required UpNova verification for this service:
            </p>
            <ul className="mt-3 space-y-1.5 text-xs text-zinc-300">
              <li>✓ Identity verification</li>
              <li>✓ Age verification</li>
              <li>✓ Background screening (where legally permitted)</li>
              <li>✓ UpNova payment protection</li>
            </ul>
            <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
              Verification is performed by an identity-verification provider — UpNova never
              stores IDs, and status never exposes legal name, ID number, DOB, or address.
              Verified means checks passed, not a guarantee.
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setSafetyFor(null)} className="btn-ghost flex-1 py-2 text-xs">Cancel</button>
              <button
                onClick={() => {
                  setHiring(safetyFor);
                  setSafetyFor(null);
                }}
                className="btn-lime flex-1 rounded-md py-2 text-xs"
              >
                Continue to booking
              </button>
            </div>
          </div>
        </div>
      )}

      {hiring && (
        <HireModal
          creator={creators.find((c) => c.id === hiring.creatorId)!}
          service={hiring}
          onClose={() => setHiring(null)}
        />
      )}
    </div>
  );
}
