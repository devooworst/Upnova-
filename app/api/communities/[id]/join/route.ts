import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import {
  findCommunity,
  getMembership,
  isMod,
  refreshMembership,
  communityPeriodDays,
  activeMemberCount,
} from "@/lib/server/communities";
import { membershipQuote } from "@/lib/communityIdentity";
import { notify } from "@/lib/server/notify";
import { unrestrictedTester, demoCampusId } from "@/lib/server/campus";

export const dynamic = "force-dynamic";

const rid = () => randomBytes(12).toString("hex");

/** Charge one membership period. expectedTotal is the transaction-auth on
 *  every pay: a mismatch (price changed underneath the member) is a 409,
 *  never a silent different charge. */
async function chargePeriod(c: typeof tables.communities.$inferSelect, userId: string, expectedTotal: unknown) {
  const quote = membershipQuote(c.price);
  if (Math.abs(Number(expectedTotal) - quote.total) > 0.009)
    throw new ApiError(409, `The total changed — it's now $${quote.total.toFixed(2)} ($${c.price} + $${quote.fee.toFixed(2)} platform fee). Review and confirm again.`);
  await db.insert(tables.payments)
    .values({
      id: rid(),
      communityId: c.id,
      payerId: userId,
      payeeId: c.createdById,
      amountCents: Math.round(c.price * 100),
      feeCents: Math.round(quote.fee * 100),
      status: "released", // membership periods pay the creator directly
    })
    .run();
}

/** POST — join / request / accept invitation / complete payment, per the
 *  community's access model:
 *    public free          → active immediately (approval if configured)
 *    private free         → pending → owner approves → active
 *    paid subscription    → pay a period → active until memberUntil
 *    paid + approval      → pending → approved_unpaid → pay → active
 *    invite-only          → invitation → (pay if priced) → active
 *  Capacity and "paused" are enforced here, on the server. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    const c = await findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");
    const body = await req.json().catch(() => ({}));
    const paid = c.price > 0;
    const quote = membershipQuote(c.price);
    const periodMs = communityPeriodDays(c) * 86_400_000;

    if (c.campusId && !(await unrestrictedTester(user.id)) /* DEMO MODE bypasses; SIMULATION enforces */) {
      const v = await db
        .select()
        .from(tables.campusVerifications)
        .where(and(eq(tables.campusVerifications.userId, user.id), eq(tables.campusVerifications.status, "verified")))
        .get();
      if (!v || v!.campusId !== c.campusId)
        throw new ApiError(403, "This is a campus community — verify your school in Your Campus first");
      // audience gates NEW joins only — existing memberships survive the
      // Student → Alumni transition untouched
      if (c.audience === "students" && v!.affiliation !== "current_student")
        throw new ApiError(403, "This room is for current students — alumni communities and events stay open to you");
      if (c.audience === "alumni" && v!.affiliation === "current_student")
        throw new ApiError(403, "This is the alumni network — it opens when you graduate");
    }

    let existing = await getMembership(c.id, user.id);
    if (existing) existing = await refreshMembership(c, existing);

    const assertCapacity = async () => {
      if (c.capacity != null && await activeMemberCount(c.id) >= c!.capacity)
        throw new ApiError(409, "This community is at capacity right now");
    };
    const where = existing
      ? and(eq(tables.communityMembers.communityId, c.id), eq(tables.communityMembers.userId, user.id))
      : null;

    const activate = async () => {
      await assertCapacity();
      const patch = {
        status: "active" as const,
        joinedAt: new Date(),
        memberUntil: paid ? new Date(Date.now() + periodMs) : null,
        expiryNotified: false,
        graceNotified: false,
      };
      if (where) await db.update(tables.communityMembers).set(patch).where(where).run();
      else await db.insert(tables.communityMembers).values({ communityId: c.id, userId: user.id, ...patch }).run();
    };

    // ---------- existing membership states ----------
    if (existing) {
      if ((await existing).status === "banned") throw new ApiError(403, "You've been removed from this community");
      if ((await existing).status === "active") throw new ApiError(409, "You're already a member");
      if ((await existing).status === "pending") throw new ApiError(409, "Your join request is waiting for approval");

      if ((await existing).status === "invited" || (await existing).status === "approved_unpaid" || (await existing).status === "inactive") {
        // completing entry (or RENEWING after lapse) — pay if priced
        if (paid) {
          if (body.expectedTotal == null)
            return { paymentRequired: true, ...quote, period: c.billingPeriod, periodDays: communityPeriodDays(c) };
          await chargePeriod(c, user.id, body.expectedTotal);
        }
        await activate();
        await notify({ userId: c.createdById, actorId: user.id, type: "community", title: `${c.name} — @${user.handle} ${(await existing).status === "inactive" ? "renewed their membership" : "joined"}`, body: paid ? `$${c.price} membership period` : "", href: `/communities/${c.slug}` });
        return { ok: true, status: "active" };
      }
    }

    // ---------- brand-new membership ----------
    if (c.paused) throw new ApiError(403, "New memberships are paused right now — check back later");
    if (c.access === "invite") throw new ApiError(403, "This community is invite-only — ask a member for an invitation");

    const needsApproval = c.access === "private" || c.joinApproval;
    if (needsApproval) {
      await db.insert(tables.communityMembers).values({ communityId: c.id, userId: user.id, status: "pending" }).run();
      const mods = (await db
        .select()
        .from(tables.communityMembers)
        .where(eq(tables.communityMembers.communityId, c.id))
        .all())
        .filter((m) => isMod(m));
      for (const m of mods)
        await notify({
          userId: m.userId,
          actorId: user.id,
          type: "community",
          title: `Join request — ${c.name}`,
          body: `@${user.handle} asked to join${paid ? ` ($${c.price} ${c.billingPeriod} membership after approval)` : ""}`,
          href: `/communities/${c.slug}?tab=members`,
        });
      return { ok: true, status: "pending" };
    }

    // public: pay if priced, then in
    if (paid) {
      if (body.expectedTotal == null)
        return { paymentRequired: true, ...quote, period: c.billingPeriod, periodDays: communityPeriodDays(c) };
      await chargePeriod(c, user.id, body.expectedTotal);
    }
    await activate();
    return { ok: true, status: "active" };
  });
}

/** DELETE — leave the community. Membership history stays in payments;
 *  the membership row is removed by the member's own choice. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    const c = await findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");
    const m = getMembership(c!.id, user.id);
    if (!m || (await m)!.status === "banned") throw new ApiError(404, "You're not a member");
    if ((await m)!.role === "owner") throw new ApiError(400, "Owners can't leave their own community — appoint a new owner first");
    await db.delete(tables.communityMembers)
      .where(and(eq(tables.communityMembers.communityId, c!.id), eq(tables.communityMembers.userId, user.id)))
      .run();
    return { ok: true };
  });
}
