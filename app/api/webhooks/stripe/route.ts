import { NextRequest } from "next/server";
import { verifyWebhook, applyWebhookEvent } from "@/lib/server/paymentProvider";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  POST /api/webhooks/stripe — the provider's callback.               */
/*                                                                     */
/*  · Signature verified against the RAW body (constructEvent).        */
/*    Unsigned / mis-signed requests are rejected 400 — never trusted. */
/*  · Idempotent by event.id (kvState dedupe) + status-guarded         */
/*    transitions — duplicate delivery cannot double-transition.       */
/*  · An event may only touch the payment whose providerRef matches    */
/*    the intent it references (validated in applyWebhookEvent).       */
/*  · Unknown event types are acknowledged 200 (Stripe's recommended   */
/*    behavior) and recorded as ignored.                               */
/*  · CSRF middleware note: webhooks carry no Origin header, so the    */
/*    origin guard does not interfere (non-browser client path).       */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing stripe-signature" }, { status: 400 });

  const rawBody = await req.text(); // RAW body — signature covers exact bytes
  let event;
  try {
    event = verifyWebhook(rawBody, signature);
  } catch (err) {
    return Response.json({ error: `Signature verification failed: ${(err as Error).message.slice(0, 120)}` }, { status: 400 });
  }

  try {
    const result = await applyWebhookEvent(event);
    return Response.json({ received: true, ...result });
  } catch (err) {
    // processing error AFTER verification: 500 so Stripe retries —
    // idempotency makes the retry safe
    return Response.json({ error: (err as Error).message.slice(0, 200) }, { status: 500 });
  }
}
