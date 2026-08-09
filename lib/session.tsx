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
    // JS-readable token cookie. Partitioned (CHIPS) so it survives even
    // when third-party cookies are blocked in the embedding (Chrome).
    get: () => document.cookie.match(new RegExp(`(?:^|; )${TOKEN_KEY}=([a-f0-9]+)`))?.[1] ?? null,
    set: (v) => {
      const base = `${TOKEN_KEY}=${v ?? ""}; path=/; SameSite=None; Secure; Partitioned`;
      document.cookie = v ? `${base}; max-age=2592000` : `${base}; max-age=0`;
      // non-Partitioned twin for browsers that reject the attribute
      const plain = `${TOKEN_KEY}=${v ?? ""}; path=/; SameSite=None; Secure`;
      document.cookie = v ? `${plain}; max-age=2592000` : `${plain}; max-age=0`;
    },
  },
  {
    // window.name survives page reloads in the same tab/iframe and is NOT
    // subject to storage/cookie blocking — the layer of last resort.
    // Demo-only: cleared on sign-out with everything else.
    get: () => {
      const m = /^upnova-token:([a-f0-9]+)$/.exec(window.name || "");
      return m ? m[1] : null;
    },
    set: (v) => {
      if (v) window.name = `upnova-token:${v}`;
      else if (/^upnova-token:/.test(window.name || "")) window.name = "";
    },
  },
];

const TOKEN_SHAPE = /^[a-f0-9]{32,128}$/; // opaque hex token — anything else is corrupt

export function getFallbackToken(): string | null {
  if (memoryToken) return memoryToken;
  if (typeof window === "undefined") return null;
  for (const layer of storageLayers) {
    try {
      const v = layer.get();
      if (v && TOKEN_SHAPE.test(v)) {
        memoryToken = v; // hydrate memory from whichever layer survived
        return v;
      }
      if (v) layer.set(null); // corrupted value — clear it safely
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

if (typeof window !== "undefined" && !(window as unknown as { __upnovaDiag?: boolean }).__upnovaDiag) {
  (window as unknown as { __upnovaDiag?: boolean }).__upnovaDiag = true;
  try {
    const diag: string[] = [];
    try { window.localStorage.setItem("__t", "1"); window.localStorage.removeItem("__t"); diag.push("localStorage:ok"); } catch { diag.push("localStorage:BLOCKED"); }
    try { window.sessionStorage.setItem("__t", "1"); window.sessionStorage.removeItem("__t"); diag.push("sessionStorage:ok"); } catch { diag.push("sessionStorage:BLOCKED"); }
    try { document.cookie = "__t=1; path=/; SameSite=None; Secure"; diag.push(document.cookie.includes("__t=1") ? "jsCookie:ok" : "jsCookie:BLOCKED"); document.cookie = "__t=; path=/; max-age=0; SameSite=None; Secure"; } catch { diag.push("jsCookie:BLOCKED"); }
    // eslint-disable-next-line no-console
    console.info("[upnova] session persistence layers →", diag.join(" · "));
  } catch {}
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

/* ---------- auth initialization: restore BEFORE first render ----------
   The saved user snapshot makes the startup sequence:
     App starts → check localStorage → restore current user → render
   instead of:
     App starts → currentUser = null/undefined → wait for network.
   The snapshot is display state only — every API request is still
   validated server-side; the background revalidation below corrects the
   snapshot the moment the server disagrees. */
const USER_SNAPSHOT_KEY = "upnova-session-user";

function readUserSnapshot(): SessionUser | null {
  try {
    const raw = window.localStorage.getItem(USER_SNAPSHOT_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as SessionUser;
    // defensive shape check — corrupted snapshots are cleared, never trusted
    if (u && typeof u.id === "string" && typeof u.handle === "string" && u.profile && typeof u.profile.displayName === "string")
      return u;
    window.localStorage.removeItem(USER_SNAPSHOT_KEY);
    return null;
  } catch {
    return null;
  }
}

export function saveUserSnapshot(user: SessionUser | null) {
  try {
    if (user) window.localStorage.setItem(USER_SNAPSHOT_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(USER_SNAPSHOT_KEY);
  } catch {}
}

/* Hydration-safe boot: the SERVER renders the auth-initializing state and
   the client's FIRST render must be byte-identical — so nothing here runs
   before mount. bootSession() is called from useSession's effect (i.e.
   AFTER hydration): it restores the saved user from localStorage, then
   revalidates against the server in the background.
     Server render → identical client render → hydration completes →
     read localStorage → restore user → show profile. */
let booted = false;

export function bootSession() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  if (cached !== undefined) return; // login already primed this session
  const restored = readUserSnapshot();
  if (restored) {
    cached = restored; // instant signed-in UI, post-hydration
    window.dispatchEvent(new Event(SESSION_EVENT));
    void fetchSession(true); // server confirms or (explicitly) clears
  } else {
    void fetchSession(); // normal path: ask the server who we are
  }
}

export async function fetchSession(force = false): Promise<SessionUser | null> {
  if (!force && cached !== undefined) return cached;
  if (!inflight || force) {
    inflight = fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json().catch(() => ({ user: null })))
      .then((d) => {
        cached = d.user ?? null;
        // server is the source of truth: refresh the snapshot on success,
        // clear it (and any dead token) when the server explicitly says
        // "nobody"
        saveUserSnapshot(cached ?? null);
        if (!cached && getFallbackToken()) setFallbackToken(null);
        window.dispatchEvent(new Event(SESSION_EVENT));
        return cached ?? null;
      })
      .catch(() => {
        // network hiccup / aborted request: NOT a logout. Keep whatever
        // state we had (restored user stays restored; still-initializing
        // stays initializing so the next mount retries). Only an explicit
        // server "nobody" above ever flips the app to logged out.
        inflight = null; // allow a retry
        window.dispatchEvent(new Event(SESSION_EVENT));
        return cached ?? null;
      });
  }
  return inflight;
}

/** Seed the client session directly from a login/signup response — the
    response body IS the authoritative user object the server just built.
    No confirmation round-trip to fail in odd embeddings. */
export function primeSession(user: SessionUser) {
  cached = user;
  inflight = Promise.resolve(user);
  saveUserSnapshot(user); // persists the signed-in account for next startup
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function invalidateSession() {
  // SOFT revalidation: keep showing the current user while the fresh
  // answer loads. Blanking to undefined here made session-dependent UI
  // (e.g. the Your Campus nav item right after verifying) vanish
  // mid-refetch. The forced fetch below replaces the state when it lands.
  inflight = null;
  fetchSession(true);
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" }); // shim attaches Bearer if needed
  setFallbackToken(null); // fallback transport dies with the session
  saveUserSnapshot(null); // explicit sign-out is what clears the saved account
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
  // IMPORTANT for hydration: the initial state is whatever the module
  // cache holds — undefined (auth initializing) on a fresh page load,
  // matching the server-rendered HTML exactly. The saved user is restored
  // only AFTER mount, inside the effect below.
  const [user, setUser] = useState<SessionUser | null | undefined>(cached);
  useEffect(() => {
    const sync = () => setUser(cached);
    window.addEventListener(SESSION_EVENT, sync);
    bootSession(); // post-hydration: restore snapshot, then revalidate
    fetchSession().then(() => setUser(cached));
    return () => window.removeEventListener(SESSION_EVENT, sync);
  }, []);
  return { user, refresh: () => invalidateSession() };
}
