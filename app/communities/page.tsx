"use client";

/* ------------------------------------------------------------------ */
/*  Communities — find your people, at whatever visibility level        */
/*  you're comfortable with.                                            */
/*                                                                      */
/*  · Discover: public directory with categories, counts, and access    */
/*  · Reveals: private identity-reveal requests + connections           */
/*  · Identity privacy: how revealed peers see you in communities       */
/*                                                                      */
/*  Anonymous to the crowd ≠ anonymous to everyone: reveals are         */
/*  per-person and private; UpNova always retains the account for       */
/*  moderation and safety.                                              */
/* ------------------------------------------------------------------ */

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, Lock, Mail, Search, ShieldCheck, Eye, UserRound, Check, X, Ban } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useSession } from "@/lib/session";
import { promptJoin } from "@/components/GuestGate";
import { REVEAL_IDENTITY_MODES, identityModeLabel } from "@/lib/communityIdentity";

interface CommunityCard {
  id: string;
  slug: string;
  name: string;
  description: string;
  access: string;
  kind: string;
  category: string;
  rules: string[];
  identityModes: string[];
  campusId: string | null;
  members: number;
  activeMembers: number;
  viewer: { role: string; status: string; isMod: boolean } | null;
}

interface RevealsData {
  incoming: { id: string; from: string; community: string | null; createdAt: string }[];
  outgoing: { id: string; to: string; community: string | null; createdAt: string }[];
  connections: {
    revealId: string;
    userId: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    community: string | null;
    youFollow: boolean;
    followsYou: boolean;
    connected: boolean;
  }[];
}

const ACCESS_BADGE: Record<string, { label: string; cls: string }> = {
  public: { label: "PUBLIC", cls: "text-lime-300 bg-lime-400/10" },
  private: { label: "PRIVATE", cls: "text-amber-300 bg-amber-400/10" },
  invite: { label: "INVITE-ONLY", cls: "text-sky-300 bg-sky-400/10" },
};

function CommunitiesInner() {
  const { user } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<{ guest: boolean; mine: CommunityCard[]; discover: CommunityCard[]; categories: string[] } | null>(null);
  const [reveals, setReveals] = useState<RevealsData | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [revealMode, setRevealMode] = useState<string>("keep_anonymous");
  const [showPrivacy, setShowPrivacy] = useState(params.get("tab") === "privacy");

  const load = useCallback(async () => {
    const url = `/api/communities?q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`;
    const res = await fetch(url);
    if (res.ok) setData(await res.json());
    if (user) {
      const r = await fetch("/api/me/reveals");
      if (r.ok) setReveals(await r.json());
      const p = await fetch("/api/me/profile");
      if (p.ok) {
        const j = await p.json();
        setRevealMode(j.profile?.revealIdentityMode ?? "keep_anonymous");
      }
    }
  }, [q, cat, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const join = async (c: CommunityCard) => {
    if (!user) return promptJoin("comment", `/communities/${c.slug}`);
    setBusy(c.id);
    const res = await fetch(`/api/communities/${c.id}/join`, { method: "POST" });
    const j = await res.json();
    setBusy(null);
    if (!res.ok) return setMsg(j.error || "Couldn't join");
    setMsg(j.status === "pending" ? `Request sent — ${c.name}'s moderators will review it.` : `Welcome to ${c.name}.`);
    void load();
  };

  const answerReveal = async (id: string, action: "accept" | "decline" | "never") => {
    const res = await fetch(`/api/reveals/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) void load();
  };

  const saveRevealMode = async (mode: string) => {
    setRevealMode(mode);
    await fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revealIdentityMode: mode }),
    });
  };

  const follow = async (userId: string) => {
    await fetch(`/api/follow/${userId}`, { method: "POST" });
    void load();
  };

  const Card = ({ c, joined }: { c: CommunityCard; joined: boolean }) => {
    const badge = ACCESS_BADGE[c.access] ?? ACCESS_BADGE.public;
    return (
      <div className="card-people flex flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/communities/${c.slug}`} className="min-w-0">
            <h3 className="truncate text-[15px] font-bold text-zinc-100 hover:text-violet-300">{c.name}</h3>
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-zinc-500">{c.description}</p>
          </Link>
          <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.14em] ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-[0.08em] text-zinc-500">
          <span className="text-zinc-400">{c.category.toUpperCase()}</span>
          <span>{c.members} MEMBERS</span>
          <span>{c.activeMembers} ACTIVE</span>
          {c.rules.length > 0 && <span>{c.rules.length} RULES</span>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {c.identityModes.map((m) => (
            <span key={m} className="rounded-full border border-violet-400/20 bg-violet-400/5 px-2 py-0.5 font-mono text-[9px] tracking-[0.1em] text-violet-300">
              {identityModeLabel(m).toUpperCase()}
            </span>
          ))}
          {c.campusId && (
            <span className="rounded-full border border-amber-400/20 bg-amber-400/5 px-2 py-0.5 font-mono text-[9px] tracking-[0.1em] text-amber-300">
              CAMPUS
            </span>
          )}
        </div>
        <div className="mt-auto flex items-center gap-2 pt-1">
          <Link
            href={`/communities/${c.slug}`}
            className="rounded-full border border-zinc-700 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-violet-400/40 hover:text-violet-300"
          >
            View
          </Link>
          {!joined &&
            (c.viewer?.status === "pending" ? (
              <span className="font-mono text-[10px] tracking-[0.1em] text-amber-300">REQUEST PENDING</span>
            ) : c.viewer?.status === "invited" ? (
              <button onClick={() => void join(c)} className="rounded-full bg-violet-400 px-3.5 py-1.5 text-xs font-bold text-zinc-950 hover:bg-violet-300">
                Accept invitation
              </button>
            ) : c.access === "invite" ? (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.1em] text-zinc-500">
                <Mail className="h-3 w-3" /> INVITATION NEEDED
              </span>
            ) : (
              <button
                disabled={busy === c.id}
                onClick={() => void join(c)}
                className="rounded-full bg-violet-400 px-3.5 py-1.5 text-xs font-bold text-zinc-950 transition hover:bg-violet-300 disabled:opacity-50"
              >
                {c.access === "private" || c.access === "public" ? (c.access === "private" ? "Request to join" : "Join") : "Join"}
              </button>
            ))}
          {joined && c.viewer?.status === "pending" && (
            <span className="font-mono text-[10px] tracking-[0.1em] text-amber-300">AWAITING APPROVAL</span>
          )}
          {joined && c.viewer?.status === "invited" && (
            <button onClick={() => void join(c)} className="rounded-full bg-violet-400 px-3.5 py-1.5 text-xs font-bold text-zinc-950 hover:bg-violet-300">
              Accept invitation
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="px-1">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/10">
            <Users className="h-5 w-5 text-violet-400" />
          </span>
          Communities
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          Join with your profile, an alias, or anonymously — each community sets what it allows. You control who ever learns it&apos;s you.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => (user ? router.push("/communities/create") : promptJoin("create", "/communities/create"))}
            className="inline-flex items-center gap-1.5 rounded-full bg-violet-400 px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-violet-300 hover:shadow-glow-violet"
          >
            + Create Community
          </button>
          {user && (
            <button
              onClick={() => setShowPrivacy((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-violet-400/40 hover:text-violet-300"
            >
              <Eye className="h-3.5 w-3.5" /> Identity privacy
            </button>
          )}
        </div>
      </header>

      {msg && (
        <div className="rounded-xl border border-violet-400/30 bg-violet-400/10 px-4 py-2.5 text-sm text-violet-200">
          {msg}
          <button onClick={() => setMsg(null)} className="float-right text-violet-300/60 hover:text-violet-200">✕</button>
        </div>
      )}

      {/* ---------- identity privacy: how revealed peers see me ---------- */}
      {user && showPrivacy && (
        <section className="card-people space-y-3 p-4">
          <h2 className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            <ShieldCheck className="h-3.5 w-3.5 text-violet-400" /> How should people I&apos;ve revealed myself to see me in communities?
          </h2>
          <div className="space-y-2">
            {REVEAL_IDENTITY_MODES.map((m) => (
              <label key={m.id} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition ${revealMode === m.id ? "border-violet-400/50 bg-violet-400/5" : "border-zinc-800 hover:border-zinc-700"}`}>
                <input type="radio" name="revealMode" checked={revealMode === m.id} onChange={() => void saveRevealMode(m.id)} className="mt-0.5 accent-violet-400" />
                <span>
                  <span className="block text-sm font-semibold text-zinc-200">{m.label}</span>
                  <span className="block text-xs text-zinc-500">{m.desc}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-600">
            This never changes what the community sees — masked posts stay masked to everyone else. It only controls whether the specific
            people you&apos;ve mutually revealed with see who you are when you post masked.
          </p>
        </section>
      )}

      {/* ---------- reveal requests: gradual trust ---------- */}
      {user && reveals && (reveals.incoming.length > 0 || reveals.outgoing.length > 0 || reveals.connections.length > 0) && (
        <section className="card-people space-y-3 p-4">
          <h2 className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            <UserRound className="h-3.5 w-3.5 text-violet-400" /> Identity reveals
          </h2>

          {reveals.incoming.map((r) => (
            <div key={r.id} className="rounded-lg border border-violet-400/30 bg-violet-400/5 p-3">
              <p className="text-sm text-zinc-200">
                <span className="font-mono tracking-[0.06em] text-violet-300">{r.from}</span> would like to reveal identities with you
                {r.community && <span className="text-zinc-500"> — from {r.community}</span>}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Accepting shows you each other&apos;s profiles — privately. The community keeps seeing your masked identities.
              </p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => void answerReveal(r.id, "accept")} className="inline-flex items-center gap-1 rounded-full bg-violet-400 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-violet-300">
                  <Check className="h-3 w-3" /> Accept
                </button>
                <button onClick={() => void answerReveal(r.id, "decline")} className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-zinc-500">
                  <X className="h-3 w-3" /> Decline
                </button>
                <button onClick={() => void answerReveal(r.id, "never")} className="inline-flex items-center gap-1 rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-400">
                  <Ban className="h-3 w-3" /> Don&apos;t ask again
                </button>
              </div>
            </div>
          ))}

          {reveals.outgoing.map((r) => (
            <p key={r.id} className="text-xs text-zinc-500">
              Waiting on <span className="font-mono text-zinc-400">{r.to}</span>
              {r.community && ` in ${r.community}`} — they&apos;ll decide in their own time.
            </p>
          ))}

          {reveals.connections.length > 0 && (
            <div className="space-y-2">
              <p className="font-mono text-[10px] tracking-[0.14em] text-zinc-500">PRIVATE CONNECTIONS — MUTUALLY REVEALED</p>
              {reveals.connections.map((c) => (
                <div key={c.revealId} className="flex items-center gap-3 rounded-lg border border-zinc-800 p-2.5">
                  <Avatar src={c.avatarUrl} initials={c.displayName.slice(0, 2).toUpperCase()} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-200">{c.displayName}</p>
                    <p className="font-mono text-[10px] text-zinc-500">
                      @{c.handle}
                      {c.community && ` · met in ${c.community}`}
                      {c.connected && " · CONNECTED"}
                    </p>
                  </div>
                  <Link href={`/creator/${c.handle}`} className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:border-violet-400/40">
                    Profile
                  </Link>
                  {!c.youFollow && (
                    <button onClick={() => void follow(c.userId)} className="rounded-full bg-violet-400 px-2.5 py-1 text-[11px] font-bold text-zinc-950 hover:bg-violet-300">
                      Follow
                    </button>
                  )}
                  <Link href={`/messages?to=${c.handle}`} className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:border-violet-400/40">
                    Message
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ---------- your communities ---------- */}
      {data && data.mine.length > 0 && (
        <section>
          <div className="mb-2.5 flex items-baseline justify-between px-1">
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Your communities</h2>
            <span className="font-mono text-[10px] text-zinc-600">{data.mine.filter((c) => c.viewer?.status === "active").length} joined</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.mine.map((c) => (
              <Card key={c.id} c={c} joined />
            ))}
          </div>
        </section>
      )}

      {/* ---------- discover ---------- */}
      <section>
        <div className="mb-2.5 flex items-center justify-between gap-3 px-1">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Discover communities</h2>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search communities…"
              className="w-full rounded-full border border-zinc-800 bg-zinc-900/60 py-2 pl-9 pr-4 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-400/40"
            />
          </div>
        </div>
        <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setCat("")}
            className={`shrink-0 rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.1em] transition ${!cat ? "bg-violet-400 font-bold text-zinc-950" : "border border-zinc-800 text-zinc-400 hover:border-violet-400/40"}`}
          >
            ALL
          </button>
          {(data?.categories ?? []).map((c) => (
            <button
              key={c}
              onClick={() => setCat(cat === c ? "" : c)}
              className={`shrink-0 rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.1em] transition ${cat === c ? "bg-violet-400 font-bold text-zinc-950" : "border border-zinc-800 text-zinc-400 hover:border-violet-400/40"}`}
            >
              {c.toUpperCase()}
            </button>
          ))}
        </div>
        {data ? (
          data.discover.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.discover.map((c) => (
                <Card key={c.id} c={c} joined={false} />
              ))}
            </div>
          ) : (
            <p className="px-1 py-6 text-center text-sm text-zinc-600">Nothing matches — try a different search or category.</p>
          )
        ) : (
          <p className="px-1 py-6 text-center font-mono text-[11px] tracking-[0.1em] text-zinc-600">LOADING…</p>
        )}
        {data?.guest && (
          <p className="mt-3 flex items-center gap-1.5 px-1 text-xs text-zinc-600">
            <Lock className="h-3 w-3" /> You&apos;re browsing as a guest — join UpNova to participate in communities.
          </p>
        )}
      </section>
    </div>
  );
}

export default function CommunitiesPage() {
  return (
    <Suspense fallback={<p className="py-10 text-center font-mono text-[11px] tracking-[0.1em] text-zinc-600">LOADING…</p>}>
      <CommunitiesInner />
    </Suspense>
  );
}
