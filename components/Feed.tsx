"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Post, RadiusId } from "@/lib/data";
import PostCard from "./PostCard";
import AudioPost from "./AudioPost";
import PollCard from "./PollCard";
import OpportunityCard from "./OpportunityCard";
import EventCard from "./EventCard";

export type FeedTab = "For You" | "Near You" | "Following" | "Opportunities" | "Trending";
const tabs: FeedTab[] = ["For You", "Near You", "Following", "Opportunities", "Trending"];

function ringOf(post: Post): 0 | 1 | 2 {
  const d = post.distanceMi;
  if (d !== undefined && d <= 5) return 0;
  if (d !== undefined && d <= 25) return 1;
  return 2;
}

const ringLabels: Record<RadiusId, [string, string, string]> = {
  "5": ["Within 5 mi", "5 – 25 mi", "Beyond 5 mi"],
  "25": ["Within 5 mi", "5 – 25 mi", "Beyond 25 mi"],
  city: ["Within 5 mi", "5 – 25 mi", "City, remote & global"],
};

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
  radius: RadiusId;
  tab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
}

export default function Feed({ radius, tab, onTabChange }: FeedProps) {
  const [farOpen, setFarOpen] = useState(false);
  const [forYou, setForYou] = useState<Post[] | null>(null);
  const [nearYou, setNearYou] = useState<Post[] | null>(null);

  /* two separate data sources: global vs. location-based */
  useEffect(() => {
    let live = true;
    fetch("/api/feed/for-you")
      .then((r) => r.json())
      .then((d) => live && setForYou(d.items))
      .catch(() => live && setForYou([]));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    setNearYou(null); // radius changed → refetch the local feed
    fetch(`/api/feed/near-you?radius=${radius}`)
      .then((r) => r.json())
      .then((d) => live && setNearYou(d.items))
      .catch(() => live && setNearYou([]));
    return () => {
      live = false;
    };
  }, [radius]);

  const groups = useMemo(() => {
    const g: [Post[], Post[], Post[]] = [[], [], []];
    (nearYou ?? []).forEach((p) => g[ringOf(p)].push(p));
    return g;
  }, [nearYou]);

  const flat = (forYou ?? []).filter((p) =>
    tab === "For You"
      ? true
      : tab === "Following"
      ? p.following
      : tab === "Opportunities"
      ? p.type === "opportunity"
      : p.trending
  );

  const [l0, l1, l2] = ringLabels[radius];
  const farCollapsed = radius !== "city" && !farOpen;
  const sections: { label: string; items: Post[]; collapsible: boolean; collapsed: boolean }[] =
    radius === "5"
      ? [
          { label: l0, items: groups[0], collapsible: false, collapsed: false },
          { label: l2, items: [...groups[1], ...groups[2]], collapsible: true, collapsed: farCollapsed },
        ]
      : [
          { label: l0, items: groups[0], collapsible: false, collapsed: false },
          { label: l1, items: groups[1], collapsible: false, collapsed: false },
          { label: l2, items: groups[2], collapsible: true, collapsed: farCollapsed },
        ];

  const loading = tab === "Near You" ? nearYou === null : forYou === null;

  return (
    <>
      {/* tab row */}
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
        {tab === "Near You" && (
          <span className="ml-auto hidden shrink-0 pb-2.5 font-mono text-[10px] uppercase tracking-widest text-zinc-600 sm:block">
            sorted by distance
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton />
      ) : tab !== "Near You" ? (
        <div key={tab} className="animate-fade-up space-y-5">
          {flat.map(renderItem)}
          {flat.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-500">Nothing here yet.</p>
          )}
        </div>
      ) : (
        <div key={radius} className="animate-fade-up space-y-8">
          {sections.map(
            (s) =>
              s.items.length > 0 && (
                <section key={s.label}>
                  <header className="mb-3 flex items-baseline gap-2.5">
                    <h2 className="text-[15px] font-bold tracking-tight text-zinc-100">
                      {s.label}
                    </h2>
                    <span className="font-mono text-[10px] tabular-nums text-zinc-500">
                      {s.items.length}
                    </span>
                    <span className="h-px flex-1 self-center bg-line-soft" />
                    {s.collapsible && (
                      <button
                        onClick={() => setFarOpen(!farOpen)}
                        className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500 transition hover:text-zinc-200"
                      >
                        {s.collapsed ? `show ${s.items.length}` : "hide"}
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${s.collapsed ? "" : "rotate-180"}`}
                        />
                      </button>
                    )}
                  </header>
                  {!s.collapsed && <div className="space-y-5">{s.items.map(renderItem)}</div>}
                </section>
              )
          )}
        </div>
      )}
    </>
  );
}
