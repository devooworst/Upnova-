"use client";

/* ------------------------------------------------------------------ */
/*  Posts grid — a creator's public work feed. Not a portfolio.        */
/*                                                                     */
/*  Filters are LEARNED from whatever categories this creator actually */
/*  uses — a hairstylist gets Hair/Nails, a producer gets Beats/       */
/*  Releases, nothing is hard-coded. Clicking a post opens it as a     */
/*  real post (likes, comments), and when the creator has a related    */
/*  service, the post connects straight to booking:                    */
/*  Post → Creator → Service → Booking.                                */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, MessageCircle, X, FileText, Zap } from "lucide-react";
import TrustChips from "@/components/TrustChips";
import type { PostTrust } from "@/lib/trust";

export interface GridPost {
  id: string;
  body: string;
  imageUrl: string | null;
  kind: string;
  category: string;
  subcategory: string;
  createdAt: string;
  likes: number;
  comments: number;
  likedByMe: boolean;
  trust?: PostTrust | null;
}

export interface RelatedService {
  id: string;
  title: string;
  price: number;
  category: string;
  cta?: string;
}

const KIND_LABEL: Record<string, string> = {
  work: "Work",
  bts: "Behind the scenes",
  announcement: "Announcement",
  promotion: "Promotion",
  content: "Content",
};

function Img({ src, alt, className }: { src: string; alt: string; className: string }) {
  if (src.startsWith("data:"))
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={`${className} absolute inset-0 h-full w-full object-cover`} />;
  return <Image src={src} alt={alt} fill sizes="(max-width: 768px) 50vw, 280px" className={`${className} object-cover`} />;
}

export default function PostsGrid({
  handle,
  displayName,
  services = [],
}: {
  handle: string;
  displayName: string;
  services?: RelatedService[];
}) {
  const [posts, setPosts] = useState<GridPost[] | null>(null);
  const [filter, setFilter] = useState("All");
  const [open, setOpen] = useState<GridPost | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/users/${handle}/posts`, { cache: "no-store" });
    if (!res.ok) {
      setPosts([]);
      return;
    }
    setPosts((await res.json()).posts ?? []);
  }, [handle]);

  useEffect(() => {
    load();
  }, [load]);

  /* the grid learns its filters from this creator's real categories */
  const categories = useMemo(() => {
    const set = new Map<string, number>();
    for (const p of posts ?? []) if (p.category) set.set(p.category, (set.get(p.category) ?? 0) + 1);
    return Array.from(set.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);
  }, [posts]);

  const shown = (posts ?? []).filter((p) => filter === "All" || p.category === filter);

  return (
    <div>
      <p className="text-sm text-zinc-500">
        <span className="font-semibold text-zinc-200">What {handle ? `${displayName.split(" ")[0]}'s` : "I've"} been creating.</span>{" "}
        Work, projects, updates, and things worth sharing.
      </p>

      {categories.length > 0 && (
        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {["All", ...categories].map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                filter === c
                  ? "border-white/40 bg-white/10 font-semibold text-zinc-50"
                  : "border-line text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {posts === null ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-card-raised" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-8 text-center text-xs text-zinc-500">
          Nothing posted{filter !== "All" ? ` in ${filter}` : ""} yet.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {shown.map((p) => (
            <button
              key={p.id}
              onClick={() => setOpen(p)}
              className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-card-raised text-left transition hover:border-zinc-600"
            >
              {p.imageUrl ? (
                <Img src={p.imageUrl} alt={p.body.slice(0, 60)} className="transition duration-300 group-hover:scale-[1.03]" />
              ) : (
                <span className="flex h-full flex-col justify-between p-3">
                  <FileText className="h-4 w-4 text-zinc-600" />
                  <span className="line-clamp-4 text-xs leading-relaxed text-zinc-300">{p.body}</span>
                </span>
              )}
              {/* hover meta */}
              <span className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6 opacity-0 transition group-hover:opacity-100">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-100">
                  <Heart className="h-3 w-3" /> {p.likes}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-zinc-100">
                  <MessageCircle className="h-3 w-3" /> {p.comments}
                </span>
                {p.category && (
                  <span className="ml-auto truncate font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-300">
                    {p.category}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && (
        <PostModal
          post={open}
          displayName={displayName}
          service={findRelatedService(open, services)}
          onClose={() => setOpen(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

/* Match a post's creator-defined category to one of their services —
   loose word-stem matching so "Nails" finds "Gel Nail Set". */
function findRelatedService(post: GridPost, services: RelatedService[]): RelatedService | null {
  if (!post.category) return services.length === 1 ? services[0] : null;
  const stems = post.category
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/s$/, ""))
    .filter((w) => w.length >= 3);
  return (
    services.find((s) => {
      const hay = `${s.title} ${s.category}`.toLowerCase();
      return stems.some((w) => hay.includes(w));
    }) ?? null
  );
}

/* ------------------------------ post modal ------------------------------ */

function PostModal({
  post,
  displayName,
  service,
  onClose,
  onChanged,
}: {
  post: GridPost;
  displayName: string;
  service: RelatedService | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likes);

  const toggleLike = async () => {
    setLiked(!liked);
    setLikes((n) => n + (liked ? -1 : 1));
    const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
    if (!res.ok) {
      setLiked(liked);
      setLikes(post.likes);
    } else onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card" onClick={(e) => e.stopPropagation()}>
        {post.imageUrl && (
          <div className="relative aspect-[4/3]">
            <Img src={post.imageUrl} alt="" className="" />
            <button onClick={onClose} className="absolute right-3 top-3 rounded-full bg-ink/70 p-1.5 text-zinc-300 backdrop-blur hover:text-zinc-50">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-5">
          {!post.imageUrl && (
            <div className="flex justify-end">
              <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <p className="text-sm font-semibold text-zinc-100">{displayName}</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{post.body}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {KIND_LABEL[post.kind] && (
              <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">
                {KIND_LABEL[post.kind]}
              </span>
            )}
            {post.category && (
              <span className="rounded-full border border-violet-400/30 bg-violet-400/5 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                {post.category}
                {post.subcategory ? ` · ${post.subcategory}` : ""}
              </span>
            )}
          </div>
          {/* trust & context labels — verified vs claimed, same chips as the feed */}
          <TrustChips trust={post.trust} postId={post.id} />
          <div className="mt-3 flex items-center gap-5 border-t border-line-soft pt-2.5 text-xs text-zinc-500">
            <button onClick={toggleLike} className={`flex items-center gap-1.5 transition ${liked ? "text-rose-400" : "hover:text-zinc-300"}`}>
              <Heart className={`h-4 w-4 ${liked ? "fill-rose-400" : ""}`} /> {likes} like{likes === 1 ? "" : "s"}
            </button>
            <span className="flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4" /> {post.comments} comment{post.comments === 1 ? "" : "s"}
            </span>
            <span className="ml-auto text-[11px] text-zinc-600">
              {new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>

          {/* Post → Service → Booking */}
          {service && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-lime-400/30 bg-lime-400/5 px-3.5 py-2.5">
              <p className="min-w-0 text-xs text-zinc-300">
                <span className="font-semibold text-zinc-100">{service.title}</span>
                <span className="font-mono tracking-[0.08em] text-lime-300"> · from ${service.price}</span>
              </p>
              <Link href="/services" className="btn-lime shrink-0 px-3.5 py-1.5 text-xs">
                <Zap className="h-3.5 w-3.5" /> {service.cta ?? "Book this service"}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
