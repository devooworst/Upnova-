"use client";

/* Permanent post page — the canonical URL a share link points at.
   Guests can view; interacting asks for an account (as everywhere). */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import DbPostCard, { type FeedPost } from "@/components/db/DbPostCard";
import ShareSheet from "@/components/ShareSheet";

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/posts/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) setError(d.error || "Not found");
        else setPost(d.post);
      })
      .catch(() => setError("Network error"));
  }, [id]);

  if (error)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm font-semibold text-zinc-200">{error}</p>
        <Link href="/" className="btn-ghost mt-4 inline-flex px-4 py-1.5 text-xs">Back home</Link>
      </div>
    );
  if (!post) return <div className="card-people mx-auto h-64 max-w-2xl animate-pulse" aria-hidden />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
        <ArrowLeft className="h-3.5 w-3.5" /> Feed
      </Link>
      <DbPostCard post={post} />
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <p className="min-w-0 flex-1 text-xs text-zinc-500">
          This is the post&apos;s permanent link — share it anywhere and people land right here.
        </p>
        <ShareSheet path={`/posts/${post.id}`} title={`${post.author.displayName} on UpNova`} text={post.body.slice(0, 80)} compact />
      </div>
    </div>
  );
}
