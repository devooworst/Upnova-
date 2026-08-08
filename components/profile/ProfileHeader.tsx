"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { PencilLine, MapPin, MessageSquare, Megaphone, Zap, FolderPlus } from "lucide-react";
import PromoteModal from "../PromoteModal";
import FollowListModal from "../FollowListModal";
import Avatar from "../Avatar";
import VerifiedBadge from "../VerifiedBadge";
import { contact, reliability } from "@/lib/data";
import { useProfile, roleLine, locationLine } from "@/lib/profile";
import { useSession } from "@/lib/session";

/**
 * The header reads the live profile store (lib/profile) — anything saved in
 * Edit Profile appears here immediately. Visitor CTAs (Message / Hire Me /
 * Create Project) come from the owner's hiring + contact settings, and the
 * badges respect the owner's privacy toggles.
 */
export default function ProfileHeader({ isOwner }: { isOwner: boolean }) {
  const profile = useProfile();
  const { user } = useSession();
  const [following, setFollowing] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [listOpen, setListOpen] = useState<"followers" | "following" | null>(null);
  const [stats, setStats] = useState<{ followers: number | null; following: number | null }>({
    followers: null,
    following: null,
  });
  const [projectCounts, setProjectCounts] = useState<{ total: number; completed: number }>({ total: 0, completed: 0 });
  useEffect(() => {
    if (!user) return;
    fetch(`/api/users/${user.handle}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.stats && setStats(d.stats));
    fetch("/api/projects", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list = d.projects ?? [];
        setProjectCounts({
          total: list.length,
          completed: list.filter((p: { state: string }) => ["completed", "reviewed"].includes(p.state)).length,
        });
      });
  }, [user]);
  const isStudent = !!user?.campus;

  const canMessage = profile.whoCanMessage !== "nobody";
  const canHire = profile.hiringEnabled && profile.acceptBookings && profile.allowServiceRequests;
  const canProject = profile.hiringEnabled && profile.acceptOffers && profile.allowProjectRequests;

  return (
    <header className="card overflow-hidden">
      {/* banner */}
      <div className="relative h-36 sm:h-48">
        {profile.cover ? (
          profile.cover.startsWith("data:") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.cover}
              alt="Profile banner"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: `center ${profile.coverPos}%` }}
            />
          ) : (
            <Image
              src={profile.cover}
              alt="Profile banner — studio session"
              fill
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
              style={{ objectPosition: `center ${profile.coverPos}%` }}
              priority
            />
          )
        ) : (
          <div className="absolute inset-0 bg-card-raised" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-black/30" />
      </div>

      <div className="px-5 pb-5 sm:px-6">
        {/* avatar + actions */}
        <div className="flex items-end justify-between">
          <span className="-mt-12 inline-block rounded-full bg-gradient-to-tr from-white/70 via-white/20 to-white/40 p-[2px] sm:-mt-14">
            <span className="block rounded-full bg-card p-1">
              <Avatar
                src={profile.avatar}
                initials={profile.displayName.charAt(0) || "D"}
                gradient="from-lime-400 to-emerald-600"
                size="xl"
              />
            </span>
          </span>
          <div className="flex items-center gap-2 pb-1">
            {isOwner ? (
              <>
                <button
                  onClick={() => setPromoteOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 px-3.5 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/10 sm:text-sm"
                >
                  <Megaphone className="h-4 w-4" />
                  Promote
                </button>
                <Link href="/profile/edit" className="btn-ghost px-4 py-1.5 text-xs sm:text-sm">
                  <PencilLine className="h-4 w-4" />
                  Edit Profile
                </Link>
              </>
            ) : (
              <>
                <button
                  onClick={() => setFollowing(!following)}
                  className={
                    following
                      ? "rounded-full border border-violet-400/40 px-4 py-1.5 text-xs font-semibold text-violet-300 sm:text-sm"
                      : "rounded-full bg-violet-400 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-violet-300 hover:shadow-glow-violet sm:text-sm"
                  }
                >
                  {following ? "Following" : "Follow"}
                </button>
                {canMessage && (
                  <a href="/messages" className="btn-ghost px-3.5 py-1.5 text-xs sm:text-sm">
                    <MessageSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">Message</span>
                  </a>
                )}
                {canProject && (
                  <a
                    href="/messages"
                    className="hidden items-center gap-1.5 rounded-full border border-violet-400/40 px-3.5 py-1.5 text-xs font-semibold text-violet-300 transition hover:bg-violet-400/10 sm:inline-flex sm:text-sm"
                  >
                    <FolderPlus className="h-4 w-4" />
                    Create Project
                  </a>
                )}
                {canHire && (
                  <a href="/messages" className="btn-lime px-4 py-1.5 text-xs sm:text-sm">
                    <Zap className="h-4 w-4" />
                    Hire Me
                  </a>
                )}
              </>
            )}
          </div>
        </div>

        {/* identity */}
        <div className="mt-3">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-zinc-50">
            {profile.displayName}
            <VerifiedBadge className="h-5 w-5" />
            {profile.openToWork && (isOwner || profile.showAvailability) && (
              <span
                className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-lime-400/40 bg-lime-400/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-lime-300"
                title="User-controlled — set in Edit Profile → Work → Availability"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse-dot" />
                Open to Work
              </span>
            )}
            {isStudent && (
              <span
                className="ml-1 inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-400/10 px-2.5 py-1 text-[11px] font-bold text-violet-300"
                title="Platform-verified — earned through school verification, not editable"
              >
                Verified Student
              </span>
            )}
            {(isOwner || profile.showWorkPerformance) && (
              <span
                className="ml-1 inline-flex items-center gap-1 rounded-full border border-line bg-card-raised px-2.5 py-1 text-[11px] font-semibold text-zinc-200"
                title={`Platform-calculated — ${reliability.onTimeRate}% of verified projects completed on time. Not manually editable.`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-lime-400" /> Reliable Creator · {reliability.onTimeRate}% on time
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm font-medium text-zinc-400">{roleLine(profile)}</p>
          <p className="mt-2.5 max-w-xl text-[15px] leading-relaxed text-zinc-300">{profile.bio}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
            {(isOwner || profile.showLocation) && (
              <>
                <MapPin className="h-3.5 w-3.5 text-lime-400" />
                {locationLine(profile)} •{" "}
              </>
            )}
            {contact.joined} • {contact.responseTime.toLowerCase()}
          </p>
        </div>

        {/* stats */}
        <dl className="mt-5 grid grid-cols-4 gap-2 border-t border-line-soft pt-4">
          {(
            [
              { label: "Followers", value: stats.followers, interactive: true },
              { label: "Following", value: stats.following, interactive: true },
              { label: "Projects", value: projectCounts.total, interactive: false },
              { label: "Completed", value: projectCounts.completed, interactive: false },
            ] as const
          ).map((s) => {
            const hidden =
              !isOwner &&
              ((s.label === "Followers" && !profile.showFollowers) ||
                (s.label === "Following" && !profile.showFollowing));
            return (
              <button
                key={s.label}
                disabled={!s.interactive || hidden}
                onClick={() =>
                  s.interactive &&
                  !hidden &&
                  setListOpen(s.label === "Followers" ? "followers" : "following")
                }
                className={`text-center sm:text-left ${
                  s.interactive && !hidden ? "transition hover:opacity-80" : "cursor-default"
                }`}
              >
                <dd className="text-xl font-bold text-zinc-50">
                  {hidden ? "—" : (s.value ?? "—")}
                </dd>
                <dt className="text-xs text-zinc-500">{s.label}</dt>
              </button>
            );
          })}
        </dl>

        {/* skills */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {profile.skills.map((skill) => (
            <span key={skill} className="chip">
              {skill}
            </span>
          ))}
        </div>
      </div>
      {promoteOpen && <PromoteModal onClose={() => setPromoteOpen(false)} />}
      {listOpen && <FollowListModal mode={listOpen} onClose={() => setListOpen(null)} />}
    </header>
  );
}
