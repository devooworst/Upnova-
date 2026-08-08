import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireAdmin, guarded, ApiError } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return guarded(() => {
    requireAdmin();
    const rows = db
      .select({ user: tables.users, profile: tables.profiles })
      .from(tables.users)
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .orderBy(desc(tables.users.createdAt))
      .all();
    return {
      users: rows.map((r) => ({
        id: r.user.id,
        handle: r.user.handle,
        email: r.user.email,
        displayName: r.profile.displayName,
        role: r.user.role,
        plan: r.user.plan,
        status: r.user.status,
        accountType: r.user.accountType,
        businessVerified: !!r.user.businessVerified,
        isSeed: r.user.isSeed,
        createdAt: r.user.createdAt.toISOString(),
      })),
    };
  });
}

/** PATCH { userId, action: suspend | activate } — moderation actions. */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const admin = requireAdmin();
    const target = db.select().from(tables.users).where(eq(tables.users.id, String(body.userId))).get();
    if (!target) throw new ApiError(404, "User not found");
    if (target.id === admin.id) throw new ApiError(400, "You can't moderate yourself");

    const action = String(body.action);
    if (action === "suspend") {
      db.update(tables.users).set({ status: "suspended" }).where(eq(tables.users.id, target.id)).run();
      // suspended users lose their sessions immediately
      db.delete(tables.sessions).where(eq(tables.sessions.userId, target.id)).run();
    } else if (action === "activate") {
      db.update(tables.users).set({ status: "active" }).where(eq(tables.users.id, target.id)).run();
    } else if (action === "verify_business") {
      if (target.accountType !== "business") throw new ApiError(400, "Not a business account");
      db.update(tables.users).set({ businessVerified: true }).where(eq(tables.users.id, target.id)).run();
    } else if (action === "revoke_business") {
      db.update(tables.users).set({ businessVerified: false }).where(eq(tables.users.id, target.id)).run();
    } else {
      throw new ApiError(400, "Unknown action");
    }
    return { ok: true };
  });
}
