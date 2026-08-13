"use client";

/* ------------------------------------------------------------------ */
/*  Public creator profile — database-backed via /api/users/[handle].  */
/*  Privacy toggles, follow state, services, and contact CTAs all      */
/*  come from the owner's real record.                                 */
/* ------------------------------------------------------------------ */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { THEMES, FRAMES, ACCENTS, FONTS, EFFECTS, SECTION_IDS, ENVIRONMENTS, WORLD_ELEMENT_IDS, WORLD_ELEMENT_LABELS, BANNERS, WORLD_DESIGN_WIDTH, worldDeviceForWidth, resolveWorldLayout, type WorldDevice, type StudioConfig, type WorldElement, type WorldImage } from "@/lib/profileStudio";
import { Star as StarDeco, Heart, Leaf, Sparkles as SparklesIcon, Music2, Zap as ZapIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, MessageSquare, Zap, Lock, Star, ShieldCheck, BadgeCheck, GraduationCap } from "lucide-react";
import { ACCOUNT_BADGES } from "@/lib/trust";
import Avatar from "@/components/Avatar";
import LiveReplaysSection from "@/components/LiveReplaysSection";
import VerifiedBadge from "@/components/VerifiedBadge";
import PosterBadge, { posterTypeOf } from "@/components/PosterBadge";
import PostsGrid from "@/components/db/PostsGrid";
import { useSession } from "@/lib/session";
import { promptJoin } from "@/components/GuestGate";

interface PublicProfile {
  user: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    coverUrl?: string | null;
    coverPos?: number;
    verified: boolean;
    roleLine: string;
    bio: string;
    skills: string[];
    city: string | null;
    state: string | null;
    locationLabel?: string | null;
    serviceArea?: string;
    openToWork: boolean;
    hiringEnabled: boolean;
    trustLevel: string;
    accountType?: string;
    businessVerified?: boolean;
  };
  business?: { openOpportunities: { id: string; title: string; budget: number | null; location: string; remote: boolean; type: string }[]; activeCount: number; hires: number } | null;
  studio?: import("@/lib/profileStudio").StudioConfig | null;
  studioDemoPreview?: boolean;
  academic?: {
    school: string;
    schoolSlug?: string;
    affiliation: string;
    classOf: string | null;
    verified: boolean;
  } | null;
  stats: {
    followers: number | null;
    following: number | null;
    rating: number | null;
    reviewsCount: number;
    completedProjects: number | null;
    approvedExtensions: number;
  };
  followedByMe: boolean;
  trust?: {
    licensesIssued?: number;
    badges: { identityVerified: boolean; businessVerified: boolean; studentVerified: boolean };
    completedProjects: number;
    completedBookings: number;
    verifiedWorkPosts: number;
    clientConfirmedPosts: number;
    reviewsCount: number;
    rating: number | null;
  };
  services: { id: string; title: string; description: string; price: number; reach: string; category?: string; cta?: string }[];
  pastServices?: { id: string; title: string; category: string; since: string }[];
  experience: { id: string; position: string; organization: string; start: string; end: string; description: string }[];
  reviews?: { rating: number; body: string; createdAt: string }[];
}

/** WYSIWYG edit mode (Profile Studio): when `edit` is provided, this SAME
    renderer becomes the canvas — real components, real data — with
    selection outlines, drag-to-move, and resize handles layered on top.
    The editor never has a second representation that could drift. */
export interface WorldEditProps {
  studio: StudioConfig;
  selected: string;
  device: WorldDevice; // the layout being edited — desktop | tablet | phone
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<WorldElement>) => void;
  /** free image layers — same gesture system, separate collection */
  onImageChange?: (id: string, patch: Partial<WorldImage>) => void;
  onImageRemove?: (id: string) => void;
  /** unsaved banner/cover being edited in the Studio — same fields the
      profile PATCH persists; undefined = use the saved profile cover */
  coverUrl?: string | null;
  coverPos?: number;
}

export default function DbCreatorProfile({ handle, edit }: { handle: string; edit?: WorldEditProps }) {
  const router = useRouter();
  const { user: me } = useSession();
  const [data, setData] = useState<PublicProfile | null>(null);
  // WYSIWYG edit interaction state (only used when `edit` is provided)
  const editDrag = useRef<{
    id: string; mode: string; startX: number; startY: number; el: WorldElement; measuredH: number;
    others: { l: number; r: number; cx: number; t: number; b: number; cy: number }[];
  } | null>(null);
  const editCanvasRef = useRef<HTMLDivElement>(null);
  /* ---- ONE LAYOUT ENGINE: the world canvas is laid out at the active
     device layout's fixed DESIGN width (desktop 960 / tablet 720 /
     phone 390) and uniformly scaled to the measured container — in the
     editor AND on the published profile. Identical text wrapping,
     identical heights, identical positions, every viewport. The scale
     is measured live, never hard-coded. ---- */
  const [availW, setAvailW] = useState<number | null>(null);
  const worldScaleRef = useRef(1);
  const measureRO = useRef<ResizeObserver | null>(null);
  const measureNode = useCallback((node: HTMLDivElement | null) => {
    measureRO.current?.disconnect();
    if (node) {
      const apply = () => setAvailW(node.clientWidth || null);
      const ro = new ResizeObserver(apply);
      ro.observe(node);
      measureRO.current = ro;
      apply();
    }
  }, []);
  // temporary smart-alignment guides — exist only while dragging.
  // dist = live distance indicators (design-px labels to the nearest
  // neighbor on each side); equal/equalH = vertical/horizontal even-gap.
  const [dragGuides, setDragGuides] = useState<{
    v: number[];
    h: number[];
    equal: boolean;
    equalH: boolean;
    dist: { axis: "x" | "y"; from: number; to: number; at: number; label: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/users/${handle}`, { cache: "no-store" });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Profile not available");
      return;
    }
    setData(d);
  }, [handle]);

  useEffect(() => {
    load();
  }, [load]);

  // profile-view signal for the recommendation engine (never for yourself)
  useEffect(() => {
    if (!data || !me || me.id === data.user.id) return;
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "user", targetId: data.user.id, action: "profile_view" }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.user.id, me?.id]);

  if (error)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Lock className="mx-auto h-6 w-6 text-zinc-500" />
        <p className="mt-2 text-sm font-semibold text-zinc-200">{error}</p>
        <Link href="/" className="btn-ghost mt-4 inline-flex px-4 py-1.5 text-xs">Back home</Link>
      </div>
    );

  if (!data) return <div className="card mx-auto h-64 max-w-3xl animate-pulse" aria-hidden />;

  const { user, stats, services, experience } = data;
  const isMe = me?.id === user.id;

  const follow = async () => {
    if (me === null) return promptJoin("follow"); // UX only — the API 401s regardless
    setBusy(true);
    await fetch(`/api/follow/${user.id}`, { method: data.followedByMe ? "DELETE" : "POST" });
    await load();
    setBusy(false);
  };

  const message = async () => {
    if (me === null) return promptJoin("message");
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toHandle: user.handle }),
    });
    const d = await res.json();
    if (res.ok) router.push(`/messages?c=${d.conversationId}`);
    else if (res.status === 401) promptJoin("message");
  };

  const studio = edit ? edit.studio : (data.studio ?? null);
  const theme = THEMES[studio?.theme ?? "none"] ?? THEMES.none;
  const frame = FRAMES[studio?.frame ?? "none"] ?? FRAMES.none;
  const accent = ACCENTS[studio?.accent ?? "none"] ?? ACCENTS.none;
  const headingFont = FONTS[studio?.font ?? "standard"] ?? FONTS.standard;
  const effect = EFFECTS[studio?.effect ?? "none"] ?? EFFECTS.none;
  const banner = BANNERS[studio?.banner ?? "none"] ?? BANNERS.none;
  const coverUrl = edit && edit.coverUrl !== undefined ? edit.coverUrl : user.coverUrl ?? null;
  const coverPos = edit && edit.coverPos !== undefined ? edit.coverPos : user.coverPos ?? 50;
  /* the banner/cover — REAL profile data (profiles.coverUrl), the same
     image Edit Profile manages; rendered identically for owner, Studio
     canvas, and visitors */
  const coverBlock = coverUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={coverUrl}
      alt=""
      className="h-36 w-full object-cover sm:h-44"
      style={{ objectPosition: `center ${coverPos}%` }}
    />
  ) : null;
  const DECO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    stars: StarDeco, hearts: Heart, vines: Leaf, sparkles: SparklesIcon, notes: Music2, bolts: ZapIcon,
  };
  const decorations = (studio?.decorations ?? []).filter((d) => DECO_ICONS[d]);
  const decoStrip = decorations.length > 0 && (
    <span className="pointer-events-none absolute right-3 top-2 flex gap-1.5 opacity-70" aria-hidden>
      {decorations.map((d) => {
        const I = DECO_ICONS[d];
        return <I key={d} className="h-3.5 w-3.5 text-zinc-300" />;
      })}
    </span>
  );

  const headerBlock = (
    <>
      <header className={`card relative overflow-hidden ${theme.card} ${theme.headerRing} ${effect.cls}`}>
        {coverBlock}
        {banner.css && <span className={`absolute inset-x-0 top-0 h-2.5 ${coverBlock ? "z-10" : ""}`} style={{ backgroundImage: banner.css }} aria-hidden />}
        {decoStrip}
        <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className={`inline-flex ${frame.cls}`}>
              <Avatar src={user.avatarUrl} initials={user.displayName.charAt(0)} size="xl" />
            </span>
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-zinc-50">
                {user.displayName}
                {user.verified && <VerifiedBadge className="h-5 w-5" />}
                {user.openToWork && user.accountType !== "business" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/40 bg-lime-400/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-lime-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse-dot" /> Open to Work
                  </span>
                )}
                {user.accountType === "business" && (
                  <PosterBadge type={posterTypeOf(user)} size="md" />
                )}
                {user.accountType !== "business" && user.trustLevel !== "standard" && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-400/10 px-2.5 py-1 text-[11px] font-bold text-violet-300"
                    title="Verified through Mavyn's identity process. Documents are never shown to other users — only this badge."
                  >
                    Identity verified
                  </span>
                )}
              </h1>
              <p className="mt-0.5 text-sm font-medium text-zinc-400">{user.roleLine || `@${user.handle}`}</p>
              {data.academic && (
                <p className="mt-1.5">
                  <Link
                    href={data.academic.schoolSlug ? `/schools/${data.academic.schoolSlug}` : "#"}
                    className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-400/10 px-2.5 py-1 text-[11px] font-bold text-violet-300 transition hover:bg-violet-400/20"
                    title="Platform-verified school affiliation. Tap to see everyone at this school on Mavyn."
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    {data.academic.school}
                    {data.academic.classOf ? ` · Class of ${data.academic.classOf}` : ""}
                    {data.academic.affiliation === "alumni" ? " · Alumni" : data.academic.affiliation === "faculty_staff" ? " · Faculty / Staff" : ""}
                  </Link>
                </p>
              )}
              {user.locationLabel && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                  <MapPin className="h-3.5 w-3.5 text-lime-400" />
                  {user.locationLabel}
                  {user.serviceArea && user.serviceArea !== "Remote" && (
                    <span className="text-zinc-600">· serves {user.serviceArea.toLowerCase()}</span>
                  )}
                </p>
              )}
            </div>
          </div>
          {!isMe && me && (
            <div className="flex items-center gap-2">
              <button
                onClick={follow}
                disabled={busy}
                className={
                  data.followedByMe
                    ? "rounded-full border border-violet-400/40 px-4 py-1.5 text-xs font-semibold text-violet-300 sm:text-sm"
                    : "rounded-full bg-violet-400 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-violet-300 sm:text-sm"
                }
              >
                {data.followedByMe ? "Following" : "Follow"}
              </button>
              <button onClick={message} className="btn-ghost px-3.5 py-1.5 text-xs sm:text-sm">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Message</span>
              </button>
              {user.hiringEnabled && services.length > 0 && (
                <Link href="/services" className="btn-lime px-4 py-1.5 text-xs sm:text-sm">
                  <Zap className="h-4 w-4" /> Book or Request
                </Link>
              )}
            </div>
          )}
          {isMe && (
            <Link href="/profile/edit" className="btn-ghost px-4 py-1.5 text-xs sm:text-sm">
              Edit Profile
            </Link>
          )}
        </div>

        {user.bio && <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-300">{user.bio}</p>}

        <dl className="mt-4 flex gap-8 border-t border-line-soft pt-4">
          {stats.followers != null && (
            <div>
              <dd className="text-xl font-bold text-zinc-50">{stats.followers}</dd>
              <dt className="text-xs text-zinc-500">Followers</dt>
            </div>
          )}
          {stats.following != null && (
            <div>
              <dd className="text-xl font-bold text-zinc-50">{stats.following}</dd>
              <dt className="text-xs text-zinc-500">Following</dt>
            </div>
          )}
          {stats.completedProjects != null && (
            <div>
              <dd className="text-xl font-bold text-zinc-50">{stats.completedProjects}</dd>
              <dt className="text-xs text-zinc-500" title="Calculated from completed Mavyn projects — never self-reported">
                Completed
              </dt>
            </div>
          )}
          {stats.rating != null && (
            <div>
              <dd className="flex items-center gap-1 text-xl font-bold text-zinc-50">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {stats.rating.toFixed(1)}
              </dd>
              <dt className="text-xs text-zinc-500">
                {stats.reviewsCount} review{stats.reviewsCount === 1 ? "" : "s"}
              </dt>
            </div>
          )}
          <div>
            <dd className="text-xl font-bold text-zinc-50">{services.length}</dd>
            <dt className="text-xs text-zinc-500">Services</dt>
          </div>
        </dl>

        {user.skills.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {user.skills.map((s) => (
              <span key={s} className="chip">
                {s}
              </span>
            ))}
          </div>
        )}
          {data.business && (
            <div className="mt-4 border-t border-line-soft pt-3">
              <div className="grid grid-cols-3 gap-3 text-center sm:max-w-sm">
                <div>
                  <p className="font-mono text-base font-semibold tracking-tight text-sky-300">{data.stats?.followers ?? 0}</p>
                  <p className="font-mono text-[8px] font-medium uppercase tracking-[0.1em] text-zinc-500">followers</p>
                </div>
                <div>
                  <p className="font-mono text-base font-semibold tracking-tight text-lime-300">{data.business.activeCount}</p>
                  <p className="font-mono text-[8px] font-medium uppercase tracking-[0.1em] text-zinc-500">open roles</p>
                </div>
                <div>
                  <p className="font-mono text-base font-semibold tracking-tight text-zinc-100">{data.business.hires}</p>
                  <p className="font-mono text-[8px] font-medium uppercase tracking-[0.1em] text-zinc-500">hires made</p>
                </div>
              </div>
              {data.business.openOpportunities.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Open opportunities</p>
                  {data.business.openOpportunities.map((o) => (
                    <Link key={o.id} href={`/opportunities/${o.id}`} className="flex items-center gap-2 rounded-lg border border-line bg-card-raised px-3 py-2 text-xs transition hover:border-zinc-600">
                      <span className="min-w-0 flex-1 truncate font-semibold text-zinc-100">{o.title}</span>
                      <span className="shrink-0 text-zinc-500">{o.remote ? "Remote" : o.location}</span>
                      {o.budget != null && <span className="shrink-0 font-bold tabular-nums text-lime-400">${o.budget}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>
    </>
  );

  const sectionBlocks: Record<string, React.ReactNode> = {
    trust: (
      <React.Fragment key="trust">
      {/* ---- Trust & authenticity — what's actually verified, computed from
     records. Mavyn shows the evidence; it doesn't tell you who to
     trust. Badges are earned, never part of any subscription. ---- */}
      {data.trust && (
  <section className={`card p-5 ${theme.card} ${effect.cls}`}>
    <h2 className={`flex items-center gap-1.5 text-sm font-bold ${accent.text} ${headingFont.cls}`}>
      <ShieldCheck className="h-4 w-4 text-lime-400" /> Trust &amp; authenticity
    </h2>
    <div className="mt-3 flex flex-wrap gap-1.5">
      {data.trust.badges.identityVerified && (
        <span title={ACCOUNT_BADGES.identity_verified.description} className="inline-flex items-center gap-1 rounded-full border border-lime-400/40 bg-lime-400/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-lime-300">
          <BadgeCheck className="h-3 w-3" /> Identity Verified
        </span>
      )}
      {data.trust.badges.businessVerified && (
        <span title={ACCOUNT_BADGES.business_verified.description} className="inline-flex items-center gap-1 rounded-full border border-sky-400/40 bg-sky-400/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-300">
          <BadgeCheck className="h-3 w-3" /> Business Verified
        </span>
      )}
      {data.trust.badges.studentVerified && (
        <span title={ACCOUNT_BADGES.student_verified.description} className="inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-400/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-300">
          <BadgeCheck className="h-3 w-3" /> Student Verified
        </span>
      )}
      {!data.trust.badges.identityVerified && !data.trust.badges.businessVerified && !data.trust.badges.studentVerified && (
        <span className="text-xs text-zinc-500">No verifications yet — badges are earned, never bought.</span>
      )}
    </div>
    <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-line-soft pt-3 text-xs text-zinc-400 sm:grid-cols-4">
      <li>
        <span className="block font-mono text-base font-semibold tracking-[0.05em] text-zinc-100">
          {data.trust.completedProjects + data.trust.completedBookings}
        </span>
        Completed on Mavyn
      </li>
      <li>
        <span className="block font-mono text-base font-semibold tracking-[0.05em] text-lime-300">{data.trust.verifiedWorkPosts}</span>
        Verified work posts
      </li>
      <li>
        <span className="block font-mono text-base font-semibold tracking-[0.05em] text-violet-300">{data.trust.clientConfirmedPosts}</span>
        Client confirmations
      </li>
      <li>
        <span className="block font-mono text-base font-semibold tracking-[0.05em] text-zinc-100">
          {data.trust.rating != null ? `${data.trust.rating.toFixed(1)}` : "—"}
        </span>
        {data.trust.reviewsCount} review{data.trust.reviewsCount === 1 ? "" : "s"}
      </li>
      {(data.trust.licensesIssued ?? 0) > 0 && (
        <li>
          <span className="block font-mono text-base font-semibold tracking-[0.05em] text-zinc-100">{data.trust.licensesIssued}</span>
          Licenses issued
        </li>
      )}
    </ul>
  </section>
      )}
      </React.Fragment>
    ),
    posts: (
      <React.Fragment key="posts">
      <section className={`card p-5 ${theme.card} ${effect.cls}`}>
  <h2 className={`text-sm font-bold ${accent.text} ${headingFont.cls}`}>Posts</h2>
  <div className="mt-3">
    <PostsGrid
      handle={user.handle}
      displayName={user.displayName}
      services={services.map((s) => ({ id: s.id, title: s.title, price: s.price, category: s.category ?? "", cta: s.cta }))}
    />
  </div>
      </section>
      </React.Fragment>
    ),
    services: (
      <React.Fragment key="services">
      {services.length > 0 && (
  <section className={`card p-5 ${theme.card} ${effect.cls}`}>
    <h2 className={`text-sm font-bold ${accent.text} ${headingFont.cls}`}>Services</h2>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {services.map((s) => (
        <article key={s.id} className="card-service flex flex-col p-4">
          <h3 className="text-sm font-bold text-zinc-100">
            <Link href={`/services/${s.id}`} className="transition hover:text-lime-300">{s.title}</Link>
          </h3>
          <p className="font-mono text-sm font-medium tracking-[0.08em] text-lime-300">From ${s.price}</p>
          <p className="mt-1.5 flex-1 text-xs leading-relaxed text-zinc-400">{s.description}</p>
          <p className="mt-2 text-[10px] text-zinc-500">{s.reach}</p>
          {!isMe && me && (
            <Link href="/services" className="btn-lime mt-3 w-full justify-center py-1.5 text-xs">
              <Zap className="h-3.5 w-3.5" /> View on Services
            </Link>
          )}
        </article>
      ))}
    </div>
    {/* deactivated services stay part of the record — history, not erasure */}
    {(data.pastServices ?? []).length > 0 && (
      <div className="mt-4 border-t border-line-soft pt-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Past services</p>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {data.pastServices!.map((s) => (
            <li key={s.id}>
              <Link
                href={`/services/${s.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300"
              >
                {s.title} <span className="text-zinc-700">· {s.category}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )}
  </section>
      )}
      </React.Fragment>
    ),
    reviews: (
      <React.Fragment key="reviews">
      {(data.reviews ?? []).length > 0 && (
  <section className={`card p-5 ${theme.card} ${effect.cls}`}>
    <h2 className={`flex items-center gap-2 text-sm font-bold ${accent.text} ${headingFont.cls}`}>
      Reviews
      <span className="font-normal text-zinc-500">from verified projects only</span>
    </h2>
    <div className="mt-3 space-y-2.5">
      {(data.reviews ?? []).map((r, i) => (
        <div key={i} className="rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
          <p className="flex items-center gap-1 text-xs font-semibold text-amber-300">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {r.rating.toFixed(1)}
            <span className="ml-1 font-normal text-zinc-600">
              {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            </span>
          </p>
          {r.body && <p className="mt-1 text-xs leading-relaxed text-zinc-300">{r.body}</p>}
        </div>
      ))}
    </div>
  </section>
      )}
      </React.Fragment>
    ),
    experience: (
      <React.Fragment key="experience">
      {experience.length > 0 && (
  <section className={`card p-5 ${theme.card} ${effect.cls}`}>
    <h2 className={`text-sm font-bold ${accent.text} ${headingFont.cls}`}>Experience</h2>
    <ol className="mt-4 space-y-4 border-l border-line pl-4">
      {experience.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[23px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-card bg-lime-400" />
          <p className="text-sm font-semibold text-zinc-100">
            {e.position} <span className="font-normal text-zinc-400">— {e.organization}</span>
          </p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            {e.start} — {e.end || "Now"}
          </p>
          {e.description && <p className="mt-1 text-xs leading-relaxed text-zinc-400">{e.description}</p>}
        </li>
      ))}
    </ol>
  </section>
      )}
      </React.Fragment>
    ),
  };

  /* ---------------- MY WORLD (Pro): the owner-designed environment ----------------
     Free placement of APPROVED elements on desktop; below sm everything
     stacks in top-to-bottom order so mobile never breaks. The hero (name,
     identity, actions) is indivisible and always visible; every function
     inside it stays standard Mavyn. */
  const world = studio?.world;
  if (world?.enabled) {
    /* WHICH LAYOUT? The editor edits its selected device; the viewer
       measures its container and picks the matching saved layout —
       the SAME resolver, so editor and profile can never disagree. */
    const viewDevice: WorldDevice = edit ? edit.device : worldDeviceForWidth(availW ?? WORLD_DESIGN_WIDTH);
    const resolved = resolveWorldLayout(world, viewDevice);
    const DESIGN_W = resolved.designWidth;
    // stacked = the clean fallback flow for phones WITHOUT a custom
    // phone layout (readable > miniature). A saved phone design renders
    // freeform at phone design width instead.
    const stacked = resolved.stackedFallback;
    const scale = Math.min(1.25, Math.max(0.2, (availW ?? DESIGN_W) / DESIGN_W));
    worldScaleRef.current = scale;
    const images: Record<string, WorldImage> = resolved.images;
    const imgOf = (key: string) => images[key.slice(4)];
    const isImgKey = (key: string) => key.startsWith("img:");
    const routePatch = (key: string, patch: Record<string, number>) => {
      if (!edit) return;
      if (isImgKey(key)) edit.onImageChange?.(key.slice(4), patch);
      else edit.onChange(key, patch);
    };
    const startInteraction = (id: string, mode: string) => (e: React.PointerEvent) => {
      if (!edit || stacked) return;
      e.preventDefault();
      e.stopPropagation();
      edit.onSelect(id);
      const img = isImgKey(id) ? imgOf(id) : null;
      if (img?.locked && mode !== "select") return; // locked layers never drag
      const el: WorldElement = img
        ? { x: img.x, y: img.y, w: img.w, h: 0, rotate: img.rotate, layer: img.layer, hidden: false }
        : resolved.elements[id];
      if (!el) return;
      const host = (e.currentTarget as HTMLElement).closest("[data-world-el]") as HTMLElement | null;
      const canvas = editCanvasRef.current;
      const others: { l: number; r: number; cx: number; t: number; b: number; cy: number }[] = [];
      if (canvas) {
        const cw = canvas.clientWidth || 1; // offset metrics are DESIGN units (transform-immune)
        canvas.querySelectorAll<HTMLElement>("[data-world-el]").forEach((n) => {
          if (n.dataset.worldEl === id) return;
          const l = (n.offsetLeft / cw) * 100;
          const r = ((n.offsetLeft + n.offsetWidth) / cw) * 100;
          others.push({ l, r, cx: (l + r) / 2, t: n.offsetTop, b: n.offsetTop + n.offsetHeight, cy: n.offsetTop + n.offsetHeight / 2 });
        });
      }
      editDrag.current = { id, mode, startX: e.clientX, startY: e.clientY, el: { ...el }, measuredH: host?.offsetHeight ?? 200, others };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    };
    const onCanvasMove = (e: React.PointerEvent) => {
      const d = editDrag.current;
      const rect = editCanvasRef.current?.getBoundingClientRect();
      if (!d || !rect || !edit) return;
      const isImg = isImgKey(d.id);
      // rect.width is the SCALED on-screen width → % math stays exact;
      // vertical motion converts screen px → design px via the live scale
      const dxPct = ((e.clientX - d.startX) / rect.width) * 100;
      const dy = (e.clientY - d.startY) / worldScaleRef.current;
      const baseH = d.el.h > 0 ? d.el.h : d.measuredH;
      const clampH = (v: number) => Math.round(Math.min(1600, Math.max(0, v)));
      const minW = isImg ? 4 : 24;
      if (d.mode === "move") {
        /* FREEFORM canvas + smart assistance: positions are free (no grid
           quantization). When an edge/center comes close to another
           element's edge/center — or the canvas edges/center — a rose
           guide appears and the card gently snaps. Alt/Option bypasses
           all magnetism for raw placement. */
        let x = Math.min(100, Math.max(0, d.el.x + dxPct));
        let y = Math.min(4000, Math.max(0, d.el.y + dy));
        const wPct = d.el.w;
        const hPx = d.el.h > 0 ? d.el.h : d.measuredH;
        const v: number[] = [];
        const hg: number[] = [];
        let equal = false;
        let equalH = false;
        if (!e.altKey) {
          const TX = 0.9; // % — small threshold: helpful, never sticky
          const TY = 8; // design px
          const vCands = [0, 50, 100, ...d.others.flatMap((o) => [o.l, o.r, o.cx])];
          const myV: [number, (c: number) => number][] = [
            [x, (c) => c],
            [x + wPct, (c) => c - wPct],
            [x + wPct / 2, (c) => c - wPct / 2],
          ];
          outerV: for (const [edge, apply] of myV)
            for (const c of vCands)
              if (Math.abs(edge - c) <= TX) { x = Math.max(0, Math.min(100, apply(c))); v.push(c); break outerV; }
          const hCands = [0, ...d.others.flatMap((o) => [o.t, o.b, o.cy])];
          const myH: [number, (c: number) => number][] = [
            [y, (c) => c],
            [y + hPx, (c) => c - hPx],
            [y + hPx / 2, (c) => c - hPx / 2],
          ];
          outerH: for (const [edge, apply] of myH)
            for (const c of hCands)
              if (Math.abs(edge - c) <= TY) { y = Math.max(0, Math.min(4000, apply(c))); hg.push(c); break outerH; }
          // EQUAL SPACING (vertical): nearest neighbor fully above and fully
          // below — when the two gaps get close, snap to even and say so
          const above = d.others.filter((o) => o.b <= y + TY).sort((a, b) => b.b - a.b)[0];
          const below = d.others.filter((o) => o.t >= y + hPx - TY).sort((a, b) => a.t - b.t)[0];
          if (above && below) {
            const gapUp = y - above.b;
            const gapDown = below.t - (y + hPx);
            if (gapUp > 4 && gapDown > 4 && Math.abs(gapUp - gapDown) <= 12) {
              y = Math.max(0, above.b + (below.t - above.b - hPx) / 2);
              equal = true;
            }
          }
          // EQUAL SPACING (horizontal): nearest vertically-overlapping
          // neighbor on each side — even out the left/right gaps too
          const overlapsMe = (o: typeof d.others[number]) => o.t < y + hPx && o.b > y;
          const leftN = d.others.filter((o) => overlapsMe(o) && o.r <= x + TX).sort((a, b) => b.r - a.r)[0];
          const rightN = d.others.filter((o) => overlapsMe(o) && o.l >= x + wPct - TX).sort((a, b) => a.l - b.l)[0];
          if (leftN && rightN) {
            const gapL = x - leftN.r;
            const gapR = rightN.l - (x + wPct);
            if (gapL > 0.5 && gapR > 0.5 && Math.abs(gapL - gapR) <= 1.4) {
              x = Math.max(0, Math.min(100, leftN.r + (rightN.l - leftN.r - wPct) / 2));
              equalH = true;
            }
          }
        }
        /* DISTANCE INDICATORS — always-on measurements while dragging
           (they inform, they never snap; Alt keeps them too). Labels are
           DESIGN px, the canvas's own unit — nothing screenshot-specific. */
        const dist: { axis: "x" | "y"; from: number; to: number; at: number; label: string }[] = [];
        {
          const hPx = d.el.h > 0 ? d.el.h : d.measuredH;
          const wPct = d.el.w;
          const pctToPx = (p: number) => (p * DESIGN_W) / 100;
          const spansX = (o: typeof d.others[number]) => o.l < x + wPct && o.r > x; // horizontal overlap
          const spansY = (o: typeof d.others[number]) => o.t < y + hPx && o.b > y; // vertical overlap
          const nAbove = d.others.filter((o) => spansX(o) && o.b <= y).sort((a, b) => b.b - a.b)[0];
          if (nAbove && y - nAbove.b >= 2)
            dist.push({ axis: "y", from: nAbove.b, to: y, at: x + wPct / 2, label: `${Math.round(y - nAbove.b)}px` });
          const nBelow = d.others.filter((o) => spansX(o) && o.t >= y + hPx).sort((a, b) => a.t - b.t)[0];
          if (nBelow && nBelow.t - (y + hPx) >= 2)
            dist.push({ axis: "y", from: y + hPx, to: nBelow.t, at: x + wPct / 2, label: `${Math.round(nBelow.t - (y + hPx))}px` });
          const nLeft = d.others.filter((o) => spansY(o) && o.r <= x).sort((a, b) => b.r - a.r)[0];
          if (nLeft && pctToPx(x - nLeft.r) >= 4)
            dist.push({ axis: "x", from: nLeft.r, to: x, at: y + hPx / 2, label: `${Math.round(pctToPx(x - nLeft.r))}px` });
          const nRight = d.others.filter((o) => spansY(o) && o.l >= x + wPct).sort((a, b) => a.l - b.l)[0];
          if (nRight && pctToPx(nRight.l - (x + wPct)) >= 4)
            dist.push({ axis: "x", from: x + wPct, to: nRight.l, at: y + hPx / 2, label: `${Math.round(pctToPx(nRight.l - (x + wPct)))}px` });
        }
        setDragGuides(v.length || hg.length || equal || equalH || dist.length ? { v, h: hg, equal, equalH, dist } : null);
        routePatch(d.id, { x: Math.round(x * 10) / 10, y: Math.round(y) });
      }
      else if (d.mode === "e")
        routePatch(d.id, { w: Math.round(Math.min(100, Math.max(minW, d.el.w + dxPct)) * 10) / 10 });
      else if (d.mode === "w")
        routePatch(d.id, {
          w: Math.round(Math.min(100, Math.max(minW, d.el.w - dxPct)) * 10) / 10,
          x: Math.round(Math.min(100, Math.max(0, d.el.x + dxPct)) * 10) / 10,
        });
      else if (d.mode === "rot") {
        // cards stay subtle (±8°); image decorations rotate freely (±180°)
        const range = isImg ? 180 : 8;
        const speed = isImg ? 2 : 14;
        routePatch(d.id, { rotate: Math.round(Math.min(range, Math.max(-range, d.el.rotate + (e.clientX - d.startX) / speed))) });
      }
      else {
        // any edge/corner combination: n/s adjust height (n also moves y),
        // e/w adjust width (w also moves x) — composable like a real design tool
        const patch: Record<string, number> = {};
        const fine = (v: number) => Math.round(v * 10) / 10;
        if (d.mode.includes("e")) patch.w = fine(Math.min(100, Math.max(minW, d.el.w + dxPct)));
        if (d.mode.includes("w")) {
          patch.w = fine(Math.min(100, Math.max(minW, d.el.w - dxPct)));
          patch.x = fine(Math.min(100, Math.max(0, d.el.x + dxPct)));
        }
        if (!isImg && d.mode.includes("s")) patch.h = clampH(baseH + dy);
        if (!isImg && d.mode.includes("n")) {
          patch.h = clampH(baseH - dy);
          patch.y = Math.round(Math.min(4000, Math.max(0, d.el.y + dy)));
        }
        if (isImg && d.mode.includes("n")) patch.y = Math.round(Math.min(4000, Math.max(0, d.el.y + dy)));
        routePatch(d.id, patch);
      }
    };
    const endInteraction = () => {
      editDrag.current = null;
      setDragGuides(null); // guides never linger
    };

    const env = ENVIRONMENTS[world.environment] ?? ENVIRONMENTS.cosmic;
    const els = WORLD_ELEMENT_IDS
      .map((id) => ({ id, el: resolved.elements[id] }))
      .filter((x) => x.el && (!x.el.hidden || x.id === "hero"))
      .sort((a, b) => a.el.y - b.el.y);
    const imgEntries = Object.entries(images);
    const canvasH = Math.max(
      900,
      Math.max(...els.map((x) => x.el.y)) + 640,
      ...imgEntries.map(([, im]) => im.y + 360)
    );
    const worldTitle = (world.title ?? "").trim() || `${user.displayName}'s world`;
    const showTitle = world.showTitle !== false;

    /* selected-layer controls — clear front/back relationship management */
    const layerControls = (key: string) => {
      if (!edit) return null;
      const img = isImgKey(key) ? imgOf(key) : null;
      const cur = img ? img.layer : resolved.elements[key]?.layer ?? 10;
      const [lo, hi] = img ? [-10, 30] : [0, 20];
      const setLayer = (v: number) => {
        const nv = Math.min(hi, Math.max(lo, v));
        if (img) edit.onImageChange?.(key.slice(4), { layer: nv });
        else edit.onChange(key, { layer: nv });
      };
      const stop = (e: React.PointerEvent | React.MouseEvent) => { e.stopPropagation(); };
      const btn = "rounded bg-zinc-950/85 px-1.5 py-0.5 font-mono text-[9px] font-bold text-lime-300 hover:bg-zinc-950";
      return (
        <span onPointerDown={stop} onClick={stop} className="absolute -top-[3.4rem] left-0 z-20 flex items-center gap-1 rounded-lg border border-lime-400/40 bg-zinc-900/95 px-1.5 py-1 shadow-xl">
          <button className={btn} title="Send to back" onClick={() => setLayer(lo)}>⟪</button>
          <button className={btn} title="Send backward" onClick={() => setLayer(cur - 1)}>−</button>
          <span className="font-mono text-[9px] text-zinc-400">z {cur}</span>
          <button className={btn} title="Bring forward" onClick={() => setLayer(cur + 1)}>+</button>
          <button className={btn} title="Bring to front" onClick={() => setLayer(hi)}>⟫</button>
          {img && (
            <>
              <span className="mx-0.5 h-4 w-px bg-zinc-700" />
              <input
                type="range" min={5} max={100} value={Math.round(img.opacity * 100)}
                onChange={(e) => edit.onImageChange?.(key.slice(4), { opacity: Number(e.target.value) / 100 })}
                className="h-1 w-14 accent-lime-400" title="Opacity"
              />
              <button className={btn} title={img.locked ? "Unlock" : "Lock (prevents accidental drags)"} onClick={() => edit.onImageChange?.(key.slice(4), { locked: !img.locked })}>
                {img.locked ? "🔒" : "🔓"}
              </button>
              <button className="rounded bg-rose-500/90 px-1.5 py-0.5 font-mono text-[9px] font-bold text-zinc-50 hover:bg-rose-500" title="Delete image" onClick={() => edit.onImageRemove?.(key.slice(4))}>✕</button>
            </>
          )}
        </span>
      );
    };

    return (
      <div className={edit ? "" : "mx-auto max-w-5xl"}>
        <div className="relative overflow-hidden rounded-2xl border border-line" style={{ backgroundImage: env.css }}>
          {env.overlay !== "none" && (
            <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: env.overlay }} aria-hidden />
          )}

          {data.studioDemoPreview && (
            <p className="relative mx-4 mt-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-[10px] text-amber-300">
              DEMO MODE preview — only you see this world until Pro is active.
            </p>
          )}
          {/* the profile banner lives ON the header card (inside the hero
              element), exactly as visitors see it on a standard profile.
              The canvas background is the ENVIRONMENT — a separate concept. */}
          <div className="relative p-3 sm:p-4">
            {stacked ? (
              /* ---- PHONE FALLBACK: the clean stacked flow (readable
                 always beats miniature) — used when no custom phone
                 layout exists. Still measured, so widening the window
                 switches straight back to the designed canvas. ---- */
              <div ref={measureNode} className="relative w-full">
                {els.map(({ id }) => (
                  <div key={id} className="relative mb-4">
                    {id === "hero" ? headerBlock : sectionBlocks[id] ?? null}
                  </div>
                ))}
              </div>
            ) : (
              /* ---- SCALED DESIGN CANVAS: laid out at DESIGN_W, scaled to
                 the real container. What you saved is what renders. ---- */
              <div ref={measureNode} className="relative w-full" style={{ height: canvasH * scale }}>
                <div
                  ref={editCanvasRef}
                  onPointerMove={edit ? onCanvasMove : undefined}
                  onPointerUp={edit ? endInteraction : undefined}
                  className="relative"
                  style={{ width: DESIGN_W, height: canvasH, transform: `scale(${scale})`, transformOrigin: "top left", touchAction: edit ? "none" : undefined }}
                >
                  {/* world headline — an overlay, not a flow block */}
                  {showTitle && (
                    <div className="pointer-events-none absolute inset-x-1 top-0 z-[1] flex items-center justify-between px-3 pt-1" aria-hidden={!worldTitle}>
                      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.24em] text-zinc-400/90">{worldTitle}</p>
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500/80">built on Mavyn</p>
                    </div>
                  )}
                  {/* SMART GUIDES — rose lines while dragging, gone on release */}
                  {edit && dragGuides && (
                    <>
                      {dragGuides.v.map((gv, i) => (
                        <span key={`v${i}`} className="pointer-events-none absolute bottom-0 top-0 z-40 w-px bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]" style={{ left: `${gv}%` }} aria-hidden />
                      ))}
                      {dragGuides.h.map((gh, i) => (
                        <span key={`h${i}`} className="pointer-events-none absolute inset-x-0 z-40 h-px bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]" style={{ top: gh }} aria-hidden />
                      ))}
                      {(dragGuides.equal || dragGuides.equalH) && (
                        <span className="pointer-events-none absolute left-1/2 top-2 z-40 -translate-x-1/2 rounded-full bg-rose-400 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-zinc-950 shadow">
                          {dragGuides.equal && dragGuides.equalH ? "Equal spacing ⇕⇔" : dragGuides.equal ? "Equal spacing ⇕" : "Equal spacing ⇔"}
                        </span>
                      )}
                      {/* DISTANCE INDICATORS — dashed rulers with live px labels */}
                      {dragGuides.dist.map((g, i) =>
                        g.axis === "y" ? (
                          <span key={`dy${i}`} className="pointer-events-none absolute z-40 flex w-0 items-center justify-center border-l border-dashed border-rose-300/90" style={{ left: `${g.at}%`, top: g.from, height: Math.max(1, g.to - g.from) }} aria-hidden>
                            <span className="rounded bg-rose-400/95 px-1 py-px font-mono text-[9px] font-bold leading-tight text-zinc-950 shadow">{g.label}</span>
                          </span>
                        ) : (
                          <span key={`dx${i}`} className="pointer-events-none absolute z-40 flex h-0 items-center justify-center border-t border-dashed border-rose-300/90" style={{ top: g.at, left: `${g.from}%`, width: `${Math.max(0.1, g.to - g.from)}%` }} aria-hidden>
                            <span className="rounded bg-rose-400/95 px-1 py-px font-mono text-[9px] font-bold leading-tight text-zinc-950 shadow">{g.label}</span>
                          </span>
                        )
                      )}
                    </>
                  )}

                  {/* ---- FREE IMAGE LAYERS — visual layers, never in the
                       card flow: behind cards (negative z), between, or in
                       front. The saved layer survives round-trips. ---- */}
                  {imgEntries.map(([iid, im]) => {
                    const key = `img:${iid}`;
                    const isSel = edit && edit.selected === key;
                    return (
                      <div
                        key={key}
                        data-world-el={key}
                        className="absolute"
                        style={{ left: `${im.x}%`, top: im.y, width: `${im.w}%`, zIndex: im.layer, transform: im.rotate ? `rotate(${im.rotate}deg)` : undefined }}
                      >
                        <img
                          src={im.src}
                          alt=""
                          draggable={false}
                          className={`h-auto w-full select-none ${edit ? "" : "pointer-events-none"}`}
                          style={{ opacity: im.opacity }}
                        />
                        {edit && (
                          <div
                            onPointerDown={startInteraction(key, "move")}
                            className={`absolute -inset-0.5 rounded-lg transition ${im.locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"} ${
                              isSel ? "ring-2 ring-sky-400" : "ring-1 ring-transparent hover:ring-sky-400/40"
                            }`}
                            role="button"
                            aria-label="Select image layer"
                          >
                            {isSel && (
                              <>
                                {layerControls(key)}
                                <span className="absolute -top-6 left-0 z-10 flex items-center gap-1.5 whitespace-nowrap rounded bg-sky-400 px-1.5 py-0.5 text-[9px] font-bold text-zinc-950">
                                  Image layer{im.locked ? " · locked" : ""}
                                  <span className="rounded bg-zinc-950/20 px-1 font-mono font-semibold">
                                    {im.x}% · {im.y}px · w{im.w}%{im.rotate ? ` · ${im.rotate}°` : ""} · {Math.round(im.opacity * 100)}%
                                  </span>
                                </span>
                                {!im.locked && (
                                  <>
                                    <span onPointerDown={startInteraction(key, "rot")} className="absolute -top-9 left-1/2 z-10 h-5 w-5 -translate-x-1/2 cursor-grab rounded-full border-2 border-zinc-900 bg-sky-400 shadow" title="Drag sideways to rotate" aria-label="Rotate image" />
                                    <span onPointerDown={startInteraction(key, "e")} className="absolute -right-2 top-1/2 z-10 h-10 w-4 -translate-y-1/2 cursor-ew-resize rounded border border-zinc-900 bg-sky-400 shadow" aria-label="Resize right" />
                                    <span onPointerDown={startInteraction(key, "w")} className="absolute -left-2 top-1/2 z-10 h-10 w-4 -translate-y-1/2 cursor-ew-resize rounded border border-zinc-900 bg-sky-400 shadow" aria-label="Resize left" />
                                    <span onPointerDown={startInteraction(key, "se")} className="absolute -bottom-2 -right-2 z-10 h-4 w-4 cursor-nwse-resize rounded border border-zinc-900 bg-sky-400 shadow" aria-label="Resize corner" />
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {els.map(({ id, el }) => {
                    const isSel = edit && edit.selected === id;
                    return (
                    <div
                      key={id}
                      data-world-el={id}
                      className="absolute"
                      style={{ left: `${el.x}%`, top: el.y, width: `${el.w}%`, zIndex: el.layer, transform: el.rotate ? `rotate(${el.rotate}deg)` : undefined, minHeight: el.h > 0 ? el.h : undefined }}
                    >
                      {/* in edit mode the real content shows but doesn't swallow clicks */}
                      <div className={edit ? "pointer-events-none select-none" : undefined}>
                        {id === "hero" ? headerBlock : sectionBlocks[id] ?? null}
                      </div>
                      {edit && (
                        <div
                          onPointerDown={startInteraction(id, "move")}
                          className={`absolute -inset-0.5 cursor-grab rounded-xl transition active:cursor-grabbing ${
                            isSel ? "ring-2 ring-lime-400" : "ring-1 ring-transparent hover:ring-lime-400/40"
                          }`}
                          role="button"
                          aria-label={`Select ${WORLD_ELEMENT_LABELS[id]}`}
                        >
                          {isSel && (
                            <>
                              {layerControls(id)}
                              <span className="absolute -top-6 left-0 z-10 flex items-center gap-1.5 whitespace-nowrap rounded bg-lime-400 px-1.5 py-0.5 text-[9px] font-bold text-zinc-950">
                                {WORLD_ELEMENT_LABELS[id]}
                                {id === "hero" ? " · identity & actions locked inside" : ""}
                                <span className="rounded bg-zinc-950/20 px-1 font-mono font-semibold">
                                  {el.x}% · {el.y}px · w{el.w}%{el.h > 0 ? ` · h${el.h}px` : ""}{el.rotate ? ` · ${el.rotate}°` : ""}
                                </span>
                              </span>
                              {/* rotation — grab and pull sideways */}
                              <span onPointerDown={startInteraction(id, "rot")} className="absolute -top-9 left-1/2 z-10 h-5 w-5 -translate-x-1/2 cursor-grab rounded-full border-2 border-zinc-900 bg-lime-400 shadow" title="Drag sideways to rotate" aria-label="Rotate" />
                              {/* edges — generous hit areas, correct cursors */}
                              <span onPointerDown={startInteraction(id, "e")} className="absolute -right-2 top-1/2 z-10 h-10 w-4 -translate-y-1/2 cursor-ew-resize rounded border border-zinc-900 bg-lime-400 shadow" aria-label="Resize right edge" />
                              <span onPointerDown={startInteraction(id, "w")} className="absolute -left-2 top-1/2 z-10 h-10 w-4 -translate-y-1/2 cursor-ew-resize rounded border border-zinc-900 bg-lime-400 shadow" aria-label="Resize left edge" />
                              <span onPointerDown={startInteraction(id, "n")} className="absolute -top-2 left-1/2 z-10 h-4 w-10 -translate-x-1/2 cursor-ns-resize rounded border border-zinc-900 bg-lime-400 shadow" aria-label="Resize top edge" />
                              <span onPointerDown={startInteraction(id, "s")} className="absolute -bottom-2 left-1/2 z-10 h-4 w-10 -translate-x-1/2 cursor-ns-resize rounded border border-zinc-900 bg-lime-400 shadow" aria-label="Resize bottom edge" />
                              {/* all four corners */}
                              <span onPointerDown={startInteraction(id, "nw")} className="absolute -left-2 -top-2 z-10 h-4 w-4 cursor-nwse-resize rounded border border-zinc-900 bg-lime-400 shadow" aria-label="Resize from top-left" />
                              <span onPointerDown={startInteraction(id, "ne")} className="absolute -right-2 -top-2 z-10 h-4 w-4 cursor-nesw-resize rounded border border-zinc-900 bg-lime-400 shadow" aria-label="Resize from top-right" />
                              <span onPointerDown={startInteraction(id, "sw")} className="absolute -bottom-2 -left-2 z-10 h-4 w-4 cursor-nesw-resize rounded border border-zinc-900 bg-lime-400 shadow" aria-label="Resize from bottom-left" />
                              <span onPointerDown={startInteraction(id, "se")} className="absolute -bottom-2 -right-2 z-10 h-4 w-4 cursor-nwse-resize rounded border border-zinc-900 bg-lime-400 shadow" aria-label="Resize from bottom-right" />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-3xl space-y-4 rounded-2xl ${theme.wash} ${theme.wash ? "p-2 sm:p-3" : ""}`}>
      {theme.deco && <div className={`h-1 rounded-full ${theme.deco}`} aria-hidden />}
      {headerBlock}

      {/* ---- Profile Studio (Pro, appearance-only): approved design system
           values only; the header, actions, and every function stay
           Mavyn-controlled. Sections below render in the owner's saved
           order. ---- */}
      {data.studioDemoPreview && (
        <p className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-4 py-2 text-[11px] text-amber-300">
          DEMO MODE preview — only you see this customization until Pro is active.
        </p>
      )}
      {(() => {
        const order = data.studio?.sections?.length ? data.studio.sections : [...SECTION_IDS];
        return <>{order.map((id) => sectionBlocks[id] ?? null)}</>;
      })()}

      {/* saved live replays — one live ecosystem, surfaced on the profile */}
      <LiveReplaysSection handle={handle} />
    </div>
  );
}
