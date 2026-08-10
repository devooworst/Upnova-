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
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
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
export function ensureQaPersonas() {
  for (const p of QA_PERSONAS) {
    let user = db.select().from(tables.users).where(eq(tables.users.handle, p.handle)).get();
    if (!user) {
      const id = uid();
      db.insert(tables.users)
        .values({
          id,
          email: `${p.handle}@upnova.dev`,
          handle: p.handle,
          passwordHash: hashPassword("upnova123"),
          accountType: p.accountType,
          testerMode: "demo",
          // QA personas never get the first-run tour sprung on a tester
          onboarding: JSON.stringify({ completedAt: new Date().toISOString(), qa: true }),
          isSeed: false, // CRITICAL: no demo auto-behaviors — the tester acts both sides
        })
        .run();
      db.insert(tables.profiles)
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
      user = db.select().from(tables.users).where(eq(tables.users.id, id)).get()!;
    }
    // Test Creator always has one active, public, bookable service
    if (p.handle === "testcreator") {
      const svc = db
        .select()
        .from(tables.services)
        .where(eq(tables.services.ownerId, user.id))
        .all()
        .find((s) => s.active);
      if (!svc)
        db.insert(tables.services)
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
      const svc = db
        .select()
        .from(tables.services)
        .where(eq(tables.services.ownerId, user.id))
        .all()
        .find((s) => s.active);
      if (!svc)
        db.insert(tables.services)
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

export function qaIds(): { customer: string; creator: string; business: string; serviceId: string; businessServiceId: string } {
  ensureQaPersonas();
  const get = (h: string) => db.select().from(tables.users).where(eq(tables.users.handle, h)).get()!.id;
  const creator = get("testcreator");
  const business = get("testbusiness");
  const svc = db
    .select()
    .from(tables.services)
    .where(eq(tables.services.ownerId, creator))
    .all()
    .find((s) => s.active)!;
  const bsvc = db
    .select()
    .from(tables.services)
    .where(eq(tables.services.ownerId, business))
    .all()
    .find((s) => s.active)!;
  return { customer: get("testcustomer"), creator, business, serviceId: svc.id, businessServiceId: bsvc.id };
}

/* ----------------------------- reset ----------------------------- */

/** Deletes every transactional record involving a QA persona — and
    ONLY those. Real accounts, auth, and seed content stay untouched. */
export function resetQaData(): number {
  const ids = QA_HANDLES.map(
    (h) => db.select().from(tables.users).where(eq(tables.users.handle, h)).get()?.id
  ).filter(Boolean) as string[];
  let removed = 0;
  for (const id of ids) {
    for (const b of db
      .select()
      .from(tables.bookings)
      .where(or(eq(tables.bookings.clientId, id), eq(tables.bookings.providerId, id)))
      .all()) {
      db.delete(tables.payments).where(eq(tables.payments.bookingId, b.id)).run();
      db.delete(tables.bookings).where(eq(tables.bookings.id, b.id)).run(); // progress rows cascade
      removed++;
    }
    for (const p of db
      .select()
      .from(tables.projects)
      .where(or(eq(tables.projects.clientId, id), eq(tables.projects.creatorId, id)))
      .all()) {
      db.delete(tables.payments).where(eq(tables.payments.projectId, p.id)).run();
      db.delete(tables.projects).where(eq(tables.projects.id, p.id)).run(); // extensions/progress/reviews cascade
      removed++;
    }
    for (const o of db.select().from(tables.opportunities).where(eq(tables.opportunities.posterId, id)).all()) {
      db.delete(tables.applications).where(eq(tables.applications.opportunityId, o.id)).run();
      db.delete(tables.opportunities).where(eq(tables.opportunities.id, o.id)).run();
      removed++;
    }
    db.delete(tables.applications).where(eq(tables.applications.applicantId, id)).run();
    for (const m of db.select().from(tables.conversationMembers).where(eq(tables.conversationMembers.userId, id)).all()) {
      db.delete(tables.conversations).where(eq(tables.conversations.id, m.conversationId)).run();
      removed++;
    }
    db.delete(tables.notifications).where(eq(tables.notifications.userId, id)).run();
    db.delete(tables.follows).where(or(eq(tables.follows.followerId, id), eq(tables.follows.followingId, id))).run();
    db.delete(tables.preferredClients).where(or(eq(tables.preferredClients.providerId, id), eq(tables.preferredClients.clientId, id))).run();
    db.delete(tables.businessTeam).where(or(eq(tables.businessTeam.businessId, id), eq(tables.businessTeam.personId, id))).run();
    db.delete(tables.interactions).where(eq(tables.interactions.userId, id)).run();
  }
  return removed;
}

/* ------------------------- scenario run state -------------------------
   Which scenario is armed and since when. Test-lab metadata only (the
   checkpoints themselves are always derived from the REAL database), so
   a small file in db/ (snapshotted, demo-only) is the honest fit. */

const RUNS_FILE = join(process.cwd(), "db", ".qa-runs.json");

export type QaRuns = Record<string, { startedAt: string }>;

export function readRuns(): QaRuns {
  try {
    if (!existsSync(RUNS_FILE)) return {};
    return JSON.parse(readFileSync(RUNS_FILE, "utf8")) as QaRuns;
  } catch {
    return {};
  }
}

export function writeRuns(runs: QaRuns) {
  try {
    writeFileSync(RUNS_FILE, JSON.stringify(runs, null, 2));
  } catch {
    /* read-only fs — run state just won't persist */
  }
}
