/* ------------------------------------------------------------------ */
/*  Products & Orders — shared vocabulary.                             */
/*  Product = "buy this" — the sixth entity, one configurable listing  */
/*  system (categories are defaults + custom, fulfillment is chosen    */
/*  by the seller, variants are free-form). Order = the purchase       */
/*  transaction whose states the buyer can actually SEE.               */
/* ------------------------------------------------------------------ */

export const PRODUCT_CATEGORIES = [
  "clothing", "accessories", "beauty", "art", "electronics", "collectibles", "handmade", "music", "other",
] as const;

export type ProductFulfillment = "shipping" | "pickup" | "delivery" | "digital";

export const FULFILLMENT_LABEL: Record<ProductFulfillment, string> = {
  shipping: "Shipping",
  pickup: "Local pickup",
  delivery: "Local delivery",
  digital: "Digital delivery",
};

export interface VariantGroup {
  name: string; // "Size", "Color"
  options: string[];
}

export function parseVariants(raw: string | null | undefined): VariantGroup[] {
  try {
    const arr = JSON.parse(raw || "[]");
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((g): g is Record<string, unknown> => !!g && typeof g === "object")
      .slice(0, 2)
      .map((g) => ({
        name: String(g.name || "").trim().slice(0, 20),
        options: (Array.isArray(g.options) ? g.options : [])
          .map((o) => String(o).trim().slice(0, 24))
          .filter(Boolean)
          .slice(0, 10),
      }))
      .filter((g) => g.name && g.options.length > 0);
  } catch {
    return [];
  }
}

export function parseFulfillment(raw: string | null | undefined): ProductFulfillment[] {
  try {
    const arr = JSON.parse(raw || "[]");
    const valid = ["shipping", "pickup", "delivery", "digital"] as const;
    const out = (Array.isArray(arr) ? arr : []).filter((f): f is ProductFulfillment =>
      (valid as readonly string[]).includes(String(f))
    );
    return out.length ? out : ["shipping"];
  } catch {
    return ["shipping"];
  }
}

/* ------------------------------ order states ------------------------------ */
/* placed → secured → preparing → shipped → delivered → completed
   (cancelled possible before shipping; funds held until completion) */

export const ORDER_FLOW = ["placed", "secured", "preparing", "shipped", "delivered", "completed"] as const;
export type OrderStatus = (typeof ORDER_FLOW)[number] | "cancelled";

export const ORDER_STATUS_LABEL: Record<string, string> = {
  placed: "Order placed",
  secured: "Payment secured",
  preparing: "Seller preparing order",
  shipped: "Shipped",
  delivered: "Delivered",
  completed: "Order completed",
  cancelled: "Cancelled",
};

export interface OrderTracking {
  carrier?: string;
  code?: string;
  eta?: string; // ISO date
}

/** What a buyer can report — opens a dispute for HUMAN review, never an
 *  automatic accusation or an automatic refund. */
export const ORDER_REPORT_REASONS = [
  { id: "item_not_shipped", label: "Item never shipped" },
  { id: "not_received", label: "Tracking says delivered, but I don't have it" },
  { id: "wrong_item", label: "Wrong item received" },
  { id: "not_as_described", label: "Item significantly differs from the listing" },
  { id: "damaged", label: "Package arrived damaged" },
  { id: "seller_unresponsive", label: "Seller doesn't respond" },
  { id: "other", label: "Something else" },
] as const;
