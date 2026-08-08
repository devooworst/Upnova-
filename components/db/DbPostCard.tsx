"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, MessageCircle, MapPin, Send, Bookmark } from "lucide-react";
import Avatar from "@/components/Avatar";
import VerifiedBadge from "@/components/VerifiedBadge";

export interface FeedAuthor {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  verified: boolean;
  roleLine: string;
  city: string | null;
  state: string | null;
  /** the most precise location the author chose to share */
  locationLabel?: string | null;
}

export interface FeedPost {
  id: string;
  body: string;
  imageUrl: string | null;
  kind: string;
  createdAt: string;
  author: FeedAuthor;
  likes: number;
  comments: number;
  likedByMe: boolean;
  isMine: boolean;
}

interface CommentItem {
  id: string;
  body: string;
  createdAt: string;
  author: FeedAuthor;
}

function timeAgo(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function DbPostCard({ post, savedInitial = false }: { post: FeedPost; savedInitial?: boolean }) {
  const [saved, setSaved] = useState(savedInitial);
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likes);
  const [commentCount, setCommentCount] = useState(post.comments);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentItem[] | null>(null);
  const [draft, setDraft] = useState("");

  const toggleLike = async () => {
    // optimistic — server is source of truth
    setLiked(!liked);
    setLikes((n) => n + (liked ? -1 : 1));
    const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
    if (!res.ok) {
      setLiked(liked);
      setLikes(post.likes);
    }
  };

  const toggleSave = async () => {
    const res = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "post", targetId: post.id }),
    });
    if (res.ok) setSaved((await res.json()).saved);
  };

  const openComments = async () => {
    setShowComments(!showComments);
    if (!comments) {
      const res = await fetch(`/api/posts/${post.id}/comments`, { cache: "no-store" });
      const data = await res.json();
      setComments(data.comments ?? []);
    }
  };

  const sendComment = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    const res = await fetch(`/api/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      setCommentCount((n) => n + 1);
      const data = await fetch(`/api/posts/${post.id}/comments`, { cache: "no-store" }).then((r) => r.json());
      setComments(data.comments ?? []);
    }
  };

  const a = post.author;

  return (
    <article className="card-people p-4 sm:p-5">
      {/* header */}
      <div className="flex items-start gap-3">
        <Link href={`/creator/${a.handle}`} className="shrink-0">
          <Avatar src={a.avatarUrl} initials={a.displayName.charAt(0)} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-zinc-100">
            <Link href={`/creator/${a.handle}`} className="transition hover:text-violet-300">
              {a.displayName}
            </Link>
            {a.verified && <VerifiedBadge />}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
            {a.roleLine || `@${a.handle}`}
            <span aria-hidden>•</span>
            {timeAgo(post.createdAt)}
            {a.locationLabel && (
              <>
                <span aria-hidden>•</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {a.locationLabel}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* body */}
      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-200">{post.body}</p>
      {post.imageUrl && (
        <div className="relative mt-3 aspect-[16/10] overflow-hidden rounded-xl border border-line">
          <Image src={post.imageUrl} alt="" fill sizes="(max-width: 768px) 100vw, 640px" className="object-cover" />
        </div>
      )}

      {/* actions */}
      <div className="mt-3 flex items-center gap-5 border-t border-line-soft pt-2.5 text-xs text-zinc-500">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 transition ${liked ? "text-rose-400" : "hover:text-zinc-300"}`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-rose-400" : ""}`} />
          {likes}
        </button>
        <button onClick={openComments} className="flex items-center gap-1.5 transition hover:text-zinc-300">
          <MessageCircle className="h-4 w-4" />
          {commentCount}
        </button>
        <button
          onClick={toggleSave}
          title={saved ? "Remove bookmark" : "Save"}
          className={`ml-auto flex items-center gap-1.5 transition ${saved ? "text-violet-300" : "hover:text-zinc-300"}`}
        >
          <Bookmark className={`h-4 w-4 ${saved ? "fill-violet-300" : ""}`} />
          {saved ? "Saved" : "Save"}
        </button>
      </div>

      {/* comments */}
      {showComments && (
        <div className="mt-3 space-y-2.5 border-t border-line-soft pt-3">
          {comments?.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <Avatar src={c.author.avatarUrl} initials={c.author.displayName.charAt(0)} size="xs" />
              <div className="min-w-0 rounded-xl bg-card-raised px-3 py-2">
                <p className="text-xs font-semibold text-zinc-200">
                  {c.author.displayName}
                  <span className="ml-1.5 font-normal text-zinc-500">{timeAgo(c.createdAt)}</span>
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-300">{c.body}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendComment()}
              placeholder="Add a comment…"
              className="min-w-0 flex-1 rounded-full border border-line bg-card-raised px-3.5 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
            />
            <button onClick={sendComment} className="rounded-full p-1.5 text-violet-300 transition hover:bg-card-raised">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
