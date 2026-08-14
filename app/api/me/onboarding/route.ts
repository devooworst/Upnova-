import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

const parse = (raw: string) => {
  try {
    return JSON.parse(raw || "{}") as { completedAt?: string; skipped?: boolean };
  } catch {
    return {};
  }
};

/** GET — my onboarding state. */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const row = db.select().from(tables.users).where(eq(tables.users.id, user.id)).get()!;
    const o = parse(row.onboarding);
    return { completed: !!o.completedAt, skipped: !!o.skipped };
  });
}

/**
 * PATCH { activation: "profile_completed" | "first_discovery" | ... }
 * Record a one-time activation event for product-market-fit tracking.
 * Idempotent — storing the event key in the onboarding JSON with a
 * timestamp means calling it twice is harmless.
 */
const ACTIVATION_KEYS = [
  "profile_completed",
  "first_discovery",
  "first_connection",
  "first_interaction",
  "first_transaction",
] as const;

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const key = String(body.activation || "");
    if (!ACTIVATION_KEYS.includes(key as (typeof ACTIVATION_KEYS)[number]))
      throw new ApiError(400, "Unknown activation event");
    const row = db.select().from(tables.users).where(eq(tables.users.id, user.id)).get()!;
    let prev: Record<string, unknown> = {};
    try { prev = JSON.parse(row.onboarding || "{}") ?? {}; } catch {}
    const activations = (typeof prev.activations === "object" && prev.activations !== null ? prev.activations : {}) as Record<string, string>;
    if (activations[key]) return { recorded: false, already: true };
    activations[key] = new Date().toISOString();
    db.update(tables.users)
      .set({ onboarding: JSON.stringify({ ...prev, activations }) })
      .where(eq(tables.users.id, user.id))
      .run();
    return { recorded: true };
  });
}

/**
 * POST { action: "complete" | "skip" | "reset" } — record that the
 * first-run tour finished (or was skipped, which counts as done: the
 * tour never nags). "reset" clears the state so the tour greets the
 * user again — used by Settings → Help → Take the tour again.
 * Education state only: nothing else in the account changes.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const action = String(body.action);
    // per-feature tutorial state (the `tours` key) is ALWAYS preserved —
    // finishing or resetting the first-run tour never wipes it
    const row = db.select().from(tables.users).where(eq(tables.users.id, user.id)).get()!;
    let prev: Record<string, unknown> = {};
    try { prev = JSON.parse(row.onboarding || "{}") ?? {}; } catch {}
    const keepTours = typeof prev.tours === "object" && prev.tours !== null ? { tours: prev.tours } : {};
    if (action === "complete" || action === "skip") {
      db.update(tables.users)
        .set({ onboarding: JSON.stringify({ completedAt: new Date().toISOString(), skipped: action === "skip", ...keepTours }) })
        .where(eq(tables.users.id, user.id))
        .run();
      return { completed: true, skipped: action === "skip" };
    }
    if (action === "reset") {
      db.update(tables.users).set({ onboarding: JSON.stringify({ ...keepTours }) }).where(eq(tables.users.id, user.id)).run();
      return { completed: false, skipped: false };
    }
    throw new ApiError(400, "Unknown action");
  });
}
