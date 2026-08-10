import { requireUser, guarded } from "@/lib/server/auth";
import { paymentsFor } from "@/lib/server/businessPeople";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/payments — my money view: totals (spent, pending out,
 * refunded, earned, pending in) + the transaction history, each row
 * tied to its real booking/project/order and counterpart. Every
 * payment in this environment is a TEST payment — no real money.
 */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    return paymentsFor(user.id);
  });
}
