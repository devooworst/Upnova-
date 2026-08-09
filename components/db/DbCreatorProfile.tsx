"use client";

/* ------------------------------------------------------------------ */
/*  Public creator profile — database-backed via /api/users/[handle].  */
/*  Privacy toggles, follow state, services, and contact CTAs all      */
/*  come from the owner's real record.                                 */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, MessageSquare, Zap, Lock, Star, ShieldCheck, BadgeCheck } from "lucide-react";
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
  academic?: {
    school: string;
    affiliation: string;
    classOf: string | null;
    program: string | null;
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

export default function DbCreatorProfile({ handle }: { handle: string }) {
  const router = useRouter();
  const { user: me } = useSession();
  const [data, setData] = useState<PublicProfile | null>(null);
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

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar src={user.avatarUrl} initials={user.displayName.charAt(0)} size="xl" />
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
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-violet-300">
                  <span>{data.academic.school}</span>
                  <span className="text-zinc-600">·</span>
                  <span>{data.academic.affiliation === "current_student" ? "Student" : data.academic.affiliation === "alumni" ? "Alumni" : "Faculty/Staff"}</span>
                  {data.academic.classOf && (
                    <>
                      <span className="text-zinc-600">·</span>
                      <span>Class of {data.academic.classOf}</span>
                    </>
                  )}
                  {data.academic.program && (
                    <>
                      <span className="text-zinc-600">·</span>
                      <span>{data.academic.program}</span>
                    </>
                  )}
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
      </header>

      {/* ---- Trust & authenticity — what's actually verified, computed from
           records. UpNova shows the evidence; it doesn't tell you who to
           trust. Badges are earned, never part of any subscription. ---- */}
      {data.trust && (
        <section className="card p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-zinc-100">
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

      <section className="card p-5">
        <h2 className="text-sm font-bold text-zinc-100">Posts</h2>
        <div className="mt-3">
          <PostsGrid
            handle={user.handle}
            displayName={user.displayName}
            services={services.map((s) => ({ id: s.id, title: s.title, price: s.price, category: s.category ?? "", cta: s.cta }))}
          />
        </div>
      </section>

      {services.length > 0 && (
        <section className="card p-5">
          <h2 className="text-sm font-bold text-zinc-100">Services</h2>
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

      {(data.reviews ?? []).length > 0 && (
        <section className="card p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-100">
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

      {experience.length > 0 && (
        <section className="card p-5">
          <h2 className="text-sm font-bold text-zinc-100">Experience</h2>
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
    </div>
  );
}
