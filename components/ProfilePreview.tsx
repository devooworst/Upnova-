"use client";

import Link from "next/link";
import { MapPin, MessageSquare, X } from "lucide-react";
import Avatar from "./Avatar";
import VerifiedBadge from "./VerifiedBadge";
import FollowButton from "./FollowButton";
import { useFollow, formatCount } from "@/lib/follow";
import { currentUser, type Creator } from "@/lib/data";

/* Compact profile preview: opens when you tap a person's avatar/name
   anywhere. Photo, name, username, location, primary skill, followers,
   then the three verbs that belong here: Follow · Message · View Profile. */

export default function ProfilePreview({
  creator,
  onClose,
}: {
  creator: Creator;
  onClose: () => void;
}) {
  const { followerCount } = useFollow();
  const isSelf = creator.id === currentUser.id;
  const profileHref = isSelf ? "/profile" : `/creator/${creator.id}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={onClose}
    >
      <div className="card-people w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <Avatar
            src={creator.avatar}
            initials={creator.initials}
            gradient={creator.gradient}
            size="lg"
            className="ring-2 ring-line"
          />
          <button onClick={onClose} className="icon-btn h-8 w-8" aria-label="Close preview">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-base font-bold tracking-tight text-zinc-50">
          {creator.name}
          {creator.verified && <VerifiedBadge />}
        </p>
        <p className="text-xs text-zinc-500">@{creator.handle}</p>

        <p className="mt-2 text-sm font-medium text-zinc-300">
          {creator.emoji} {creator.role}
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
          <MapPin className="h-3 w-3" />
          {creator.location}
          {creator.distanceMi !== undefined && creator.distanceMi <= 40 && (
            <span className="font-mono font-medium text-zinc-400">· {creator.distanceMi} mi</span>
          )}
        </p>
        <p className="mt-2 text-xs text-zinc-400">
          <span className="font-bold text-zinc-100">{formatCount(followerCount(creator))}</span>{" "}
          followers
        </p>

        {!isSelf && (
          <div className="mt-4 flex gap-2">
            <FollowButton id={creator.id} className="flex-1 !py-2" />
            <Link
              href={`/messages?to=${creator.handle}`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-line py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-card-raised"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Message
            </Link>
          </div>
        )}
        <Link
          href={profileHref}
          className="mt-2 flex w-full items-center justify-center rounded-full bg-white py-2 text-xs font-bold text-zinc-950 transition hover:bg-zinc-200"
        >
          View Profile
        </Link>
      </div>
    </div>
  );
}
