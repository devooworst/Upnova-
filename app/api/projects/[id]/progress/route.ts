import { NextRequest } from "next/server";
import { requireUser, guarded } from "@/lib/server/auth";
import { postProgressUpdate, postEtaChange, progressPayload } from "@/lib/server/progress";

export const dynamic = "force-dynamic";

/** GET — full progress history + current estimate for a party. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const user = requireUser();
    return { progress: progressPayload("project", params.id, user.id) };
  });
}

/**
 * POST — the CREATOR posts a progress update or an ETA change.
 *   { kind: "update", status, percent?, message?, etaAt?, attachmentUrl? }
 *   { kind: "eta", etaAt, reason }
 * Progress never mutates the project state machine; ETA changes record
 * the previous estimate and notify the client — never silent.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    if (body.kind === "eta") {
      const row = postEtaChange("project", params.id, user.id, { etaAt: String(body.etaAt), reason: body.reason });
      return { id: row.id, progress: progressPayload("project", params.id, user.id) };
    }
    const row = postProgressUpdate("project", params.id, user.id, {
      status: body.status,
      percent: body.percent,
      message: body.message,
      etaAt: body.etaAt ?? null,
      attachmentUrl: body.attachmentUrl,
    });
    return { id: row.id, progress: progressPayload("project", params.id, user.id) };
  });
}
