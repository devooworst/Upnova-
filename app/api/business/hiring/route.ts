import { requireUser, guarded } from "@/lib/server/auth";
import { hiringFor } from "@/lib/server/businessPeople";

export const dynamic = "force-dynamic";

/**
 * GET /api/business/hiring — the hiring dashboard: open opportunities,
 * applications, shortlists, active + completed hires, distinct people
 * hired, and the real application activity trail. Everything is
 * computed from the same records the product writes — nothing is a
 * display-only number.
 */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    return hiringFor(user.id);
  });
}
