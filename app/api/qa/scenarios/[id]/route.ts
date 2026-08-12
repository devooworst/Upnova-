import { NextRequest } from "next/server";
import { requireQaOperator, guarded, ApiError, isDemoMode, signDemoToken } from "@/lib/server/auth";
import { ensureQaPersonas, resetQaData, readRuns, writeRuns } from "@/lib/server/qa";
import { getScenario, scenarioProgress, buildContext, type QaApi } from "@/lib/server/qaScenarios";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function scenarioState(id: string) {
  const scenario = getScenario(id);
  if (!scenario) throw new ApiError(404, "Unknown scenario");
  const runs = readRuns();
  const prog = scenarioProgress(scenario, runs);
  return {
    id: scenario.id,
    title: scenario.title,
    personas: scenario.personas,
    description: scenario.description,
    startedAt: prog.startedAt,
    completed: prog.completed,
    completedAt: prog.completedAt,
    current: prog.current,
    done: prog.done,
    total: prog.total,
    steps: prog.steps,
  };
}

/** GET — live checkpoint evaluation straight from the real database. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    requireQaOperator();
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
    requireQaOperator();
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
    // STRICT PROGRESSION RULES:
    // · Resetting/starting THIS scenario always begins at Task 1 — its
    //   run entry (cursor, passed snapshots, completion) is replaced
    //   wholesale, so no stale current-task state can survive.
    // · OTHER scenarios are never touched: completed ones keep their
    //   verified snapshots, in-flight ones keep the exact prefix of
    //   tasks they already passed (each pass was snapshotted when it
    //   verified). Resetting the booking scenario cannot reset the
    //   project scenario, and vice versa.
    runs[scenario.id] = { startedAt: new Date().toISOString() };
    writeRuns(runs);
    return Response.json({ ...scenarioState(scenario.id), resetRecords: removed });
  }

  if (action === "repair") {
    // RESTORE REQUIRED STATE — exploration is allowed and can never be
    // falsely credited, but it may consume the state the current task
    // needs (e.g. submitting early removes Request-extension). This
    // rewinds ONLY the QA records to the task's exact starting state.
    // It never marks anything passed: verification still comes solely
    // from real records created after the task is active.
    const runs = readRuns();
    const run = runs[scenario.id];
    if (!run) return Response.json({ error: "Start the scenario first" }, { status: 409 });
    const prog = scenarioProgress(scenario, runs);
    if (prog.completed || prog.current == null) return Response.json({ error: "Nothing to repair — the scenario is complete" }, { status: 409 });
    const step = scenario.steps[prog.current];
    const ctx = buildContext(new Date(run.startedAt), new Date(runs[scenario.id]?.activated?.[step.id] ?? run.startedAt));
    const readiness = step.ready?.(ctx);
    if (!readiness || readiness.ok) return Response.json({ ...scenarioState(scenario.id), repaired: "state already correct" });
    if (!step.repair) return Response.json({ error: `No automatic repair for this task — reset the scenario to start over. (${readiness.why})` }, { status: 409 });
    const did = step.repair(ctx);
    return Response.json({ ...scenarioState(scenario.id), repaired: did });
  }

  if (action === "auto") {
    const runs = readRuns();
    if (!runs[scenario.id]) return Response.json({ error: "Start the scenario first" }, { status: 409 });
    const step = scenario.steps.find((s) => s.id === String(body.step));
    if (!step) return Response.json({ error: "Unknown step" }, { status: 404 });
    if (!step.perform)
      return Response.json({ error: "This checkpoint is a verification — it flips when the real action lands" }, { status: 409 });

    // SEQUENTIAL UNLOCK — even automation cannot skip ahead. Only the
    // one current task may be performed; locked tasks stay locked until
    // every earlier task has actually passed.
    const prog = scenarioProgress(scenario, runs);
    const idx = scenario.steps.findIndex((s) => s.id === step.id);
    const state = prog.steps[idx]?.status;
    if (state === "done") return Response.json(scenarioState(scenario.id)); // already verified — idempotent
    if (state === "locked")
      return Response.json(
        { error: `Test ${idx + 1} is locked — test ${(prog.current ?? 0) + 1} must pass first. Tasks unlock strictly in order.` },
        { status: 409 }
      );

    // authenticated persona calls against the REAL public routes.
    // Failed calls are COLLECTED and surfaced — a swallowed 429/500 used
    // to leave the checkpoint looking like a data wedge ("exists from
    // BEFORE this test") when the truth was "the action never happened".
    const performFailures: string[] = [];
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
      if (res.status >= 400 && (init?.method ?? "GET") !== "GET")
        performFailures.push(`${init?.method} ${path} → ${res.status}${data.error ? ` (${String(data.error).slice(0, 80)})` : ""}`);
      return { status: res.status, data };
    };

    const ctx = buildContext(new Date(runs[scenario.id].startedAt));
    try {
      await step.perform(ctx, api);
    } catch (e) {
      return Response.json({ error: `Step execution failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
    }
    if (performFailures.length) {
      // benign sub-call failures happen (e.g. re-running an idempotent
      // PATCH) — only surface them when the checkpoint ALSO failed to
      // verify, i.e. when the failure is the actual reason it's stuck
      const after = scenarioProgress(scenario, readRuns());
      const nowState = after.steps[idx]?.status;
      if (nowState !== "done")
        return Response.json({ error: `The step's real API call failed: ${performFailures.join("; ")}`, ...(scenarioState(scenario.id) as object) }, { status: 502 });
    }
    return Response.json(scenarioState(scenario.id));
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
