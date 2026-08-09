import { existsSync } from "fs";
import { join } from "path";
import { db, tables } from "@/db";
import { guarded, ApiError } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** Dev-only session diagnostics — exists ONLY when the demo flag is on.
 *  No secrets: counts and booleans, never tokens or emails. */
export async function GET() {
  return guarded(() => {
    if (process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS !== "1") throw new ApiError(404, "Not found");
    return {
      serverTime: new Date().toISOString(),
      sessionsInDb: db.select().from(tables.sessions).all().length,
      stickyEnabled: process.env.UPNOVA_DEMO_STICKY_SESSION === "1",
      stickyMarkerPresent: existsSync(join(process.cwd(), "db", ".demo-session")),
      cookielessMode: process.env.UPNOVA_DISABLE_SESSION_COOKIES === "1",
      sandbox: process.env.E2B_SANDBOX_ID ?? null,
    };
  });
}
