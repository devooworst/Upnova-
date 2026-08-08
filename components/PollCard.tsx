"use client";

import { useState } from "react";
import { BarChart2, MapPin } from "lucide-react";
import Avatar from "./Avatar";
import BottomStats from "./BottomStats";
import VerifiedBadge from "./VerifiedBadge";
import type { Post } from "@/lib/data";

export default function PollCard({ post }: { post: Post }) {
  const [voted, setVoted] = useState<number | null>(null);
  const c = post.creator;
  const poll = post.poll!;
  const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0) + (voted !== null ? 1 : 0);

  return (
    <article className="card-people p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar src={c.avatar} initials={c.initials} gradient={c.gradient} size="md" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-zinc-100">
            {c.name}
            {c.verified && <VerifiedBadge />}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
            {c.role}
            <span aria-hidden>•</span>
            {post.time}
            <span aria-hidden>•</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {c.location}
            </span>
            {post.distanceMi !== undefined && (
              <span className="font-mono text-[10px] font-medium text-zinc-400">
                • {post.distanceMi} mi
              </span>
            )}
          </p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-400/10 text-violet-400">
          <BarChart2 className="h-4 w-4" />
        </span>
      </div>

      <h3 className="mt-4 text-[15px] font-semibold text-zinc-100">{poll.question}</h3>

      <div className="mt-3 space-y-2">
        {poll.options.map((opt, i) => {
          const votes = opt.votes + (voted === i ? 1 : 0);
          const pct = Math.round((votes / totalVotes) * 100);
          return (
            <button
              key={opt.label}
              onClick={() => voted === null && setVoted(i)}
              disabled={voted !== null}
              className={`relative block w-full overflow-hidden rounded-xl border px-4 py-3 text-left text-sm transition ${
                voted === null
                  ? "cursor-pointer border-line bg-card-raised hover:border-lime-400/40"
                  : "border-line-soft bg-card-raised"
              }`}
            >
              {voted !== null && (
                <span
                  className={`absolute inset-y-0 left-0 ${
                    voted === i ? "bg-violet-400/20" : "bg-zinc-700/20"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              )}
              <span className="relative flex items-center justify-between gap-3">
                <span className={voted === i ? "font-semibold text-violet-300" : "text-zinc-200"}>
                  {opt.label}
                </span>
                {voted !== null && (
                  <span className={`font-mono text-xs ${voted === i ? "text-violet-300" : "text-zinc-500"}`}>
                    {pct}%
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2.5 text-xs text-zinc-500">
        {voted !== null ? (
          <>
            <span className="font-medium text-violet-400">You voted</span> • {totalVotes.toLocaleString()} votes
          </>
        ) : (
          <>{totalVotes.toLocaleString()} votes • Tap to vote</>
        )}
      </p>

      <div className="mt-3">
        <BottomStats likes={post.likes} comments={post.comments} shares={post.shares} />
      </div>
    </article>
  );
}
