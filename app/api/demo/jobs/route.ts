import { requireUser, guarded, ApiError, isDemoMode } from "@/lib/server/auth";
import { runJobsTick } from "@/lib/server/jobs";

export const dynamic = "force-dynamic";

/**
 * POST /api/demo/jobs — run one background-job tick on demand.
 * The scheduler runs every minute on its own; this exists for tests
 * and operators (admins in demo mode) to verify job behavior
 * deterministically. Idempotency means calling it repeatedly is safe.
 */
export async function POST() {
  return guarded(async () => {
    const user = await requireUser();
    if (!isDemoMode() || user.role !== "admin") throw new ApiError(403, "Admin demo tool");
    return { ...(await runJobsTick()) };
  });
}
