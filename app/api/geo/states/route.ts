import { NextRequest } from "next/server";
import { guarded, ApiError } from "@/lib/server/auth";
import { searchStates, getCountry } from "@/lib/server/geo";

export const dynamic = "force-dynamic";

/**
 * GET /api/geo/states?country=US&q=mary
 * States/provinces/regions OF THE GIVEN COUNTRY only — the dependency
 * is enforced here, not just in the dropdown.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return guarded(() => {
    const country = String(p.get("country") || "").trim();
    if (!country) throw new ApiError(400, "Pick a country first.");
    const meta = getCountry(country);
    if (!meta) throw new ApiError(400, "That country isn't in the location data.");
    return {
      items: searchStates(country, String(p.get("q") || "").slice(0, 60)),
      stateLabel: meta.stateLabel,
      countyLabel: meta.countyLabel,
    };
  });
}
