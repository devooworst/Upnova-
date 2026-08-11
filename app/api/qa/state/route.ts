import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireQaOperator, guarded, ApiError, isDemoMode } from "@/lib/server/auth";
import { ensureQaPersonas, QA_PERSONAS, isQaHandle, readRuns } from "@/lib/server/qa";
import { QA_SCENARIOS, scenarioProgress } from "@/lib/server/qaScenarios";

export const dynamic = "force-dynamic";

/**
 * GET /api/qa/state — QA Lab overview: the three TEST personas (real
 * database accounts, no bot behaviors) and every scenario's live
 * checkpoint progress, derived from the REAL records. Demo only.
 */
export async function GET() {
  return guarded(() => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    const me = requireQaOperator();
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
      const prog = scenarioProgress(s, runs);
      return {
        id: s.id,
        title: s.title,
        personas: s.personas,
        description: s.description,
        startedAt: prog.startedAt,
        completed: prog.completed,
        done: prog.done,
        total: prog.total,
      };
    });

    // the curriculum view: completed stages count forever
    const overall = {
      done: scenarios.reduce((a, s) => a + s.done, 0),
      total: scenarios.reduce((a, s) => a + s.total, 0),
      completedScenarios: scenarios.filter((s) => s.completed).length,
      scenarioCount: scenarios.length,
    };

    return { personas, scenarios, overall, viewerIsPersona: isQaHandle(me.handle), viewerHandle: me.handle };
  });
}
