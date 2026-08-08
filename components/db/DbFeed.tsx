"use client";

/* ------------------------------------------------------------------ */
/*  Database-backed feed. Tab = what to rank, scope = where to look.   */
/*  Every post, author, like and comment is a real DB record owned by  */
/*  a real account. No hardcoded users anywhere.                       */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import DbPostCard, { type FeedPost } from "./DbPostCard";
import OpportunityList from "./OpportunityList";
import { useSession } from "@/lib/session";
import type { FeedScope } from "@/components/Feed";

export type FeedTab = "For You" | "Following" | "Opportunities" | "Trending";
const tabs: FeedTab[] = ["For You", "Following", "Opportunities", "Trending"];

export const FEED_EVENT = "upnova:feed-changed";

const scopeParam: Record<FeedScope, string> = {
  foryou: "for-you",
  "5": "5mi",
  "25": "25mi",
  city: "city",
  county: "county",
  state: "state",
  country: "country",
  global: "global",
  school: "school",
};

const tabParam: Record<FeedTab, string> = {
  "For You": "for-you",
  Following: "following",
  Opportunities: "opportunities",
  Trending: "trending",
};

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

interface Props {
  scope: FeedScope;
  tab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
  isStudent: boolean;
}

export default function DbFeed({ scope, tab, onTabChange, isStudent }: Props) {
  const { user } = useSession();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (tab === "Opportunities") return; // handled by OpportunityList
    try {
      const res = await fetch(`/api/feed?tab=${tabParam[tab]}&scope=${scopeParam[scope]}`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        setPosts([]);
        setError("signin");
        return;
      }
      const data = await res.json();
      setError(null);
      setPosts(data.items ?? []);
    } catch {
      setError("network");
      setPosts([]);
    }
  }, [tab, scope]);

  useEffect(() => {
    setPosts(null);
    load();
    window.addEventListener(FEED_EVENT, load);
    return () => window.removeEventListener(FEED_EVENT, load);
  }, [load]);

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
      </div>

      {/* school scope banner */}
      {scope === "school" && (
        <div className="flex items-center gap-3 rounded-xl border border-violet-400/30 bg-violet-400/5 px-4 py-2.5">
          <GraduationCap className="h-4 w-4 shrink-0 text-violet-400" />
          <p className="min-w-0 flex-1 text-xs text-zinc-400">
            <span className="font-semibold text-violet-300">Verified campus scope</span> — students,
            campus creators, orgs, and campus work.
          </p>
          <Link href="/campus" className="shrink-0 text-xs font-semibold text-violet-400 hover:text-violet-300">
            Campus →
          </Link>
        </div>
      )}

      {tab === "Opportunities" ? (
        <OpportunityList scope={scopeParam[scope]} compact />
      ) : user === null || error === "signin" ? (
        <div className="card p-8 text-center">
          <p className="text-sm font-semibold text-zinc-200">Sign in to see your feed</p>
          <p className="mt-1 text-xs text-zinc-500">
            Your feed is built from real accounts, follows, and location — it needs to know who you are.
          </p>
          <Link href="/login" className="btn-lime mt-4 inline-flex px-5 py-2 text-sm">
            Sign in
          </Link>
        </div>
      ) : posts === null ? (
        <Skeleton />
      ) : (
        <div key={`${tab}-${scope}`} className="animate-fade-up space-y-4">
          {posts.map((p) => (
            <DbPostCard key={p.id} post={p} />
          ))}
          {posts.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-500">
              Nothing here{["5mi", "25mi", "city", "county", "state", "school"].includes(scopeParam[scope]) ? " at this range — widen the scope" : " yet"}.
            </p>
          )}
        </div>
      )}
    </>
  );
}
