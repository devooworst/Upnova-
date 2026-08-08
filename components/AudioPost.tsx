"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Play, Pause, MapPin, Music2 } from "lucide-react";
import Avatar from "./Avatar";
import BottomStats from "./BottomStats";
import VerifiedBadge from "./VerifiedBadge";
import type { Post } from "@/lib/data";

const DURATION_S = 30;

export default function AudioPost({ post }: { post: Post }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const c = post.creator;
  const audio = post.audio!;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setProgress((p) => {
        const next = p + 0.1 / DURATION_S;
        if (next >= 1) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [playing]);

  const elapsed = Math.round(progress * DURATION_S);

  return (
    <article className="card p-4 sm:p-5">
      {/* header */}
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
          </p>
        </div>
        {playing && (
          <span className="flex items-end gap-0.5 pb-1" aria-label="Playing">
            <span className="w-1 rounded-full bg-lime-400 animate-eq-1" />
            <span className="w-1 rounded-full bg-lime-400 animate-eq-2" />
            <span className="w-1 rounded-full bg-lime-400 animate-eq-3" />
          </span>
        )}
      </div>

      <p className="mt-3 text-[15px] leading-relaxed text-zinc-200">{post.text}</p>

      {/* audio module */}
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line-soft bg-card-raised p-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-800">
          {audio.cover ? (
            <Image src={audio.cover} alt="" fill sizes="56px" className="object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center">
              <Music2 className="h-6 w-6 text-white" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-100">{audio.title}</p>
          <p className="text-xs text-zinc-500">{audio.subtitle}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-lime-400 transition-[width] duration-100"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span className="w-9 text-right font-mono text-[10px] text-zinc-500">
              0:{String(elapsed).padStart(2, "0")}
            </span>
          </div>
        </div>
        <button
          onClick={() => setPlaying(!playing)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime-400 text-zinc-950 shadow-glow transition hover:bg-lime-300 active:scale-95"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
        </button>
      </div>

      <div className="mt-3">
        <BottomStats likes={post.likes} comments={post.comments} shares={post.shares} />
      </div>
    </article>
  );
}
