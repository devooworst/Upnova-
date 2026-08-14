"use client";

/* ------------------------------------------------------------------ */
/*  Activation tracking — the 5 events that tell us whether Mavyn     */
/*  is delivering real value.                                          */
/*                                                                     */
/*  These are NOT vanity metrics. Each one represents a user crossing  */
/*  a threshold that predicts retention:                               */
/*                                                                     */
/*    1. profile_completed   — filled 5+ fields (discoverable)         */
/*    2. first_discovery     — searched or browsed Discover/services   */
/*    3. first_connection    — sent a message or followed someone      */
/*    4. first_interaction   — applied to opp / inquired on service    */
/*    5. first_transaction   — booking created or payment initiated    */
/*                                                                     */
/*  Each event fires AT MOST ONCE per user. State is stored server-    */
/*  side (onboarding_tours table) so it survives device changes.       */
/*  The client sends a lightweight POST; the server is idempotent.     */
/* ------------------------------------------------------------------ */

export const ACTIVATION_EVENTS = [
  "profile_completed",
  "first_discovery",
  "first_connection",
  "first_interaction",
  "first_transaction",
] as const;

export type ActivationEvent = (typeof ACTIVATION_EVENTS)[number];

const STORAGE_KEY = "mavyn:activation";

/** Local cache of which events have already fired (avoids redundant POSTs). */
function getLocal(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setLocal(key: string) {
  try {
    const cur = getLocal();
    cur[key] = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cur));
  } catch {}
}

/**
 * Fire an activation event. Idempotent — calling this multiple times
 * for the same event is safe (only the first call sends a request).
 */
export function trackActivation(event: ActivationEvent): void {
  const local = getLocal();
  if (local[event]) return; // already fired
  setLocal(event);

  // Fire-and-forget — never block the user's action on analytics
  fetch("/api/me/onboarding", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activation: event }),
  }).catch(() => {});
}

/**
 * Check whether an activation event has already been recorded locally.
 * Useful for conditional UI (e.g., showing a nudge only if the user
 * hasn't completed their profile yet).
 */
export function hasActivated(event: ActivationEvent): boolean {
  return !!getLocal()[event];
}

/**
 * Returns the count of activation events completed (0–5).
 * Useful for progress indicators.
 */
export function activationProgress(): number {
  const local = getLocal();
  return ACTIVATION_EVENTS.filter((e) => local[e]).length;
}
