import { NextRequest } from "next/server";
import { guarded, ApiError } from "@/lib/server/auth";
import { searchCities } from "@/lib/server/geo";

export const dynamic = "force-dynamic";

/**
 * GET /api/geo/cities?country=US&state=US-MD&county=US-24033&q=acc
 * Cities OF THE SELECTED AREA only, lazily filtered server-side
 * (max 50 rows per response — nobody downloads 145k cities).
 * Each row carries its countyId/countyName so choosing a city can
 * auto-fill the county above it.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return guarded(async () => {
    const country = String(p.get("country") || "").trim();
    if (!country) throw new ApiError(400, "Pick a country first.");
    return {
      items: searchCities({
        countryCode: country,
        stateId: String(p.get("state") || "").trim() || undefined,
        countyId: String(p.get("county") || "").trim() || undefined,
        q: String(p.get("q") || "").slice(0, 60),
      }),
    };
  });
}
