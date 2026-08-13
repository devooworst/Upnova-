import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { findCommunity, getMembership, refreshMembership, communityPeriodDays } from "@/lib/server/communities";
import { membershipQuote } from "@/lib/communityIdentity";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

/** GET — my membership + a renewal quote. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    const c = await findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");
    let m = await getMembership(c.id, user.id);
    if (!m) throw new ApiError(404, "You're not a member");
    m = await refreshMembership(c, m);
    return {
      status: m.status,
      memberUntil: m.memberUntil ? new Date(m.memberUntil).toISOString() : null,
      quote: c.price > 0 ? { ...membershipQuote(c.price), period: c.billingPeriod, periodDays: communityPeriodDays(c) } : null,
    };
  });
}

/** POST — RENEW a paid membership. Extends from whichever is later: now or
 *  the current paid-through date, so renewing early never loses days.
 *  Reactivates an inactive membership — history untouched throughout. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    const c = await findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");
    if (c.price <= 0) throw new ApiError(409, "This community is free — there's nothing to renew");

    let m = await getMembership(c.id, user.id);
    if (!m || m.status === "banned") throw new ApiError(403, "You're not a member of this community");
    m = await refreshMembership(c, m);
    if (!["active", "inactive"].includes(m.status))
      throw new ApiError(409, "Renewal applies to current or lapsed memberships");

    const body = await req.json().catch(() => ({}));
    const quote = membershipQuote(c.price);
    if (body.expectedTotal == null)
      return { paymentRequired: true, ...quote, period: c.billingPeriod, periodDays: communityPeriodDays(c) };
    if (Math.abs(Number(body.expectedTotal) - quote.total) > 0.009)
      throw new ApiError(409, `The total changed — it's now $${quote.total.toFixed(2)} ($${c.price} + $${quote.fee.toFixed(2)} platform fee). Review and confirm again.`);

    await db.insert(tables.payments)
      .values({
        id: randomBytes(12).toString("hex"),
        communityId: c.id,
        payerId: user.id,
        payeeId: c.createdById,
        amountCents: Math.round(c.price * 100),
        feeCents: Math.round(quote.fee * 100),
        status: "released",
      })
      .run();

    const base = Math.max(Date.now(), m.memberUntil ? new Date(m.memberUntil).getTime() : 0);
    const until = new Date(base + communityPeriodDays(c) * 86_400_000);
    await db.update(tables.communityMembers)
      .set({ status: "active", memberUntil: until, expiryNotified: false, graceNotified: false })
      .where(and(eq(tables.communityMembers.communityId, c.id), eq(tables.communityMembers.userId, user.id)))
      .run();

    await notify({ userId: c.createdById, actorId: user.id, type: "community", title: `${c.name} — @${user.handle} renewed`, body: `$${c.price} membership period`, href: `/communities/${c.slug}` });
    return { ok: true, status: "active", memberUntil: until.toISOString() };
  });
}
