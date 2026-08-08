import { NextRequest } from "next/server";
import { requireUser, guarded } from "@/lib/server/auth";
import { addReview } from "@/lib/server/projects";
import { seedReviewsBack } from "@/lib/server/demo";

export const dynamic = "force-dynamic";

/** POST { rating, body } — review the counterpart after completion. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    addReview(params.id, user.id, Number(body.rating), String(body.body || "").slice(0, 1000));
    // dev demo: seed counterpart reviews back, closing the project
    seedReviewsBack(params.id, user.id);
    return { ok: true };
  });
}
