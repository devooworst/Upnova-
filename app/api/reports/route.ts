import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { recordInteraction, TARGET_TYPES, type TargetType } from "@/lib/server/recsys";
import { computeRiskSignals } from "@/lib/server/trust";

export const dynamic = "force-dynamic";

/** POST /api/reports — file a report against any record type.
 *  Reports enter the moderation queue for HUMAN review — filing one never
 *  auto-accuses, auto-labels, or auto-bans anyone. Automated risk signals
 *  are attached as advisory context only. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const targetType = String(body.targetType || "");
    const category = String(body.category || "");
    if (!["user", "post", "message", "service", "opportunity", "community", "project", "order", "product"].includes(targetType))
      throw new ApiError(400, "Invalid target type");
    if (
      ![
        // legacy general categories
        "payment", "creator", "creative-integrity", "safety", "emergency",
        // trust & authenticity reasons (lib/trust.ts REPORT_REASONS)
        "stolen_work", "impersonation", "false_service_claim", "copyright", "other",
        // order problems (lib/products.ts ORDER_REPORT_REASONS) — open a
        // dispute for human review; never an automatic refund or accusation
        "item_not_shipped", "not_received", "wrong_item", "not_as_described", "damaged", "seller_unresponsive",
      ].includes(category)
    )
      throw new ApiError(400, "Invalid category");

    // advisory signals for the moderator — never proof, never automatic action
    const signals = computeRiskSignals(targetType, String(body.targetId || ""));

    const id = randomBytes(12).toString("hex");
    db.insert(tables.reports)
      .values({
        id,
        reporterId: user.id,
        targetType,
        targetId: String(body.targetId || "").slice(0, 64),
        category,
        details: String(body.details || "").slice(0, 2000),
        signals: JSON.stringify(signals),
      })
      .run();
    if (TARGET_TYPES.includes(targetType as TargetType) && body.targetId)
      recordInteraction(user.id, targetType as TargetType, String(body.targetId), "report");
    return { id };
  });
}
