"use client";

/* ------------------------------------------------------------------ */
/*  MobileProfile — Mavyn's phone/tablet profile presentation.         */
/*                                                                     */
/*  Renders BELOW the lg breakpoint only (ResponsiveProfile decides);  */
/*  desktop keeps DbCreatorProfile completely unchanged. Same API      */
/*  (/api/users/[handle]), same records, same actions — reorganized    */
/*  for thumbs:                                                        */
/*    cover → avatar → name+verified → roles → OPEN TO WORK →          */
/*    campus/class → location/service area → actions → bio →           */
/*    Posts | Services | Portfolio | About                             */
/*  About groups Professional / Education / Location / Verification /  */
/*  Experience into separate cards instead of one giant wall.          */
/*  Nothing is removed — everything is reorganized.                    */
/* ------------------------------------------------------------------ */

import {
  BadgeCheck, GraduationCap, MapPin, PencilLine, Share2, MessageSquare, MoreHorizontal,
  Briefcase, ShieldCheck, Star, Wrench, Radio, Sparkles, Building2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import PostsGrid from "@/components/db/PostsGrid";
import LiveReplaysSection from "@/components/LiveReplaysSection";
import { useSession } from "@/lib/session";
import { promptJoin } from "@/components/GuestGate";
import { CreatorNotifyBell } from "@/components/NotifyControl";

type Payload = {
  user: {
    id: string; handle: string; displayName: string; avatarUrl: string | null; coverUrl: string | null;
    coverPos: number; verified: boolean; roleLine: string; bio: string; skills: string[];
    locationLabel: string | null; serviceArea: string; openToWork: boolean; accountType: string;
    businessVerified: boolean;
  };
  academic: { school: string; classOf: string | null; verified: boolean } | null;
  business: { name?: string } | null;
  stats: { followers: number; following: number; reviewsCount: number; avgRating: number | null };
  reviews: { rating: number; body: string }[];
  followedByMe: boolean;
  services: { id: string; title: string; description: string; price: number | null; category: string; paused: boolean; cta: string }[];
  portfolio: { id: string; title: string; mediaUrl: string | null; kind: string }[];
  experience: { position: string; organization: string; start: string; end: string }[];
};

const TABS = ["Posts", "Services", "Portfolio", "About"] as const;

export default function MobileProfile({ handle }: { handle: string }) {
  const router = useRouter();
  const { user: viewer } = useSession();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Posts");
  const [menuOpen, setMenuOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);

  const load = () =>
    fetch(`/api/users/${handle}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Profile not found");
        setData(d);
      })
      .catch((e) => setError(e.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [handle]);

  if (error)
    return <p className="mx-auto max-w-md rounded-2xl border border-line bg-card p-6 text-center text-sm text-zinc-400">{error}</p>;
  if (!data)
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="h-36 animate-pulse rounded-2xl bg-card" />
        <div className="h-40 animate-pulse rounded-2xl bg-card" />
      </div>
    );

  const { user } = data;
  const isOwner = viewer?.handle === user.handle;

  const share = async () => {
    const url = `${window.location.origin}/creator/${user.handle}`;
    try {
      if (navigator.share) await navigator.share({ title: `${user.displayName} on Mavyn`, url });
      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 2000); }
    } catch {}
  };
  const follow = async () => {
    if (!viewer) return promptJoin("follow");
    await fetch(`/api/follow/${user.id}`, { method: data.followedByMe ? "DELETE" : "POST" });
    load();
  };

  /* 48px-minimum touch targets throughout */
  const btn = "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold transition";

  return (
    <div className="mx-auto max-w-2xl" data-guide="mobile-profile">
      {/* 1 · cover — a compact visual accent (~112px phones), never the
          main event. object-cover crops from the center-safe area. */}
      <div className="relative h-28 overflow-hidden rounded-2xl border border-line bg-card sm:h-32 md:h-36">
        {user.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.coverUrl} alt="" className="h-full w-full object-cover" style={{ objectPosition: `center ${user.coverPos}%` }} />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-violet-500/20 via-transparent to-lime-400/10" />
        )}
      </div>

      {/* 2-7 · identity block */}
      <div className="px-4">
        <div className="-mt-9 mb-2 flex items-end justify-between">
          <span className="inline-block rounded-full ring-4 ring-ink">
            <Avatar initials={user.displayName.slice(0, 1)} src={user.avatarUrl ?? undefined} size="xl" className="!h-[72px] !w-[72px] text-lg sm:!h-20 sm:!w-20" />
          </span>
          {/* 8 · secondary actions live in "…" — the header stays calm */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-zinc-400 transition hover:text-zinc-200"
              aria-label="More options"
              data-guide="mobile-profile-more"
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-card shadow-2xl" onClick={() => setMenuOpen(false)}>
                <button onClick={share} className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm text-zinc-300 hover:bg-card-raised">
                  <Share2 size={15} /> {shared ? "Link copied" : "Share profile"}
                </button>
                {isOwner ? (
                  <>
                    <Link href="/profile/studio" className="flex items-center gap-2.5 px-4 py-3 text-sm text-zinc-300 hover:bg-card-raised">
                      <Sparkles size={15} /> Profile Studio
                    </Link>
                    <Link href="/settings" className="flex items-center gap-2.5 px-4 py-3 text-sm text-zinc-300 hover:bg-card-raised">
                      <Wrench size={15} /> Settings
                    </Link>
                  </>
                ) : (
                  <Link href={`/creator/${user.handle}?report=1`} className="flex items-center gap-2.5 px-4 py-3 text-sm text-rose-300 hover:bg-card-raised">
                    <ShieldCheck size={15} /> Report profile
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3 · name + verification */}
        <h1 className="flex items-center gap-1.5 text-lg font-bold leading-tight text-zinc-50">
          {user.displayName}
          {user.verified && <BadgeCheck size={18} className="shrink-0 text-sky-400" aria-label="Verified" />}
          {user.businessVerified && <Building2 size={16} className="shrink-0 text-sky-300" aria-label="Verified business" />}
        </h1>
        <p className="text-[13px] leading-snug text-zinc-500">@{user.handle}</p>

        {/* 4 · roles */}
        {user.roleLine && <p className="mt-0.5 text-[13px] font-medium leading-snug text-zinc-300">{user.roleLine}</p>}

        {/* 5 · open to work */}
        {user.openToWork && (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-lime-400/40 bg-lime-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lime-300">
            <span className="h-1 w-1 rounded-full bg-lime-400" /> Open to work
          </span>
        )}

        {/* 6 · campus + location — public labels only, privacy-respecting */}
        <div className="mt-2 space-y-0.5 text-xs leading-relaxed text-zinc-400">
          {data.academic && (
            <p className="flex items-center gap-1.5">
              <GraduationCap size={14} className="shrink-0 text-violet-300" />
              {data.academic.school}
              {data.academic.classOf && <span className="text-zinc-500">· Class of {data.academic.classOf}</span>}
              {data.academic.verified && <ShieldCheck size={12} className="text-violet-300" aria-label="Campus verified" />}
            </p>
          )}
          {(user.locationLabel || user.serviceArea) && (
            <p className="flex items-center gap-1.5">
              <MapPin size={14} className="shrink-0 text-zinc-500" />
              {user.locationLabel}
              {user.locationLabel && user.serviceArea && <span className="text-zinc-600">·</span>}
              {user.serviceArea && <span>Serves {user.serviceArea}</span>}
            </p>
          )}
        </div>

        {/* stats strip — compact single row */}
        <div className="mt-2 flex items-center gap-4 text-[13px] leading-snug">
          <span className="text-zinc-400"><b className="font-semibold text-zinc-100">{data.stats.followers}</b> followers</span>
          <span className="text-zinc-400"><b className="font-semibold text-zinc-100">{data.stats.following}</b> following</span>
          {data.stats.reviewsCount > 0 && (
            <span className="flex items-center gap-1 text-zinc-400">
              <Star size={12} className="text-amber-300" /> {data.stats.avgRating ?? "—"} ({data.stats.reviewsCount})
            </span>
          )}
        </div>

        {/* 8 · primary actions */}
        <div className="mt-3 flex gap-2" data-guide="mobile-profile-actions">
          {isOwner ? (
            <>
              <Link href="/profile/edit" className={`${btn} bg-lime-400 text-zinc-950 hover:bg-lime-300`} data-guide="mobile-edit-profile">
                <PencilLine size={16} /> Edit Profile
              </Link>
              <button onClick={share} className={`${btn} border border-line bg-card text-zinc-300 hover:border-zinc-600`}>
                <Share2 size={16} /> {shared ? "Copied" : "Share"}
              </button>
            </>
          ) : (
            <>
              <button onClick={follow} className={`${btn} ${data.followedByMe ? "border border-line bg-card text-zinc-300" : "bg-violet-400 text-zinc-950 hover:bg-violet-300"}`}>
                {data.followedByMe ? "Following" : "Follow"}
              </button>
              {viewer && <CreatorNotifyBell creatorId={user.id} />}
              <Link
                href={viewer ? `/messages?to=${user.handle}` : "#"}
                onClick={(e) => { if (!viewer) { e.preventDefault(); promptJoin("message"); } }}
                className={`${btn} border border-line bg-card text-zinc-300 hover:border-zinc-600`}
              >
                <MessageSquare size={16} /> Message
              </Link>
            </>
          )}
        </div>

        {/* 9 · bio — compact, expandable instead of pushing content down */}
        {user.bio && (
          <div className="mt-3">
            <p className={`text-[13px] leading-relaxed text-zinc-300 ${bioOpen ? "" : "line-clamp-2"}`}>{user.bio}</p>
            {user.bio.length > 110 && (
              <button onClick={() => setBioOpen((v) => !v)} className="mt-0.5 text-xs font-semibold text-zinc-500 transition hover:text-zinc-300">
                {bioOpen ? "Less" : "More"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 10 · content tabs — one section at a time, never everything at once */}
      <div className="sticky top-16 z-20 mt-4 border-b border-line bg-ink/95 backdrop-blur-xl" data-guide="mobile-profile-tabs">
        <div className="flex">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`min-h-[44px] flex-1 border-b-2 text-[13px] font-semibold transition ${
                tab === t ? "border-lime-400 text-zinc-50" : "border-transparent text-zinc-500"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 px-1">
        {tab === "Posts" && <PostsGrid handle={user.handle} displayName={user.displayName} services={data.services.map((s) => ({ id: s.id, title: s.title, price: s.price ?? 0, category: s.category }))} />}

        {tab === "Services" && (
          <div className="space-y-3">
            {data.services.length === 0 && <Empty text={isOwner ? "You haven't listed a service yet." : "No services listed yet."} />}
            {data.services.map((s) => (
              <Link key={s.id} href={`/services/${s.id}`} className="block rounded-2xl border border-line bg-card p-4 transition hover:border-zinc-600">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-100">{s.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{s.description}</p>
                  </div>
                  {s.price != null && <span className="shrink-0 text-sm font-bold text-lime-300">${s.price}</span>}
                </div>
                <div className="mt-2.5 flex items-center gap-2 text-[11px]">
                  <span className="rounded-full border border-line px-2 py-0.5 text-zinc-400">{s.category}</span>
                  {s.paused ? <span className="text-amber-300">Paused</span> : <span className="text-lime-300">{s.cta}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}

        {tab === "Portfolio" && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {data.portfolio.length === 0 && <div className="col-span-full"><Empty text="Nothing in the portfolio yet." /></div>}
            {data.portfolio.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-xl border border-line bg-card">
                {p.mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.mediaUrl} alt={p.title} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-card-raised text-zinc-600"><Briefcase size={20} /></div>
                )}
                <p className="truncate px-2.5 py-2 text-[11px] font-medium text-zinc-300">{p.title}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "About" && (
          <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
            <AboutCard title="Professional" icon={<Briefcase size={13} />}>
              {user.roleLine && <Row k="Roles" v={user.roleLine} />}
              {user.skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {user.skills.map((sk) => (
                    <span key={sk} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-zinc-400">{sk}</span>
                  ))}
                </div>
              )}
              {data.experience.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-line-soft pt-2.5">
                  {data.experience.slice(0, 4).map((x, i) => (
                    <p key={i} className="text-xs text-zinc-400">
                      <span className="font-semibold text-zinc-300">{x.position}</span> · {x.organization}
                      <span className="text-zinc-600"> {x.start}–{x.end || "now"}</span>
                    </p>
                  ))}
                </div>
              )}
            </AboutCard>

            <AboutCard title="Education" icon={<GraduationCap size={13} />}>
              {data.academic ? (
                <>
                  <Row k="School" v={data.academic.school} />
                  {data.academic.classOf && <Row k="Class of" v={data.academic.classOf} />}
                </>
              ) : (
                <p className="text-xs text-zinc-600">Not shared.</p>
              )}
            </AboutCard>

            <AboutCard title="Location" icon={<MapPin size={13} />}>
              {user.locationLabel ? <Row k="Based in" v={user.locationLabel} /> : <p className="text-xs text-zinc-600">Not shared.</p>}
              {user.serviceArea && <Row k="Service area" v={user.serviceArea} />}
              <p className="mt-2 text-[10px] text-zinc-600">Exact addresses are never shown — only what this member chose to share.</p>
            </AboutCard>

            <AboutCard title="Verification" icon={<ShieldCheck size={13} />}>
              <Row k="Identity" v={user.verified ? "Verified" : "Not verified"} good={user.verified} />
              <Row k="Campus" v={data.academic?.verified ? `Verified · ${data.academic.school}` : "Not verified"} good={!!data.academic?.verified} />
              {user.accountType === "business" && <Row k="Business" v={user.businessVerified ? "Verified" : "Not verified"} good={user.businessVerified} />}
            </AboutCard>

            {data.reviews.length > 0 && (
              <AboutCard title={`Reviews (${data.stats.reviewsCount})`} icon={<Star size={13} />}>
                {data.reviews.slice(0, 3).map((r, i) => (
                  <p key={i} className="mb-2 text-xs text-zinc-400 last:mb-0">
                    <span className="text-amber-300">{"★".repeat(r.rating)}</span> {r.body}
                  </p>
                ))}
              </AboutCard>
            )}

            <div className="md:col-span-2">
              <LiveReplaysSection handle={user.handle} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AboutCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-400">{icon} {title}</p>
      {children}
    </section>
  );
}
function Row({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <p className="flex items-baseline justify-between gap-3 py-0.5 text-xs">
      <span className="shrink-0 text-zinc-500">{k}</span>
      <span className={`text-right font-medium ${good === undefined ? "text-zinc-300" : good ? "text-lime-300" : "text-zinc-500"}`}>{v}</span>
    </p>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-line-soft bg-card p-6 text-center text-sm text-zinc-500">{text}</p>;
}
