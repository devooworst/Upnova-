"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Creator } from "./data";

/* ------------------------------------------------------------------ */
/* The relationship layer. Follow = keep up with someone's content.    */
/* Strictly separate from Message / Hire / Pitch / Join — nothing      */
/* auto-follows. One store, so follow state persists everywhere.       */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "upnova-following";

/** People you already follow when the demo starts. */
const SEED: Record<string, boolean> = { jordan: true, ava: true, marcus: true };

interface FollowContextValue {
  isFollowing: (id: string) => boolean;
  toggle: (id: string) => void;
  followingCount: number;
  /** live follower count for a creator (baseline adjusts with your follow) */
  followerCount: (c: Creator) => number;
}

const FollowContext = createContext<FollowContextValue | null>(null);

export function FollowProvider({ children }: { children: React.ReactNode }) {
  const [map, setMap] = useState<Record<string, boolean>>(SEED);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setMap(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const persist = (next: Record<string, boolean>) => {
    setMap(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const value: FollowContextValue = {
    isFollowing: (id) => !!map[id],
    toggle: (id) => persist({ ...map, [id]: !map[id] }),
    followingCount: Object.values(map).filter(Boolean).length,
    followerCount: (c) => c.followers + (map[c.id] ? 1 : 0) - (SEED[c.id] ? 1 : 0),
  };

  return <FollowContext.Provider value={value}>{children}</FollowContext.Provider>;
}

export function useFollow(): FollowContextValue {
  const ctx = useContext(FollowContext);
  if (!ctx) throw new Error("useFollow must be used inside FollowProvider");
  return ctx;
}

export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}K`;
  return `${n}`;
}
