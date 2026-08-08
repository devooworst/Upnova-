/* ------------------------------------------------------------------ */
/* Account state — mock until real auth/billing exists.                */
/*                                                                     */
/* Independent properties, deliberately:                               */
/*   Plan          free | college | pro   → subscription perks only    */
/*   Verification  studentVerified        → campus eligibility         */
/*                                                                     */
/* Plan controls benefits. Verification controls eligibility. Feed     */
/* scope controls what you see. Switching College → Pro removes        */
/* College perks but NEVER removes verified school identity or         */
/* legitimate campus access.                                           */
/* ------------------------------------------------------------------ */

export type Plan = "free" | "college" | "pro";

export const PRO_EVENT = "upnova:account-changed";

export function getPlan(): Plan {
  if (typeof window === "undefined") return "free";
  const v = window.localStorage.getItem("upnova-plan");
  return v === "pro" || v === "college" ? v : "free";
}

export function setPlan(plan: Plan) {
  window.localStorage.setItem("upnova-plan", plan);
  window.dispatchEvent(new Event(PRO_EVENT));
}

/** Verified student identity — independent of the current plan. */
export function isStudentVerified(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("upnova-student-verified") === "1";
}

export function setStudentVerified(v: boolean) {
  window.localStorage.setItem("upnova-student-verified", v ? "1" : "0");
  window.dispatchEvent(new Event(PRO_EVENT));
}

/* compat shims */
export function isPro(): boolean {
  return getPlan() === "pro";
}
export function setPro(active: boolean) {
  setPlan(active ? "pro" : "free");
}
