import { NextRequest } from "next/server";
import { requireUser, guarded, ApiError, isDemoMode , requireQaOperator } from "@/lib/server/auth";
import { forceAdvanceBooking, forceAdvanceOrder, forceAdvanceApplication } from "@/lib/server/demo";

export const dynamic = "force-dynamic";

/**
 * POST /api/demo/advance { kind, id } — Test Center control that plays
 * the SEED counterpart's next real action on a transaction the caller
 * participates in (provider accepts/prepares/starts/completes, seller
 * ships, poster shortlists…). It produces the exact messages,
 * notifications, and payment records the organic flow produces.
 *
 * Never an authorization bypass: it refuses transactions the caller
 * isn't part of, refuses non-seed counterparts, and NEVER performs the
 * caller's own steps (paying happens only in the real payment UI).
 * Demo deployments only — production (no db/DEMO_MODE) 404s.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return guarded(() => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    const user = requireQaOperator();
    const kind = String(body.kind || "");
    const id = String(body.id || "");
    if (!id) throw new ApiError(400, "id is required");
    try {
      if (kind === "booking") return forceAdvanceBooking(id, user.id);
      if (kind === "purchase") return forceAdvanceOrder(id, user.id);
      if (kind === "application") return forceAdvanceApplication(id, user.id);
    } catch (e) {
      throw new ApiError(409, (e as Error).message);
    }
    throw new ApiError(400, "kind must be booking | purchase | application");
  });
}
