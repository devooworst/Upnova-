/* ------------------------------------------------------------------ */
/* UpNova monetization — single source of truth.                       */
/*                                                                     */
/* Model: buyer pays the platform fee separately. The creator's listed */
/* price is exactly what the creator earns (before payment-processing  */
/* costs/taxes, which live with the payment provider, not here).       */
/*                                                                     */
/* Production architecture: Stripe Connect (connected accounts,        */
/* onboarding/verification, destination charges with application_fee,  */
/* payouts, refunds, disputes). No proprietary wallet. No stored       */
/* balances. UpNova never holds funds itself — the processor does.     */
/* Every amount shown in the UI must flow through these helpers so the */
/* fee model is a config change, not a rewrite.                        */
/* ------------------------------------------------------------------ */

export const PLATFORM_FEE_RATE = 0.05; // 5% — displayed transparently before checkout

/** Platform fee for a given creator price, in dollars (cents-exact). */
export function feeFor(price: number): number {
  return Math.round(price * PLATFORM_FEE_RATE * 100) / 100;
}

/** What the client pays: creator price + platform fee. */
export function totalFor(price: number): number {
  return Math.round((price + feeFor(price)) * 100) / 100;
}

/** $1,234 or $12.50 — whole dollars stay whole. */
export function money(n: number): string {
  return n % 1 === 0 ? `$${n.toLocaleString()}` : `$${n.toFixed(2)}`;
}

/* ---- Pro subscription ---- */
export const PRO_PRICE = 7.99; // per month — core earning ability is never paywalled

/* ---- Promotion products (clearly labeled, never override relevance) ---- */
export const promoProducts = [
  { id: "boost-service", name: "Boost Service", price: 3.99, duration: "3 days", desc: "Your service ranks higher in Services and Discover for people it's relevant to." },
  { id: "featured-profile", name: "Featured Profile", price: 7.99, duration: "7 days", desc: "Your profile appears in featured creator slots across Discover." },
  { id: "featured-opportunity", name: "Featured Opportunity", price: 9.99, duration: "7 days", desc: "Your opportunity gets the Featured banner and better placement on the job board." },
] as const;
