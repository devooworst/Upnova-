/* UpNova subscription state — mock. Lives in localStorage until real
   billing (Stripe subscriptions) exists.
   Plans: free · college (verified students, ends at graduation) · pro. */

export type Plan = "free" | "college" | "pro";

export const PRO_EVENT = "upnova:pro-changed";

export function getPlan(): Plan {
  if (typeof window === "undefined") return "free";
  const v = window.localStorage.getItem("upnova-plan");
  return v === "pro" || v === "college" ? v : "free";
}

export function setPlan(plan: Plan) {
  window.localStorage.setItem("upnova-plan", plan);
  window.dispatchEvent(new Event(PRO_EVENT));
}

/* compat shims */
export function isPro(): boolean {
  return getPlan() === "pro";
}
export function setPro(active: boolean) {
  setPlan(active ? "pro" : "free");
}
