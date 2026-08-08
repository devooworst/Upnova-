"use client";

import { useState } from "react";
import Image from "next/image";
import { Heart, X, MapPin } from "lucide-react";
import Avatar from "./Avatar";
import BottomStats from "./BottomStats";
import VerifiedBadge from "./VerifiedBadge";
import type { Post } from "@/lib/data";

export default function PostCard({ post }: { post: Post }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [burst, setBurst] = useState(false);
  const [liked, setLiked] = useState(false);

  const c = post.creator;

  const handleDouble = () => {
    if (!liked) setLiked(true);
    setBurst(true);
    setTimeout(() => setBurst(false), 650);
  };

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
      </div>

      {/* body */}
      <p className="mt-3 text-[15px] leading-relaxed text-zinc-200">{post.text}</p>

      {post.image && (
        <div
          className="group relative mt-3 cursor-zoom-in overflow-hidden rounded-2xl border border-line-soft"
          onClick={() => setFullscreen(true)}
          onDoubleClick={handleDouble}
          role="button"
          tabIndex={0}
          aria-label="View image fullscreen"
          onKeyDown={(e) => e.key === "Enter" && setFullscreen(true)}
        >
          <Image
            src={post.image}
            alt={post.imageAlt ?? ""}
            width={800}
            height={520}
            sizes="(max-width: 640px) 100vw, 640px"
            className="h-auto w-full object-cover transition duration-500 group-hover:scale-[1.015]"
          />
          {burst && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Heart className="h-20 w-20 fill-lime-400 text-lime-400 drop-shadow-lg animate-heart-pop" />
            </span>
          )}
        </div>
      )}

      {post.tags && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.tags.map((t) => (
            <span key={t} className="cursor-pointer text-sm font-medium text-lime-400/90 hover:text-lime-300">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3">
        <BottomStats
          likes={post.likes}
          comments={post.comments}
          shares={post.shares}
          initialSaved={post.saved}
          liked={liked}
          onLikedChange={setLiked}
        />
      </div>

      {/* fullscreen viewer */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2 sm:p-8"
          onClick={() => setFullscreen(false)}
        >
          <button
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close image"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.image}
            alt={post.imageAlt ?? ""}
            className="max-h-full max-w-full rounded-xl object-contain animate-fade-up"
          />
        </div>
      )}
    </article>
  );
}
