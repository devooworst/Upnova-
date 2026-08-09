/* ------------------------------------------------------------------ */
/*  Demo provider behavior — DEV ONLY.                                 */
/*                                                                     */
/*  Seed accounts (users.isSeed) act like responsive counterparts so   */
/*  the full marketplace loop can be demonstrated by one person:       */
/*                                                                     */
/*    · you message a seed user        → they reply                    */
/*    · you open a project with one    → they review it and send the   */
/*                                       offer                         */
/*    · you fund the project           → they start, then ask for a    */
/*                                       small extension (once)        */
/*    · you decide the extension       → they deliver for review       */
/*    · you review them after payout   → they review you back          */
/*                                                                     */
/*  None of this runs for real (non-seed) users, and every action      */
/*  goes through the same state machine + notification paths a real    */
/*  user would use. Delete this module for production.                 */
/* ------------------------------------------------------------------ */

import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { transition, requestExtension, addReview } from "./projects";
import { notify } from "./notify";

const id = () => randomBytes(12).toString("hex");

export function isSeedUser(userId: string): boolean {
  const u = db.select({ isSeed: tables.users.isSeed }).from(tables.users).where(eq(tables.users.id, userId)).get();
  return !!u?.isSeed;
}

function sendAs(conversationId: string, senderId: string, body: string) {
  db.insert(tables.messages).values({ id: id(), conversationId, senderId, body }).run();
  db.update(tables.conversations)
    .set({ updatedAt: new Date() })
    .where(eq(tables.conversations.id, conversationId))
    .run();
}

/* ---------------------------- chat replies ---------------------------- */

const REPLIES: Record<string, string[]> = {
  lena: [
    "Love it. Send over any references you have and I'll fold them into the direction.",
    "Working on your concepts now — first look coming shortly.",
    "Good question. I always start with typography, the rest of the identity follows from it.",
  ],
  ava: [
    "Sounds good! I'll block that on my calendar.",
    "Golden hour is 7:40 that week — let's plan around it.",
    "Sending you a shot list tonight.",
  ],
  jordanmiles: [
    "Bet. Send the stems whenever.",
    "I'll have notes back to you by tomorrow.",
    "That reference is exactly the right lane for this record.",
  ],
  default: [
    "Sounds good — let me take a look and get back to you today.",
    "Got it. Give me a moment and I'll send details.",
    "Perfect, that works on my end.",
  ],
};

let replyCounter = new Map<string, number>();

/** A seed user replies once per incoming message, cycling their lines. */
export function maybeAutoReply(conversationId: string, fromUserId: string) {
  const members = db
    .select()
    .from(tables.conversationMembers)
    .where(eq(tables.conversationMembers.conversationId, conversationId))
    .all();
  const other = members.find((m) => m.userId !== fromUserId);
  if (!other || !isSeedUser(other.userId)) return;

  const user = db.select().from(tables.users).where(eq(tables.users.id, other.userId)).get()!;
  const pool = REPLIES[user.handle] ?? REPLIES.default;
  const key = `${conversationId}:${other.userId}`;
  const n = replyCounter.get(key) ?? 0;
  replyCounter.set(key, n + 1);
  sendAs(conversationId, other.userId, pool[n % pool.length]);
}

/* --------------------------- project behavior --------------------------- */

/** After a client opens a draft with a seed creator: review + send offer. */
export function seedRespondsToDraft(projectId: string) {
  const p = db.select().from(tables.projects).where(eq(tables.projects.id, projectId)).get();
  if (!p || p.state !== "draft" || !isSeedUser(p.creatorId)) return;
  if (p.conversationId) {
    sendAs(
      p.conversationId,
      p.creatorId,
      `Just reviewed your brief for "${p.title}" — I can do this. Sending the offer now: $${p.amount}, everything as described.`
    );
  }
  transition(projectId, "send_offer", p.creatorId);
}

/** After the client funds: seed creator starts, then asks for +2 days (once). */
export function seedStartsWork(projectId: string) {
  const p = db.select().from(tables.projects).where(eq(tables.projects.id, projectId)).get();
  if (!p || p.state !== "in_progress" || !isSeedUser(p.creatorId)) return;
  if (p.conversationId) {
    sendAs(p.conversationId, p.creatorId, "Payment came through — starting today. I'll keep everything in this thread.");
  }
  // one honest extension request so the approval flow can be demonstrated;
  // requestExtension enforces a single pending request per project
  const existing = db
    .select()
    .from(tables.extensionRequests)
    .where(eq(tables.extensionRequests.projectId, projectId))
    .all();
  if (existing.length === 0) {
    try {
      requestExtension(projectId, p.creatorId, 2, "Adding a final polish pass — two extra days makes it right.");
    } catch {
      /* already pending or wrong state — never force it */
    }
  }
}

/** After the client decides the extension: seed creator delivers. */
export function seedDeliversAfterExtensionDecision(projectId: string) {
  const p = db.select().from(tables.projects).where(eq(tables.projects.id, projectId)).get();
  if (!p || p.state !== "in_progress" || !isSeedUser(p.creatorId)) return;
  if (p.conversationId) {
    sendAs(p.conversationId, p.creatorId, "Delivery is up for your review — files and notes attached to the project.");
  }
  try {
    transition(projectId, "submit", p.creatorId);
  } catch {
    /* state moved on — do nothing */
  }
}

/* --------------------------- booking behavior --------------------------- */

/** Seed providers respond to booking requests immediately — no waiting. */
export function seedAcceptsBooking(bookingId: string) {
  const b = db.select().from(tables.bookings).where(eq(tables.bookings.id, bookingId)).get();
  if (!b || b.status !== "pending" || !isSeedUser(b.providerId)) return;
  db.update(tables.bookings).set({ status: "accepted" }).where(eq(tables.bookings.id, bookingId)).run();
  if (b.conversationId) {
    sendAs(
      b.conversationId,
      b.providerId,
      `Absolutely — I have that time available. I've accepted your booking request for ${b.title}; once payment is in, you're locked in.`
    );
  }
}

/** Seed provider confirms in chat after the client pays. */
export function seedConfirmsBookingPayment(bookingId: string) {
  const b = db.select().from(tables.bookings).where(eq(tables.bookings.id, bookingId)).get();
  if (!b || !isSeedUser(b.providerId) || !b.conversationId) return;
  const when = b.startsAt.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const time = b.startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  sendAs(b.conversationId, b.providerId, `Got it — your payment is secured. You're confirmed for ${when} at ${time}. See you then!`);
}

/** Seed counterparty confirms a linked work post ("Client Confirmed"). */
export function seedClientConfirmsWork(postId: string, counterpartyId: string) {
  if (!isSeedUser(counterpartyId)) return;
  const post = db.select().from(tables.posts).where(eq(tables.posts.id, postId)).get();
  if (!post || post.clientConfirmed) return;
  db.update(tables.posts).set({ clientConfirmed: true }).where(eq(tables.posts.id, postId)).run();
  const confirmer = db.select().from(tables.profiles).where(eq(tables.profiles.userId, counterpartyId)).get();
  notify({
    userId: post.authorId,
    actorId: counterpartyId,
    type: "post",
    title: `${confirmer?.displayName ?? "Your client"} confirmed your work`,
    body: "The post now carries a Client Confirmed label.",
    href: "/profile",
  });
}

/** After the real user reviews a completed project: the seed side reviews back. */
export function seedReviewsBack(projectId: string, realUserId: string) {
  const p = db.select().from(tables.projects).where(eq(tables.projects.id, projectId)).get();
  if (!p) return;
  const seedParty = p.clientId === realUserId ? p.creatorId : p.clientId;
  if (!isSeedUser(seedParty)) return;
  const existing = db
    .select()
    .from(tables.reviews)
    .where(and(eq(tables.reviews.projectId, projectId), eq(tables.reviews.authorId, seedParty)))
    .get();
  if (existing) return;
  try {
    addReview(projectId, seedParty, 5, "Clear brief, quick decisions, on-time payment. Would work together again.");
  } catch {
    /* reviews closed — fine */
  }
}

/* ------------------- role opportunities (Team & Openings) ------------------- */

/** Seed applicant accepts a role offer instantly — the team view fills in. */
export function seedAcceptsRoleOffer(applicationId: string) {
  const app = db.select().from(tables.applications).where(eq(tables.applications.id, applicationId)).get();
  if (!app || app.status !== "selected" || !isSeedUser(app.applicantId)) return;
  // the protagonist demo account (admin) never auto-acts — accepting an
  // offer is THEIR moment when a human is driving that account
  const applicant = db.select().from(tables.users).where(eq(tables.users.id, app.applicantId)).get();
  if (applicant?.role === "admin") return;
  // lazy import avoids a cycle (oppFlow → notify only)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("./oppFlow").acceptRoleOffer(applicationId);
}

/**
 * When a REAL user posts a role opportunity, a few seed locals apply to
 * each role right away so the poster can demo review → select → team →
 * payment without waiting for anyone.
 */
export function seedApplicantsApplyToRoles(opportunityId: string) {
  const opp = db.select().from(tables.opportunities).where(eq(tables.opportunities.id, opportunityId)).get();
  if (!opp) return;
  let roles: { id: string; title: string }[] = [];
  try { roles = JSON.parse(opp.roles); } catch { return; }
  if (!roles.length) return;
  const seeds = db.select().from(tables.users).all().filter((u) => u.isSeed && u.id !== opp.posterId && u.status === "active");
  const MESSAGES = [
    "This is exactly my lane — portfolio's on my profile, happy to share more.",
    "Available that day and local. Would love to be part of this.",
    "Been doing this for years — refs and recent work on my profile.",
  ];
  let cursor = 0;
  for (const role of roles) {
    // two applicants per role, cycling through seed users (one app per user)
    for (let k = 0; k < 2 && cursor < seeds.length; k++, cursor++) {
      const u = seeds[cursor];
      const already = db
        .select()
        .from(tables.applications)
        .where(and(eq(tables.applications.opportunityId, opp.id), eq(tables.applications.applicantId, u.id)))
        .get();
      if (already) continue;
      db.insert(tables.applications)
        .values({
          id: randomBytes(12).toString("hex"),
          opportunityId: opp.id,
          applicantId: u.id,
          roleId: role.id,
          message: MESSAGES[cursor % MESSAGES.length],
          availability: "yes",
        })
        .run();
      notify({
        userId: opp.posterId,
        actorId: u.id,
        type: "application",
        title: `New applicant — ${role.title}`,
        body: opp.title,
        href: `/opportunities/${opp.id}/applicants`,
        priority: "normal",
      });
    }
  }
}

/* ------------------------------ shop orders ------------------------------ */

/**
 * Seed seller fulfills a paid order instantly: preparing → shipped with
 * mock tracking (ETA ≈ 4 days; pickup/digital hand off directly). The
 * buyer sees every state of the timeline without waiting for a human.
 */
export function seedSellerFulfills(orderId: string) {
  const o = db.select().from(tables.orders).where(eq(tables.orders.id, orderId)).get();
  if (!o || o.status !== "secured" || !isSeedUser(o.sellerId)) return;
  if (o.fulfillment === "shipping") {
    const eta = new Date(Date.now() + 4 * 86400_000).toISOString();
    const code = "9400" + String(Math.floor(1e10 + Math.random() * 9e10));
    // high-value: the seed seller records evidence like a careful human would
    const highValue = o.price * o.qty >= 200;
    db.update(tables.orders)
      .set({
        status: "shipped",
        tracking: JSON.stringify({ carrier: "USPS", code, eta }),
        ...(highValue
          ? { sellerEvidence: JSON.stringify({ serial: "SN-" + code.slice(-8), note: "Photographed and serial-logged before packing (demo evidence)", photos: [] }) }
          : {}),
      })
      .where(eq(tables.orders.id, o.id))
      .run();
    if (o.conversationId)
      sendAs(o.conversationId, o.sellerId, `Packed and shipped! USPS tracking ${code} — should land in about 4 days.`);
    notify({
      userId: o.buyerId, actorId: o.sellerId, type: "order",
      title: `Shipped — ${o.title}`, body: `USPS · estimated ${new Date(eta).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      href: "/orders",
    });
  } else if (o.fulfillment === "digital") {
    db.update(tables.orders).set({ status: "delivered" }).where(eq(tables.orders.id, o.id)).run();
    if (o.conversationId)
      sendAs(o.conversationId, o.sellerId, `Download link sent! Confirm you got everything and the order completes.`);
    notify({ userId: o.buyerId, actorId: o.sellerId, type: "order", title: `Delivered — ${o.title}`, body: "Confirm receipt to complete the order.", href: "/orders" });
  } else {
    // pickup / local delivery: seed seller proposes the meetup in chat
    db.update(tables.orders).set({ status: "preparing" }).where(eq(tables.orders.id, o.id)).run();
    if (o.conversationId)
      sendAs(
        o.conversationId,
        o.sellerId,
        `I'm flexible for the ${o.fulfillment === "pickup" ? "pickup" : "drop-off"} — does Saturday around 2 PM near downtown work? Exact spot once we confirm.`
      );
    notify({ userId: o.buyerId, actorId: o.sellerId, type: "order", title: `Seller is preparing your order`, body: `${o.title} — arrange the ${o.fulfillment} in Messages`, href: "/orders", priority: "normal" });
  }
}

/* ------------------------------ licensing ------------------------------ */

/** Seed creator delivers licensed files instantly in chat — the licensee's
 *  "confirm delivery" moment always arrives without waiting. */
export function seedCreatorDeliversLicense(licenseId: string) {
  const lic = db.select().from(tables.licenses).where(eq(tables.licenses.id, licenseId)).get();
  if (!lic || lic.status !== "issued" || !isSeedUser(lic.creatorId)) return;
  if (lic.conversationId)
    sendAs(
      lic.conversationId,
      lic.creatorId,
      `Files sent! Untagged ${lic.workTitle} + stems are in your inbox. Confirm delivery when you've got everything and the license completes.`
    );
  notify({
    userId: lic.licenseeId, actorId: lic.creatorId, type: "order",
    title: `Files delivered — ${lic.workTitle}`,
    body: "Confirm delivery to complete the license and release the payout.",
    href: "/works?licenses=1",
  });
}
