"use client";

import { useState } from "react";
import { Heart, MessageCircle, Send, Bookmark } from "lucide-react";

interface BottomStatsProps {
  likes: number;
  comments: number;
  shares: number;
  initialLiked?: boolean;
  initialSaved?: boolean;
  /** controlled like state (used by PostCard double-tap) */
  liked?: boolean;
  onLikedChange?: (liked: boolean) => void;
}

export default function BottomStats({
  likes,
  comments,
  shares,
  initialLiked = false,
  initialSaved = false,
  liked,
  onLikedChange,
}: BottomStatsProps) {
  const [internalLiked, setInternalLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const isLiked = liked ?? internalLiked;
  const baseLikes = likes + (isLiked && !initialLiked ? 1 : 0);

  const toggleLike = () => {
    const next = !isLiked;
    if (onLikedChange) onLikedChange(next);
    else setInternalLiked(next);
  };

  return (
    <div className="flex items-center justify-between border-t border-line-soft pt-3">
      <div className="flex items-center gap-1">
        <button
          onClick={toggleLike}
          className={`group flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm transition hover:bg-card-raised ${
            isLiked ? "text-violet-400" : "text-zinc-400 hover:text-zinc-200"
          }`}
          aria-pressed={isLiked}
        >
          <Heart
            className={`h-[18px] w-[18px] transition-transform group-active:scale-90 ${
              isLiked ? "fill-violet-400" : ""
            }`}
          />
          {baseLikes}
        </button>
        <button className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-zinc-400 transition hover:bg-card-raised hover:text-zinc-200">
          <MessageCircle className="h-[18px] w-[18px]" />
          {comments}
        </button>
        <button className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-zinc-400 transition hover:bg-card-raised hover:text-zinc-200">
          <Send className="h-[18px] w-[18px]" />
          {shares}
        </button>
      </div>
      <button
        onClick={() => setSaved(!saved)}
        className={`rounded-full p-2 transition hover:bg-card-raised ${
          saved ? "text-amber-400" : "text-zinc-400 hover:text-zinc-200"
        }`}
        aria-pressed={saved}
        aria-label={saved ? "Remove bookmark" : "Save to bookmarks"}
      >
        <Bookmark className={`h-[18px] w-[18px] ${saved ? "fill-amber-400" : ""}`} />
      </button>
    </div>
  );
}
