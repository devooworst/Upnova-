import { NextRequest } from "next/server";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import {
  recordInteraction,
  INTERACTION_ACTIONS,
  TARGET_TYPES,
  type InteractionAction,
  type TargetType,
} from "@/lib/server/recsys";

export const dynamic = "force-dynamic";

/**
 * POST /api/track { events: [{ targetType, targetId, action, meta? }] }
 * Client-side signal recording: views, profile views, service views,
 * hide, not_interested. Domain actions (like, save, book, apply,
 * follow, report) are recorded server-side by their own routes.
 */
export async function POST(req: NextRequest) {
  // beacons fired during page unload can arrive with an EMPTY body —
  // that's normal fire-and-forget analytics, not an error worth a 500
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ ok: true, recorded: 0 });
  return guarded(() => {
    const user = requireUser();
    const events = Array.isArray(body.events) ? body.events.slice(0, 25) : [body];
    let recorded = 0;
    for (const e of events) {
      const targetType = String(e.targetType) as TargetType;
      const action = String(e.action) as InteractionAction;
      const targetId = String(e.targetId || "").slice(0, 64);
      if (!TARGET_TYPES.includes(targetType) || !INTERACTION_ACTIONS.includes(action) || !targetId) continue;
      // only passive/negative signals come from the client; money-adjacent
      // actions are recorded by their authoritative routes
      if (!["view", "profile_view", "service_view", "hide", "not_interested"].includes(action))
        throw new ApiError(400, `Action ${action} is recorded server-side`);
      recordInteraction(user.id, targetType, targetId, action, e.meta ? String(e.meta) : "");
      recorded++;
    }
    return { recorded };
  });
}
