# P0-3 Phase A — Payment Architecture Trace (read-only)

**Date:** 2026-08-15 · **Branch:** `arena/01a0026a-upnova` @ `3aac62e` · **No code modified.**

## The lifecycle as it exists today

```
booking/order/project/license/membership  (REAL — DB state machines)
        │  client clicks Pay → POST {action:"pay", expectedTotal}
        ▼
[transaction authentication]  (REAL — server recomputes the total from DB
        │   prices; mismatched expectedTotal → 409; amount NEVER trusted
        │   from the client, only confirmed against it)
        ▼
payments INSERT  status="held"  (TEST — no provider call; money is
        │   fictional. amountCents = seller price, feeCents = 5% buyer-side
        │   platform fee, computed server-side from lib/fees PLATFORM_FEE_RATE)
        ▼
held → released    (REAL state machine, TEST money)
   · booking: provider marks complete (authz: provider-only, status-guarded)
   · project: client approves → complete (parties-only)
   · order:   protection window ends w/o dispute → orderSweep (now cron'd, P0-2)
   · license: buyer confirms delivery
held → refunded    (REAL state machine, TEST money)
   · booking cancel per creator policy (server-evaluated)
   · dispute resolution: admin refund_buyer / release_seller
   · order return flow
```

## Component-by-component classification

| Component | State | Detail |
|---|---|---|
| Payment provider / integration | **MOCK** | `provider` column defaults to `"stripe_connect"`, `providerRef` is always NULL. No SDK in package.json, no API calls, no Stripe keys anywhere. The schema comment names the seam: "providerRef will hold the PaymentIntent / Transfer id and webhooks will drive status transitions" |
| TEST vs LIVE credentials | **MISSING** | No credential handling exists at all |
| Payment creation endpoints | **REAL structure, TEST money** | 6 sites: bookings `pay`, orders `pay`, projects `start`, license purchase, community join/membership. Each: authz (payer-only) → status guard → server-computed total → `expectedTotal` match → INSERT `held` (memberships insert `released` — subscriptions settle immediately) |
| Webhook endpoint | **MISSING** | None exists |
| Webhook signature verification | **MISSING** | n/a |
| Payment state transitions | **REAL** | `pending → held → released \| refunded` enforced by status-guarded UPDATEs (`WHERE status='held'`) — idempotent by construction |
| Idempotency on creation | **REAL (state-machine level)** | Double-pay impossible: booking must be `accepted` (pay flips it to `confirmed`), order must be `placed` (pay flips to `secured`). No idempotency-key mechanism (nothing external to dedupe yet) |
| Held/released logic | **REAL** | Verified through P0-2: release targets `held` rows only; cron + lazy sweeps cannot double-release |
| Refunds | **REAL state, TEST money** | Policy-evaluated (creator cancellation policy, server-side), dispute-resolved (admin), return flow |
| Disputes/Resolution integration | **REAL** | Open dispute freezes auto-complete (sweep checks); admin PATCH applies `refunded`/`released`; `/api/me/disputes` + Resolution page (P5d) |
| Platform fee | **REAL** | 5% buyer-side, single source `lib/fees.PLATFORM_FEE_RATE`, always computed server-side in cents; client only echoes a display total that the server re-verifies |
| Client vs server authority | **REAL (server-authoritative)** | The client can only *request* `pay`; amounts, fees, status all derive from DB. No client-supplied success flag exists anywhere |

## What Phase B therefore needs — and what it must NOT touch

The internal model is already the shape Stripe Connect expects (the codebase's own doctrine in `lib/fees.ts`: destination charges + `application_fee`, "Mavyn never holds funds itself"). Missing is exactly one seam:

1. **Provider abstraction** (`lib/server/payments.ts`): `createPayment` → PaymentIntent (destination charge, `application_fee_amount = feeCents`, idempotency key = our payment id), `refundPayment`, `releaseTransfer`. In TEST/demo mode the provider is a **simulated provider** that returns instantly-succeeded intents — preserving today's Test Center behavior byte-for-byte.
2. **Webhook route** (`/api/webhooks/stripe`): signature-verified (`STRIPE_WEBHOOK_SECRET`), idempotent by `event.id` + status-guarded transitions, drives `pending → held` (payment_intent.succeeded) and failure states.
3. **Credential separation**: `STRIPE_SECRET_KEY` (sk_test_/sk_live_), publishable key to client only. Demo/preview instances keep the simulated provider by default. Production **fails closed** without keys.
4. **`providerRef`** finally populated; `provider` column reflects `simulated` vs `stripe`.

**Unchanged:** all 6 creation sites' authz/guards/fee math, the held→released state machine, the sweep, disputes, Test Center.

**Not in scope until explicitly instructed:** LIVE keys, real charges, Stripe Connect onboarding UI (sellers need connected accounts before live payouts — flagged as the known follow-up).
