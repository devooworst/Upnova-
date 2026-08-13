import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** PATCH /api/me/plan { plan } — subscription state lives on the account, not in a browser. */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const plan = String(body.plan);
    const acct = (await db.select().from(tables.users).where(eq(tables.users.id, user.id)).get())!;
    // plan sets are per account type: personal (Free -> College+ -> Pro,
    // with Alumni Pro billed at the permanent alumni rate) vs business
    // (presence is FREE; Business Pro / Agency monetize recruiting+scale)
    // ONE Business subscription (the old Agency tier is merged into it;
    // legacy 'agency' values are read as Business but never sold)
    const allowed = acct.accountType === "business" ? ["free", "business_pro"] : ["free", "college", "pro"];
    if (!allowed.includes(plan))
      throw new ApiError(400, acct.accountType === "business" ? "Business accounts use: free or business_pro" : "Invalid plan");
    await db.update(tables.users).set({ plan }).where(eq(tables.users.id, user.id)).run();
    return { plan };
  });
}
