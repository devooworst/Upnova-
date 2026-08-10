import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError, isDemoMode } from "@/lib/server/auth";
import { ensureQaPersonas, QA_PERSONAS, isQaHandle, readRuns } from "@/lib/server/qa";
import { QA_SCENARIOS, evaluateScenario } from "@/lib/server/qaScenarios";

export const dynamic = "force-dynamic";

/**
 * GET /api/qa/state — QA Lab overview: the three TEST personas (real
 * database accounts, no bot behaviors) and every scenario's live
 * checkpoint progress, derived from the REAL records. Demo only.
 */
export async function GET() {
  return guarded(() => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    const me = requireUser();
    ensureQaPersonas();

    const personas = QA_PERSONAS.map((p) => {
      const u = db.select().from(tables.users).where(eq(tables.users.handle, p.handle)).get()!;
      const prof = db.select().from(tables.profiles).where(eq(tables.profiles.userId, u.id)).get()!;
      return {
        handle: p.handle,
        label: p.label,
        displayName: prof.displayName,
        role: p.role,
        avatarUrl: prof.avatarUrl,
        active: me.handle === p.handle,
      };
    });

    const runs = readRuns();
    const scenarios = QA_SCENARIOS.map((s) => {
      const run = runs[s.id];
      const startedAt = run ? new Date(run.startedAt) : null;
      const steps = evaluateScenario(s, startedAt);
      return {
        id: s.id,
        title: s.title,
        personas: s.personas,
        description: s.description,
        startedAt: startedAt?.toISOString() ?? null,
        done: steps.filter((x) => x.status === "done").length,
        total: steps.length,
      };
    });

    return { personas, scenarios, viewerIsPersona: isQaHandle(me.handle), viewerHandle: me.handle };
  });
}
