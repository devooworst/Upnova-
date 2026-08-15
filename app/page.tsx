"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, MapPin } from "lucide-react";
import DbComposer from "@/components/db/DbComposer";
import DbFeed, { type FeedTab, type FeedScope } from "@/components/db/DbFeed";
import RightSidebar from "@/components/RightSidebar";
import { useSession } from "@/lib/session";

/* ------------------------------------------------------------------ */
/* Home always stays Home — "what should I see right now?"             */
/*   Feed Type  — For You (personalized) | Following (chronological)   */
/*   Feed Scope — For You default → 5 mi → … → Global → My School      */
/* Scope filters the feed; it never renames the page. Opportunities    */
/* is a sidebar destination; Trending lives in Discover.               */
/* ------------------------------------------------------------------ */

const scopes: { id: FeedScope; label: string; studentOnly?: boolean }[] = [
  { id: "foryou", label: "For You" },
  { id: "5", label: "5 miles" },
  { id: "25", label: "25 miles" },
  { id: "city", label: "City" },
  { id: "county", label: "County" },
  { id: "state", label: "State" },
  { id: "country", label: "Country" },
  { id: "global", label: "Global" },
  { id: "school", label: "My School", studentOnly: true },
];


export default function Home() {
  const { user } = useSession();
  // GUEST MODE = the real app, read-only. A fresh visitor browses the
  // ACTUAL application (guest Discover feed, public profiles, services,
  // opportunities) — never someone else's account (their browser holds no
  // session), and never a separate landing page. Participation prompts
  // Sign Up / Sign In contextually (GuestGate).
  const [scope, setScope] = useState<FeedScope>("foryou");
  const [tab, setTab] = useState<FeedTab>("For You");
  const [menuOpen, setMenuOpen] = useState(false);
  const isStudent = !!user?.campus;
  const menuRef = useRef<HTMLDivElement>(null);

  /* scope place labels come from the signed-in user's real location */
  const cityLabel = user?.profile.city ? `${user.profile.city}, ${user.profile.state}` : "your area";
  const scopePlace: Record<FeedScope, string> = {
    foryou: "",
    "5": cityLabel,
    "25": cityLabel,
    city: cityLabel,
    county: user?.profile.county || "your county",
    state: user?.profile.state || "your state",
    country: user?.profile.country || "your country",
    global: "Everywhere",
    school: user?.campus?.name || "your verified school",
  };

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const active = scopes.find((s) => s.id === scope)!;

  const pick = (id: FeedScope) => {
    // picking the active scope again resets to default
    setScope(id === scope ? "foryou" : id);
    setMenuOpen(false);
  };

  return (
    /* ONE centered content group — feed + right rail move together.
       The group centers inside whatever width the (collapsible) left
       sidebar leaves available, so closing the hamburger re-centers Home
       automatically: no fixed left offset, no dead zone on the right.
       Wide screens get slightly more room (2xl) instead of empty space;
       below xl the rail drops away and the feed centers alone. */
    <div className="mx-auto flex w-full max-w-[984px] justify-center gap-6 2xl:max-w-[1040px]">
      <div className="w-full min-w-0 max-w-[640px] flex-1 space-y-4 2xl:max-w-[688px]">
        {/* masthead — Home, always. No location/date banner: the page
            opens with the title and the feed, content-first. */}
        <header className="pt-1">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50">{user === null ? "Discover" : "Home"}</h1>

            {/* feed scope — members only: scopes rank around YOUR location */}
            {user !== null && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 text-sm transition hover:border-zinc-600"
              >
                <span className="text-xs text-zinc-500">Showing:</span>
                <span className="font-semibold text-zinc-100">{active.label}</span>
                <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-xl border border-line bg-card shadow-card animate-fade-up">
                  <p className="border-b border-line-soft px-3.5 pb-2 pt-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    feed scope
                  </p>
                  <ul className="p-1">
                    {scopes
                      .filter((s) => !s.studentOnly || isStudent)
                      .map((s, i) => (
                        <li key={s.id}>
                          {i === 1 && <div className="mx-2 my-1 h-px bg-line-soft" />}
                          <button
                            onClick={() => pick(s.id)}
                            className={`flex w-full items-center rounded-lg px-3 py-1.5 text-sm transition ${
                              scope === s.id
                                ? "bg-white/10 font-semibold text-zinc-50"
                                : "text-zinc-300 hover:bg-card-raised"
                            }`}
                          >
                            {s.label}
                            {scope === s.id && <Check className="ml-auto h-3.5 w-3.5 text-lime-400" />}
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
            )}
          </div>

          {/* guests: what this place is, plus the public surfaces they CAN browse */}
          {user === null && (
            <div className="mt-2">
              <p className="text-sm text-zinc-400">
                Find what&apos;s happening around you — and the people who can make it happen. You&apos;re
                browsing the public side of Mavyn.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/services" className="rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100">
                  Browse Services
                </Link>
                <Link href="/opportunities" className="rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100">
                  Browse Opportunities
                </Link>
                <Link href="/events" className="rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100">
                  Browse Events
                </Link>
              </div>
            </div>
          )}

          {/* active scope indicator */}
          {scope !== "foryou" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
              <MapPin className="h-3.5 w-3.5 text-zinc-400" />
              <span className="font-medium text-zinc-300">
                {scope === "school"
                  ? "My School"
                  : scope === "5" || scope === "25"
                  ? `Within ${scope} miles`
                  : active.label}
              </span>
              · {scopePlace[scope]}
            </p>
          )}

          {/* signature: the ticket perforation, carried at brand level */}
          <div className="relative mt-4" aria-hidden>
            <div className="border-t border-dashed border-line" />
            <span className="absolute -top-[5px] left-0 h-[9px] w-[9px] rounded-full border border-line bg-ink" />
            <span className="absolute -top-[5px] right-0 h-[9px] w-[9px] rounded-full border border-line bg-ink" />
          </div>
        </header>

        <DbComposer />
        <DbFeed scope={scope} tab={tab} onTabChange={setTab} isStudent={isStudent} />
      </div>

      <RightSidebar scope={scope} />
    </div>
  );
}
