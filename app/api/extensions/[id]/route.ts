import { NextRequest } from "next/server";
import { requireUser, guarded } from "@/lib/server/auth";
import { decideExtension } from "@/lib/server/projects";

export const dynamic = "force-dynamic";

/** PATCH { approve: boolean } — client decides a pending extension request. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const ext = decideExtension(params.id, user.id, !!body.approve);
    return { status: ext.status };
  });
}
