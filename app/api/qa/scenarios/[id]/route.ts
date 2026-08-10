import { NextRequest } from "next/server";
import { requireUser, guarded, ApiError, isDemoMode, signDemoToken } from "@/lib/server/auth";
import { ensureQaPersonas, resetQaData, readRuns, writeRuns } from "@/lib/server/qa";
import { getScenario, evaluateScenario, buildContext, type QaApi } from "@/lib/server/qaScenarios";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function scenarioState(id: string) {
  const scenario = getScenario(id);
  if (!scenario) throw new ApiError(404, "Unknown scenario");
  const runs = readRuns();
  const startedAt = runs[id] ? new Date(runs[id].startedAt) : null;
  const steps = evaluateScenario(scenario, startedAt);
  return {
    id: scenario.id,
    title: scenario.title,
    personas: scenario.personas,
    description: scenario.description,
    startedAt: startedAt?.toISOString() ?? null,
    done: steps.filter((s) => s.status === "done").length,
    total: steps.length,
    steps,
  };
}

/** GET — live checkpoint evaluation straight from the real database. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    requireUser();
    ensureQaPersonas();
    return scenarioState(params.id);
  });
}

/**
 * POST { action: "start" | "reset" }   — arm the scenario: wipe ALL QA
 *   test records (only QA personas' data — real accounts untouched) and
 *   set the observation window. Checkpoints only count records created
 *   after this moment.
 * POST { action: "auto", step }        — perform ONE step server-side,
 *   through the same public HTTP routes, authenticated as the correct
 *   persona. Real state machines run; nothing is label-flipped. The
 *   step is then re-verified like any manual action.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const origin = req.nextUrl.origin;

  const gate = await guarded(() => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    requireUser();
    ensureQaPersonas();
    return { ok: true };
  });
  if (gate.status !== 200) return gate;

  const scenario = getScenario(params.id);
  if (!scenario) return Response.json({ error: "Unknown scenario" }, { status: 404 });
  const action = String(body.action);

  if (action === "start" || action === "reset") {
    const removed = resetQaData();
    const runs = readRuns();
    // arming one scenario resets the shared QA data, so other runs restart
    for (const k of Object.keys(runs)) delete runs[k];
    runs[scenario.id] = { startedAt: new Date().toISOString() };
    writeRuns(runs);
    return Response.json({ ...scenarioState(scenario.id), resetRecords: removed });
  }

  if (action === "auto") {
    const runs = readRuns();
    if (!runs[scenario.id]) return Response.json({ error: "Start the scenario first" }, { status: 409 });
    const step = scenario.steps.find((s) => s.id === String(body.step));
    if (!step) return Response.json({ error: "Unknown step" }, { status: 404 });
    if (!step.perform)
      return Response.json({ error: "This checkpoint is a verification — it flips when the real action lands" }, { status: 409 });

    // authenticated persona calls against the REAL public routes
    const api: QaApi = async (handle, path, init) => {
      const res = await fetch(origin + path, {
        method: init?.method ?? "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${signDemoToken(handle)}` },
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch {
        /* non-json */
      }
      return { status: res.status, data };
    };

    const ctx = buildContext(new Date(runs[scenario.id].startedAt));
    try {
      await step.perform(ctx, api);
    } catch (e) {
      return Response.json({ error: `Step execution failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
    }
    return Response.json(scenarioState(scenario.id));
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
