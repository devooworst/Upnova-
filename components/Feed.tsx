"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { feed, type Post, type RadiusId } from "@/lib/data";
import PostCard from "./PostCard";
import AudioPost from "./AudioPost";
import PollCard from "./PollCard";
import OpportunityCard from "./OpportunityCard";
import EventCard from "./EventCard";

const secondaryFilters = ["Following", "Opportunities", "Trending"] as const;
type Filter = "Near You" | (typeof secondaryFilters)[number];

function ringOf(post: Post): 0 | 1 | 2 {
  const d = post.distanceMi;
  if (d !== undefined && d <= 5) return 0;
  if (d !== undefined && d <= 25) return 1;
  return 2;
}

const ringLabels: Record<RadiusId, [string, string, string]> = {
  "5": ["Within 5 mi", "5 – 25 mi", "Beyond 5 mi • farther & remote"],
  "25": ["Within 5 mi", "5 – 25 mi", "Beyond 25 mi • farther & remote"],
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

export default function Feed({ radius }: { radius: RadiusId }) {
  const [filter, setFilter] = useState<Filter>("Near You");
  const [farOpen, setFarOpen] = useState(false);

  const groups = useMemo(() => {
    const g: [Post[], Post[], Post[]] = [[], [], []];
    feed.forEach((p) => g[ringOf(p)].push(p));
    return g;
  }, []);

  const flat = feed.filter((p) =>
    filter === "Following"
      ? p.following
      : filter === "Opportunities"
      ? p.type === "opportunity"
      : p.trending
  );

  const [l0, l1, l2] = ringLabels[radius];
  const farCollapsed = radius !== "city" && !farOpen;
  const sections: { label: string; items: Post[]; collapsible: boolean; collapsed: boolean; ring: number }[] =
    radius === "5"
      ? [
          { label: l0, items: groups[0], collapsible: false, collapsed: false, ring: 0 },
          { label: l2, items: [...groups[1], ...groups[2]], collapsible: true, collapsed: farCollapsed, ring: 2 },
        ]
      : [
          { label: l0, items: groups[0], collapsible: false, collapsed: false, ring: 0 },
          { label: l1, items: groups[1], collapsible: false, collapsed: false, ring: 1 },
          { label: l2, items: groups[2], collapsible: true, collapsed: farCollapsed, ring: 2 },
        ];

  return (
    <>
      {/* minimal filter row */}
      <div className="flex items-center gap-4 border-b border-line-soft pb-0 text-sm">
        <button
          onClick={() => setFilter("Near You")}
          className={`-mb-px border-b-2 pb-2.5 font-semibold transition ${
            filter === "Near You"
              ? "border-white text-zinc-50"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Near You
        </button>
        {secondaryFilters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`-mb-px border-b-2 pb-2.5 font-medium transition ${
              filter === f
                ? "border-white text-zinc-50"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto hidden pb-2.5 font-mono text-[10px] uppercase tracking-widest text-zinc-600 sm:block">
          sorted by distance
        </span>
      </div>

      {filter !== "Near You" ? (
        <div className="space-y-5">{flat.map(renderItem)}</div>
      ) : (
        <div className="space-y-8">
          {sections.map(
            (s) =>
              s.items.length > 0 && (
                <section key={s.label}>
                  <header className="mb-3 flex items-baseline gap-2.5">
                    <h2 className="font-display text-sm font-bold tracking-tight text-zinc-200">
                      {s.label.split("•")[0].trim()}
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
