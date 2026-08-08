import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { generateSecret, otpauthUrl, verifyTotp } from "@/lib/server/totp";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

/** GET — MFA status for the account. */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const u = db.select().from(tables.users).where(eq(tables.users.id, user.id)).get()!;
    return { enabled: u.mfaEnabled };
  });
}

/**
 * POST { action: "setup" }            → generates a secret (not yet active)
 * POST { action: "enable", code }     → verifies a code and turns MFA on
 * POST { action: "disable", code }    → verifies a code and turns MFA off
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const u = db.select().from(tables.users).where(eq(tables.users.id, user.id)).get()!;
    const action = String(body.action);

    if (action === "setup") {
      if (u.mfaEnabled) throw new ApiError(409, "MFA is already enabled");
      const secret = generateSecret();
      db.update(tables.users).set({ mfaSecret: secret, mfaEnabled: false }).where(eq(tables.users.id, user.id)).run();
      return { secret, otpauth: otpauthUrl(secret, user.email) };
    }

    if (action === "enable") {
      if (!u.mfaSecret) throw new ApiError(409, "Run setup first");
      if (!verifyTotp(u.mfaSecret, String(body.code || ""))) throw new ApiError(401, "Code didn't match — try the current one");
      db.update(tables.users).set({ mfaEnabled: true }).where(eq(tables.users.id, user.id)).run();
      notify({
        userId: user.id,
        type: "campus",
        category: "activity",
        priority: "normal",
        title: "Two-factor authentication enabled",
        body: "Sign-ins now require a code from your authenticator app.",
        href: "/settings",
      });
      return { enabled: true };
    }

    if (action === "disable") {
      if (!u.mfaEnabled || !u.mfaSecret) throw new ApiError(409, "MFA is not enabled");
      if (!verifyTotp(u.mfaSecret, String(body.code || ""))) throw new ApiError(401, "Code didn't match — try the current one");
      db.update(tables.users).set({ mfaEnabled: false, mfaSecret: null }).where(eq(tables.users.id, user.id)).run();
      notify({
        userId: user.id,
        type: "campus",
        category: "activity",
        priority: "high",
        title: "Two-factor authentication disabled",
        body: "If this wasn't you, reset your password immediately.",
        href: "/settings",
      });
      return { enabled: false };
    }

    throw new ApiError(400, "Unknown action");
  });
}
