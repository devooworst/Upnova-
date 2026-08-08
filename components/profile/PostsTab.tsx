"use client";

/* Profile → Posts: the owner's public work feed — the same grid a
   visitor sees on /creator/[handle]. Posts are things you chose to
   share; structured paid work lives under Opportunities → Verified
   Projects, and offerings live under Services. */

import { useEffect, useState } from "react";
import Link from "next/link";
import PostsGrid, { type RelatedService } from "@/components/db/PostsGrid";
import { useSession } from "@/lib/session";

export default function PostsTab({ isOwner }: { isOwner: boolean }) {
  const { user } = useSession();
  const [services, setServices] = useState<RelatedService[]>([]);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/users/${user.handle}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) =>
        setServices(
          (d.services ?? []).map((s: { id: string; title: string; price: number; category?: string; cta?: string }) => ({
            id: s.id,
            title: s.title,
            price: s.price,
            category: s.category ?? "",
            cta: s.cta,
          }))
        )
      );
  }, [user]);

  if (!user) return <div className="h-40 animate-pulse rounded-xl bg-card-raised" aria-hidden />;

  return (
    <div>
      <PostsGrid handle={user.handle} displayName={user.profile.displayName} services={services} />
      {isOwner && (
        <p className="mt-4 border-t border-line-soft pt-3 text-[11px] leading-relaxed text-zinc-600">
          Posts are anything worth sharing — work, behind the scenes, announcements, promotions.
          Post from the composer on{" "}
          <Link href="/" className="text-violet-300 hover:underline">Home</Link>{" "}
          with a category, and your grid learns its filters automatically. Verified client projects
          live under Opportunities.
        </p>
      )}
    </div>
  );
}
