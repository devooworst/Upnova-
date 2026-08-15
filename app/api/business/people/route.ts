import { requireUser, guarded } from "@/lib/server/auth";
import { peopleFor } from "@/lib/server/businessPeople";

export const dynamic = "force-dynamic";

/**
 * GET /api/business/people — the PRIVATE relationship dashboard:
 * TEAM (explicit rows only), CLIENTS (they booked/hired me), TALENT
 * (I hired them), CONTACTS (talked, no engagement yet). Derived from
 * the real bookings/projects/applications/conversations — one hire
 * never makes anyone an employee. Visible only to the account itself.
 */
export async function GET() {
  return guarded(async () => {
    const user = await requireUser();
    return peopleFor(user.id);
  });
}
