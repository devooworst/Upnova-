import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireAdmin, guarded, ApiError } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return guarded(() => {
    requireAdmin();
    const rows = db
      .select({ report: tables.reports, reporter: tables.profiles })
      .from(tables.reports)
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.reports.reporterId))
      .orderBy(desc(tables.reports.createdAt))
      .all();
    return {
      reports: rows.map((r) => ({
        id: r.report.id,
        targetType: r.report.targetType,
        targetId: r.report.targetId,
        category: r.report.category,
        details: r.report.details,
        // advisory context for the human reviewer — never proof
        signals: (() => { try { return JSON.parse(r.report.signals); } catch { return []; } })(),
        status: r.report.status,
        reporter: r.reporter.displayName,
        createdAt: r.report.createdAt.toISOString(),
      })),
    };
  });
}

/** PATCH { reportId, status: reviewing | resolved | dismissed } */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    requireAdmin();
    const status = String(body.status);
    if (!["reviewing", "resolved", "dismissed"].includes(status)) throw new ApiError(400, "Invalid status");
    db.update(tables.reports).set({ status }).where(eq(tables.reports.id, String(body.reportId))).run();
    return { ok: true };
  });
}
