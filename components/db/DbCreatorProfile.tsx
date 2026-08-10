"use client";

/* ------------------------------------------------------------------ */
/*  Public creator profile — database-backed via /api/users/[handle].  */
/*  Privacy toggles, follow state, services, and contact CTAs all      */
/*  come from the owner's real record.                                 */
/* ------------------------------------------------------------------ */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { THEMES, FRAMES, ACCENTS, FONTS, EFFECTS, SECTION_IDS, ENVIRONMENTS, WORLD_ELEMENT_IDS, WORLD_ELEMENT_LABELS, BANNERS, type StudioConfig, type WorldElement } from "@/lib/profileStudio";
import { Star as StarDeco, Heart, Leaf, Sparkles as SparklesIcon, Music2, Zap as ZapIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, MessageSquare, Zap, Lock, Star, ShieldCheck, BadgeCheck, GraduationCap } from "lucide-react";
import { ACCOUNT_BADGES } from "@/lib/trust";
import Avatar from "@/components/Avatar";
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
  device: "desktop" | "tablet" | "mobile";
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<WorldElement>) => void;
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
  const editDrag = useRef<{ id: string; mode: "move" | "e" | "w"; startX: number; startY: number; el: WorldElement } | null>(null);
  const editCanvasRef = useRef<HTMLDivElement>(null);
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
                    title="Verified through UpNova's identity process. Documents are never shown to other users — only this badge."
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
                    title="Platform-verified school affiliation. Tap to see everyone at this school on UpNova."
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
              <dt className="text-xs text-zinc-500" title="Calculated from completed UpNova projects — never self-reported">
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
        </div>
      </header>
    </>
  );

  const sectionBlocks: Record<string, React.ReactNode> = {
    trust: (
      <React.Fragment key="trust">
      {/* ---- Trust & authenticity — what's actually verified, computed from
     records. UpNova shows the evidence; it doesn't tell you who to
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
        Completed on UpNova
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
        <article key={s.id} className="card-money flex flex-col p-4">
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
     inside it stays standard UpNova. */
  const world = studio?.world;
  if (world?.enabled) {
    const stacked = edit?.device === "mobile"; // the REAL phone behavior
    const snap2 = (v: number) => Math.round(v / 2) * 2;
    const snap20 = (v: number) => Math.round(v / 20) * 20;
    const startInteraction = (id: string, mode: "move" | "e" | "w") => (e: React.PointerEvent) => {
      if (!edit || stacked) return;
      e.preventDefault();
      e.stopPropagation();
      edit.onSelect(id);
      const el = world.elements[id];
      editDrag.current = { id, mode, startX: e.clientX, startY: e.clientY, el: { ...el } };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    };
    const onCanvasMove = (e: React.PointerEvent) => {
      const d = editDrag.current;
      const rect = editCanvasRef.current?.getBoundingClientRect();
      if (!d || !rect || !edit) return;
      const dxPct = ((e.clientX - d.startX) / rect.width) * 100;
      const dy = e.clientY - d.startY;
      if (d.mode === "move")
        edit.onChange(d.id, {
          x: snap2(Math.min(100, Math.max(0, d.el.x + dxPct))),
          y: snap20(Math.min(4000, Math.max(0, d.el.y + dy))),
        });
      else if (d.mode === "e")
        edit.onChange(d.id, { w: snap2(Math.min(100, Math.max(24, d.el.w + dxPct))) });
      else
        edit.onChange(d.id, {
          w: snap2(Math.min(100, Math.max(24, d.el.w - dxPct))),
          x: snap2(Math.min(100, Math.max(0, d.el.x + dxPct))),
        });
    };
    const endInteraction = () => (editDrag.current = null);
    const env = ENVIRONMENTS[world.environment] ?? ENVIRONMENTS.cosmic;
    const els = WORLD_ELEMENT_IDS
      .map((id) => ({ id, el: world.elements[id] }))
      .filter((x) => x.el && (!x.el.hidden || x.id === "hero"))
      .sort((a, b) => a.el.y - b.el.y);
    const canvasH = Math.max(...els.map((x) => x.el.y)) + 640;
    return (
      <div className="mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-2xl border border-line" style={{ backgroundImage: env.css }}>
          {env.overlay !== "none" && (
            <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: env.overlay }} aria-hidden />
          )}
          <div className="relative flex items-center justify-between gap-2 px-4 pt-3">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.24em] text-zinc-400/90">
              {user.displayName}&apos;s world
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500/80">built on UpNova</p>
          </div>
          {data.studioDemoPreview && (
            <p className="relative mx-4 mt-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-[10px] text-amber-300">
              DEMO MODE preview — only you see this world until Pro is active.
            </p>
          )}
          {coverUrl && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-72" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt="" className="h-full w-full object-cover opacity-80" style={{ objectPosition: `center ${coverPos}%`, maskImage: "linear-gradient(180deg, black 55%, transparent 100%)", WebkitMaskImage: "linear-gradient(180deg, black 55%, transparent 100%)" }} />
            </div>
          )}
          <div className="relative p-3 sm:p-4">
            <div
              ref={editCanvasRef}
              onPointerMove={edit && !stacked ? onCanvasMove : undefined}
              onPointerUp={edit && !stacked ? endInteraction : undefined}
              className={stacked ? "relative" : "relative sm:h-[var(--wh)]"}
              style={stacked ? undefined : ({ "--wh": `${canvasH}px`, touchAction: edit ? "none" : undefined } as React.CSSProperties)}
            >
              {els.map(({ id, el }) => {
                const isSel = edit && edit.selected === id;
                return (
                <div
                  key={id}
                  className={
                    stacked
                      ? "relative mb-4"
                      : "relative mb-4 sm:absolute sm:mb-0 sm:left-[var(--wx)] sm:top-[var(--wy)] sm:w-[var(--ww)] sm:z-[var(--wz)] sm:rotate-[var(--wr)]"
                  }
                  style={stacked ? undefined : ({ "--wx": `${el.x}%`, "--wy": `${el.y}px`, "--ww": `${el.w}%`, "--wz": String(el.layer), "--wr": `${el.rotate}deg` } as React.CSSProperties)}
                >
                  {/* in edit mode the real content shows but doesn't swallow clicks */}
                  <div className={edit && !stacked ? "pointer-events-none select-none" : undefined}>
                    {id === "hero" ? headerBlock : sectionBlocks[id] ?? null}
                  </div>
                  {edit && !stacked && (
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
                          <span className="absolute -top-6 left-0 z-10 whitespace-nowrap rounded bg-lime-400 px-1.5 py-0.5 text-[9px] font-bold text-zinc-950">
                            {WORLD_ELEMENT_LABELS[id]}
                            {id === "hero" ? " · identity & actions locked inside" : ""}
                          </span>
                          <span onPointerDown={startInteraction(id, "e")} className="absolute -right-1.5 top-1/2 z-10 h-7 w-3 -translate-y-1/2 cursor-ew-resize rounded-sm border border-zinc-900 bg-lime-400" aria-label="Resize from the right edge" />
                          <span onPointerDown={startInteraction(id, "w")} className="absolute -left-1.5 top-1/2 z-10 h-7 w-3 -translate-y-1/2 cursor-ew-resize rounded-sm border border-zinc-900 bg-lime-400" aria-label="Resize from the left edge" />
                          <span onPointerDown={startInteraction(id, "e")} className="absolute -bottom-1.5 -right-1.5 z-10 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-zinc-900 bg-lime-400" aria-label="Resize from the corner" />
                        </>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
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
           UpNova-controlled. Sections below render in the owner's saved
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
    </div>
  );
}
