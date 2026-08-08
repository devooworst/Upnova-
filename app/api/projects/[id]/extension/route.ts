import { NextRequest } from "next/server";
import { requireUser, guarded } from "@/lib/server/auth";
import { requestExtension } from "@/lib/server/projects";

export const dynamic = "force-dynamic";

/** POST { days, reason } — creator requests a deadline extension (persistent, idempotent). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const ext = requestExtension(params.id, user.id, Number(body.days), String(body.reason || ""));
    return { id: ext.id, status: ext.status };
  });
}
