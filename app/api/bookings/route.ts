import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { asc, eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { notify } from "@/lib/server/notify";

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
          location: b.location,
          status: b.status,
          paymentStatus: payment?.status ?? null,
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

    // the calendar is the source of truth: no double-booking a taken slot
    const durationMin = Math.min(480, Math.max(15, Number(body.durationMin) || 60));
    const conflicts = db
      .select()
      .from(tables.bookings)
      .where(eq(tables.bookings.providerId, service.ownerId))
      .all()
      .some((x) => {
        if (!["accepted", "confirmed", "pending", "reschedule_requested"].includes(x.status)) return false;
        const aStart = startsAt.getTime();
        const aEnd = aStart + durationMin * 60_000;
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
        title: service.title,
        startsAt,
        durationMin,
        price: service.price,
        location: String(body.location || "").slice(0, 120),
      })
      .run();

    notify({
      userId: service.ownerId,
      actorId: user.id,
      type: "booking",
      title: `${user.profile.displayName} requested a booking`,
      body: `${service.title} · $${service.price}`,
      href: "/calendar",
    });
    return { id };
  });
}
