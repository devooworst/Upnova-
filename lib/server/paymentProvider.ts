import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";

/* ------------------------------------------------------------------ */
/*  PAYMENT PROVIDER SEAM — the one place external money moves.        */
/*                                                                     */
/*  Two implementations behind one interface:                          */
/*                                                                     */
/*   · SIMULATED — local dev, Vercel Preview, demo mode, Test Center.  */
/*     Behaves exactly like the pre-seam platform: the "charge"        */
/*     succeeds instantly and fictionally; provider="simulated",       */
/*     providerRef stays NULL (never fabricated). Every existing test  */
/*     runs without Stripe credentials.                                */
/*                                                                     */
/*   · STRIPE — production-capable. Server-side SDK only (the secret   */
/*     key never reaches a browser; nothing here is importable from    */
/*     client components — "server-only" enforced by import site).     */
/*     Destination-charge architecture per lib/fees.ts doctrine:       */
/*       amount           = amountCents + feeCents (buyer pays fee)    */
/*       application_fee  = feeCents    (the platform's cut)           */
/*       transfer target  = the seller's connected account             */
/*     UNTIL CONNECT ONBOARDING EXISTS (deliberately not built yet),   */
/*     sellers have no connected account id, so intents are created    */
/*     WITHOUT a transfer target — funds settle to the platform        */
/*     account in TEST MODE. Real payouts to sellers REQUIRE the       */
/*     onboarding pass; this file refuses live keys until then.        */
/*                                                                     */
/*  Environment selection (fail closed):                               */
/*   · VERCEL_ENV=production  → Stripe REQUIRED. Missing key = every   */
/*     payment attempt errors loudly. NO silent simulated fallback.    */
/*   · preview / dev / demo   → simulated by default; Stripe test     */
/*     mode opt-in via STRIPE_SECRET_KEY (sk_test_ only).              */
/*   · sk_live_ keys are REFUSED everywhere until live activation is   */
/*     explicitly instructed (MAVYN_ALLOW_LIVE_STRIPE=1 — do not set). */
/* ------------------------------------------------------------------ */

export type ProviderName = "simulated" | "stripe";

export interface CreatePaymentInput {
  /** our payments.id — doubles as the Stripe idempotency key */
  paymentId: string;
  amountCents: number; // seller's money
  feeCents: number; // platform fee (buyer-side)
  payerId: string;
  payeeId: string;
  description: string;
}

export interface CreatePaymentResult {
  provider: ProviderName;
  /** external transaction id (PaymentIntent id) — NULL for simulated */
  providerRef: string | null;
  /** simulated: settled immediately. stripe: awaits webhook confirmation */
  settled: boolean;
  /** client secret for the browser payment element (stripe only) */
  clientSecret?: string;
}

export interface RefundResult {
  provider: ProviderName;
  providerRef: string | null; // refund id for stripe
  refunded: boolean;
}

/* ------------------------------- config ------------------------------- */

const isVercelProduction = () => process.env.VERCEL_ENV === "production";

function stripeKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY || null;
  if (!key) return null;
  if (key.startsWith("sk_live_") && process.env.MAVYN_ALLOW_LIVE_STRIPE !== "1") {
    // CRITICAL SAFETY RULE: live-money is disabled for this phase.
    throw new Error(
      "REFUSED: sk_live_ Stripe key configured but live charging is not activated for this deployment. " +
        "Use an sk_test_ key. (Live activation is a separate, explicitly-approved step.)"
    );
  }
  return key;
}

export function activeProvider(): ProviderName {
  if (isVercelProduction()) {
    // production NEVER silently falls back to fictional money
    if (!stripeKey()) {
      throw new Error(
        "FATAL: VERCEL_ENV=production but STRIPE_SECRET_KEY is not configured. " +
          "Payments fail closed — configure the key (sk_test_ during this phase) and redeploy."
      );
    }
    return "stripe";
  }
  // dev / preview / demo: simulated unless a test key opts in
  return stripeKey() ? "stripe" : "simulated";
}

let stripeSingleton: Stripe | null = null;
function stripe(): Stripe {
  const key = stripeKey();
  if (!key) throw new Error("Stripe requested without STRIPE_SECRET_KEY");
  if (!stripeSingleton) stripeSingleton = new Stripe(key);
  return stripeSingleton;
}

/* ------------------------------ createPayment ------------------------------ */

/** Create the external charge for a payment row that the CALLER has already
 *  authorized, price-checked, and fee-computed (the six call sites keep all
 *  their guards). Returns provider/providerRef/settled for the row. */
export async function createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  const provider = activeProvider();

  if (provider === "simulated") {
    // exactly the platform's historical behavior: instant fictional settle.
    // providerRef deliberately NULL — never fabricate an external reference.
    return { provider, providerRef: null, settled: true };
  }

  // Stripe test-mode PaymentIntent. Idempotency: our payment id is the key —
  // a retried request returns the SAME intent, never a second charge.
  const intent = await stripe().paymentIntents.create(
    {
      amount: input.amountCents + input.feeCents, // buyer pays price + fee
      currency: "usd",
      description: input.description,
      // application_fee/transfer_data{destination} slot in HERE when Connect
      // onboarding exists and the payee has a connected account id.
      // Until then funds settle to the platform (test mode).
      metadata: {
        mavynPaymentId: input.paymentId,
        payerId: input.payerId,
        payeeId: input.payeeId,
        amountCents: String(input.amountCents),
        feeCents: String(input.feeCents),
      },
      // demo flows have no browser payment element yet — confirm server-side
      // with the official test payment method so the full intent lifecycle
      // (incl. webhooks) runs in test mode.
      confirm: true,
      payment_method: "pm_card_visa",
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    },
    { idempotencyKey: `pay_${input.paymentId}` }
  );

  return {
    provider,
    providerRef: intent.id,
    // server-authoritative: only the intent's own status counts — and the
    // webhook remains the source of truth for the final transition
    settled: intent.status === "succeeded",
    clientSecret: intent.client_secret ?? undefined,
  };
}

/* ------------------------------ refundPayment ------------------------------ */

/** Refund an external charge. The CALLER enforces policy/dispute authorization
 *  (creator cancellation policy, admin dispute resolution) — this function
 *  only executes the provider side. Idempotent: keyed on the payment id. */
export async function refundPayment(paymentRow: {
  id: string;
  provider: string;
  providerRef: string | null;
}): Promise<RefundResult> {
  if (paymentRow.provider !== "stripe" || !paymentRow.providerRef) {
    // simulated payments refund fictionally, like always
    return { provider: "simulated", providerRef: null, refunded: true };
  }
  const refund = await stripe().refunds.create(
    { payment_intent: paymentRow.providerRef },
    { idempotencyKey: `refund_${paymentRow.id}` }
  );
  return { provider: "stripe", providerRef: refund.id, refunded: refund.status === "succeeded" || refund.status === "pending" };
}

/* --------------------------- webhook processing --------------------------- */

/** Verify a Stripe webhook signature against the RAW body. Throws on bad sig. */
export function verifyWebhook(rawBody: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");
  return stripe().webhooks.constructEvent(rawBody, signature, secret);
}

/** Idempotent event application. Uses kvState to dedupe by event.id, then
 *  status-guarded transitions (the second protection layer). A webhook may
 *  only touch the payment row whose providerRef matches the intent it
 *  references — never arbitrary rows. */
export async function applyWebhookEvent(event: Stripe.Event): Promise<{ handled: boolean; note: string }> {
  const { kvGet, kvSet } = await import("@/lib/server/kv");
  const dedupeKey = `stripe:evt:${event.id}`;
  if (await kvGet(dedupeKey)) return { handled: false, note: "duplicate event — already processed" };

  let note = "ignored (unhandled event type)";
  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed" || event.type === "charge.refunded") {
    const obj = event.data.object as Stripe.PaymentIntent | Stripe.Charge;
    const intentId =
      event.type === "charge.refunded"
        ? typeof (obj as Stripe.Charge).payment_intent === "string"
          ? ((obj as Stripe.Charge).payment_intent as string)
          : ((obj as Stripe.Charge).payment_intent as Stripe.PaymentIntent | null)?.id ?? null
        : (obj as Stripe.PaymentIntent).id;
    const mavynPaymentId = (obj.metadata?.mavynPaymentId as string | undefined) ?? null;

    if (intentId && mavynPaymentId) {
      // the payment row must EXIST, carry provider=stripe, and reference THIS intent
      const row = await db.select().from(tables.payments).where(eq(tables.payments.id, mavynPaymentId)).get();
      if (row && row.provider === "stripe" && row.providerRef === intentId) {
        if (event.type === "payment_intent.succeeded") {
          // pending → held ONLY (status guard: never resurrect released/refunded)
          if (row.status === "pending") {
            await db.update(tables.payments).set({ status: "held" }).where(eq(tables.payments.id, row.id)).run();
            note = `payment ${row.id}: pending → held`;
          } else note = `payment ${row.id}: already ${row.status} — no transition`;
        } else if (event.type === "payment_intent.payment_failed") {
          if (row.status === "pending") {
            await db.update(tables.payments).set({ status: "failed" }).where(eq(tables.payments.id, row.id)).run();
            note = `payment ${row.id}: pending → failed`;
          } else note = `payment ${row.id}: already ${row.status} — failure ignored`;
        } else {
          // charge.refunded — confirm our refund state matches the provider's
          if (row.status !== "refunded") {
            await db.update(tables.payments).set({ status: "refunded" }).where(eq(tables.payments.id, row.id)).run();
            note = `payment ${row.id}: → refunded (provider-confirmed)`;
          } else note = `payment ${row.id}: already refunded`;
        }
      } else {
        note = row
          ? "REJECTED: providerRef mismatch — event does not belong to the referenced payment"
          : "REJECTED: unknown mavynPaymentId";
      }
    } else {
      note = "ignored: event carries no mavynPaymentId metadata (not a Mavyn-created intent)";
    }
  }

  await kvSet(dedupeKey, JSON.stringify({ at: new Date().toISOString(), type: event.type, note }));
  return { handled: true, note };
}
