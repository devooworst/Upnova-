/* UpNova Pro subscription state — mock. Lives in localStorage until a real
   billing backend (Stripe subscriptions) exists. */

export const PRO_EVENT = "upnova:pro-changed";

export function isPro(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("upnova-pro") === "1";
}

export function setPro(active: boolean) {
  window.localStorage.setItem("upnova-pro", active ? "1" : "0");
  window.dispatchEvent(new Event(PRO_EVENT));
}
