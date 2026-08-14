"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { trackActivation } from "@/lib/activation";
import { Search, SlidersHorizontal, Store, Briefcase } from "lucide-react";
import CreatorCard from "@/components/CreatorCard";
import CommunityCard from "@/components/CommunityCard";
import EventCard from "@/components/EventCard";
import ReachBadge from "@/components/ReachBadge";
import Avatar from "@/components/Avatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import {
  creators,
  communities,
  events,
  opportunities,
  services,
  discoverCategories,
  locationFilters,
  categoryFilters,
  availabilityFilters,
  serviceCatalog,
} from "@/lib/data";

export default function DiscoverClient() {
  const params = useSearchParams();
  const initial = discoverCategories.includes(params.get("tab") ?? "")
    ? (params.get("tab") as string)
    : "Creators";
  const [category, setCategory] = useState(initial);
  const [location, setLocation] = useState(locationFilters[1]);
  const [cats, setCats] = useState<string[]>([]);
  const [avail, setAvail] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Track first discovery — fires once per user (idempotent)
  useEffect(() => { trackActivation("first_discovery"); }, []);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <div className="space-y-5">
      <header className="px-1">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Discover</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Search people, services, paid work, and communities on Mavyn.
        </p>
      </header>

      {/* search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="search"
          placeholder="Search creators, services, communities, events…"
          className="w-full rounded-2xl border border-line bg-card py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/15"
        />
      </div>

      {/* category tabs */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {discoverCategories.map((c) => (
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

      <div className="flex items-start gap-6">
        {/* filters */}
        <aside className="w-full shrink-0 lg:w-56">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-2 text-sm font-medium text-zinc-300 lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {filtersOpen ? "Hide filters" : "Show filters"}
          </button>
          <div className={`${filtersOpen ? "block" : "hidden"} space-y-4 lg:block`}>
            <FilterGroup
              title="Location"
              options={locationFilters}
              selected={[location]}
              onSelect={(v) => setLocation(v)}
              single
            />
            <FilterGroup
              title="Category"
              options={categoryFilters}
              selected={cats}
              onSelect={(v) => toggle(cats, setCats, v)}
            />
            <FilterGroup
              title="Availability"
              options={availabilityFilters}
              selected={avail}
              onSelect={(v) => toggle(avail, setAvail, v)}
            />
          </div>
        </aside>

        {/* results */}
        <div className="min-w-0 flex-1">
          {category === "Creators" && (
            <div className="grid gap-4 md:grid-cols-2">
              {creators.map((c) => (
                <CreatorCard key={c.id} creator={c} />
              ))}
            </div>
          )}

          {category === "Services" && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {serviceCatalog.slice(0, 6).map((svc) => {
                  const c = creators.find((cr) => cr.id === svc.creatorId);
                  if (!c) return null;
                  return (
                    <article key={svc.id} className="card-people p-5 transition hover:border-zinc-600">
                      <div className="flex items-center gap-3">
                        <Avatar src={c.avatar} initials={c.initials} gradient={c.gradient} size="sm" />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-zinc-100">{svc.title}</h3>
                          <p className="flex items-center gap-1 text-xs text-zinc-500">
                            by {c.name} {c.verified && <VerifiedBadge />}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-400">{svc.description}</p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-zinc-400">
                          Starting at{" "}
                          <span className="text-base font-bold text-lime-400">${svc.startingAt}</span>
                        </p>
                        <a href="/services" className="btn-lime px-4 py-1.5 text-xs">Book or Request</a>
                      </div>
                    </article>
                  );
                })}
              </div>
              <a
                href="/services"
                className="block rounded-xl border border-line px-4 py-2.5 text-center text-xs font-semibold text-lime-400 transition hover:border-lime-400/40"
              >
                Browse the full Services catalog →
              </a>
            </div>
          )}

          {category === "Opportunities" && (
            <div className="space-y-3">
              {opportunities.map((o) => (
                <article key={o.id} className="card flex flex-wrap items-center gap-3 p-4 transition hover:border-zinc-600">
                  <Avatar src={o.posterAvatar} initials={o.posterInitials} gradient={o.posterGradient} size="sm" />
                  <div className="min-w-0 flex-1">
                    <h3 className="flex items-center gap-1.5 truncate text-sm font-bold text-zinc-100">
                      {o.title}
                      {o.verifiedPoster && <VerifiedBadge />}
                    </h3>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {o.poster} • {o.category} • {o.applicants} applicants
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <ReachBadge info={o.reach} compact />
                  </div>
                  <p className="text-sm font-bold text-lime-400">{o.budget}</p>
                  <button className="btn-ghost px-4 py-1.5 text-xs">View</button>
                </article>
              ))}
            </div>
          )}

          {category === "Communities" && (
            <div className="grid gap-4 md:grid-cols-2">
              {communities.map((c) => (
                <CommunityCard key={c.id} community={c} />
              ))}
            </div>
          )}

          {category === "Events" && (
            <div className="grid gap-4 md:grid-cols-2">
              {events.map((e) => (
                <EventCard key={e.id} id={e.id} />
              ))}
            </div>
          )}

          {category === "Businesses" && (
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { name: "Harbor & Oak", type: "Lifestyle brand", emoji: "🌿", desc: "Local apparel brand collaborating with photographers and models.", location: "Baltimore, MD" },
                { name: "Vaulted Co.", type: "Streetwear label", emoji: "🧢", desc: "Independent streetwear label hiring content creators nationwide.", location: "Remote" },
                { name: "Studio 410", type: "Recording studio", emoji: "🎚️", desc: "Booking sessions for artists and producers in the DMV.", location: "Baltimore, MD" },
                { name: "FrameHouse", type: "Production company", emoji: "🎬", desc: "Commercial and music-video production. Always scouting editors.", location: "Washington, DC" },
              ].map((b) => (
                <article key={b.name} className="card p-5 transition hover:border-zinc-600">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-card-raised text-xl">
                      {b.emoji}
                    </span>
                    <div>
                      <h3 className="flex items-center gap-1.5 text-sm font-bold text-zinc-100">
                        {b.name} <VerifiedBadge />
                      </h3>
                      <p className="text-xs text-zinc-500">
                        {b.type} • {b.location}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{b.desc}</p>
                  <div className="mt-4 flex gap-2">
                    <button className="btn-lime flex-1 py-1.5 text-xs">
                      <Briefcase className="h-3.5 w-3.5" /> View openings
                    </button>
                    <button className="btn-ghost flex-1 py-1.5 text-xs">
                      <Store className="h-3.5 w-3.5" /> Follow
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  options,
  selected,
  onSelect,
  single = false,
}: {
  title: string;
  options: string[];
  selected: string[];
  onSelect: (value: string) => void;
  single?: boolean;
}) {
  return (
    <div className="card p-4">
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = selected.includes(o);
          return (
            <button
              key={o}
              onClick={() => onSelect(o)}
              aria-pressed={active}
              className={`chip ${active ? "border-white/50 bg-white/10 text-zinc-100" : "hover:border-zinc-600"}`}
            >
              {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              {o}
            </button>
          );
        })}
      </div>
      {single && <p className="mt-2 text-[10px] text-zinc-600">Pick one</p>}
    </div>
  );
}
