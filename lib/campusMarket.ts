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
  requested: "Request sent",
  approved: "Approved — arrange pickup",
  borrowed: "Borrowed",
  return_claimed: "Return claimed — awaiting owner confirmation",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
  returned_disputed: "Returned with a reported problem",
};

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
