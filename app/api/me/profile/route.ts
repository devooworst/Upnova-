import { NextRequest } from "next/server";
import { storeImage } from "@/lib/server/blobs";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";
import { ownProfile } from "@/lib/server/serialize";
import { resolveLocation, geoReady } from "@/lib/server/geo";

export const dynamic = "force-dynamic";

/** PATCH /api/me/profile — the Edit Profile save path. Owner-only by construction. */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();

    const str = (v: unknown, max = 500) => String(v ?? "").slice(0, max);
    const arr = (v: unknown) => JSON.stringify(Array.isArray(v) ? v.slice(0, 40).map((x) => String(x).slice(0, 80)) : []);
    const b = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);
    const p = user.profile;

    /* ---------------- location: validated relationally ----------------
       Preferred path: body.location = { countryCode, stateId, countyId,
       cityId }. The chain is verified against the geo reference data —
       Maryland → Fairfax County (Virginia) is REJECTED with a 400, no
       matter what the client claims. Display text (city/county/state/
       country) is derived server-side from the canonical rows.

       Legacy path (no usable location object): free-text city/state/…
       are stored as before, so older clients and existing profiles keep
       working until they're normalized. Sending an empty location AND
       empty text explicitly clears the location.                       */
    const loc = body.location && typeof body.location === "object" ? body.location : null;
    const wantsStructured = !!loc && !!String(loc.countryCode || "").trim();
    const wantsClear =
      !!loc && !String(loc.countryCode || "").trim() && ![body.city, body.county, body.state, body.country].some((t) => String(t || "").trim());
    let locationCols: Record<string, unknown>;
    // The structured path only runs when the geo reference DB is
    // actually compiled on this instance. If it isn't, we fall through
    // to the plain-text path — saving a profile must NEVER be blocked
    // by a missing internal dataset, and "run npm run geo:build" is a
    // developer note, not a user-facing error.
    if ((wantsStructured && geoReady()) || wantsClear) {
      const r = resolveLocation(
        wantsClear ? {} : { countryCode: loc.countryCode, stateId: loc.stateId, countyId: loc.countyId, cityId: loc.cityId }
      ); // throws ApiError(400) on any invalid combination
      locationCols = {
        city: r.cityName,
        county: r.countyName,
        state: r.stateShort,
        country: r.countryName,
        countryCode: r.countryCode,
        stateId: r.stateId,
        countyId: r.countyId,
        cityId: r.cityId,
        // city centroid only — never an exact address; used for the
        // server-side distance scoping that already existed
        lat: r.lat,
        lng: r.lng,
      };
    } else {
      // legacy free-text path — if the text actually changed, the old
      // ids no longer describe it, so drop them rather than lie
      const next = { city: str(body.city, 60), state: str(body.state, 40), county: str(body.county, 60), country: str(body.country, 60) };
      const textChanged = next.city !== p.city || next.state !== p.state || next.county !== p.county || next.country !== p.country;
      locationCols = { ...next, ...(textChanged ? { countryCode: "", stateId: "", countyId: "", cityId: "" } : {}) };
    }

    await db.update(tables.profiles)
      .set({
        displayName: str(body.displayName, 50) || p.displayName,
        bio: str(body.bio, 300),
        // uploaded images are persisted to disk; the DB keeps only the path
        avatarUrl: body.avatarUrl === null ? null : (await storeImage(str(body.avatarUrl, 500_000), "avatar")) || p.avatarUrl,
        coverUrl: body.coverUrl === null ? null : (await storeImage(str(body.coverUrl, 1_500_000), "cover", 1_600_000)) || p.coverUrl,
        coverPos: Number.isFinite(body.coverPos) ? Math.min(100, Math.max(0, Math.round(body.coverPos))) : p.coverPos,
        locationVisibility: ["city", "county", "state", "country", "hidden"].includes(body.locationVisibility)
          ? body.locationVisibility
          : p.locationVisibility,
        ...locationCols,
        primaryRole: str(body.primaryRole, 60),
        additionalRoles: arr(body.additionalRoles),
        skills: arr(body.skills),
        interests: arr(body.interests),
        serviceArea: str(body.serviceArea, 40) || p.serviceArea,
        openToWork: b(body.openToWork, p.openToWork),
        availableFor: arr(body.availableFor),
        availableFrom: str(body.availableFrom, 20),
        workLocation: str(body.workLocation, 20) || p.workLocation,
        minBudget: Number.isFinite(body.minBudget) ? Math.max(0, Math.round(body.minBudget)) : null,
        collabPref: str(body.collabPref, 20) || p.collabPref,
        hiringEnabled: b(body.hiringEnabled, p.hiringEnabled),
        acceptOffers: b(body.acceptOffers, p.acceptOffers),
        acceptBookings: b(body.acceptBookings, p.acceptBookings),
        acceptCollabs: b(body.acceptCollabs, p.acceptCollabs),
        whoCanMessage: ["everyone", "following", "worked", "nobody"].includes(body.whoCanMessage)
          ? body.whoCanMessage
          : p.whoCanMessage,
        visibility: ["public", "members", "private"].includes(body.visibility) ? body.visibility : p.visibility,
        revealIdentityMode: ["keep_anonymous", "show_to_connections", "always_profile"].includes(body.revealIdentityMode)
          ? body.revealIdentityMode
          : p.revealIdentityMode,
        showLocation: b(body.showLocation, p.showLocation),
        showEducation: b(body.showEducation, p.showEducation),
        showFollowers: b(body.showFollowers, p.showFollowers),
        showFollowing: b(body.showFollowing, p.showFollowing),
        showPortfolio: b(body.showPortfolio, p.showPortfolio),
        showCompletedProjects: b(body.showCompletedProjects, p.showCompletedProjects),
        showWorkPerformance: b(body.showWorkPerformance, p.showWorkPerformance),
        showAvailability: b(body.showAvailability, p.showAvailability),
        links: JSON.stringify(
          Array.isArray(body.links)
            ? body.links.slice(0, 12).map((l: { platform?: unknown; url?: unknown }) => ({
                platform: String(l.platform ?? "").slice(0, 30),
                url: String(l.url ?? "").slice(0, 200),
              }))
            : []
        ),
        education: JSON.stringify(
          Array.isArray(body.education)
            ? body.education.slice(0, 8).map((e: { school?: unknown; program?: unknown; gradYear?: unknown }) => ({
                school: String(e.school ?? "").slice(0, 80),
                program: String(e.program ?? "").slice(0, 80),
                gradYear: String(e.gradYear ?? "").slice(0, 10),
              }))
            : [],
        ),
      })
      .where(eq(tables.profiles.userId, user.id))
      .run();

    // experience: full replace with the submitted list (owner's rows only)
    if (Array.isArray(body.experience)) {
      await db.delete(tables.experiences).where(eq(tables.experiences.userId, user.id)).run();
      const xs: { position?: unknown; organization?: unknown; start?: unknown; end?: unknown; description?: unknown; location?: unknown }[] = body.experience.slice(0, 20);
      let xi = 0;
      for (const x of xs) {
        const i = xi++;
        {
          const position = String(x.position ?? "").slice(0, 80);
          const organization = String(x.organization ?? "").slice(0, 80);
          if (!position || !organization) continue;
          await db.insert(tables.experiences)
            .values({
              id: `${user.id.slice(0, 8)}-xp-${Date.now()}-${i}`,
              userId: user.id,
              position,
              organization,
              start: String(x.start ?? "").slice(0, 20),
              end: String(x.end ?? "").slice(0, 20),
              description: String(x.description ?? "").slice(0, 400),
              location: String(x.location ?? "").slice(0, 80),
              order: i,
            })
            .run();
        }
      }
    }

    const u = (await db.select().from(tables.users).where(eq(tables.users.id, user.id)).get())!;
    const profile = (await db.select().from(tables.profiles).where(eq(tables.profiles.userId, user.id)).get())!;
    return ownProfile(u, profile);
  });
}
