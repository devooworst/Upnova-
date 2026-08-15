import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { runJobsTick } from "@/lib/server/jobs";
import { kvGetJson, kvSetJson } from "@/lib/server/kv";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // a full sweep must never be cut off at the default

/* ------------------------------------------------------------------ */
/*  GET /api/jobs/tick — the production job runner.                    */
/*                                                                     */
/*  Invoked by Vercel Cron (vercel.json, every 10 minutes). Vercel     */
/*  sends `Authorization: Bearer ${CRON_SECRET}` automatically when    */
/*  the CRON_SECRET env var is set on the project; any other caller    */
/*  must present the same secret (or JOBS_TICK_SECRET). Unauthorized   */
/*  callers get 401. If NO secret is configured, the route fails       */
/*  CLOSED in production (503 — configure the secret) and stays open   */
/*  only on dev/preview instances where the Test Center already        */
/*  exposes an equivalent admin-gated trigger.                         */
/*                                                                     */
/*  Safe to invoke repeatedly and concurrently: every job checks its   */
/*  own state in the database (notifications table for sends,          */
/*  status-guarded transitions for orders) — never in-memory state.    */
/*  Each run's outcome is recorded to kvState for operations.          */
/* ------------------------------------------------------------------ */

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.JOBS_TICK_SECRET || "";
  if (!secret) {
    // fail closed in production; open on dev/preview (Test Center parity)
    return process.env.VERCEL_ENV !== "production";
  }
  const header = req.headers.get("authorization") || "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    const configured = !!(process.env.CRON_SECRET || process.env.JOBS_TICK_SECRET);
    return Response.json(
      { error: configured ? "Unauthorized" : "Job runner secret not configured — set CRON_SECRET" },
      { status: configured ? 401 : 503 }
    );
  }

  const startedAt = new Date();
  try {
    const counts = await runJobsTick(startedAt);
    const record = {
      at: startedAt.toISOString(),
      ms: Date.now() - startedAt.getTime(),
      ok: true,
      counts,
    };
    await kvSetJson("jobs:lastRun", record).catch(() => {}); // ops record must never fail the tick
    await kvSetJson("jobs:consecutiveFailures", 0).catch(() => {});
    return Response.json(record);
  } catch (err) {
    // record the failure, return 500 — the next cron invocation retries
    // the SAME work safely (idempotency lives in the jobs themselves)
    const record = {
      at: startedAt.toISOString(),
      ms: Date.now() - startedAt.getTime(),
      ok: false,
      error: (err as Error).message?.slice(0, 300) ?? "unknown",
    };
    await kvSetJson("jobs:lastRun", record).catch(() => {});
    const prior = await kvGetJson<number>("jobs:consecutiveFailures", 0).catch(() => 0);
    await kvSetJson("jobs:consecutiveFailures", prior + 1).catch(() => {});
    return Response.json(record, { status: 500 });
  }
}
