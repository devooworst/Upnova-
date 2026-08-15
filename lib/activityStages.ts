/* ------------------------------------------------------------------ */
/* Activity stages — ONE definition per workflow type, shared by the   */
/* Activity page, timelines, compact progress indicators, and the      */
/* Test Center. Separate chains on purpose: purchases, service         */
/* bookings, projects, and opportunity applications are different      */
/* processes and never share a generic status list.                    */
/* ------------------------------------------------------------------ */

export type ActivityKind = "booking" | "purchase" | "project" | "application";

export const STAGE_CHAINS: Record<ActivityKind, string[]> = {
  booking: ["Requested", "Accepted", "Payment secured", "Preparing", "In progress", "Completed"],
  purchase: ["Placed", "Payment secured", "Preparing", "Shipped / Ready", "Delivered", "Completed"],
  project: ["Brief", "Offer sent", "Accepted", "In progress", "Submitted", "Approved", "Completed", "Reviewed"],
  application: ["Submitted", "Shortlisted", "Selected", "Confirmed"],
};

/** current index in the chain (-1 = cancelled/declined) */
export function bookingStageIndex(status: string, progress: string): number {
  if (status === "cancelled") return -1;
  if (status === "completed") return 5;
  if (status === "confirmed") return progress === "in_progress" ? 4 : progress === "preparing" ? 3 : 2;
  if (status === "accepted") return 1;
  return 0; // pending / reschedule_requested
}

export function purchaseStageIndex(status: string): number {
  const map: Record<string, number> = {
    placed: 0,
    paid: 1,
    preparing: 2,
    shipped: 3,
    ready: 3,
    delivered: 4,
    completed: 5,
  };
  if (status === "cancelled" || status === "refunded") return -1;
  if (status === "disputed") return 4; // frozen at delivered while disputed
  return map[status] ?? 0;
}

const PROJECT_STEPS = ["draft", "offer_sent", "accepted", "in_progress", "submitted", "approved", "completed", "reviewed"];
export function projectStageIndex(state: string): number {
  if (state === "cancelled" || state === "declined") return -1;
  if (state === "extension_requested") return 3;
  const i = PROJECT_STEPS.indexOf(state);
  return i === -1 ? 0 : i;
}

export function applicationStageIndex(status: string): number {
  const map: Record<string, number> = { submitted: 0, shortlisted: 1, selected: 2, confirmed: 3 };
  if (status === "declined" || status === "offer_declined") return -1;
  return map[status] ?? 0;
}
