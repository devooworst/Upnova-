import { NextRequest } from "next/server";
import { guarded, ApiError } from "@/lib/server/auth";
import { searchCounties } from "@/lib/server/geo";

export const dynamic = "force-dynamic";

/**
 * GET /api/geo/counties?country=US&state=US-MD&q=prince
 * Counties/districts OF THE GIVEN STATE only. Maryland never lists
 * Fairfax; a state without county data returns an empty list (and the
 * UI hides the level entirely).
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return guarded(async () => {
    const country = String(p.get("country") || "").trim();
    const state = String(p.get("state") || "").trim();
    if (!country || !state) throw new ApiError(400, "Pick a country and state first.");
    return { items: searchCounties(country, state, String(p.get("q") || "").slice(0, 60)) };
  });
}
