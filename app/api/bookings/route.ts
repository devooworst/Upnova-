import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { asc, and, eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { assertCapacityById } from "@/lib/server/businessLimits";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { notify } from "@/lib/server/notify";
import { seedAcceptsBooking, isSeedUser, seedBookingProgress } from "@/lib/server/demo";
import { resolvePairConversation } from "@/lib/server/conversations";
import { parseConfig, travelFeeFor, computeSelection } from "@/lib/servicePolicies";
import { hasEarlyAccess, discountPercent, readEarlyAccess, readRelease, activeBookingsForService, clientBookingsSinceWindowStart } from "@/lib/server/preferred";
import { recordInteraction } from "@/lib/server/recsys";
import { haversineMi } from "@/lib/server/feed";

export const dynamic = "force-dynamic";

/** GET /api/bookings — bookings where I'm the client or the provider. */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const rows = db
      .select()
      .from(tables.bookings)
      .where(or(eq(tables.bookings.clientId, user.id), eq(tables.bookings.providerId, user.id)))
      .orderBy(asc(tables.bookings.startsAt))
      .all();

    // demo progress beats: seed providers announce "preparing" and
    // "in progress" into the CORRECT conversation (by booking ids), once
    for (const b of rows) seedBookingProgress(b.id);
    // demo mode: when a seed provider's confirmed appointment time has
    // passed, the appointment "happened" — completed, payout released
    for (const b of rows) {
      if (b.status === "confirmed" && b.startsAt.getTime() < Date.now() && isSeedUser(b.providerId)) {
        db.update(tables.bookings).set({ status: "completed" }).where(eq(tables.bookings.id, b.id)).run();
        db.update(tables.payments)
          .set({ status: "released" })
          .where(and(eq(tables.payments.bookingId, b.id), eq(tables.payments.status, "held")))
          .run();
        b.status = "completed";
        notify({
          userId: b.clientId,
          actorId: b.providerId,
          type: "payment",
          title: `${b.title} completed`,
          body: `Payout processed — $${b.price} released to the provider`,
          href: "/calendar",
          category: "payments",
        });
      }
    }

    const payRows = db.select().from(tables.payments).all().filter((p) => p.bookingId);
    return {
      bookings: rows.map((b) => {
        const otherId = b.clientId === user.id ? b.providerId : b.clientId;
        const otherUser = db.select().from(tables.users).where(eq(tables.users.id, otherId)).get()!;
        const otherProfile = db.select().from(tables.profiles).where(eq(tables.profiles.userId, otherId)).get()!;
        const payment = payRows.find((p) => p.bookingId === b.id);
        return {
          id: b.id,
          title: b.title,
          startsAt: b.startsAt.toISOString(),
          proposedStartsAt: b.proposedStartsAt?.toISOString() ?? null,
          durationMin: b.durationMin,
          price: b.price,
          items: (() => { try { return JSON.parse(b.items); } catch { return []; } })(),
          location: b.location,
          status: b.status,
          paymentStatus: payment?.status ?? null,
          travelFee: b.travelFee,
          conversationId: b.conversationId,
          myRole: b.clientId === user.id ? "client" : "provider",
          with: publicUser(otherUser, otherProfile),
        };
      }),
    };
  });
}

/** POST — book a provider's service slot. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const service = db.select().from(tables.services).where(eq(tables.services.id, String(body.serviceId))).get();
    if (!service || !service.active) throw new ApiError(404, "Service not found");
    // visibility is enforced where money happens, not just in the UI:
    // drafts aren't published; followers-only requires actually following
    if (service.visibility === "draft") throw new ApiError(404, "Service not found");
    if (service.visibility === "followers") {
      const follows = !!db
        .select()
        .from(tables.follows)
        .where(and(eq(tables.follows.followerId, user.id), eq(tables.follows.followingId, service.ownerId)))
        .get();
      if (!follows) throw new ApiError(403, "This service is only available to followers");
    }
    if (service.ownerId === user.id) throw new ApiError(400, "You can't book your own service");

    // BUSINESS CAPACITY: a business booking talent adds an active hire —
    // creation-only gate, never blocks anyone from booking THE business
    assertCapacityById(user.id, "activeHires");

    /* ---- PREFERRED EARLY ACCESS ----------------------------------
       Early Access controls WHO gets access first; availability controls
       HOW MANY can book. Enforcement order matters:
        1. SLOT CAPACITY applies to EVERYONE — Preferred Clients included.
           A full service is unavailable to all; a cancellation frees its
           slot automatically (slot-holding statuses only).
        2. While the window is open, only the owner's Preferred Clients
           (priority-booking / early-access benefit) may book — still
           inside capacity, schedule, and conflict rules.
        3. Optional PER-CLIENT limit: each Preferred Client can claim at
           most N appointments during early access, so one client can't
           sweep the whole release.
       After the window, remaining availability opens to everyone. */
    const eaSetup = readEarlyAccess(service.config);
    const windowOpen = !!service.preferredUntil && service.preferredUntil.getTime() > Date.now();
    if (eaSetup?.slots != null) {
      const activeNow = activeBookingsForService(service.id);
      if (activeNow >= eaSetup.slots)
        throw new ApiError(409, `Fully booked — all ${eaSetup.slots} slots for this service are taken. If a slot opens up (a cancellation), booking reopens automatically.`);
    }
    if (windowOpen) {
      const opens = service.preferredUntil!.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      if (!hasEarlyAccess(service.ownerId, user.id))
        throw new ApiError(403, `Preferred Early Access is on — this provider's Preferred Clients get first pick. Booking opens to everyone ${opens}`);
      if (eaSetup?.preferredLimit != null) {
        const mine = clientBookingsSinceWindowStart(service.id, user.id, eaSetup.startedAt);
        if (mine >= eaSetup.preferredLimit)
          throw new ApiError(409, `Early-access limit reached — ${eaSetup.preferredLimit} booking${eaSetup.preferredLimit === 1 ? "" : "s"} per Preferred Client during this window. Remaining availability opens to everyone ${opens}`);
      }
    }
    const providerProfile = db
      .select()
      .from(tables.profiles)
      .where(eq(tables.profiles.userId, service.ownerId))
      .get()!;
    if (!providerProfile.hiringEnabled || !providerProfile.acceptBookings)
      throw new ApiError(403, "This creator isn't accepting bookings");

    const startsAt = new Date(body.startsAt);
    if (isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now())
      throw new ApiError(400, "Pick a future time");

    // the creator's config drives duration, radius, limits, and travel
    const config = parseConfig(service.config);
    const providerProfileFull = db
      .select()
      .from(tables.profiles)
      .where(eq(tables.profiles.userId, service.ownerId))
      .get()!;
    const distanceMi =
      user.profile.lat != null && providerProfileFull.lat != null
        ? Math.round(haversineMi(user.profile.lat, user.profile.lng!, providerProfileFull.lat, providerProfileFull.lng!) * 10) / 10
        : null;

    // service radius: outside the area → refused up front, never a surprise
    if (
      ["client_location", "both"].includes(config.locationMode) &&
      config.travel.radiusMi &&
      distanceMi != null &&
      distanceMi > config.travel.radiusMi
    )
      throw new ApiError(409, `Outside ${providerProfileFull.displayName}'s service area (${config.travel.radiusMi} mi)`);

    const travelFee = travelFeeFor(config.travel, distanceMi).fee;

    // --- the creator's booking rules, enforced server-side ---
    const sched = config.scheduling;
    const reqStart = new Date(body.startsAt);
    if (sched.days && sched.days.length && !sched.days.includes(reqStart.getDay()))
      throw new ApiError(409, `${providerProfileFull.displayName} doesn't take bookings on ${reqStart.toLocaleDateString("en-US", { weekday: "long" })}s`);
    const hour = reqStart.getHours();
    if (sched.startHour != null && sched.endHour != null && (hour < sched.startHour || hour >= sched.endHour))
      throw new ApiError(409, `Outside working hours (${sched.startHour}:00–${sched.endHour}:00)`);
    const hoursOut = (reqStart.getTime() - Date.now()) / 3600_000;
    /* HOW AVAILABILITY IS RELEASED — the provider's choice of model.
       Rolling: the window moves forward continuously (horizonDays).
       Scheduled: dates open at a specific moment ("September opens
       Aug 25, 9 AM"), Preferred Clients first when early access is set.
       Either way this only decides WHEN dates become bookable —
       capacity below still decides HOW MANY, for everyone. */
    if (sched.releaseMode === "scheduled") {
      const rel = readRelease(service.config);
      const reqT = reqStart.getTime();
      const fmtT = (t: number) => new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      let releasedThrough = rel?.releasedUntil ? Date.parse(rel.releasedUntil) : 0;
      const relAt = rel?.releaseAt ? Date.parse(rel.releaseAt) : null;
      const relUntil = rel?.releaseUntil ? Date.parse(rel.releaseUntil) : null;
      if (relAt != null && relUntil != null) {
        const publicAt = relAt + (rel?.eaHours ?? 0) * 3600_000;
        if (Date.now() >= publicAt) {
          releasedThrough = Math.max(releasedThrough, relUntil); // fully open
        } else if (Date.now() >= relAt && reqT > releasedThrough && reqT <= relUntil) {
          // the release is in its Preferred Early Access phase
          if (!hasEarlyAccess(service.ownerId, user.id))
            throw new ApiError(403, `This new availability is in Preferred Early Access — it opens to everyone ${fmtT(publicAt)}`);
          const eaRel = readEarlyAccess(service.config);
          if (eaRel?.preferredLimit != null) {
            const mine = clientBookingsSinceWindowStart(service.id, user.id, rel!.releaseAt);
            if (mine >= eaRel.preferredLimit)
              throw new ApiError(409, `Early-access limit reached — ${eaRel.preferredLimit} booking${eaRel.preferredLimit === 1 ? "" : "s"} per Preferred Client for this release. It opens to everyone ${fmtT(publicAt)}`);
          }
          releasedThrough = relUntil; // this Preferred Client may book the new range
        } else if (Date.now() < relAt && reqT > releasedThrough && reqT <= relUntil) {
          throw new ApiError(409, `These dates aren't released yet — they open ${fmtT(relAt)}${rel?.eaHours ? ` (Preferred Clients book first for ${rel.eaHours}h)` : ""}`);
        }
      }
      if (reqT > releasedThrough)
        throw new ApiError(409, `${providerProfileFull.displayName} releases availability on specific dates — that date isn't part of any released or scheduled batch yet`);
    } else {
      // ROLLING HORIZON: how far ahead THIS provider releases availability.
      const horizon = sched.horizonDays ?? 60;
      if (reqStart.getTime() > Date.now() + horizon * 86400_000) {
        const releases = new Date(reqStart.getTime() - horizon * 86400_000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        throw new ApiError(409, `${providerProfileFull.displayName} opens bookings ${horizon} days ahead — that date isn't released yet (bookable from ${releases})`);
      }
    }
    if (sched.sameDayBooking === false && reqStart.toDateString() === new Date().toDateString())
      throw new ApiError(409, "Same-day booking isn't available for this service");
    if (sched.advanceNoticeHours && hoursOut < sched.advanceNoticeHours)
      throw new ApiError(409, `Needs at least ${sched.advanceNoticeHours} hours advance notice`);

    // booking limits: the creator caps their own day
    if (config.scheduling.maxPerDay) {
      const dayStart = new Date(body.startsAt);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 86400_000);
      const sameDay = db
        .select()
        .from(tables.bookings)
        .where(eq(tables.bookings.providerId, service.ownerId))
        .all()
        .filter(
          (x) =>
            ["pending", "accepted", "confirmed", "reschedule_requested"].includes(x.status) &&
            x.startsAt >= dayStart &&
            x.startsAt < dayEnd
        ).length;
      if (sameDay >= config.scheduling.maxPerDay)
        throw new ApiError(409, `${providerProfileFull.displayName} is fully booked that day (max ${config.scheduling.maxPerDay}/day)`);
    }

    // --- the customer's menu selection, priced by the CREATOR's menu ---
    // The client sends ids only; price, time, and line items are recomputed
    // here from the service config. A tampered request can't change what
    // anything costs — it can only pick items that actually exist.
    const addonIds = Array.isArray(body.addonIds) ? body.addonIds.map(String).slice(0, 12) : [];
    const packageId = body.packageId ? String(body.packageId) : null;
    const menu = config.menu;
    if (packageId && !menu?.packages.some((p) => p.id === packageId))
      throw new ApiError(400, "That package is no longer on the menu");
    for (const aid of addonIds)
      if (!menu?.addons.some((a) => a.id === aid)) throw new ApiError(400, "That add-on is no longer on the menu");
    const selection = computeSelection(config, { title: service.title, price: service.price }, { packageId, addonIds });

    // PREFERRED PRICING: if the provider gave this client a discount
    // benefit, it's applied server-side and disclosed as its own line on
    // the frozen receipt — the client never has to ask, and the price
    // can't be spoofed from the request.
    const prefPct = discountPercent(service.ownerId, user.id);
    const prefDiscount = prefPct > 0 ? Math.round((selection.payout * prefPct) / 100) : 0;
    const finalPayout = selection.payout - prefDiscount;
    const finalLines = prefDiscount > 0
      ? [...selection.lines, { label: `Preferred client pricing (-${prefPct}%)`, amount: -prefDiscount }]
      : selection.lines;

    // the calendar is the source of truth: no double-booking a taken slot
    const durationMin = selection.durationMin || Math.min(480, Math.max(15, Number(body.durationMin) || 60));
    const conflicts = db
      .select()
      .from(tables.bookings)
      .where(eq(tables.bookings.providerId, service.ownerId))
      .all()
      .some((x) => {
        if (!["accepted", "confirmed", "pending", "reschedule_requested"].includes(x.status)) return false;
        // the creator's buffer widens every conflict window
        const buffer = (config.scheduling.bufferMin ?? 0) * 60_000;
        const aStart = startsAt.getTime() - buffer;
        const aEnd = startsAt.getTime() + durationMin * 60_000 + buffer;
        const bStart = x.startsAt.getTime();
        const bEnd = bStart + x.durationMin * 60_000;
        return aStart < bEnd && bStart < aEnd;
      });
    if (conflicts) throw new ApiError(409, "That time is no longer available — pick another slot");

    const id = randomBytes(12).toString("hex");
    /* THE RELATIONSHIP FIX: the booking's conversation is derived from the
       two participant IDs — clientId + providerId — never trusted from the
       client. A stale/mismatched conversationId (the "John's booking opened
       Sarah's conversation" bug) is ignored: we verify the provided
       conversation is EXACTLY the 1:1 between these two people, otherwise
       we find-or-create the correct one. Every downstream auto-message
       (acceptance, payment, progress) lands in the right thread by ID. */
    const conversationId = resolvePairConversation(user.id, service.ownerId, body.conversationId ? String(body.conversationId) : null);
    db.insert(tables.bookings)
      .values({
        id,
        serviceId: service.id,
        clientId: user.id,
        providerId: service.ownerId,
        title: selection.title,
        startsAt,
        durationMin,
        price: finalPayout,
        items: JSON.stringify(finalLines),
        travelFee,
        location: String(body.location || "").slice(0, 120),
        conversationId,
      })
      .run();

    notify({
      userId: service.ownerId,
      actorId: user.id,
      type: "booking",
      title: `${user.profile.displayName} requested a booking`,
      body: `${selection.title} · $${finalPayout}${selection.hasQuoted ? " + quoted items" : ""}${prefDiscount > 0 ? ` (preferred pricing applied)` : ""} · ${durationMin} min`,
      href: "/calendar",
    });

    if (prefDiscount > 0)
      notify({
        userId: user.id,
        actorId: service.ownerId,
        type: "preferred_added",
        title: `You received Preferred Client pricing from ${providerProfileFull.displayName}`,
        body: `${selection.title} — $${prefDiscount} off (${prefPct}%)`,
        href: "/calendar",
        priority: "low",
      });

    recordInteraction(user.id, "service", service.id, "book");

    // demo mode: seed providers respond immediately — the flow never stalls
    seedAcceptsBooking(id);

    const fresh = db.select().from(tables.bookings).where(eq(tables.bookings.id, id)).get()!;
    return { id, status: fresh.status };
  });
}
