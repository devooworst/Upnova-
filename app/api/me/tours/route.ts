import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  Per-feature tutorial state — tracked PER USER and PER FEATURE.     */
/*                                                                     */
/*  Lives inside users.onboarding JSON under the `tours` key, next to  */
/*  the first-run tour's own state. Values: "done" (finished or        */
/*  skipped — never nag again) | "dismissed" ("don't show this again").*/
/*  "reset" clears one feature so its tutorial offers itself again.    */
/*  Education state only: nothing else about the account changes.     */
/* ------------------------------------------------------------------ */

const parseAll = (raw: string): Record<string, unknown> => {
  try {
    const o = JSON.parse(raw || "{}");
    return typeof o === "object" && o !== null ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const toursOf = (o: Record<string, unknown>): Record<string, string> => {
  const t = o.tours;
  if (typeof t !== "object" || t === null) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(t as Record<string, unknown>))
    if (typeof v === "string") out[k] = v;
  return out;
};

/** GET — my tutorial state for every feature. */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const row = db.select().from(tables.users).where(eq(tables.users.id, user.id)).get()!;
    return { tours: toursOf(parseAll(row.onboarding)) };
  });
}

/** POST { id, status: "done" | "dismissed" | "reset" } */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const id = String(body.id ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    const status = String(body.status ?? "");
    if (!id) throw new ApiError(400, "Tutorial id is required");
    if (!["done", "dismissed", "reset"].includes(status)) throw new ApiError(400, "Status must be done, dismissed, or reset");

    const row = db.select().from(tables.users).where(eq(tables.users.id, user.id)).get()!;
    const all = parseAll(row.onboarding);
    const tours = toursOf(all);
    if (status === "reset") delete tours[id];
    else tours[id] = status;
    all.tours = tours;
    db.update(tables.users).set({ onboarding: JSON.stringify(all) }).where(eq(tables.users.id, user.id)).run();
    return { tours };
  });
}
