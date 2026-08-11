import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import {
  requireUser,
  guarded,
  ApiError,
  isDemoMode,
  signDemoToken,
  verifyDemoToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/server/auth";
import { ensureQaPersonas, isQaHandle } from "@/lib/server/qa";

export const dynamic = "force-dynamic";

/**
 * POST /api/qa/impersonate — Test-Center persona switching ("View as
 * TEST CUSTOMER / TEST CREATOR / TEST BUSINESS").
 *
 *   { handle }       → switch INTO a QA persona (allowlist — QA test
 *                      accounts ONLY; real accounts can never be
 *                      impersonated through this route)
 *   { returnToken }  → switch BACK to the account you started from,
 *                      by presenting the signed token this route gave
 *                      you when you left (cryptographically verified —
 *                      possessing it IS the credential)
 *
 * DEMO DEPLOYMENTS ONLY (production 404s). Requires a signed-in
 * session. Uses the same signed demo-token transport the demo login
 * flow uses; never writes session rows, never touches the sandbox's
 * sticky session marker.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return guarded(() => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    const me = requireUser();
    ensureQaPersonas();

    // SERVER-SIDE AUTHORIZATION — persona switching is a development
    // tool. Entering a QA persona: dev admins + QA personas only.
    // Exiting via returnToken: only a QA persona can be "inside" one.
    const meIsQa = isQaHandle(me.handle);
    const meAuthorized = me.role === "admin" || meIsQa;

    let targetHandle: string;
    if (body.returnToken) {
      if (!meIsQa) throw new ApiError(403, "Nothing to exit — you are not in a test persona");
      const h = verifyDemoToken(String(body.returnToken));
      if (!h) throw new ApiError(403, "Invalid return token");
      targetHandle = h;
    } else {
      if (!meAuthorized)
        throw new ApiError(403, "Test personas are restricted to authorized development accounts");
      targetHandle = String(body.handle ?? "").trim().toLowerCase();
      if (!isQaHandle(targetHandle))
        throw new ApiError(403, "Only the QA test personas can be impersonated");
    }

    const target = db.select().from(tables.users).where(eq(tables.users.handle, targetHandle)).get();
    if (!target || target.status !== "active") throw new ApiError(404, "Account not found");

    const token = signDemoToken(target.handle);
    // the HTTP session cookie takes precedence over Bearer fallbacks, so
    // switch it too (demo tokens ride every transport identically)
    const cookieless = process.env.MAVYN_DISABLE_SESSION_COOKIES === "1";
    if (!cookieless) cookies().set(SESSION_COOKIE, token, sessionCookieOptions());

    return {
      handle: target.handle,
      sessionToken: token,
      // leaving a NON-QA account? hand back a signed way home
      returnToken: !isQaHandle(me.handle) && !body.returnToken ? signDemoToken(me.handle) : null,
      returnHandle: !isQaHandle(me.handle) && !body.returnToken ? me.handle : null,
    };
  });
}
