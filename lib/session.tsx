"use client";

/* ------------------------------------------------------------------ */
/*  Client session state — one fetch of /api/auth/me, shared app-wide  */
/*  via a module cache + event. Every component that shows "the        */
/*  current user" reads this; nothing is hardcoded.                    */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";

export interface SessionProfile {
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  coverPos: number;
  verified: boolean;
  city: string;
  state: string;
  county: string;
  country: string;
  locationVisibility: string;
  primaryRole: string;
  additionalRoles: string[];
  skills: string[];
  interests: string[];
  serviceArea: string;
  openToWork: boolean;
  availableFor: string[];
  availableFrom: string;
  workLocation: string;
  minBudget: number | null;
  collabPref: string;
  hiringEnabled: boolean;
  acceptOffers: boolean;
  acceptBookings: boolean;
  acceptCollabs: boolean;
  whoCanMessage: string;
  visibility: string;
  showLocation: boolean;
  showEducation: boolean;
  showFollowers: boolean;
  showFollowing: boolean;
  showPortfolio: boolean;
  showCompletedProjects: boolean;
  showWorkPerformance: boolean;
  showAvailability: boolean;
  links: { platform: string; url: string }[];
  trustLevel: string;
  education?: { school: string; program: string; gradYear?: string }[];
}

export interface SessionUser {
  id: string;
  email: string;
  handle: string;
  role: string;
  plan: string;
  accountType?: string;
  businessVerified?: boolean;
  profile: SessionProfile;
  campus?: { name: string; slug: string; program: string } | null;
}

export const SESSION_EVENT = "upnova:session-changed";

let cached: SessionUser | null | undefined; // undefined = not loaded yet
let inflight: Promise<SessionUser | null> | null = null;

export async function fetchSession(force = false): Promise<SessionUser | null> {
  if (!force && cached !== undefined) return cached;
  if (!inflight || force) {
    inflight = fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        cached = d.user ?? null;
        window.dispatchEvent(new Event(SESSION_EVENT));
        return cached ?? null;
      })
      .catch(() => {
        cached = null;
        return null;
      });
  }
  return inflight;
}

export function invalidateSession() {
  cached = undefined;
  inflight = null;
  fetchSession(true);
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  cached = null;
  // per-user client caches must not leak into the next session
  for (const k of ["upnova-plan", "upnova-trust", "upnova-student-verified", "upnova-notif-read", "upnova-following"]) {
    try {
      window.localStorage.removeItem(k);
    } catch {}
  }
  window.dispatchEvent(new Event(SESSION_EVENT));
}

/** Live session hook. `user === undefined` while loading, null when logged out. */
export function useSession(): { user: SessionUser | null | undefined; refresh: () => void } {
  const [user, setUser] = useState<SessionUser | null | undefined>(cached);
  useEffect(() => {
    const sync = () => setUser(cached);
    window.addEventListener(SESSION_EVENT, sync);
    fetchSession().then(() => setUser(cached));
    return () => window.removeEventListener(SESSION_EVENT, sync);
  }, []);
  return { user, refresh: () => invalidateSession() };
}
