/* ------------------------------------------------------------------ */
/*  Demo provider behavior — DEV ONLY.                                 */
/*                                                                     */
/*  SIMULATED accounts (users.simulated — explicit classification,     */
/*  never a username) act like responsive counterparts so             */
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
import { and, desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { transition, requestExtension, addReview } from "./projects";
import { notify } from "./notify";

const id = () => randomBytes(12).toString("hex");

/** THE automation authority: may scripted demo behavior act AS this
    account? Reads users.simulated — the explicit classification — never
    a username and never the seed-DATA flag. REAL/PERSONAL accounts
    (admin, signups) are simulated=false: the platform NEVER sends a
    message or performs an action as them. */
export async function isSeedUser(userId: string): Promise<boolean> {
  const u = await db.select({ simulated: tables.users.simulated }).from(tables.users).where(eq(tables.users.id, userId)).get();
  return !!u?.simulated;
}

async function sendAs(conversationId: string, senderId: string, body: string) {
  await db.insert(tables.messages).values({ id: id(), conversationId, senderId, body }).run();
  await db.update(tables.conversations)
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
export async function maybeAutoReply(conversationId: string, fromUserId: string) {
  const members = await db
    .select()
    .from(tables.conversationMembers)
    .where(eq(tables.conversationMembers.conversationId, conversationId))
    .all();
  const other = members.find((m) => m.userId !== fromUserId);
  if (!other || !await isSeedUser(other.userId)) return;

  const user = (await db.select().from(tables.users).where(eq(tables.users.id, other.userId)).get())!;

  // context first: if this conversation has a live booking, the reply moves
  // that booking forward instead of being generic chatter
  const booking = await db
    .select()
    .from(tables.bookings)
    .where(eq(tables.bookings.conversationId, conversationId))
    .orderBy(desc(tables.bookings.createdAt))
    .get();
  const contextual = (() => {
    if (!booking || booking.providerId !== other.userId) return null;
    const when = booking!.startsAt.toLocaleDateString("en-US", { month: "long", day: "numeric" });
    if (booking!.status === "accepted")
      return `Whenever you're ready, secure the payment and ${when} is locked in for you. Any questions about the options or add-ons before you do?`;
    if (booking!.status === "confirmed")
      return `We're all set for ${when}. Are there any special requirements I should plan for?`;
    if (booking!.status === "completed")
      return "It was great working with you! If everything looks good on your end, a quick review really helps.";
    return null;
  })();

  const questionPool = [
    "Which option would you like to go with?",
    "What date works best for you?",
    "Would you like the extended package? It adds more time and deliverables.",
    "Any special requirements I should know about?",
  ];
  const pool = contextual ? [contextual] : (REPLIES[user.handle] ?? REPLIES.default).concat(questionPool);
  const key = `${conversationId}:${other.userId}`;
  const n = replyCounter.get(key) ?? 0;
  replyCounter.set(key, n + 1);
  await sendAs(conversationId, other.userId, pool[n % pool.length]);
}

/* --------------------------- project behavior --------------------------- */

/** After a client opens a draft with a seed creator: review + send offer. */
export async function seedRespondsToDraft(projectId: string) {
  const p = await db.select().from(tables.projects).where(eq(tables.projects.id, projectId)).get();
  if (!p || p.state !== "draft" || !await isSeedUser(p.creatorId)) return;
  if (p.conversationId) {
    await sendAs(
      p.conversationId,
      p.creatorId,
      `Just reviewed your brief for "${p.title}" — I can do this. Sending the offer now: $${p.amount}, everything as described.`
    );
  }
  await transition(projectId, "send_offer", p.creatorId);
}

/** After the client funds: seed creator starts, then asks for +2 days (once). */
export async function seedStartsWork(projectId: string) {
  const p = await db.select().from(tables.projects).where(eq(tables.projects.id, projectId)).get();
  if (!p || p.state !== "in_progress" || !await isSeedUser(p.creatorId)) return;
  if (p.conversationId) {
    await sendAs(p.conversationId, p.creatorId, "Payment came through — starting today. I'll keep everything in this thread.");
  }
  // one honest extension request so the approval flow can be demonstrated;
  // requestExtension enforces a single pending request per project
  const existing = await db
    .select()
    .from(tables.extensionRequests)
    .where(eq(tables.extensionRequests.projectId, projectId))
    .all();
  if (existing.length === 0) {
    try {
      await requestExtension(projectId, p.creatorId, 2, "Adding a final polish pass — two extra days makes it right.");
    } catch {
      /* already pending or wrong state — never force it */
    }
  }
}

/** After the client decides the extension: seed creator delivers. */
export async function seedDeliversAfterExtensionDecision(projectId: string) {
  const p = await db.select().from(tables.projects).where(eq(tables.projects.id, projectId)).get();
  if (!p || p.state !== "in_progress" || !await isSeedUser(p.creatorId)) return;
  if (p.conversationId) {
    await sendAs(p.conversationId, p.creatorId, "Delivery is up for your review — files and notes attached to the project.");
  }
  try {
    await transition(projectId, "submit", p.creatorId);
  } catch {
    /* state moved on — do nothing */
  }
}

/* --------------------------- booking behavior --------------------------- */

/** Seed providers respond to booking requests immediately — no waiting. */
export async function seedAcceptsBooking(bookingId: string) {
  const b = await db.select().from(tables.bookings).where(eq(tables.bookings.id, bookingId)).get();
  if (!b || b.status !== "pending" || !await isSeedUser(b.providerId)) return;
  await db.update(tables.bookings).set({ status: "accepted" }).where(eq(tables.bookings.id, bookingId)).run();
  if (b.conversationId) {
    await sendAs(
      b.conversationId,
      b.providerId,
      `Absolutely — I have that time available. I've accepted your booking request for ${b.title}; once payment is in, you're locked in.`
    );
  }
}

/** Demo progress beats for a CONFIRMED seed booking — announced once each,
    always into the booking's own conversation (by id):
      confirmed → "preparing" (within 24h of start) → "in progress" (during
      the slot). Completion + payout release is handled by the bookings GET. */
export async function seedBookingProgress(bookingId: string) {
  const b = await db.select().from(tables.bookings).where(eq(tables.bookings.id, bookingId)).get();
  if (!b || b.status !== "confirmed" || !await isSeedUser(b.providerId)) return;
  const now = Date.now();
  const start = b.startsAt.getTime();
  const end = start + b.durationMin * 60_000;
  const setProgress = async (progress: string) =>
    await db.update(tables.bookings).set({ progress }).where(eq(tables.bookings.id, bookingId)).run();
  if (b.progress === "" && now >= start - 24 * 3600_000 && now < start) {
    await setProgress("preparing");
    if (b.conversationId)
      await sendAs(b.conversationId, b.providerId, `Getting everything ready for ${b.title} — see you soon. Any special requirements I should know about beforehand?`);
    await notify({ userId: b.clientId, actorId: b.providerId, type: "booking", title: "Preparing for your booking", body: b.title, href: "/calendar" });
  } else if (b.progress !== "in_progress" && now >= start && now < end) {
    await setProgress("in_progress");
    if (b.conversationId) await sendAs(b.conversationId, b.providerId, `Starting ${b.title} now.`);
  }
}

/** Seed provider confirms in chat after the client pays. */
export async function seedConfirmsBookingPayment(bookingId: string) {
  const b = await db.select().from(tables.bookings).where(eq(tables.bookings.id, bookingId)).get();
  if (!b || !await isSeedUser(b.providerId) || !b.conversationId) return;
  const when = b.startsAt.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const time = b.startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  await sendAs(b.conversationId, b.providerId, `Got it — your payment is secured. You're confirmed for ${when} at ${time}. See you then!`);
}

/* ------------------- Test Center: force-advance -------------------- */
/* Simulates the SEED counterpart's next real action on a transaction
   the CALLER participates in. It never elevates the caller's own
   privileges, never touches auth, and uses the exact same messages,
   notifications, and payment records the organic flow produces —
   just without waiting for the clock. Demo deployments only (the
   route gates on isDemoMode); the caller's own steps (like paying)
   are NEVER faked — the response points at the real UI instead. */
export async function forceAdvanceBooking(bookingId: string, actorUserId: string): Promise<{ ok: true; stage: string } | { requiresAction: string; href: string }> {
  const b = await db.select().from(tables.bookings).where(eq(tables.bookings.id, bookingId)).get();
  if (!b) throw new Error("Booking not found");
  if (b.clientId !== actorUserId && b.providerId !== actorUserId) throw new Error("Not your booking");
  const other = b.clientId === actorUserId ? b.providerId : b.clientId;
  if (!await isSeedUser(other)) throw new Error("Advance works only against seed demo accounts");

  const providerIsSimulated = other === b.providerId; // (other is already verified simulated)
  if (b.status === "pending") {
    // accepting is the PROVIDER'S action — if that's YOU, it's your move
    if (!providerIsSimulated) return { requiresAction: "Accept or decline the request yourself — it's a booking for YOUR service", href: "/calendar" };
    await seedAcceptsBooking(bookingId);
    return { ok: true, stage: "Accepted — awaiting your test payment" };
  }
  if (b.status === "accepted") {
    // paying is the CALLER's step — never simulated for them
    return { requiresAction: "Pay (test payment) in the real UI", href: "/calendar" };
  }
  if (b.status === "confirmed") {
    // progress + completion are the PROVIDER'S actions — never simulated
    // when the caller is the provider (a REAL account never auto-speaks)
    if (!providerIsSimulated) return { requiresAction: "Post progress / mark complete yourself — you're the provider", href: "/calendar" };
    if (b.progress === "") {
      await db.update(tables.bookings).set({ progress: "preparing" }).where(eq(tables.bookings.id, bookingId)).run();
      if (b.conversationId) await sendAs(b.conversationId, b.providerId, `Getting everything ready for ${b.title} — see you soon. Any special requirements I should know about beforehand?`);
      await notify({ userId: b.clientId, actorId: b.providerId, type: "booking", title: "Preparing for your booking", body: b.title, href: `/activity?focus=booking:${b.id}`, category: "work" });
      return { ok: true, stage: "Preparing" };
    }
    if (b.progress === "preparing") {
      await db.update(tables.bookings).set({ progress: "in_progress" }).where(eq(tables.bookings.id, bookingId)).run();
      if (b.conversationId) await sendAs(b.conversationId, b.providerId, `Starting ${b.title} now.`);
      await notify({ userId: b.clientId, actorId: b.providerId, type: "booking", title: "Service in progress", body: b.title, href: `/activity?focus=booking:${b.id}`, category: "work" });
      return { ok: true, stage: "In progress" };
    }
    await db.update(tables.bookings).set({ status: "completed" }).where(eq(tables.bookings.id, bookingId)).run();
    await db.update(tables.payments).set({ status: "released" }).where(and(eq(tables.payments.bookingId, b.id), eq(tables.payments.status, "held"))).run();
    if (b.conversationId) await sendAs(b.conversationId, b.providerId, `${b.title} is done — thanks for booking me! If everything looks good, a quick review helps a lot.`);
    await notify({ userId: b.clientId, actorId: b.providerId, type: "payment", title: `${b.title} completed`, body: `Payout released to the provider (test payment)`, href: `/activity?focus=booking:${b.id}`, category: "payments" });
    return { ok: true, stage: "Completed — payment released" };
  }
  throw new Error(`Nothing to advance from "${b.status}"`);
}

export async function forceAdvanceOrder(orderId: string, actorUserId: string): Promise<{ ok: true; stage: string } | { requiresAction: string; href: string }> {
  const o = await db.select().from(tables.orders).where(eq(tables.orders.id, orderId)).get();
  if (!o) throw new Error("Order not found");
  if (o.buyerId !== actorUserId && o.sellerId !== actorUserId) throw new Error("Not your order");
  const other = o.buyerId === actorUserId ? o.sellerId : o.buyerId;
  if (!await isSeedUser(other)) throw new Error("Advance works only against seed demo accounts");
  const log = async (kind: string, note: string) =>
    await db.insert(tables.orderEvents).values({ id: id(), orderId: o.id, actorId: o.sellerId, kind, note }).run();

  if (o.status === "placed") return { requiresAction: "Pay (test payment) in the real UI", href: "/orders" };
  if (o.status === "paid") {
    await db.update(tables.orders).set({ status: "preparing" }).where(eq(tables.orders.id, o.id)).run();
    await log("preparing", "Seller is preparing your order");
    await notify({ userId: o.buyerId, actorId: o.sellerId, type: "order", title: "Your order is being prepared", body: o.title, href: `/activity?focus=purchase:${o.id}`, category: "payments" });
    return { ok: true, stage: "Preparing" };
  }
  if (o.status === "preparing") {
    await db.update(tables.orders).set({ status: "shipped", tracking: JSON.stringify({ carrier: "Demo Carrier", code: "TEST-" + o.id.slice(0, 6).toUpperCase() }) }).where(eq(tables.orders.id, o.id)).run();
    await log("shipped", "Demo Carrier TEST-" + o.id.slice(0, 6).toUpperCase());
    await notify({ userId: o.buyerId, actorId: o.sellerId, type: "order", title: "Your order shipped", body: o.title, href: `/activity?focus=purchase:${o.id}`, category: "payments" });
    return { ok: true, stage: "Shipped" };
  }
  if (o.status === "shipped") {
    await db.update(tables.orders).set({ status: "delivered", protectionEndsAt: new Date(Date.now() + 48 * 3600_000) }).where(eq(tables.orders.id, o.id)).run();
    await log("delivered", "Carrier confirmed delivery");
    await notify({ userId: o.buyerId, actorId: o.sellerId, type: "order", title: "Delivered", body: `${o.title} — protection window open`, href: `/activity?focus=purchase:${o.id}`, category: "payments" });
    return { ok: true, stage: "Delivered — protection window open" };
  }
  if (o.status === "delivered") {
    await db.update(tables.orders).set({ status: "completed" }).where(eq(tables.orders.id, o.id)).run();
    await db.update(tables.payments).set({ status: "released" }).where(and(eq(tables.payments.orderId, o.id), eq(tables.payments.status, "held"))).run();
    await log("completed", "Protection window ended with no reported problem — funds released");
    await notify({ userId: o.buyerId, actorId: o.sellerId, type: "payment", title: "Order complete", body: `${o.title} — funds released (test payment)`, href: `/activity?focus=purchase:${o.id}`, category: "payments" });
    return { ok: true, stage: "Completed — funds released" };
  }
  throw new Error(`Nothing to advance from "${o.status}"`);
}

export async function forceAdvanceApplication(applicationId: string, actorUserId: string): Promise<{ ok: true; stage: string }> {
  const a = await db.select().from(tables.applications).where(eq(tables.applications.id, applicationId)).get();
  if (!a) throw new Error("Application not found");
  if (a.applicantId !== actorUserId) throw new Error("Not your application");
  const opp = await db.select().from(tables.opportunities).where(eq(tables.opportunities.id, a.opportunityId)).get();
  if (!opp || !await isSeedUser(opp.posterId)) throw new Error("Advance works only against seed demo accounts");
  const next: Record<string, { status: string; stage: string; note: string }> = {
    submitted: { status: "shortlisted", stage: "Shortlisted", note: "You've been shortlisted" },
    shortlisted: { status: "selected", stage: "Selected", note: "You were selected — congratulations" },
    selected: { status: "confirmed", stage: "Confirmed", note: "You're confirmed for this opportunity" },
  };
  const step = next[a.status];
  if (!step) throw new Error(`Nothing to advance from "${a.status}"`);
  await db.update(tables.applications).set({ status: step.status }).where(eq(tables.applications.id, a.id)).run();
  await notify({ userId: a.applicantId, actorId: opp.posterId, type: "opportunity", title: step.note, body: opp.title, href: `/opportunities/${opp.id}`, category: "work" });
  return { ok: true, stage: step.stage };
}

/** Seed counterparty confirms a linked work post ("Client Confirmed"). */
export async function seedClientConfirmsWork(postId: string, counterpartyId: string) {
  if (!await isSeedUser(counterpartyId)) return;
  const post = await db.select().from(tables.posts).where(eq(tables.posts.id, postId)).get();
  if (!post || post.clientConfirmed) return;
  await db.update(tables.posts).set({ clientConfirmed: true }).where(eq(tables.posts.id, postId)).run();
  const confirmer = await db.select().from(tables.profiles).where(eq(tables.profiles.userId, counterpartyId)).get();
  await notify({
    userId: post.authorId,
    actorId: counterpartyId,
    type: "post",
    title: `${confirmer?.displayName ?? "Your client"} confirmed your work`,
    body: "The post now carries a Client Confirmed label.",
    href: "/profile",
  });
}

/** After the real user reviews a completed project: the seed side reviews back. */
export async function seedReviewsBack(projectId: string, realUserId: string) {
  const p = await db.select().from(tables.projects).where(eq(tables.projects.id, projectId)).get();
  if (!p) return;
  const seedParty = p.clientId === realUserId ? p.creatorId : p.clientId;
  if (!await isSeedUser(seedParty)) return;
  const existing = await db
    .select()
    .from(tables.reviews)
    .where(and(eq(tables.reviews.projectId, projectId), eq(tables.reviews.authorId, seedParty)))
    .get();
  if (existing) return;
  try {
    await addReview(projectId, seedParty, 5, "Clear brief, quick decisions, on-time payment. Would work together again.");
  } catch {
    /* reviews closed — fine */
  }
}

/* ------------------- role opportunities (Team & Openings) ------------------- */

/** Seed applicant accepts a role offer instantly — the team view fills in. */
export async function seedAcceptsRoleOffer(applicationId: string) {
  const app = await db.select().from(tables.applications).where(eq(tables.applications.id, applicationId)).get();
  if (!app || app.status !== "selected" || !await isSeedUser(app.applicantId)) return;
  // the protagonist demo account (admin) never auto-acts — accepting an
  // offer is THEIR moment when a human is driving that account
  const applicant = await db.select().from(tables.users).where(eq(tables.users.id, app.applicantId)).get();
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
export async function seedApplicantsApplyToRoles(opportunityId: string) {
  const opp = await db.select().from(tables.opportunities).where(eq(tables.opportunities.id, opportunityId)).get();
  if (!opp) return;
  let roles: { id: string; title: string }[] = [];
  try { roles = JSON.parse(opp.roles); } catch { return; }
  if (!roles.length) return;
  const seeds = (await db.select().from(tables.users).all()).filter((u) => u.simulated && u.id !== opp.posterId && u.status === "active");
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
      const already = await db
        .select()
        .from(tables.applications)
        .where(and(eq(tables.applications.opportunityId, opp.id), eq(tables.applications.applicantId, u.id)))
        .get();
      if (already) continue;
      await db.insert(tables.applications)
        .values({
          id: randomBytes(12).toString("hex"),
          opportunityId: opp.id,
          applicantId: u.id,
          roleId: role.id,
          message: MESSAGES[cursor % MESSAGES.length],
          availability: "yes",
        })
        .run();
      await notify({
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
export async function seedSellerFulfills(orderId: string) {
  const o = await db.select().from(tables.orders).where(eq(tables.orders.id, orderId)).get();
  if (!o || o.status !== "secured" || !await isSeedUser(o.sellerId)) return;
  if (o.fulfillment === "shipping") {
    const eta = new Date(Date.now() + 4 * 86400_000).toISOString();
    const code = "9400" + String(Math.floor(1e10 + Math.random() * 9e10));
    // high-value: the seed seller records evidence like a careful human would
    const highValue = o.price * o.qty >= 200;
    await db.update(tables.orders)
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
      await sendAs(o.conversationId, o.sellerId, `Packed and shipped! USPS tracking ${code} — should land in about 4 days.`);
    await notify({
      userId: o.buyerId, actorId: o.sellerId, type: "order",
      title: `Shipped — ${o.title}`, body: `USPS · estimated ${new Date(eta).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      href: "/orders",
    });
  } else if (o.fulfillment === "digital") {
    await db.update(tables.orders).set({ status: "delivered" }).where(eq(tables.orders.id, o.id)).run();
    if (o.conversationId)
      await sendAs(o.conversationId, o.sellerId, `Download link sent! Confirm you got everything and the order completes.`);
    await notify({ userId: o.buyerId, actorId: o.sellerId, type: "order", title: `Delivered — ${o.title}`, body: "Confirm receipt to complete the order.", href: "/orders" });
  } else {
    // pickup / local delivery: seed seller proposes the meetup in chat
    await db.update(tables.orders).set({ status: "preparing" }).where(eq(tables.orders.id, o.id)).run();
    if (o.conversationId)
      await sendAs(
        o.conversationId,
        o.sellerId,
        `I'm flexible for the ${o.fulfillment === "pickup" ? "pickup" : "drop-off"} — does Saturday around 2 PM near downtown work? Exact spot once we confirm.`
      );
    await notify({ userId: o.buyerId, actorId: o.sellerId, type: "order", title: `Seller is preparing your order`, body: `${o.title} — arrange the ${o.fulfillment} in Messages`, href: "/orders", priority: "normal" });
  }
}

/* ------------------------------ licensing ------------------------------ */

/** Seed creator delivers licensed files instantly in chat — the licensee's
 *  "confirm delivery" moment always arrives without waiting. */
export async function seedCreatorDeliversLicense(licenseId: string) {
  const lic = await db.select().from(tables.licenses).where(eq(tables.licenses.id, licenseId)).get();
  if (!lic || lic.status !== "issued" || !await isSeedUser(lic.creatorId)) return;
  if (lic.conversationId)
    await sendAs(
      lic.conversationId,
      lic.creatorId,
      `Files sent! Untagged ${lic.workTitle} + stems are in your inbox. Confirm delivery when you've got everything and the license completes.`
    );
  await notify({
    userId: lic.licenseeId, actorId: lic.creatorId, type: "order",
    title: `Files delivered — ${lic.workTitle}`,
    body: "Confirm delivery to complete the license and release the payout.",
    href: "/works?licenses=1",
  });
}

/* ----------------------------- communities ----------------------------- */

/** Seed members reply once to a fresh post by a REAL (or protagonist) user
 *  in a seed community, so the discussion feels alive. Replies respect the
 *  community's identity modes: in anonymous-friendly rooms seed members
 *  answer masked, exactly like a real shy member would. */
export async function seedRespondsInCommunity(communityId: string) {
  const c = await db.select().from(tables.communities).where(eq(tables.communities.id, communityId)).get();
  if (!c || !c.isSeed) return;

  const cutoff = new Date(Date.now() - 7 * 86_400_000);
  const posts = (await db
    .select()
    .from(tables.communityPosts)
    .where(eq(tables.communityPosts.communityId, communityId))
    .all())
    .filter((p) => !p.isSeed && !p.removedAt && p.createdAt > cutoff);

  let modes: string[] = ["real"];
  try {
    modes = JSON.parse(c.identityModes || '["real"]');
  } catch {}

  for (const post of posts) {
    const existing = db
      .select()
      .from(tables.communityComments)
      .where(eq(tables.communityComments.postId, post.id))
      .all();
    if ((await existing).some((cm) => cm.isSeed)) continue; // one seed reply per post

    // pick an active seed member who isn't the author (and never the admin)
    const members = (await db
      .select({ m: tables.communityMembers, u: tables.users })
      .from(tables.communityMembers)
      .innerJoin(tables.users, eq(tables.communityMembers.userId, tables.users.id))
      .where(eq(tables.communityMembers.communityId, communityId))
      .all())
      .filter((r) => r.m.status === "active" && r.u.simulated && r.u.id !== post.authorId);
    if (!members.length) continue;
    const replier = members[Math.floor(Math.random() * members.length)];

    const identity = modes.includes("anonymous") ? "anonymous" : modes.includes("alias") && replier.m.alias ? "alias" : "real";
    if (identity === "anonymous" && !replier.m.anonCode) {
      // stable code, same as the real path
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("./communities").ensureAnonCode(communityId, replier.u.id);
    }

    const lines = [
      "Was just thinking about this — glad somebody said it.",
      "Same here honestly. Following this thread.",
      "Good question. Somebody in here definitely knows.",
      "This community delivers again. Watching this one.",
      "Felt this. Thanks for posting it.",
    ];
    await db.insert(tables.communityComments)
      .values({
        id: id(),
        postId: post.id,
        authorId: replier.u.id,
        identity,
        body: lines[Math.floor(Math.random() * lines.length)],
        isSeed: true,
      })
      .run();
  }
}

/** Seed accounts answer pending reveal requests so the full
 *  request → accept → connection loop can be demonstrated solo.
 *  The protagonist admin account never auto-answers — that decision
 *  belongs to the human driving it. */
export async function seedAcceptsReveal(forUserId: string) {
  const pending = (await db
    .select()
    .from(tables.identityReveals)
    .where(eq(tables.identityReveals.status, "pending"))
    .all())
    .filter((r) => r.requesterId === forUserId);
  for (const r of pending) {
    if (!(await isSeedUser(r.targetId))) continue;
    const target = await db.select().from(tables.users).where(eq(tables.users.id, r.targetId)).get();
    if (!target || target.role === "admin") continue;
    await db.update(tables.identityReveals)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(eq(tables.identityReveals.id, r.id))
      .run();
    await notify({
      userId: r.requesterId,
      actorId: r.targetId,
      type: "community",
      title: `${r.targetLabel || "They"} accepted your reveal request`,
      body: "You can now see each other's profiles — privately. The community still sees your masked identities.",
      href: "/communities?tab=reveals",
    });
  }
}
