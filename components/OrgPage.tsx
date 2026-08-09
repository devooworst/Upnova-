"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Check,
  GraduationCap,
  Lock,
  MapPin,
  Plus,
  Users,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import OpportunityCard from "@/components/OpportunityCard";
import { campusOrgs, creators } from "@/lib/data";
import { useSession } from "@/lib/session";

/* Organization page — another type of community, not a separate product.
   Verified Organization ✓ = the org is legitimate. Branding colors are
   cosmetic. Membership verification is V2 (org admins approve). */

export default function OrgPage({ id }: { id: string }) {
  const org = campusOrgs.find((o) => o.id === id)!;
  // campus access is a database fact (campus_verifications) — same check as the sidebar and /campus
  const { user } = useSession();
  const verified = !!user?.campus;
  const [joined, setJoined] = useState(false);
  const [rsvp, setRsvp] = useState<Record<string, boolean>>({});

  // session still resolving — decide nothing yet
  if (user === undefined) {
    return (
      <div className="mx-auto max-w-md pt-12 text-center" aria-busy="true">
        <div className="mx-auto h-16 w-16 animate-pulse rounded-2xl bg-card-raised" />
        <div className="mx-auto mt-4 h-5 w-48 animate-pulse rounded bg-card-raised" />
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="mx-auto max-w-md pt-12 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-400/10">
          <Lock className="h-7 w-7 text-violet-400" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-50">{org.name}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">
          Campus organizations are part of your verified school network.
        </p>
        <Link
          href="/pro"
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-violet-400 px-6 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-violet-300 hover:shadow-glow-violet"
        >
          <GraduationCap className="h-4 w-4" /> Verify Student Status — Free
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* header — org branding is cosmetic, status is earned */}
      <header className="card-people overflow-hidden">
        <div className={`h-24 bg-gradient-to-br sm:h-28 ${org.gradient} opacity-70`} />
        <div className="px-5 pb-4">
          <div className="-mt-8 flex items-end justify-between">
            <span className={`flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-card bg-gradient-to-br text-3xl ${org.gradient}`}>
              {org.emoji}
            </span>
            <button
              onClick={() => setJoined(!joined)}
              className={
                joined
                  ? "flex items-center gap-1.5 rounded-full border border-violet-400/40 px-4 py-1.5 text-xs font-semibold text-violet-300"
                  : "rounded-full bg-violet-400 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-violet-300 hover:shadow-glow-violet"
              }
            >
              {joined ? (<><Check className="h-3.5 w-3.5" /> Joined</>) : "Join Organization"}
            </button>
          </div>
          <div className="mt-3">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-zinc-50">
              {org.name}
              {org.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/40 bg-sky-400/10 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                  <BadgeCheck className="h-3 w-3" /> Verified Organization
                </span>
              ) : (
                <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
                  Community Group
                </span>
              )}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {org.school}</span>
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {org.members + (joined ? 1 : 0)} members</span>
              <span>{org.category}</span>
            </p>
          </div>
        </div>
      </header>

      <Link href="/campus" className="flex w-fit items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300">
        <ArrowLeft className="h-3.5 w-3.5" /> back to campus
      </Link>

      <div className="grid gap-5 md:grid-cols-5">
        <div className="space-y-5 md:col-span-3">
          {/* about */}
          <section className="card-people p-5">
            <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">About</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{org.about}</p>
            <div className="mt-3.5 border-t border-line-soft pt-3">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">leadership</p>
              <ul className="mt-1.5 space-y-1 text-xs text-zinc-300">
                {org.leadership.map((l) => <li key={l}>{l}</li>)}
              </ul>
            </div>
            {!org.verified && (
              <p className="mt-3 border-t border-line-soft pt-3 text-[10px] leading-relaxed text-zinc-600">
                Community groups are unofficial. Verified Organization status confirms an org is
                legitimate — it never proves who is a member.
              </p>
            )}
          </section>

          {/* posts */}
          <section className="card-people p-5">
            <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Posts</h2>
            <ul className="mt-3 space-y-4">
              {org.posts.map((post) => (
                <li key={post.id} className="border-t border-line-soft pt-3 first:border-0 first:pt-0">
                  <p className="text-xs">
                    <span className="font-semibold text-zinc-100">{post.author}</span>{" "}
                    <span className="text-zinc-600">· {post.time}</span>
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-300">{post.text}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* org opportunity — orgs feed the work ecosystem */}
          {org.opportunityId && (
            <section>
              <h2 className="mb-3 text-[15px] font-bold tracking-tight text-zinc-100">Opportunities</h2>
              <OpportunityCard id={org.opportunityId} />
            </section>
          )}
        </div>

        <div className="space-y-5 md:col-span-2">
          {/* events */}
          <section className="card-event overflow-hidden">
            <h2 className="border-b border-line-soft px-4 pb-3 pt-4 text-[15px] font-bold tracking-tight text-zinc-50">
              Events
            </h2>
            <ul className="divide-y divide-line-soft">
              {org.orgEvents.map((e) => (
                <li key={e.id} className="p-4">
                  <p className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-zinc-100">{e.title}</span>
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                    <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3 text-amber-400" /> {e.when}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {e.where}</span>
                  </p>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="font-mono text-[10px] font-medium text-zinc-500">
                      {e.going + (rsvp[e.id] ? 1 : 0)} going
                    </span>
                    <button
                      onClick={() => setRsvp((r) => ({ ...r, [e.id]: !r[e.id] }))}
                      className={
                        rsvp[e.id]
                          ? "flex items-center gap-1 rounded-full border border-amber-400/40 px-3 py-1 text-[11px] font-semibold text-amber-300"
                          : "rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold text-zinc-950 transition hover:bg-amber-300"
                      }
                    >
                      {rsvp[e.id] ? (<><Check className="h-3 w-3" /> Going</>) : "RSVP"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t border-line-soft px-4 py-2.5 text-[10px] text-zinc-600">
              Bigger org events (ticketed, 21+, capacity) run on the full UpNova Events system.
            </p>
          </section>

          {/* members */}
          <section className="card-people p-5">
            <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Members</h2>
            <div className="mt-3 flex items-center">
              {creators.slice(0, 4).map((c, i) => (
                <Avatar key={c.id} src={c.avatar} initials={c.initials} gradient={c.gradient} size="sm" className={i > 0 ? "-ml-2 ring-2 ring-card" : "ring-2 ring-card"} />
              ))}
              <span className="ml-3 text-xs text-zinc-500">+{org.members - 4} members</span>
            </div>
            <p className="mt-3 border-t border-line-soft pt-3 text-[10px] leading-relaxed text-zinc-600">
              Member verification (✓ Verified Member, approved by org admins) ships in V2 — until
              then, joining follows the org without claiming official membership.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
