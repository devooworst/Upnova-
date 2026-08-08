import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { asc, and, eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { notify } from "@/lib/server/notify";
import { seedAcceptsBooking, isSeedUser } from "@/lib/server/demo";
import { parseConfig, travelFeeFor, computeSelection } from "@/lib/servicePolicies";
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
    db.insert(tables.bookings)
      .values({
        id,
        serviceId: service.id,
        clientId: user.id,
        providerId: service.ownerId,
        title: selection.title,
        startsAt,
        durationMin,
        price: selection.payout,
        items: JSON.stringify(selection.lines),
        travelFee,
        location: String(body.location || "").slice(0, 120),
        conversationId: body.conversationId ? String(body.conversationId) : null,
      })
      .run();

    notify({
      userId: service.ownerId,
      actorId: user.id,
      type: "booking",
      title: `${user.profile.displayName} requested a booking`,
      body: `${selection.title} · $${selection.payout}${selection.hasQuoted ? " + quoted items" : ""} · ${durationMin} min`,
      href: "/calendar",
    });

    recordInteraction(user.id, "service", service.id, "book");

    // demo mode: seed providers respond immediately — the flow never stalls
    seedAcceptsBooking(id);

    const fresh = db.select().from(tables.bookings).where(eq(tables.bookings.id, id)).get()!;
    return { id, status: fresh.status };
  });
}
