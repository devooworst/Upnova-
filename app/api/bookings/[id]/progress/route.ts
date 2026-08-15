import { NextRequest } from "next/server";
import { requireUser, guarded } from "@/lib/server/auth";
import { postProgressUpdate, postEtaChange, progressPayload } from "@/lib/server/progress";

export const dynamic = "force-dynamic";

/** GET — booking progress history + current estimate for a party. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    return { progress: await progressPayload("booking", params.id, user.id) };
  });
}

/** POST — the PROVIDER posts a progress update / ETA change on an
    accepted or confirmed booking (same shapes as project progress). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    if (body.kind === "eta") {
      const row = await postEtaChange("booking", params.id, user.id, { etaAt: String(body.etaAt), reason: body.reason });
      return { id: row.id, progress: await progressPayload("booking", params.id, user.id) };
    }
    const row = postProgressUpdate("booking", params.id, user.id, {
      status: body.status,
      percent: body.percent,
      message: body.message,
      etaAt: body.etaAt ?? null,
      attachmentUrl: body.attachmentUrl,
    });
    return { id: (await row).id, progress: await progressPayload("booking", params.id, user.id) };
  });
}
