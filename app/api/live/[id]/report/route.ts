import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { getStream } from "@/lib/server/live";

export const dynamic = "force-dynamic";

/**
 * POST /api/live/[id]/report — report the stream or a person in it.
 * Files into the ONE shared reports system (human review — reports are
 * never auto-punishment). { target: "stream"|"user", userId?, category, details }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const stream = await getStream(params.id);
    const target = body.target === "user" ? "user" : "live_stream";
    const category = ["safety", "spam", "impersonation", "inappropriate", "privacy", "other"].includes(body.category)
      ? body.category
      : "other";
    const targetId = target === "user" ? String(body.userId || "") : stream.id;
    if (!targetId) throw new ApiError(400, "Who are you reporting?");
    if (targetId === user.id) throw new ApiError(400, "You can't report yourself");

    await db.insert(tables.reports)
      .values({
        id: randomBytes(12).toString("hex"),
        reporterId: user.id,
        targetType: target,
        targetId,
        category,
        details: String(body.details || "").slice(0, 1000),
        signals: JSON.stringify([{ context: "live", streamId: stream.id }]),
      })
      .run();
    return { ok: true, message: "Report filed — a human reviews it. Nothing is auto-punished." };
  });
}
