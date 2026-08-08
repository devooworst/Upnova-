import { Check, Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import CommunityCard from "@/components/CommunityCard";
import { communities } from "@/lib/data";

export const metadata = { title: "Communities" };

/* Your Communities = places you're already connected to (compact).
   Discover = places you could join (the big cards belong here).       */

export default function CommunitiesPage() {
  const joined = communities.filter((c) => c.joined);
  const discover = communities.filter((c) => !c.joined);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="px-1">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
            <Users className="h-5 w-5 text-lime-400" />
          </span>
          Communities
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          Find your people — local communities for creators, built around where you are.
        </p>
        <a
          href="/communities/create"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-violet-400 px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-violet-300 hover:shadow-glow-violet"
        >
          + Create Community
        </a>
      </header>

      {/* ---- your communities: compact — you already know these places ---- */}
      <section>
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Your communities
          </h2>
          <span className="font-mono text-[10px] text-zinc-600">{joined.length} joined</span>
        </div>
        <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
          {joined.map((c) => (
            <Link
              key={c.id}
              href={`/communities/${c.id}`}
              className="card-people card-lift flex w-56 shrink-0 items-center gap-2.5 p-3 hover:border-violet-400/40"
            >
              {c.image ? (
                <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                  <Image src={c.image} alt="" fill sizes="36px" className="object-cover" />
                </span>
              ) : (
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-lg ${c.gradient}`}>
                  {c.emoji}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-zinc-100">{c.name}</span>
                <span className="block truncate text-[11px] text-zinc-500">{c.members} members</span>
              </span>
              <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-violet-300">
                <Check className="h-3 w-3" /> Joined
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- discover: the big cards belong here ---- */}
      <section>
        <h2 className="mb-3 px-1 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Discover communities
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {discover.map((c) => (
            <CommunityCard key={c.id} community={c} />
          ))}
        </div>
      </section>
    </div>
  );
}
