"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, MapPin } from "lucide-react";
import NearbyNow from "@/components/NearbyNow";
import CreatePost from "@/components/CreatePost";
import Feed, { type FeedTab, type FeedScope } from "@/components/Feed";
import RightSidebar from "@/components/RightSidebar";
import { currentUser } from "@/lib/data";
import { getPlan, PRO_EVENT } from "@/lib/pro";

/* ------------------------------------------------------------------ */
/* Home always stays Home. Two orthogonal controls:                    */
/*   Feed Type  — For You | Following | Opportunities | Trending       */
/*   Feed Scope — For You default → 5 mi → … → Global → My School      */
/* Scope filters the feed; it never renames the page.                  */
/* ------------------------------------------------------------------ */

const scopes: { id: FeedScope; icon: string; label: string; studentOnly?: boolean }[] = [
  { id: "foryou", icon: "✨", label: "For You" },
  { id: "5", icon: "📍", label: "5 miles" },
  { id: "25", icon: "📍", label: "25 miles" },
  { id: "city", icon: "🏙️", label: "City" },
  { id: "county", icon: "🗺️", label: "County" },
  { id: "state", icon: "📍", label: "State" },
  { id: "country", icon: "🇺🇸", label: "Country" },
  { id: "global", icon: "🌎", label: "Global" },
  { id: "school", icon: "🎓", label: "My School", studentOnly: true },
];

const scopePlace: Record<FeedScope, string> = {
  foryou: "",
  "5": "Baltimore, MD",
  "25": "Baltimore, MD",
  city: "Baltimore, MD",
  county: "Baltimore County",
  state: "Maryland",
  country: "United States",
  global: "Everywhere",
  school: "Bowie State University",
};

export default function Home() {
  const [scope, setScope] = useState<FeedScope>("foryou");
  const [tab, setTab] = useState<FeedTab>("For You");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isStudent, setIsStudent] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setIsStudent(getPlan() === "college");
    sync();
    window.addEventListener(PRO_EVENT, sync);
    return () => window.removeEventListener(PRO_EVENT, sync);
  }, []);

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
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-6">
        {/* masthead — Home, always */}
        <header className="pt-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500">
            {currentUser.location} · Thu Aug 7
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Home</h1>

            {/* feed scope */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 text-sm transition hover:border-zinc-600"
              >
                <span className="text-xs text-zinc-500">Showing:</span>
                <span className="font-semibold text-zinc-100">
                  {active.icon} {active.label}
                </span>
                <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-card shadow-card animate-fade-up">
                  <p className="border-b border-line-soft px-4 pb-2 pt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    feed scope
                  </p>
                  <ul className="p-1.5">
                    {scopes
                      .filter((s) => !s.studentOnly || isStudent)
                      .map((s, i) => (
                        <li key={s.id}>
                          {i === 1 && <div className="mx-2 my-1 h-px bg-line-soft" />}
                          <button
                            onClick={() => pick(s.id)}
                            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                              scope === s.id
                                ? "bg-white/10 font-semibold text-zinc-50"
                                : "text-zinc-300 hover:bg-card-raised"
                            }`}
                          >
                            <span aria-hidden>{s.icon}</span>
                            {s.label}
                            {scope === s.id && <Check className="ml-auto h-4 w-4 text-lime-400" />}
                          </button>
                        </li>
                      ))}
                    {!isStudent && (
                      <li className="px-3 py-2 text-[10px] text-zinc-600">
                        🎓 My School unlocks with verified student status
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>

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
          <div className="relative mt-5" aria-hidden>
            <div className="border-t border-dashed border-line" />
            <span className="absolute -top-[5px] left-0 h-[9px] w-[9px] rounded-full border border-line bg-ink" />
            <span className="absolute -top-[5px] right-0 h-[9px] w-[9px] rounded-full border border-line bg-ink" />
          </div>
        </header>

        <NearbyNow />
        <CreatePost />
        <Feed scope={scope} tab={tab} onTabChange={setTab} isStudent={isStudent} />
      </div>

      <RightSidebar radius={scope === "5" ? "5" : scope === "25" ? "25" : "city"} />
    </div>
  );
}
