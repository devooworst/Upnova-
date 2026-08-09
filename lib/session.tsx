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
  campus?: { name: string; slug: string; program: string; affiliation?: string; gradYear?: string } | null;
}

export const SESSION_EVENT = "upnova:session-changed";

/* ---------------- demo fallback transport (cookie-blocked iframes) ----------------
   If the browser refuses the session cookie (embedded previews), the login
   flow stores the SAME opaque session token here and every /api request
   carries it as Authorization: Bearer. The server validates it against the
   same sessions table. Cleared on logout. When cookies work, this never
   activates. */
const TOKEN_KEY = "upnova-session-token";

/* memory first: some embedded views block localStorage/sessionStorage
   entirely. The in-memory copy keeps the session alive across ALL
   client-side navigation regardless; the storage layers below are
   best-effort so a refresh can restore it too. */
let memoryToken: string | null = null;

const storageLayers: { get: () => string | null; set: (v: string | null) => void }[] = [
  {
    get: () => window.localStorage.getItem(TOKEN_KEY),
    set: (v) => (v ? window.localStorage.setItem(TOKEN_KEY, v) : window.localStorage.removeItem(TOKEN_KEY)),
  },
  {
    get: () => window.sessionStorage.getItem(TOKEN_KEY),
    set: (v) => (v ? window.sessionStorage.setItem(TOKEN_KEY, v) : window.sessionStorage.removeItem(TOKEN_KEY)),
  },
  {
    // last resort: a JS-readable first-party cookie (demo transport, not
    // the auth cookie — the server reads the Authorization header)
    get: () => document.cookie.match(new RegExp(`(?:^|; )${TOKEN_KEY}=([a-f0-9]+)`))?.[1] ?? null,
    set: (v) =>
      (document.cookie = v
        ? `${TOKEN_KEY}=${v}; path=/; max-age=2592000; SameSite=None; Secure`
        : `${TOKEN_KEY}=; path=/; max-age=0; SameSite=None; Secure`),
  },
];

export function getFallbackToken(): string | null {
  if (memoryToken) return memoryToken;
  if (typeof window === "undefined") return null;
  for (const layer of storageLayers) {
    try {
      const v = layer.get();
      if (v) {
        memoryToken = v; // hydrate memory from whichever layer survived
        return v;
      }
    } catch {}
  }
  return null;
}

export function setFallbackToken(token: string | null) {
  memoryToken = token;
  if (typeof window === "undefined") return;
  for (const layer of storageLayers) {
    try {
      layer.set(token);
    } catch {}
  }
}

if (typeof window !== "undefined" && !(window as unknown as { __upnovaFetchShim?: boolean }).__upnovaFetchShim) {
  (window as unknown as { __upnovaFetchShim?: boolean }).__upnovaFetchShim = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    // only OUR api, only relative same-origin paths, only when a token exists
    if (url.startsWith("/api/")) {
      const token = getFallbackToken();
      if (token) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (!headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
        return realFetch(input, { ...init, headers });
      }
    }
    return realFetch(input, init);
  };
}

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
  await fetch("/api/auth/logout", { method: "POST" }); // shim attaches Bearer if needed
  setFallbackToken(null); // fallback transport dies with the session
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
