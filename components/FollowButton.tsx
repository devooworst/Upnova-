"use client";

import { useFollow } from "@/lib/follow";

interface FollowButtonProps {
  id: string;
  size?: "xs" | "sm";
  className?: string;
}

/** The one Follow button. Violet = people. Never triggers anything else. */
export default function FollowButton({ id, size = "sm", className = "" }: FollowButtonProps) {
  const { isFollowing, toggle } = useFollow();
  const following = isFollowing(id);
  const pad = size === "xs" ? "px-3 py-1 text-[11px]" : "px-3.5 py-1.5 text-xs";

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(id);
      }}
      aria-pressed={following}
      className={`shrink-0 rounded-full font-semibold transition ${pad} ${
        following
          ? "border border-violet-400/40 text-violet-300 hover:border-violet-400/70"
          : "bg-violet-400 text-zinc-950 hover:bg-violet-300 hover:shadow-glow-violet"
      } ${className}`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
