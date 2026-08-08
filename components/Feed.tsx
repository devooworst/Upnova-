"use client";

import { useState } from "react";
import { feed } from "@/lib/data";
import PostCard from "./PostCard";
import AudioPost from "./AudioPost";
import PollCard from "./PollCard";
import OpportunityCard from "./OpportunityCard";
import EventCard from "./EventCard";

const tabs = ["Near You", "Following", "Opportunities", "Trending"] as const;
type Tab = (typeof tabs)[number];

export default function Feed() {
  const [tab, setTab] = useState<Tab>("Near You");

  const items = feed.filter((post) => {
    switch (tab) {
      case "Following":
        return post.following === true;
      case "Opportunities":
        return post.type === "opportunity";
      case "Trending":
        return post.trending === true;
      default:
        return true;
    }
  });

  return (
    <>
      {/* tabs */}
      <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Feed">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === t
                ? "bg-lime-400 text-zinc-950"
                : "text-zinc-400 hover:bg-card-raised hover:text-zinc-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* feed */}
      <div className="space-y-5">
        {items.map((post) => {
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
        })}

        {items.length === 0 && (
          <div className="card p-10 text-center text-sm text-zinc-500">
            Nothing here yet — check back soon.
          </div>
        )}
      </div>
    </>
  );
}
