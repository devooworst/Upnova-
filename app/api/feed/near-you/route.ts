import { NextResponse } from "next/server";
import { feed } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * GET /api/feed/near-you?radius=5|25|city
 * The local feed: only items with a known distance, sorted nearest-first.
 * The client renders ring groups from this list and collapses whatever
 * sits beyond the selected radius; "city" expands everything.
 */
export function GET(request: Request) {
  const radius = new URL(request.url).searchParams.get("radius") ?? "25";

  const items = feed
    .filter((p) => p.distanceMi !== undefined)
    .sort((a, b) => a.distanceMi! - b.distanceMi!);

  return NextResponse.json({ source: "near-you", radius, items });
}
