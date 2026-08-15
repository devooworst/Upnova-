/* ------------------------------------------------------------------ */
/*  QA Lab core — dedicated TEST personas + resettable test records.   */
/*                                                                     */
/*  · Three clearly-labeled accounts: TEST CUSTOMER, TEST CREATOR,     */
/*    TEST BUSINESS. They are REAL rows in the real database and go    */
/*    through the exact same routes as everyone else.                  */
/*  · isSeed = FALSE on purpose: no demo auto-behaviors ever fire for  */
/*    them. Nothing accepts, replies, or delivers by itself — the      */
/*    tester personally performs BOTH sides of every transaction.      */
/*  · resetQaData() wipes only records involving QA personas. Real     */
/*    accounts are never touched.                                      */
/*  · No next.js-only imports here: db/seed.ts creates the same        */
/*    personas, so a fresh database always has the lab ready.          */
/* ------------------------------------------------------------------ */

import { randomBytes } from "crypto";

import { eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { hashPassword } from "./passwords";

export const QA_PERSONAS = [
  {
    handle: "testcustomer",
    label: "TEST CUSTOMER",
    displayName: "Test Customer",
    role: "Books services, hires creators, applies to opportunities",
    accountType: "individual" as const,
  },
  {
    handle: "testcreator",
    label: "TEST CREATOR",
    displayName: "Test Creator",
    role: "Offers a service, receives bookings, delivers projects",
    accountType: "individual" as const,
  },
  {
    handle: "testbusiness",
    label: "TEST BUSINESS",
    displayName: "Test Business Co.",
    role: "Posts opportunities, reviews applicants",
    accountType: "business" as const,
  },
] as const;

export const QA_HANDLES = QA_PERSONAS.map((p) => p.handle) as unknown as string[];
export const isQaHandle = (h: string) => QA_HANDLES.includes(h);

const uid = () => randomBytes(12).toString("hex");

/** Idempotent: creates the three personas (+ Test Creator's bookable
    service) if missing. Safe to call on every QA API hit. */
export async function ensureQaPersonas() {
  for (const p of QA_PERSONAS) {
    let user = await db.select().from(tables.users).where(eq(tables.users.handle, p.handle)).get();
    if (!user) {
      const id = uid();
      await db.insert(tables.users)
        .values({
          id,
          email: `${p.handle}@mavyn.dev`,
          handle: p.handle,
          passwordHash: hashPassword("mavyn123"),
          accountType: p.accountType,
          testerMode: "demo",
          // QA personas never get the first-run tour sprung on a tester
          onboarding: JSON.stringify({ completedAt: new Date().toISOString(), qa: true }),
          isSeed: false, // CRITICAL: no demo auto-behaviors — the tester acts both sides
        })
        .run();
      await db.insert(tables.profiles)
        .values({
          id: uid(),
          userId: id,
          displayName: p.displayName,
          bio: `QA test account — not a real person. ${p.role}. Managed by the Test Center; all its transactions are test records.`,
          primaryRole: p.handle === "testbusiness" ? "Local business" : p.handle === "testcreator" ? "Service provider (QA)" : "Client (QA)",
          city: "Baltimore",
          state: "MD",
          hiringEnabled: true,
          acceptBookings: true,
          acceptOffers: true,
          acceptCollabs: true,
          openToWork: p.handle === "testcreator",
        })
        .run();
      user = (await db.select().from(tables.users).where(eq(tables.users.id, id)).get())!;
    }
    // Test Creator always has one active, public, bookable service
    if (p.handle === "testcreator") {
      const svc = (await db
        .select()
        .from(tables.services)
        .where(eq(tables.services.ownerId, user.id))
        .all())
        .find((s) => s.active);
      if (!svc)
        await db.insert(tables.services)
          .values({
            id: uid(),
            ownerId: user.id,
            title: "QA Test Session",
            description:
              "A test service owned by the TEST CREATOR account. Book it from the Test Center to walk the real booking + TEST payment flow end to end. No real money ever moves.",
            price: 100,
            category: "creative",
            fulfillment: "appointment",
            reach: "Remote",
          })
          .run();
    }
    // Test Business too — so the CLIENTS category can be exercised
    if (p.handle === "testbusiness") {
      const svc = (await db
        .select()
        .from(tables.services)
        .where(eq(tables.services.ownerId, user.id))
        .all())
        .find((s) => s.active);
      if (!svc)
        await db.insert(tables.services)
          .values({
            id: uid(),
            ownerId: user.id,
            title: "QA Studio Rental",
            description:
              "A test service owned by the TEST BUSINESS account, so customer→business bookings can be tested. All payments are TEST payments.",
            price: 80,
            category: "creative",
            fulfillment: "appointment",
            reach: "Baltimore, MD",
          })
          .run();
    }
  }
}

export async function qaIds(): Promise<{ customer: string; creator: string; business: string; serviceId: string; businessServiceId: string }> {
  await ensureQaPersonas();
  const get = async (h: string) => (await db.select().from(tables.users).where(eq(tables.users.handle, h)).get())!.id;
  const creator = await get("testcreator");
  const business = await get("testbusiness");
  const svc = (await db
    .select()
    .from(tables.services)
    .where(eq(tables.services.ownerId, creator))
    .all())
    .find((s) => s.active)!;
  const bsvc = (await db
    .select()
    .from(tables.services)
    .where(eq(tables.services.ownerId, business))
    .all())
    .find((s) => s.active)!;
  return { customer: await get("testcustomer"), creator, business, serviceId: svc.id, businessServiceId: bsvc.id };
}

/* ----------------------------- reset ----------------------------- */

/** Deletes every transactional record involving a QA persona — and
    ONLY those. Real accounts, auth, and seed content stay untouched. */
export async function resetQaData(): Promise<number> {
  const ids: string[] = [];
  for (const h of QA_HANDLES) {
    const u = await db.select().from(tables.users).where(eq(tables.users.handle, h)).get();
    if (u) ids.push(u.id);
  }
  let removed = 0;
  for (const id of ids) {
    for (const b of await db
      .select()
      .from(tables.bookings)
      .where(or(eq(tables.bookings.clientId, id), eq(tables.bookings.providerId, id)))
      .all()) {
      await db.delete(tables.payments).where(eq(tables.payments.bookingId, b.id)).run();
      await db.delete(tables.bookings).where(eq(tables.bookings.id, b.id)).run(); // progress rows cascade
      removed++;
    }
    for (const p of await db
      .select()
      .from(tables.projects)
      .where(or(eq(tables.projects.clientId, id), eq(tables.projects.creatorId, id)))
      .all()) {
      await db.delete(tables.payments).where(eq(tables.payments.projectId, p.id)).run();
      await db.delete(tables.projects).where(eq(tables.projects.id, p.id)).run(); // extensions/progress/reviews cascade
      removed++;
    }
    // live streams hosted by a persona (chat/reactions/guests cascade)
    for (const l of await db.select().from(tables.liveStreams).where(eq(tables.liveStreams.hostId, id)).all()) {
      await db.delete(tables.liveStreams).where(eq(tables.liveStreams.id, l.id)).run();
      removed++;
    }
    // presence/chat/restrictions a persona left in OTHER streams
    await db.delete(tables.liveViewers).where(eq(tables.liveViewers.userId, id)).run();
    await db.delete(tables.liveMessages).where(eq(tables.liveMessages.userId, id)).run();
    await db.delete(tables.liveReactions).where(eq(tables.liveReactions.userId, id)).run();
    await db.delete(tables.liveGuests).where(eq(tables.liveGuests.userId, id)).run();
    await db.delete(tables.liveModerators).where(eq(tables.liveModerators.userId, id)).run();
    await db.delete(tables.liveRestrictions).where(eq(tables.liveRestrictions.userId, id)).run();
    for (const o of await db.select().from(tables.opportunities).where(eq(tables.opportunities.posterId, id)).all()) {
      await db.delete(tables.applications).where(eq(tables.applications.opportunityId, o.id)).run();
      await db.delete(tables.opportunities).where(eq(tables.opportunities.id, o.id)).run();
      removed++;
    }
    await db.delete(tables.applications).where(eq(tables.applications.applicantId, id)).run();
    for (const m of await db.select().from(tables.conversationMembers).where(eq(tables.conversationMembers.userId, id)).all()) {
      await db.delete(tables.conversations).where(eq(tables.conversations.id, m.conversationId)).run();
      removed++;
    }
    await db.delete(tables.notifications).where(eq(tables.notifications.userId, id)).run();
    await db.delete(tables.follows).where(or(eq(tables.follows.followerId, id), eq(tables.follows.followingId, id))).run();
    await db.delete(tables.preferredClients).where(or(eq(tables.preferredClients.providerId, id), eq(tables.preferredClients.clientId, id))).run();
    await db.delete(tables.businessTeam).where(or(eq(tables.businessTeam.businessId, id), eq(tables.businessTeam.personId, id))).run();
    await db.delete(tables.bookmarks).where(eq(tables.bookmarks.userId, id)).run();
    await db.delete(tables.interactions).where(eq(tables.interactions.userId, id)).run();
    // PLAN-NEUTRAL FIXTURE — every scenario starts from the same truth:
    // Free plan, Demo Mode, no campus verification, no saved Studio.
    // Only QA personas are touched; the Plan Lab flips these through
    // the REAL routes and this reset always restores the baseline.
    await db.update(tables.users).set({ plan: "free", testerMode: "demo" }).where(eq(tables.users.id, id)).run();
    await db.delete(tables.campusVerifications).where(eq(tables.campusVerifications.userId, id)).run();
    await db.update(tables.profiles).set({ studio: "" }).where(eq(tables.profiles.userId, id)).run();
  }
  return removed;
}

/* ------------------------- scenario run state -------------------------
   Which scenario is armed and since when. Test-lab metadata only (the
   checkpoints themselves are always derived from the REAL database), so
   a small file in db/ (snapshotted, demo-only) is the honest fit. */

/** a completed scenario keeps its VERIFIED snapshot forever: the steps
    as they evaluated (against real DB state) at the moment everything
    passed. Moving on to another scenario never erases the achievement —
    only an explicit reset of THAT scenario does. */
export type QaStepSnapshot = {
  id: string;
  role: string;
  title: string;
  instruction: string;
  expected: string;
  actual: string;
  record: string | null;
};
export type QaRuns = Record<
  string,
  {
    startedAt: string;
    completedAt?: string;
    snapshot?: QaStepSnapshot[];
    /** STRICT PROGRESSION — the ordered list of tasks that VERIFIED,
        exactly aligned with the scenario definition's step order.
        passed.length IS the cursor: tasks below it are done (their
        verified snapshot is kept forever), the task AT it is the one
        and only current task, tasks above it are LOCKED. The current
        task can only be derived from here — never from whichever
        database checkpoint happens to be true. */
    passed?: QaStepSnapshot[];
    /** when each task became ACTIVE (stepId → ISO). A task's checkpoint
        only counts records created AFTER its activation — §accidental
        future completion: work done while a task was still locked never
        counts; the tester performs it again when the task is reached. */
    activated?: Record<string, string>;
  }
>;

const RUNS_KEY = "qa:runs";

export async function readRuns(): Promise<QaRuns> {
  try {
    const row = await db.select().from(tables.kvState).where(eq(tables.kvState.key, RUNS_KEY)).get();
    return row?.value ? (JSON.parse(row.value) as QaRuns) : {};
  } catch {
    return {};
  }
}

export async function writeRuns(runs: QaRuns) {
  const value = JSON.stringify(runs);
  const existing = await db.select().from(tables.kvState).where(eq(tables.kvState.key, RUNS_KEY)).get();
  if (existing) await db.update(tables.kvState).set({ value, updatedAt: new Date() }).where(eq(tables.kvState.key, RUNS_KEY)).run();
  else await db.insert(tables.kvState).values({ key: RUNS_KEY, value }).run();
}
