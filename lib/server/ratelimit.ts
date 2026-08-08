/* ------------------------------------------------------------------ */
/*  Rate limiting — fixed-window, in-memory. Fine for the single-      */
/*  process dev server; production swaps the store for Redis behind    */
/*  the same interface.                                                */
/* ------------------------------------------------------------------ */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  b.count++;
  if (b.count > max) return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, retryAfterSec: 0 };
}

/** Clear a bucket (e.g. successful login resets the failure counter). */
export function rateLimitReset(key: string) {
  buckets.delete(key);
}
