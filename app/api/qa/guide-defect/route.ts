import { NextRequest } from "next/server";
import { requireQaOperator, guarded, ApiError, isDemoMode } from "@/lib/server/auth";
import { kvGetJson, kvSetJson, kvDelete } from "@/lib/server/kv";

/* ------------------------------------------------------------------ */
/*  GUIDE DEFECT LOG — the Test Center QA's its own guidance.          */
/*                                                                     */
/*  When "Show me where" cannot locate a control it promised (after    */
/*  the grace period, never for a just-performed action), the tester   */
/*  reports it here. A guide failure is NOT an application failure —   */
/*  the underlying checkpoint may still pass — but broken guidance is  */
/*  a defect that must be visible until fixed, never silently ignored. */
/*  QA-operator only, like every Test Center tool.                     */
/* ------------------------------------------------------------------ */

export const dynamic = "force-dynamic";

const KEY = "qa:guide-defects";

type Defect = { task: string; expected: string; target: string; page: string; reportedAt: string; by: string };

const read = () => kvGetJson<Defect[]>(KEY, []);

export async function GET() {
  return guarded(async () => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    await requireQaOperator();
    return { defects: await read() };
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return guarded(async () => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    const me = await requireQaOperator();
    const defect: Defect = {
      task: String(body.task ?? "").slice(0, 120),
      expected: String(body.expected ?? "").slice(0, 80),
      target: String(body.target ?? "").slice(0, 60),
      page: String(body.page ?? "").slice(0, 160),
      reportedAt: new Date().toISOString(),
      by: me.handle,
    };
    if (!defect.target) throw new ApiError(400, "target is required");
    const all = await read();
    // de-dupe on task+target — one live defect per broken pointer
    const next = [...all.filter((d) => !(d.task === defect.task && d.target === defect.target)), defect].slice(-100);
    await kvSetJson(KEY, next);
    return { ok: true, count: next.length };
  });
}

export async function DELETE() {
  return guarded(async () => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    await requireQaOperator();
    await kvDelete(KEY);
    return { ok: true };
  });
}
