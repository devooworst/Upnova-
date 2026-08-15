/* ------------------------------------------------------------------ */
/*  Campus Marketplace — students helping students.                    */
/*  Six transaction types on ONE listing system. The distinction that  */
/*  matters most: FREE = you keep it · BORROW = it comes back.         */
/* ------------------------------------------------------------------ */

export const LISTING_TYPES = [
  { id: "fixed", label: "For Sale", cta: "Buy" },
  { id: "free", label: "Free", cta: "Claim Item" },
  { id: "negotiable", label: "Negotiable / OBO", cta: "Make an Offer" },
  { id: "trade", label: "Trade", cta: "Propose a Trade" },
  { id: "auction", label: "Auction", cta: "Place Bid" },
  { id: "borrow", label: "Borrow", cta: "Request to Borrow" },
  { id: "need_borrow", label: "Need to Borrow", cta: "I Can Lend Mine" },
] as const;
export type ListingType = (typeof LISTING_TYPES)[number]["id"];

export const CAMPUS_CATEGORIES = [
  "textbooks", "electronics", "clothing", "dorm & housing", "beauty", "handmade",
  "food", "collectibles", "student businesses", "free & giveaways", "other",
] as const;

export const CAMPUS_FULFILLMENT = [
  { id: "pickup", label: "Campus pickup" },
  { id: "campus_delivery", label: "Campus delivery" },
  { id: "shipping", label: "Shipping" },
  { id: "flexible", label: "Flexible" },
] as const;

export const CONDITIONS = [
  { id: "new", label: "New" },
  { id: "like_new", label: "Like new" },
  { id: "good", label: "Good" },
  { id: "fair", label: "Fair" },
] as const;

export const LOAN_FLOW = ["requested", "approved", "borrowed", "return_claimed", "completed"] as const;
export const LOAN_STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  approved: "Accepted — exchange pending",
  borrowed: "Borrowed",
  return_claimed: "Returned — awaiting owner confirmation",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
  returned_disputed: "Returned with a reported problem",
};

/* The borrowing agreement, tracked end to end. "Return due" and "Overdue"
   are time phases of the borrowed state, derived from the agreed dueAt. */
export const LOAN_CHAIN = [
  "Requested",
  "Accepted",
  "Exchange pending",
  "Borrowed",
  "Return due",
  "Returned",
  "Completed",
] as const;

/** Current position in LOAN_CHAIN (−1 for declined/cancelled/disputed). */
export function loanChainStep(status: string, dueAtMs: number, now = Date.now()): number {
  switch (status) {
    case "requested":
      return 0;
    case "approved":
      return 2; // accepted; exchange is what's pending now
    case "borrowed":
      return dueAtMs - now < 24 * 3600_000 ? 4 : 3; // Return due inside 24h (or past due)
    case "return_claimed":
      return 5;
    case "completed":
      return 6;
    default:
      return -1;
  }
}

/** Display phase, overdue-aware. */
export function loanPhase(status: string, dueAtMs: number, now = Date.now()): string {
  if (status === "borrowed" && dueAtMs < now) return "Overdue";
  const step = loanChainStep(status, dueAtMs, now);
  if (step === -1) return LOAN_STATUS_LABEL[status] ?? status;
  if (status === "approved") return "Accepted — exchange pending";
  return LOAN_CHAIN[step];
}

export const EXCHANGE_METHODS = [
  { id: "campus_meetup", label: "Campus meetup", desc: "Meet somewhere public on campus" },
  { id: "pickup", label: "Pickup", desc: "Borrower picks it up from the owner" },
  { id: "dropoff", label: "Drop-off", desc: "Owner drops it off to the borrower" },
  { id: "custom", label: "Custom", desc: "Something else — describe it" },
] as const;

export const exchangeLabel = (m: string) => EXCHANGE_METHODS.find((x) => x.id === m)?.label ?? m;

export const CAMPUS_REPORT_REASONS = [
  { id: "scam", label: "Suspected scam" },
  { id: "prohibited_item", label: "Prohibited item" },
  { id: "counterfeit", label: "Counterfeit goods" },
  { id: "harassment", label: "Harassment" },
  { id: "unsafe_transaction", label: "Unsafe transaction" },
  { id: "other", label: "Something else" },
] as const;

export function typeLabel(t: string) {
  return LISTING_TYPES.find((x) => x.id === t)?.label ?? t;
}
export function typeCta(t: string) {
  return LISTING_TYPES.find((x) => x.id === t)?.cta ?? "View";
}
