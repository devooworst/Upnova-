import { resolveLocation, geoReady } from "@/lib/server/geo";
import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { asc, eq, isNull } from "drizzle-orm";
import { db, tables } from "@/db";
import { getSessionUser, requireUser, guarded, ApiError } from "@/lib/server/auth";
import { serializeEvent, rsvpCounts, verifiedCampusOf } from "@/lib/server/events";
import { haversineMi } from "@/lib/server/feed";
import { EVENT_CATEGORIES, CAMPUS_EVENT_CATEGORIES, AGE_RULES } from "@/lib/events";
import { unrestrictedTester, demoCampusId } from "@/lib/server/campus";

export const dynamic = "force-dynamic";

const id = () => randomBytes(12).toString("hex");
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "event";

/** GET /api/events — THE WIDER WORLD ONLY. Campus events (campusId set)
 *  are excluded here by the query itself; they live in Your Campus.
 *  Filters: ?q= &category= &when=week|month &price=free|paid
 *  &scope=5mi|25mi|city|state (distance uses the viewer's profile
 *  coordinates server-side — coordinates never leave the server). */
export async function GET(req: NextRequest) {
  return guarded(() => {
    const viewer = getSessionUser();
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") || "").toLowerCase().trim();
    const category = sp.get("category") || "";
    const when = sp.get("when") || "all";
    const price = sp.get("price") || "all";
    const scope = sp.get("scope") || "all";

    let rows = db
      .select({ event: tables.events, profile: tables.profiles, u: tables.users })
      .from(tables.events)
      .innerJoin(tables.users, eq(tables.events.hostId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.events.hostId))
      .orderBy(asc(tables.events.startsAt))
      .all()
      // SCOPE RULE with the visibility/eligibility split: world events
      // always list; campus events list ONLY when the organizer opted
      // into public visibility (info only — RSVP stays campus-gated).
      .filter((r) => (!r.event.campusId || r.event.publicVisibility) && r.event.status === "active" && r.u.status === "active");

    // upcoming only (grace: keep events until 6h after start)
    const now = Date.now();
    rows = rows.filter((r) => r.event.startsAt.getTime() > now - 6 * 3_600_000);

    if (q) rows = rows.filter((r) => (r.event.title + " " + r.event.description + " " + r.event.location + " " + r.event.city).toLowerCase().includes(q));
    if (category) rows = rows.filter((r) => r.event.category === category);
    if (when === "week") rows = rows.filter((r) => r.event.startsAt.getTime() < now + 7 * 86_400_000);
    if (when === "month") rows = rows.filter((r) => r.event.startsAt.getTime() < now + 31 * 86_400_000);
    if (price === "free") rows = rows.filter((r) => r.event.price == null);
    if (price === "paid") rows = rows.filter((r) => r.event.price != null);

    // location scoping — viewer coords stay server-side
    const vLat = viewer?.profile.lat ?? null;
    const vLng = viewer?.profile.lng ?? null;
    let scopeNote: string | null = null;
    if (scope !== "all") {
      if (!viewer) {
        scopeNote = "Sign in to use nearby filters — showing everywhere instead";
      } else if (scope === "city") {
        rows = rows.filter((r) => r.event.city.toLowerCase().startsWith((viewer.profile.city || "").toLowerCase()) && viewer.profile.city);
      } else if (scope === "state") {
        rows = rows.filter((r) => (r.event.state || r.event.city.split(", ").pop() || "").toLowerCase() === (viewer.profile.state || "").toLowerCase() && viewer.profile.state);
      } else if ((scope === "5mi" || scope === "25mi") && vLat != null && vLng != null) {
        const maxMi = scope === "5mi" ? 5 : 25;
        rows = rows.filter((r) => r.event.lat != null && r.event.lng != null && haversineMi(vLat, vLng, r.event.lat, r.event.lng) <= maxMi);
      } else if (scope === "5mi" || scope === "25mi") {
        scopeNote = "Add a location to your profile to use distance filters — showing everywhere instead";
      }
    }

    const eventIds = rows.map((r) => r.event.id);
    const rsvps = rsvpCounts(eventIds);
    const saved = viewer
      ? new Set(
          db.select().from(tables.bookmarks).where(eq(tables.bookmarks.userId, viewer.id)).all()
            .filter((b) => b.targetType === "event").map((b) => b.targetId)
        )
      : new Set<string>();
    const mine = viewer
      ? new Set(db.select().from(tables.eventRsvps).where(eq(tables.eventRsvps.userId, viewer.id)).all().map((r) => r.eventId))
      : new Set<string>();

    const campusNames = new Map(db.select().from(tables.campuses).all().map((c) => [c.id, c.name]));
    return {
      events: rows.map((r) =>
        serializeEvent(r.event, {
          hostName: r.profile.displayName,
          hostHandle: r.u.handle,
          rsvps: rsvps.get(r.event.id) ?? 0,
          saved: saved.has(r.event.id),
          going: mine.has(r.event.id),
          viewerLat: vLat,
          viewerLng: vLng,
          isHost: viewer?.id === r.event.hostId,
          campusName: r.event.campusId ? campusNames.get(r.event.campusId) ?? null : null,
        })
      ),
      scopeNote,
      guest: !viewer,
    };
  });
}

/** POST /api/events — create an event.
 *  campus:true publishes INTO Your Campus (requires verified campus
 *  status; the event is stamped with the creator's campus and never
 *  appears in the public section). campus:false is the wider world. */
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const user = requireUser();
    const body = await req.json().catch(() => ({}));

    const title = String(body.title || "").trim();
    if (title.length < 3 || title.length > 80) throw new ApiError(400, "Event name should be 3–80 characters");
    const description = String(body.description || "").trim().slice(0, 2000);

    const isCampus = !!body.campus;
    let campusId: string | null = null;
    let publicVisibility = false;
    if (isCampus) {
      campusId = verifiedCampusOf(user.id);
      if (!campusId && unrestrictedTester(user.id)) campusId = demoCampusId(); // DEMO MODE
      if (!campusId) throw new ApiError(403, "Campus events need verified campus status — verify your school in Your Campus first");
      // organizer choice: list publicly (info only) while RSVP stays campus-gated
      publicVisibility = !!body.publicVisibility;
    }

    const cats: readonly string[] = isCampus ? CAMPUS_EVENT_CATEGORIES : EVENT_CATEGORIES;
    const category = cats.includes(body.category) ? body.category : "Other";

    const startsAt = new Date(String(body.startsAt || ""));
    if (isNaN(startsAt.getTime())) throw new ApiError(400, "Pick a date and time");
    if (startsAt.getTime() < Date.now() - 3_600_000) throw new ApiError(400, "That start time is in the past");

    const kind = ["rsvp", "registration", "ticket", "approval"].includes(body.kind) ? body.kind : "rsvp";
    const priceNum = body.price != null && body.price !== "" ? Math.round(Number(body.price)) : null;
    if (priceNum != null && (isNaN(priceNum) || priceNum < 0 || priceNum > 100_000)) throw new ApiError(400, "That price doesn't look right");
    if (priceNum != null && priceNum > 0 && kind !== "ticket") throw new ApiError(400, "Paid events use the ticket model");
    if (kind === "ticket" && (priceNum == null || priceNum <= 0)) throw new ApiError(400, "Ticketed events need a price — or switch to RSVP for free entry");

    const capacity = body.capacity != null && body.capacity !== "" ? Math.round(Number(body.capacity)) : null;
    if (capacity != null && (isNaN(capacity) || capacity < 1 || capacity > 100_000)) throw new ApiError(400, "That capacity doesn't look right");

    const venue = String(body.venue || "").trim().slice(0, 120);
    if (!venue) throw new ApiError(400, isCampus ? "Where on campus? (building, hall, quad…)" : "Where is it happening?");

    // location: campus events inherit the school's identity; public events
    // take city/state (+ the host's profile coords for nearby discovery —
    // coords never leave the server)
    let city = "";
    let state = "";
    let lat: number | null = null;
    let lng: number | null = null;
    let campusName: string | null = null;
    if (isCampus) {
      const campus = db.select().from(tables.campuses).where(eq(tables.campuses.id, campusId!)).get()!;
      campusName = campus.name;
      city = `${campus.city}, ${campus.state}`;
      state = campus.state;
    } else {
      // preferred: a validated geo chain from the cascading picker —
      // the server re-checks every parent/child relationship and derives
      // the display strings itself (invalid combos are rejected with 400)
      const geoIn = body.geo && typeof body.geo === "object" ? body.geo : null;
      if (geoIn && String(geoIn.countryCode || "").trim() && geoReady()) {
        const r = resolveLocation({
          countryCode: geoIn.countryCode,
          stateId: geoIn.stateId,
          countyId: geoIn.countyId,
          cityId: geoIn.cityId,
        });
        if (!r.cityName) throw new ApiError(400, "What city is the event in?");
        city = r.cityName;
        state = r.stateShort;
        // city centroid for nearby discovery (never an exact address)
        lat = r.lat ?? user.profile.lat ?? null;
        lng = r.lng ?? user.profile.lng ?? null;
      } else {
        // legacy free-text path (older clients)
        city = String(body.city || "").trim().slice(0, 80);
        state = String(body.state || "").trim().slice(0, 20);
        if (!city) throw new ApiError(400, "What city is the event in?");
        lat = user.profile.lat ?? null;
        lng = user.profile.lng ?? null;
      }
    }

    const config = {
      fields: Array.isArray(body.fields) ? body.fields.map(String).slice(0, 8) : [],
      rules: Array.isArray(body.rules) ? body.rules.map(String).slice(0, 10) : [],
      waitlist: !!body.waitlist,
    };

    let slug = slugify(title);
    if (db.select().from(tables.events).where(eq(tables.events.slug, slug)).get()) slug = `${slug}-${id().slice(0, 4)}`;

    const eventId = id();
    db.insert(tables.events)
      .values({
        id: eventId,
        slug,
        hostId: user.id,
        title,
        description,
        campusId,
        publicVisibility,
        category,
        startsAt,
        timeLabel: startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        location: campusName ? `${venue}, ${campusName}` : `${venue}, ${city}`,
        city,
        state,
        lat,
        lng,
        price: priceNum && priceNum > 0 ? priceNum : null,
        capacity,
        kind,
        ageRule: AGE_RULES.includes(body.ageRule) ? body.ageRule : "all",
        config: JSON.stringify(config),
        imageUrl: body.imageUrl ? String(body.imageUrl).slice(0, 400) : null,
      })
      .run();

    return { ok: true, id: eventId, slug, campus: isCampus };
  });
}
