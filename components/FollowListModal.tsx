"use client";

import { X } from "lucide-react";
import Link from "next/link";
import Avatar from "./Avatar";
import VerifiedBadge from "./VerifiedBadge";
import FollowButton from "./FollowButton";
import { creators, currentUser, type Creator } from "@/lib/data";
import { useFollow } from "@/lib/follow";

/* Follower / Following lists as a modal. */

export default function FollowListModal({
  mode,
  onClose,
  ownerName,
}: {
  mode: "followers" | "following";
  ownerName?: string;
  onClose: () => void;
}) {
  const { isFollowing } = useFollow();

  const list: Creator[] =
    mode === "following"
      ? creators.filter((c) => isFollowing(c.id))
      : creators.filter((c) => c.id !== currentUser.id).slice(0, 5);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={onClose}
    >
      <div className="card-people w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">
            {mode === "followers" ? "Followers" : "Following"}
            {ownerName ? <span className="font-normal text-zinc-500"> · {ownerName}</span> : null}
          </h2>
          <button onClick={onClose} className="icon-btn h-8 w-8" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
          {list.map((c) => (
            <li key={c.id} className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-card-raised">
              <Avatar src={c.avatar} initials={c.initials} gradient={c.gradient} size="sm" className="ring-1 ring-line" />
              <Link href={`/creator/${c.id}`} onClick={onClose} className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-sm font-semibold text-zinc-100">
                  {c.name} {c.verified && <VerifiedBadge />}
                </span>
                <span className="block truncate text-xs text-zinc-500">{c.role}</span>
              </Link>
              <FollowButton id={c.id} size="xs" />
            </li>
          ))}
          {list.length === 0 && (
            <li className="py-6 text-center text-xs text-zinc-500">
              Not following anyone yet — find your people in Discover.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
