import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { guarded, ApiError, isDemoMode, requireQaOperator } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/demo/mode — the DEMO MODE / SIMULATION MODE master switch.
 *
 *   demo       — unrestricted developer testing (access gates open)
 *   simulation — realistic user experience (every real gate applies)
 *
 * Persisted on the ACCOUNT (users.tester_mode) so it survives refreshes
 * and device switches. Demo-deployment only: production (no db/DEMO_MODE)
 * returns 404 and the platform always behaves like simulation mode.
 * This changes FEATURE ACCESS only — auth/session state is never touched.
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return guarded(async () => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    const user = await requireQaOperator();
    const mode = String(body.mode || "");
    if (mode !== "demo" && mode !== "simulation")
      throw new ApiError(400, 'mode must be "demo" or "simulation"');
    await db.update(tables.users).set({ testerMode: mode }).where(eq(tables.users.id, user.id)).run();
    return { mode };
  });
}
