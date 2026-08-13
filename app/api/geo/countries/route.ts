import { NextRequest } from "next/server";
import { guarded } from "@/lib/server/auth";
import { searchCountries, getCountry } from "@/lib/server/geo";

export const dynamic = "force-dynamic";

/**
 * GET /api/geo/countries?q=uni          — search
 * GET /api/geo/countries?code=US        — exact lookup (rehydration)
 * Public reference data (no account information involved). Each row
 * carries the country's level configuration so the UI can adapt:
 * stateLabel ("Province", "Prefecture", …), hasStates (skip the level
 * entirely when false) and hasCounties (never show a fake County field).
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  const code = req.nextUrl.searchParams.get("code") || "";
  return guarded(async () => {
    if (code) {
      const c = getCountry(code.slice(0, 2));
      return { items: c ? [c] : [] };
    }
    return { items: searchCountries(q.slice(0, 60)) };
  });
}
