"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, MessageCircle, MapPin, Send, Bookmark, MoreHorizontal, EyeOff, Ban } from "lucide-react";
import Avatar from "@/components/Avatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { BadgeCheck } from "lucide-react";
import { useSession } from "@/lib/session";
import { promptJoin } from "@/components/GuestGate";

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
  accountType?: string;
  businessVerified?: boolean;
}

export interface FeedPost {
  id: string;
  body: string;
  imageUrl: string | null;
  kind: string;
  category?: string;
  subcategory?: string;
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

export default function DbPostCard({
  post,
  savedInitial = false,
  onHidden,
}: {
  post: FeedPost;
  savedInitial?: boolean;
  onHidden?: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user: me } = useSession();
  const guest = me === null;
  const [saved, setSaved] = useState(savedInitial);
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likes);
  const [commentCount, setCommentCount] = useState(post.comments);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentItem[] | null>(null);
  const [draft, setDraft] = useState("");

  const toggleLike = async () => {
    if (guest) return promptJoin("like"); // UX only — the API 401s regardless
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
    if (guest) return promptJoin("save");
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

  const feedback = async (action: "hide" | "not_interested", meta = "") => {
    setMenuOpen(false);
    if (guest) return promptJoin("personalize");
    onHidden?.(post.id); // gone immediately — the server remembers
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "post", targetId: post.id, action, meta }),
    });
  };

  const sendComment = async () => {
    if (guest) return promptJoin("comment");
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
            {a.accountType === "business" && a.businessVerified && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-sky-400/40 bg-sky-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-sky-300"
                title="Verified business"
              >
                <BadgeCheck className="h-3 w-3" /> Business
              </span>
            )}
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
        {!post.isMine && onHidden && (
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Post options"
              className="rounded-md p-1 text-zinc-600 transition hover:bg-card-raised hover:text-zinc-300"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-xl border border-line bg-card shadow-card">
                  <button
                    onClick={() => feedback("hide")}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs text-zinc-300 transition hover:bg-card-raised"
                  >
                    <EyeOff className="h-3.5 w-3.5 text-zinc-500" />
                    <span>
                      Hide this post
                      <span className="block text-[10px] text-zinc-600">Never show it again</span>
                    </span>
                  </button>
                  <button
                    onClick={() => feedback("not_interested", post.category ? `category:${post.category}` : "")}
                    className="flex w-full items-center gap-2.5 border-t border-line-soft px-3.5 py-2.5 text-left text-xs text-zinc-300 transition hover:bg-card-raised"
                  >
                    <Ban className="h-3.5 w-3.5 text-zinc-500" />
                    <span>
                      Not interested
                      <span className="block text-[10px] text-zinc-600">
                        See less {post.category ? `${post.category} and ` : ""}less from {a.displayName.split(" ")[0]}
                      </span>
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* body */}
      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-200">{post.body}</p>
      {(post.category || ["work", "bts", "announcement", "promotion", "content"].includes(post.kind)) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {["work", "bts", "announcement", "promotion", "content"].includes(post.kind) && (
            <span className="rounded-full border border-line px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-500">
              {post.kind === "bts" ? "Behind the scenes" : post.kind}
            </span>
          )}
          {post.category && (
            <span className="rounded-full border border-violet-400/30 bg-violet-400/5 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
              {post.category}
              {post.subcategory ? ` · ${post.subcategory}` : ""}
            </span>
          )}
        </div>
      )}
      {post.imageUrl && (
        <div className="relative mt-3 aspect-[16/10] overflow-hidden rounded-xl border border-line">
          {post.imageUrl.startsWith("data:") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <Image src={post.imageUrl} alt="" fill sizes="(max-width: 768px) 100vw, 640px" className="object-cover" />
          )}
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
