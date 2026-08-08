"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import type { Post } from "@/lib/data";
import { creators, opportunities, events } from "@/lib/data";
import { useFollow } from "@/lib/follow";
import PostCard from "./PostCard";
import AudioPost from "./AudioPost";
import PollCard from "./PollCard";
import OpportunityCard from "./OpportunityCard";
import EventCard from "./EventCard";

/* ------------------------------------------------------------------ */
/* Feed Type (what kind of content) × Feed Scope (how far it reaches). */
/* Orthogonal by design: Following + 5 miles, Trending + City, etc.    */
/* Every piece of content has a reach; the feed respects it.           */
/* ------------------------------------------------------------------ */

export type FeedTab = "For You" | "Following" | "Opportunities" | "Trending";
const tabs: FeedTab[] = ["For You", "Following", "Opportunities", "Trending"];

export type FeedScope =
  | "foryou" | "5" | "25" | "city" | "county" | "state" | "country" | "global" | "school";

/** max distance per scope; Infinity = include remote/global content */
const scopeMaxMi: Record<FeedScope, number> = {
  foryou: Infinity,
  "5": 5,
  "25": 25,
  city: 40,
  county: 60,
  state: 150,
  country: Infinity,
  global: Infinity,
  school: 5,
};

/** local scopes exclude remote content (posts without a distance) */
const localScopes: FeedScope[] = ["5", "25", "city", "county", "state", "school"];

function renderItem(post: Post) {
  switch (post.type) {
    case "opportunity":
      return <OpportunityCard key={post.id} id={post.opportunityId!} />;
    case "audio":
      return <AudioPost key={post.id} post={post} />;
    case "poll":
      return <PollCard key={post.id} post={post} />;
    case "event":
      return <EventCard key={post.id} id={post.eventId!} />;
    default:
      return <PostCard key={post.id} post={post} />;
  }
}

function Skeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card-people animate-pulse p-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-card-raised" />
            <div className="space-y-2">
              <div className="h-3 w-32 rounded bg-card-raised" />
              <div className="h-2.5 w-48 rounded bg-card-raised" />
            </div>
          </div>
          <div className="mt-4 h-3 w-4/5 rounded bg-card-raised" />
          <div className="mt-2 h-3 w-3/5 rounded bg-card-raised" />
        </div>
      ))}
    </div>
  );
}

interface FeedProps {
  scope: FeedScope;
  tab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
  isStudent: boolean;
}

export default function Feed({ scope, tab, onTabChange, isStudent }: FeedProps) {
  const { isFollowing } = useFollow();
  const [forYou, setForYou] = useState<Post[] | null>(null);
  const [nearYou, setNearYou] = useState<Post[] | null>(null);

  /* two data sources: global ranking + distance-sorted local */
  useEffect(() => {
    let live = true;
    fetch("/api/feed/for-you")
      .then((r) => r.json())
      .then((d) => live && setForYou(d.items))
      .catch(() => live && setForYou([]));
    fetch("/api/feed/near-you?radius=25")
      .then((r) => r.json())
      .then((d) => live && setNearYou(d.items))
      .catch(() => live && setNearYou([]));
    return () => {
      live = false;
    };
  }, []);

  const scoped = useMemo(() => {
    const isLocal = localScopes.includes(scope);
    const source = isLocal ? nearYou : forYou;
    if (!source) return null;
    const max = scopeMaxMi[scope];
    return source.filter((p) => {
      if (!isLocal) return true; // for-you / country / global: everything
      if (p.distanceMi === undefined) return false; // remote content is out of local scopes
      return p.distanceMi <= max;
    });
  }, [scope, forYou, nearYou]);

  const items = (scoped ?? []).filter((p) =>
    tab === "For You"
      ? true
      : tab === "Following"
      ? isFollowing(p.creator.id)
      : tab === "Opportunities"
      ? p.type === "opportunity"
      : p.trending
  );

  const loading = scoped === null;
  const isLocal = localScopes.includes(scope);

  /* Near You is a content label inside Home — never a page */
  const nearCounts = useMemo(() => {
    if (!isLocal) return null;
    const max = scopeMaxMi[scope];
    const inRange = (d?: number) => d !== undefined && d <= max;
    return {
      creators: creators.filter((c) => inRange(c.distanceMi)).length,
      opportunities: opportunities.filter((o) => inRange(o.distanceMi)).length,
      events: events.filter(() => scope !== "5").length || 1,
    };
  }, [scope, isLocal]);

  return (
    <>
      {/* feed type — what kind of content */}
      <div className="flex items-center gap-4 overflow-x-auto border-b border-line-soft pb-0 text-sm no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className={`-mb-px shrink-0 border-b-2 pb-2.5 transition ${
              tab === t
                ? "border-white font-semibold text-zinc-50"
                : "border-transparent font-medium text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t}
          </button>
        ))}
        {isLocal && (
          <span className="ml-auto hidden shrink-0 pb-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-600 sm:block">
            sorted by distance
          </span>
        )}
      </div>

      {/* school scope banner */}
      {scope === "school" && (
        <div className="flex items-center gap-3 rounded-xl border border-violet-400/30 bg-violet-400/5 px-4 py-2.5">
          <GraduationCap className="h-4 w-4 shrink-0 text-violet-400" />
          <p className="min-w-0 flex-1 text-xs text-zinc-400">
            <span className="font-semibold text-violet-300">Bowie State University</span> · verified
            campus scope — students, campus creators, orgs, and campus work.
          </p>
          <Link href="/campus" className="shrink-0 text-xs font-semibold text-violet-400 hover:text-violet-300">
            Campus →
          </Link>
        </div>
      )}

      {/* Near You — a section inside Home, not a page */}
      {isLocal && nearCounts && !loading && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line px-4 py-2.5 font-mono text-[11px] font-medium text-zinc-400">
          <span className="font-bold uppercase tracking-[0.08em] text-zinc-200">Near You</span>
          <span><span className="text-violet-400">{nearCounts.creators}</span> creators</span>
          <span><span className="text-lime-400">{nearCounts.opportunities}</span> opportunities</span>
          <span><span className="text-amber-400">{nearCounts.events}</span> events</span>
          <span className="ml-auto text-zinc-600">
            {items.length} post{items.length === 1 ? "" : "s"} in range
          </span>
        </div>
      )}

      {loading ? (
        <Skeleton />
      ) : (
        <div key={`${tab}-${scope}`} className="animate-fade-up space-y-4">
          {items.map(renderItem)}
          {items.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-500">
              Nothing here{isLocal ? " at this range — widen the scope" : " yet"}.
            </p>
          )}
        </div>
      )}
    </>
  );
}
