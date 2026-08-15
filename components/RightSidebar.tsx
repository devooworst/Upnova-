"use client";

/* ------------------------------------------------------------------ */
/*  Right sidebar — quick previews over LIVE data.                     */
/*  Open Opportunities and People near you query the database with     */
/*  the current feed scope; This week remains demo event data until    */
/*  events move to the DB (see README audit).                          */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Briefcase, ChevronDown, MapPin } from "lucide-react";
import Avatar from "./Avatar";
import { useSession } from "@/lib/session";
import type { FeedScope } from "./db/DbFeed";

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const scopeParam: Record<FeedScope, string> = {
  foryou: "25mi", "5": "5mi", "25": "25mi", city: "city", county: "county",
  state: "state", country: "country", global: "global", school: "school",
};

interface OppRow {
  id: string;
  title: string;
  budget: number | null;
  location: string;
  remote: boolean;
  applyBy: string | null;
  studentFriendly: boolean;
  posterType?: string;
  poster?: { displayName: string };
}

interface EventRow {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  timeLabel: string;
  location: string;
  attending: number;
}

interface PersonRow {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  roleLine: string;
  distanceMi: number | null;
  followedByMe: boolean;
}

export default function RightSidebar({ scope }: { scope: FeedScope }) {
  const { user } = useSession();
  const [open, setOpen] = useState({ money: true, people: true, week: true });
  const toggle = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const [opps, setOpps] = useState<OppRow[] | null>(null);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [eventRows, setEventRows] = useState<EventRow[]>([]);

  const scopeSub = (() => {
    const city = user?.profile.city ? `${user.profile.city}, ${user.profile.state}` : "near you";
    switch (scope) {
      case "foryou": return "Paid work near you";
      case "5": return "Near you · 5 mi";
      case "25": return "Near you · 25 mi";
      case "city": return city;
      case "county": return user?.profile.county || "your county";
      case "state": return user?.profile.state || "your state";
      case "country": return user?.profile.country || "your country";
      case "global": return "Global";
      case "school": return "Student jobs · gigs · collabs";
    }
  })();

  const load = useCallback(async () => {
    if (!user) return;
    const [o, p, ev] = await Promise.all([
      fetch(`/api/opportunities?scope=${scopeParam[scope]}`, { cache: "no-store" }),
      fetch("/api/users?near=1&limit=3", { cache: "no-store" }),
      fetch("/api/events", { cache: "no-store" }),
    ]);
    if (ev.ok) setEventRows(((await ev.json()).events ?? []).slice(0, 2));
    if (o.ok) {
      const d = await o.json();
      let list: OppRow[] = (d.opportunities ?? []).filter((x: { isMine: boolean }) => !x.isMine);
      if (scope === "school") list = list.filter((x) => x.studentFriendly);
      setOpps(list);
    }
    if (p.ok) setPeople((await p.json()).creators ?? []);
  }, [user, scope]);

  useEffect(() => {
    load();
  }, [load]);

  const follow = async (person: PersonRow) => {
    await fetch(`/api/follow/${person.id}`, { method: person.followedByMe ? "DELETE" : "POST" });
    load();
  };

  if (!user) return <aside className="hidden w-80 shrink-0 xl:block" aria-hidden />;

  /* quick discovery, not a feed: cap at 4 */
  const shown = (opps ?? []).slice(0, 4);
  const total = (opps ?? []).reduce((sum, o) => sum + (o.budget ?? 0), 0);
  const oppsHref = `/opportunities?scope=${scope}`;

  return (
    <aside className="sticky top-20 hidden w-80 shrink-0 space-y-4 self-start xl:block">
      {/* ---- money: receipt. sharp corners, lime rule, mono, dashed rows ---- */}
      <section className="card-money px-5 pb-5 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">
              {scope === "school" ? "Campus Opportunities" : "Open Opportunities"}
            </h2>
            <p className="font-mono text-[10px] font-medium text-zinc-500">{scopeSub}</p>
          </div>
          <button
            onClick={() => toggle("money")}
            aria-label="Collapse open opportunities"
            className="text-zinc-500 transition hover:text-zinc-200"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${open.money ? "rotate-180" : ""}`} />
          </button>
        </div>
        {open.money && (
        <>
        <ul className="mt-2.5">
          {shown.map((o) => (
            <li key={o.id} className="border-t border-dashed border-zinc-700/60 first:border-t-0">
              <Link
                href={oppsHref}
                className="group -mx-2 block rounded-md px-2 py-2 transition hover:bg-card-raised"
              >
                <p className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-zinc-100 group-hover:text-lime-300">
                    <Briefcase
                      className={`h-3 w-3 shrink-0 ${o.posterType === "verified_business" ? "text-sky-400" : "text-lime-400/70"}`}
                    />
                    <span className="truncate">{o.title.split("—")[0].trim()}</span>
                    {o.posterType === "verified_business" && (
                      <span className="shrink-0 rounded-sm border border-sky-400/40 px-1 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-sky-300" title={`Verified business · ${o.poster?.displayName ?? ""}`}>
                        biz
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[15px] font-bold tracking-tight tabular-nums text-lime-400">
                    {o.budget != null ? `$${o.budget}` : "collab"}
                  </span>
                </p>
                <p className="mt-0.5 flex items-baseline justify-between gap-2 font-mono text-[10px] font-medium text-zinc-500">
                  <span className="truncate">
                    {o.remote ? "remote" : o.location.split(",")[0].toLowerCase()}
                    {o.applyBy &&
                      ` · apply by ${new Date(o.applyBy).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toLowerCase()}`}
                  </span>
                  <span className="shrink-0 font-semibold text-lime-400 opacity-0 transition group-hover:opacity-100">
                    apply →
                  </span>
                </p>
              </Link>
            </li>
          ))}
          {opps !== null && shown.length === 0 && (
            <li className="py-2.5 text-xs text-zinc-500">
              No paid openings inside this radius yet. Try a wider scope.
            </li>
          )}
        </ul>

        {/* receipt total: double rule */}
        {shown.length > 0 && (
          <div className="mt-1">
            <div className="border-t border-zinc-600" />
            <div className="mt-[3px] border-t border-zinc-600" />
            <p className="mt-2.5 text-xs text-zinc-400">
              <span className="text-base font-extrabold tracking-tight tabular-nums text-lime-400">
                ${total.toLocaleString()}
              </span>{" "}
              in paid work in this scope right now
            </p>
          </div>
        )}

        <Link
          href={oppsHref}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-lime-400/30 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-lime-300 transition hover:border-lime-400/60 hover:bg-lime-400/5"
        >
          View all {(opps ?? []).length > shown.length ? `${(opps ?? []).length} ` : ""}opportunities <ArrowRight className="h-3 w-3" />
        </Link>
        </>
        )}
      </section>

      {/* ---- people: round, avatar-forward, violet ---- */}
      <section className="card-people p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">People near you</h2>
          <span className="flex items-center gap-2">
            <Link
              href="/discover"
              className="text-xs font-semibold text-violet-400 transition hover:text-violet-300"
            >
              Discover
            </Link>
            <button
              onClick={() => toggle("people")}
              aria-label="Collapse people near you"
              className="text-zinc-500 transition hover:text-zinc-200"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${open.people ? "rotate-180" : ""}`} />
            </button>
          </span>
        </div>
        {open.people && (
        <ul className="mt-3 space-y-1">
          {people.map((c) => (
            <li key={c.id} className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-1.5 transition hover:bg-card-raised">
              <Link href={`/creator/${c.handle}`} className="relative shrink-0">
                <Avatar src={c.avatarUrl} initials={c.displayName.charAt(0)} size="md" className="ring-1 ring-line" />
              </Link>
              <Link href={`/creator/${c.handle}`} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold text-zinc-100">{c.displayName}</p>
                <p className="truncate text-xs text-zinc-500">
                  {c.roleLine.split(" · ")[0]}
                  {c.distanceMi != null && ` · ${c.distanceMi} mi`}
                </p>
              </Link>
              <button
                onClick={() => follow(c)}
                className={
                  c.followedByMe
                    ? "shrink-0 rounded-full border border-violet-400/40 px-3 py-1 text-[11px] font-semibold text-violet-300"
                    : "shrink-0 rounded-full bg-violet-400 px-3 py-1 text-[11px] font-semibold text-zinc-950 transition hover:bg-violet-300"
                }
              >
                {c.followedByMe ? "Following" : "Follow"}
              </button>
            </li>
          ))}
        </ul>
        )}
      </section>

      {/* ---- events: ticket rows with real date blocks, amber ---- */}
      <section className="card-event overflow-hidden">
        <div className="flex items-center justify-between border-b border-line-soft px-5 pb-3 pt-4">
          <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">This week</h2>
          <button
            onClick={() => toggle("week")}
            aria-label="Collapse this week"
            className="text-zinc-500 transition hover:text-zinc-200"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${open.week ? "rotate-180" : ""}`} />
          </button>
        </div>
        {open.week && (
        <ul className="divide-y divide-line-soft">
          {eventRows.map((e) => {
            const d = new Date(e.startsAt);
            return (
              <li key={e.id}>
                <Link href={`/events/${e.slug}`} className="group flex items-stretch transition hover:bg-card-raised">
                  <span className="flex w-14 shrink-0 flex-col items-center justify-center border-r border-dashed border-zinc-700/60 bg-amber-400/[0.06] py-3">
                    <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-amber-400">
                      {MON[d.getMonth()]}
                    </span>
                    <span className="text-xl font-extrabold leading-tight text-zinc-50">
                      {d.getDate()}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 px-4 py-3">
                    <span className="block truncate text-sm font-semibold text-zinc-100 group-hover:text-amber-300">
                      {e.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-500">
                      {e.timeLabel} ·
                      <MapPin className="h-3 w-3 shrink-0" />
                      {e.location.split(",")[0]} · {e.attending} going
                    </span>
                  </span>
                  <span className="mr-3 hidden shrink-0 self-center rounded-full border border-amber-400/40 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-300 opacity-0 transition group-hover:opacity-100 sm:block">
                    rsvp
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        )}
      </section>

      <p className="px-2 font-mono text-[10px] leading-relaxed text-zinc-600">
        about · help · privacy · terms
        <br />© 2026 Mavyn, Baltimore MD
      </p>
    </aside>
  );
}
