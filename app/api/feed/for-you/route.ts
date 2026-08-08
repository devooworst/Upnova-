import { NextResponse } from "next/server";
import { feed } from "@/lib/data";

/**
 * GET /api/feed/for-you
 * The global feed: no location logic at all. Ranked by trending flag,
 * then raw engagement (likes + comments + shares) — Instagram/TikTok style.
 */
export function GET() {
  const items = [...feed].sort((a, b) => {
    const t = Number(!!b.trending) - Number(!!a.trending);
    if (t !== 0) return t;
    return b.likes + b.comments + b.shares - (a.likes + a.comments + a.shares);
  });
  return NextResponse.json({ source: "for-you", items });
}
