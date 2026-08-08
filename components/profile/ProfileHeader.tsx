"use client";

import Image from "next/image";
import { useState } from "react";
import { PencilLine, MapPin, MessageSquare, Megaphone, Zap } from "lucide-react";
import PromoteModal from "../PromoteModal";
import FollowListModal from "../FollowListModal";
import { useFollow, formatCount } from "@/lib/follow";
import { isStudentVerified, PRO_EVENT } from "@/lib/pro";
import { useEffect } from "react";
import Avatar from "../Avatar";
import VerifiedBadge from "../VerifiedBadge";
import { currentUser, profileStats, contact, reliability } from "@/lib/data";

export default function ProfileHeader({ isOwner }: { isOwner: boolean }) {
  const [following, setFollowing] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [listOpen, setListOpen] = useState<"followers" | "following" | null>(null);
  const { followingCount } = useFollow();
  const [isStudent, setIsStudent] = useState(false);
  useEffect(() => {
    const sync = () => setIsStudent(isStudentVerified());
    sync();
    window.addEventListener(PRO_EVENT, sync);
    return () => window.removeEventListener(PRO_EVENT, sync);
  }, []);
  return (
    <header className="card overflow-hidden">
      {/* banner */}
      <div className="relative h-36 sm:h-48">
        <Image
          src="/images/banner.jpg"
          alt="Profile banner — studio session"
          fill
          sizes="(max-width: 1024px) 100vw, 1024px"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-black/30" />
      </div>

      <div className="px-5 pb-5 sm:px-6">
        {/* avatar + actions */}
        <div className="flex items-end justify-between">
          <span className="-mt-12 inline-block rounded-full bg-gradient-to-tr from-white/70 via-white/20 to-white/40 p-[2px] sm:-mt-14">
            <span className="block rounded-full bg-card p-1">
              <Avatar src={currentUser.avatar} initials={currentUser.initials} size="xl" />
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
                <button className="btn-ghost px-4 py-1.5 text-xs sm:text-sm">
                  <PencilLine className="h-4 w-4" />
                  Edit Profile
                </button>
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
                <a href="/messages" className="btn-ghost px-3.5 py-1.5 text-xs sm:text-sm">
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Message</span>
                </a>
                <a href="/messages" className="btn-lime px-4 py-1.5 text-xs sm:text-sm">
                  <Zap className="h-4 w-4" />
                  Hire Me
                </a>
              </>
            )}
          </div>
        </div>

        {/* identity */}
        <div className="mt-3">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-zinc-50">
            {currentUser.name}
            {currentUser.verified && <VerifiedBadge className="h-5 w-5" />}
            <span className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-lime-400/40 bg-lime-400/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-lime-300">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse-dot" />
              Open to Work
            </span>
            {isStudent && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-400/10 px-2.5 py-1 text-[11px] font-bold text-violet-300">
                Verified Student
              </span>
            )}
            <span
              className="ml-1 inline-flex items-center gap-1 rounded-full border border-line bg-card-raised px-2.5 py-1 text-[11px] font-semibold text-zinc-200"
              title={`${reliability.onTimeRate}% of verified projects completed on time`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-lime-400" /> Reliable Creator · {reliability.onTimeRate}% on time
            </span>
          </h1>
          <p className="mt-1 text-sm font-medium text-zinc-400">{currentUser.role}</p>
          <p className="mt-2.5 max-w-xl text-[15px] leading-relaxed text-zinc-300">{currentUser.bio}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
            <MapPin className="h-3.5 w-3.5 text-lime-400" />
            {currentUser.location} • {contact.joined} • {contact.responseTime.toLowerCase()}
          </p>
        </div>

        {/* stats */}
        <dl className="mt-5 grid grid-cols-4 gap-2 border-t border-line-soft pt-4">
          {profileStats.map((s) => {
            const interactive = s.label === "Followers" || s.label === "Following";
            const value =
              s.label === "Following" ? `${345 + followingCount}` : s.value;
            return (
              <button
                key={s.label}
                disabled={!interactive}
                onClick={() =>
                  interactive &&
                  setListOpen(s.label === "Followers" ? "followers" : "following")
                }
                className={`text-center sm:text-left ${
                  interactive ? "transition hover:opacity-80" : "cursor-default"
                }`}
              >
                <dd className="text-xl font-bold text-zinc-50">{value}</dd>
                <dt className="text-xs text-zinc-500">{s.label}</dt>
              </button>
            );
          })}
        </dl>

        {/* skills */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {currentUser.skills.map((skill) => (
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
