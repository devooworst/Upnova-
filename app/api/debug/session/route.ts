import { existsSync } from "fs";
import { join } from "path";
import { db, tables } from "@/db";
import { guarded, isDemoMode, ApiError, demoModeSources, getSessionUser } from "@/lib/server/auth";
import { uploadsBackend } from "@/lib/server/blobs";

export const dynamic = "force-dynamic";

/** Dev-only session diagnostics — exists ONLY when the demo flag is on.
 *  No secrets: counts and booleans, never tokens or emails. */
export async function GET() {
  return guarded(async () => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    return {
      serverTime: new Date().toISOString(),
      sessionsInDb: (await db.select().from(tables.sessions).all()).length,
      stickyEnabled: process.env.MAVYN_DEMO_STICKY_SESSION === "1",
      stickyMarkerPresent: existsSync(join(process.cwd(), "db", ".demo-session")),
      cookielessMode: process.env.MAVYN_DISABLE_SESSION_COOKIES === "1",
      sandbox: process.env.E2B_SANDBOX_ID ?? null,
      serverBuildCommit: process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "unknown",
      // demo/QA tooling state: WHY this instance is in demo mode, and
      // whether the current session may use the controls (the same
      // requireQaOperator rule the routes enforce)
      demoMode: {
        active: true, // this endpoint only exists on demo instances
        via: demoModeSources(),
        vercelEnv: process.env.VERCEL_ENV ?? null,
        sessionAuthorizedForDemoTools: await (async () => {
          const u = await getSessionUser();
          return !!u && (u.role === "admin" || ["testcustomer", "testcreator", "testbusiness"].includes(u.handle));
        })(),
      },
      // uploads diagnostics: which storage backend THIS deployment uses.
      // "NOT_CONFIGURED" = running on Vercel without a connected Blob
      // store (BLOB_READ_WRITE_TOKEN missing) — uploads cannot work.
      uploads: {
        backend: uploadsBackend(),
        blobTokenPresent: !!process.env.BLOB_READ_WRITE_TOKEN,
      },
    };
  });
}
