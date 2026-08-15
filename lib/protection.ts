/* ------------------------------------------------------------------ */
/*  Marketplace protection — the rules of the game, value-tiered.      */
/*                                                                     */
/*  Design law: NEVER auto-side with buyer or seller. A claim opens a  */
/*  dispute; funds freeze; both parties submit evidence; a human       */
/*  resolves. Tracking alone doesn't close a case ("delivered" ≠       */
/*  "received the right item") and a claim alone doesn't refund one.   */
/*  Risk signals stay internal. Trust is earned through evidence and   */
/*  history — never blind.                                             */
/* ------------------------------------------------------------------ */

/** Value-tiered protection rules: a $10 shirt ≠ a $500 console. */
export function protectionRules(price: number) {
  if (price >= 200)
    return {
      tier: "high" as const,
      protectionHours: 96,
      sellerEvidenceRequired: true, // photos/serial before shipping
      signatureSuggested: true,
      returnTrackingRequired: true,
    };
  if (price >= 50)
    return { tier: "standard" as const, protectionHours: 72, sellerEvidenceRequired: false, signatureSuggested: false, returnTrackingRequired: true };
  return { tier: "light" as const, protectionHours: 48, sellerEvidenceRequired: false, signatureSuggested: false, returnTrackingRequired: false };
}

/* -------------------------- dispute vocabulary -------------------------- */

export const PROBLEM_REASONS = [
  { id: "never_received", label: "I never received the package" },
  { id: "marked_delivered_not_received", label: "Marked delivered, but I didn't receive it" },
  { id: "wrong_item", label: "Wrong item" },
  { id: "missing_parts", label: "Item is missing parts/accessories" },
  { id: "damaged", label: "Item arrived damaged" },
  { id: "not_working", label: "Item doesn't work" },
  { id: "not_as_described", label: "Significantly different from the listing" },
  { id: "counterfeit", label: "Suspected counterfeit/fake item" },
  { id: "wrong_package_contents", label: "Seller shipped an empty or incorrect package" },
  { id: "other", label: "Other" },
] as const;

export const RETURN_REASONS = [
  { id: "wrong_size", label: "Wrong size/fit" },
  { id: "changed_mind", label: "Changed my mind" },
  { id: "not_expected", label: "Doesn't fit expectations" },
  { id: "damaged", label: "Damaged" },
  { id: "not_working", label: "Defective / not working" },
  { id: "wrong_item", label: "Wrong item received" },
  { id: "missing_parts", label: "Missing item/parts" },
  { id: "not_as_described", label: "Significantly different from listing" },
  { id: "counterfeit", label: "Suspected counterfeit" },
  { id: "other", label: "Other" },
] as const;

/** Platform-level protections that survive a seller's "no returns":
 *  non-delivery, misrepresentation, counterfeit, defective, wrong item. */
export const PROTECTED_REASONS = new Set([
  "never_received", "marked_delivered_not_received", "wrong_item", "missing_parts",
  "damaged", "not_working", "not_as_described", "counterfeit", "wrong_package_contents",
]);

export const DISPUTE_STATUS_LABEL: Record<string, string> = {
  open: "Open — awaiting the other party",
  under_review: "Under Mavyn review",
  return_authorized: "Return authorized — ship it back",
  return_in_transit: "Return in transit",
  resolved_refund: "Resolved — refunded to buyer",
  resolved_release: "Resolved — released to seller",
  withdrawn: "Withdrawn",
};

/* ----------------------------- return policy ----------------------------- */

export interface ReturnPolicy {
  accepts: boolean; // ordinary returns (changed mind, size…)
  windowDays: number;
  whoPaysShipping: "buyer" | "seller";
  restockingPct: number; // 0–20
  conditions: string; // "unworn, tags attached"
}

export const DEFAULT_RETURN_POLICY: ReturnPolicy = {
  accepts: true,
  windowDays: 14,
  whoPaysShipping: "buyer",
  restockingPct: 0,
  conditions: "",
};

export function parseReturnPolicy(raw: string | null | undefined): ReturnPolicy {
  try {
    const p = JSON.parse(raw || "{}");
    return {
      accepts: p.accepts !== false,
      windowDays: Math.min(60, Math.max(3, Math.round(Number(p.windowDays) || 14))),
      whoPaysShipping: p.whoPaysShipping === "seller" ? "seller" : "buyer",
      restockingPct: Math.min(20, Math.max(0, Math.round(Number(p.restockingPct) || 0))),
      conditions: String(p.conditions || "").slice(0, 160),
    };
  } catch {
    return DEFAULT_RETURN_POLICY;
  }
}

export function returnPolicyLines(p: ReturnPolicy): string[] {
  if (!p.accepts)
    return [
      "No ordinary returns (changed mind, size, etc.)",
      "Platform protection still applies: non-delivery, wrong/damaged/defective/counterfeit or misrepresented items are always disputable",
    ];
  return [
    `${p.windowDays}-day return window after delivery`,
    `Return shipping paid by the ${p.whoPaysShipping}`,
    p.restockingPct > 0 ? `${p.restockingPct}% restocking fee` : "No restocking fee",
    p.conditions ? `Condition: ${p.conditions}` : "Item must come back in the condition it arrived",
    "Refund issued after the seller receives the return (or Mavyn resolves a dispute)",
    "Platform protection applies regardless: non-delivery and misrepresented/defective/counterfeit items are always disputable",
  ];
}
