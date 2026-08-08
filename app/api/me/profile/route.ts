import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";
import { ownProfile } from "@/lib/server/serialize";

export const dynamic = "force-dynamic";

/** PATCH /api/me/profile — the Edit Profile save path. Owner-only by construction. */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();

    const str = (v: unknown, max = 500) => String(v ?? "").slice(0, max);
    const arr = (v: unknown) => JSON.stringify(Array.isArray(v) ? v.slice(0, 40).map((x) => String(x).slice(0, 80)) : []);
    const b = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);
    const p = user.profile;

    db.update(tables.profiles)
      .set({
        displayName: str(body.displayName, 50) || p.displayName,
        bio: str(body.bio, 300),
        avatarUrl: body.avatarUrl === null ? null : str(body.avatarUrl, 500_000) || p.avatarUrl,
        coverUrl: body.coverUrl === null ? null : str(body.coverUrl, 1_500_000) || p.coverUrl,
        coverPos: Number.isFinite(body.coverPos) ? Math.min(100, Math.max(0, Math.round(body.coverPos))) : p.coverPos,
        locationVisibility: ["city", "county", "state", "country", "hidden"].includes(body.locationVisibility)
          ? body.locationVisibility
          : p.locationVisibility,
        city: str(body.city, 60),
        state: str(body.state, 40),
        county: str(body.county, 60),
        country: str(body.country, 60),
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
      db.delete(tables.experiences).where(eq(tables.experiences.userId, user.id)).run();
      body.experience.slice(0, 20).forEach(
        (
          x: { position?: unknown; organization?: unknown; start?: unknown; end?: unknown; description?: unknown; location?: unknown },
          i: number
        ) => {
          const position = String(x.position ?? "").slice(0, 80);
          const organization = String(x.organization ?? "").slice(0, 80);
          if (!position || !organization) return;
          db.insert(tables.experiences)
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
      );
    }

    const u = db.select().from(tables.users).where(eq(tables.users.id, user.id)).get()!;
    const profile = db.select().from(tables.profiles).where(eq(tables.profiles.userId, user.id)).get()!;
    return ownProfile(u, profile);
  });
}
