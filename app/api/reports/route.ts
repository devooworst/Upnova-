import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** POST /api/reports — file a report against any record type. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const targetType = String(body.targetType || "");
    const category = String(body.category || "");
    if (!["user", "post", "message", "service", "opportunity", "community", "project"].includes(targetType))
      throw new ApiError(400, "Invalid target type");
    if (!["payment", "creator", "creative-integrity", "safety", "emergency"].includes(category))
      throw new ApiError(400, "Invalid category");

    const id = randomBytes(12).toString("hex");
    db.insert(tables.reports)
      .values({
        id,
        reporterId: user.id,
        targetType,
        targetId: String(body.targetId || "").slice(0, 64),
        category,
        details: String(body.details || "").slice(0, 2000),
      })
      .run();
    return { id };
  });
}
