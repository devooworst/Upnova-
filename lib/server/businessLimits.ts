/* ------------------------------------------------------------------ */
/*  Business subscription capacity — the single authority.             */
/*                                                                     */
/*  PHILOSOPHY (same as the rest of UpNova — never a walking paywall): */
/*  Business Free is a genuinely usable hiring account: find talent,   */
/*  post, receive applications, hire, run projects, pay, review.       */
/*  Business Pro buys SCALE, never basic access.                       */
/*                                                                     */
/*  RULES:                                                             */
/*   · Limits gate the CREATION of new records only. Nothing is ever   */
/*     deleted, hidden from management, or locked after a downgrade.   */
/*   · Over-limit after downgrade → existing records stay fully        */
/*     accessible; only NEW creation is refused until back under the   */
/*     limit or upgraded.                                              */
/*   · Refusals are honest: current usage / limit + what Pro raises    */
/*     it to. HTTP 409, never silent.                                  */
/*   · CLIENT / TALENT record caps never block incoming economic       */
/*     activity (someone booking you is never refused) — they cap the  */
/*     CRM directory view, honestly labeled.                           */
/*   · Demo mode (unrestrictedTester) bypasses, simulation enforces —  */
/*     the same doctrine as every other gate.                          */
/* ------------------------------------------------------------------ */

import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { ApiError } from "./auth";
import { unrestrictedTester } from "./campus";
import { HIRED_APP_STATUSES } from "./businessPeople";
import { BUSINESS_LIMITS, LIMIT_LABEL, type BusinessLimits, type BusinessTier } from "@/lib/businessPlans";

export { BUSINESS_LIMITS, LIMIT_LABEL };
export type { BusinessLimits, BusinessTier };

export function businessTier(user: { accountType?: string | null; plan?: string | null }): BusinessTier {
  // legacy 'agency' reads as Business Pro; never sold
  return user.plan === "business_pro" || user.plan === "agency" ? "business_pro" : "free";
}

const IN_FLIGHT_PROJECT = ["draft", "offer_sent", "accepted", "in_progress", "extension_requested", "submitted", "approved"];
const IN_FLIGHT_BOOKING = ["pending", "accepted", "confirmed", "reschedule_requested"];
const IN_FLIGHT_APP = ["selected", "confirmed", "active"];

/** live usage across every capacity dimension — real rows, no caching */
export function businessUsage(businessId: string) {
  const teamRows = db
    .select()
    .from(tables.businessTeam)
    .where(and(eq(tables.businessTeam.businessId, businessId), eq(tables.businessTeam.status, "active")))
    .all();
  const openOpps = db
    .select()
    .from(tables.opportunities)
    .where(eq(tables.opportunities.posterId, businessId))
    .all()
    .filter((o) => o.status === "open").length;

  // active hires = everything IN FLIGHT where the business is the buyer:
  // projects (draft→approved), bookings (pending→confirmed), and hired
  // opportunity engagements not yet completed. Completed history is
  // unlimited on every tier and never counts.
  const projectsInFlight = db
    .select()
    .from(tables.projects)
    .where(eq(tables.projects.clientId, businessId))
    .all()
    .filter((p) => IN_FLIGHT_PROJECT.includes(p.state)).length;
  const bookingsInFlight = db
    .select()
    .from(tables.bookings)
    .where(eq(tables.bookings.clientId, businessId))
    .all()
    .filter((b) => IN_FLIGHT_BOOKING.includes(b.status)).length;
  const appsInFlight = db
    .select({ app: tables.applications })
    .from(tables.applications)
    .innerJoin(tables.opportunities, eq(tables.applications.opportunityId, tables.opportunities.id))
    .where(eq(tables.opportunities.posterId, businessId))
    .all()
    .filter((r) => IN_FLIGHT_APP.includes(r.app.status)).length;

  const savedTalent = db
    .select()
    .from(tables.bookmarks)
    .where(and(eq(tables.bookmarks.userId, businessId), eq(tables.bookmarks.targetType, "user")))
    .all().length;

  // client / talent record counts (derived CRM relationships)
  const clientIds = new Set<string>();
  for (const b of db.select().from(tables.bookings).where(eq(tables.bookings.providerId, businessId)).all()) clientIds.add(b.clientId);
  for (const p of db.select().from(tables.projects).where(eq(tables.projects.creatorId, businessId)).all()) clientIds.add(p.clientId);
  const talentIds = new Set<string>();
  for (const b of db.select().from(tables.bookings).where(eq(tables.bookings.clientId, businessId)).all()) talentIds.add(b.providerId);
  for (const p of db.select().from(tables.projects).where(eq(tables.projects.clientId, businessId)).all()) talentIds.add(p.creatorId);
  for (const r of db
    .select({ app: tables.applications })
    .from(tables.applications)
    .innerJoin(tables.opportunities, eq(tables.applications.opportunityId, tables.opportunities.id))
    .where(eq(tables.opportunities.posterId, businessId))
    .all())
    if (HIRED_APP_STATUSES.includes(r.app.status)) talentIds.add(r.app.applicantId);

  return {
    teamMembers: teamRows.length,
    activeHires: projectsInFlight + bookingsInFlight + appsInFlight,
    activeOpportunities: openOpps,
    savedTalent,
    admins: 1 + teamRows.filter((t) => t.isAdmin).length, // owner is always seat #1
    clientRecords: clientIds.size,
    talentRecords: talentIds.size,
  };
}

/**
 * Refuse CREATION of a new record past the tier limit — 409 with the
 * honest current/limit + what Pro raises it to. Applies to business
 * accounts only; demo mode bypasses (simulation enforces), matching
 * every other gate. NEVER used to hide or delete existing records.
 */
export function assertBusinessCapacity(
  user: { id: string; accountType?: string | null; plan?: string | null },
  kind: keyof BusinessLimits
) {
  if (user.accountType !== "business") return;
  if (unrestrictedTester(user.id)) return; // demo mode — gates open, honestly labeled in the UI
  const tier = businessTier(user);
  const limit = BUSINESS_LIMITS[tier][kind];
  const usage = businessUsage(user.id)[kind];
  if (usage < limit) return;
  const proLimit = BUSINESS_LIMITS.business_pro[kind];
  throw new ApiError(
    409,
    tier === "free"
      ? `You've reached your Business Free limit — ${LIMIT_LABEL[kind]}: ${usage}/${limit}. Business Pro raises this to ${proLimit}. Existing records stay fully accessible — nothing is ever deleted.`
      : `You've reached the Business Pro limit — ${LIMIT_LABEL[kind]}: ${usage}/${limit}.`
  );
}

/** convenience: same check, reading the account row fresh by id */
export function assertCapacityById(userId: string, kind: keyof BusinessLimits) {
  const row = db.select().from(tables.users).where(eq(tables.users.id, userId)).get();
  if (!row) return;
  assertBusinessCapacity({ id: row.id, accountType: row.accountType, plan: row.plan }, kind);
}

/** payload for the UI + tests: plan, limits, live usage, enforcement */
export function limitsPayload(user: { id: string; accountType?: string | null; plan?: string | null }) {
  const tier = businessTier(user);
  const limits = BUSINESS_LIMITS[tier];
  const usage = businessUsage(user.id);
  const enforced = user.accountType === "business" && !unrestrictedTester(user.id);
  return {
    plan: tier,
    enforced, // false in demo mode — the UI labels it
    limits,
    proLimits: BUSINESS_LIMITS.business_pro,
    usage,
    atLimit: Object.fromEntries(
      (Object.keys(limits) as (keyof BusinessLimits)[]).map((k) => [k, usage[k] >= limits[k]])
    ) as Record<keyof BusinessLimits, boolean>,
  };
}
