import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** PATCH /api/me/plan { plan } — subscription state lives on the account, not in a browser. */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const plan = String(body.plan);
    if (!["free", "college", "pro"].includes(plan)) throw new ApiError(400, "Invalid plan");
    db.update(tables.users).set({ plan }).where(eq(tables.users.id, user.id)).run();
    return { plan };
  });
}
