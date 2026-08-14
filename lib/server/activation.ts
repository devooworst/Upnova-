/* ------------------------------------------------------------------ */
/*  Server-side activation tracking — records one-time activation      */
/*  events in the user's onboarding JSON. Idempotent (safe to call     */
/*  multiple times for the same event).                                */
/* ------------------------------------------------------------------ */

import { eq } from "drizzle-orm";
import { db, tables } from "@/db";

const ACTIVATION_KEYS = [
  "profile_completed",
  "first_discovery",
  "first_connection",
  "first_interaction",
  "first_transaction",
] as const;

export type ActivationKey = (typeof ACTIVATION_KEYS)[number];

/**
 * Record an activation event for a user. Idempotent — if the event
 * was already recorded, this is a no-op.
 */
export function recordActivation(userId: string, key: ActivationKey): void {
  try {
    const row = db.select().from(tables.users).where(eq(tables.users.id, userId)).get();
    if (!row) return;
    let prev: Record<string, unknown> = {};
    try { prev = JSON.parse(row.onboarding || "{}") ?? {}; } catch {}
    const activations = (typeof prev.activations === "object" && prev.activations !== null ? prev.activations : {}) as Record<string, string>;
    if (activations[key]) return; // already recorded
    activations[key] = new Date().toISOString();
    db.update(tables.users)
      .set({ onboarding: JSON.stringify({ ...prev, activations }) })
      .where(eq(tables.users.id, userId))
      .run();
  } catch {
    // Activation tracking should never break the main flow
  }
}
