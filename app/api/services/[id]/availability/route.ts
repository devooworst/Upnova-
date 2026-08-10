import { NextRequest } from "next/server";
import { guarded } from "@/lib/server/auth";
import { getSessionUser } from "@/lib/server/auth";
import { serviceAvailability, serviceDaySlots } from "@/lib/server/availability";
import { ApiError } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/services/[id]/availability?days=60 — the honest per-date
 * booking calendar for a service. Public (guests see it too);
 * personalized only in one way: a Preferred Client with early access
 * sees early-access dates as bookable, everyone else sees when those
 * dates open to the public. Every status means exactly one thing —
 * "not released" is never conflated with "fully booked".
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const viewer = getSessionUser();
    // ?date=YYYY-MM-DD → the TIME-SLOT layer for that day (step 2 of booking)
    const date = req.nextUrl.searchParams.get("date");
    if (date) {
      const slots = serviceDaySlots(params.id, viewer?.id ?? null, date.slice(0, 10));
      if (!slots) throw new ApiError(404, "Service not found");
      return slots;
    }
    const days = Math.round(Number(req.nextUrl.searchParams.get("days") ?? 60)) || 60;
    const result = serviceAvailability(params.id, viewer?.id ?? null, days);
    if (!result) throw new ApiError(404, "Service not found");
    return result;
  });
}
