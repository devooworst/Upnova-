import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";
import { limitsPayload } from "@/lib/server/businessLimits";

export const dynamic = "force-dynamic";

/**
 * GET /api/business/limits — plan, capacity limits, live usage, and
 * at-limit flags for the signed-in account. Powers the honest capacity
 * banners ("Active opportunities: 3/3 — Business Pro: up to 15") and
 * the Test Center's subscription assertions.
 */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const row = db.select().from(tables.users).where(eq(tables.users.id, user.id)).get()!;
    return limitsPayload({ id: row.id, accountType: row.accountType, plan: row.plan });
  });
}
