/* ------------------------------------------------------------------ */
/*  Serialization — the only shapes the API is allowed to return.      */
/*  Public user objects NEVER include email, password hash, exact      */
/*  coordinates, or verification evidence. Privacy toggles are         */
/*  applied here, in one place.                                        */
/* ------------------------------------------------------------------ */

import { tables } from "@/db";

type User = typeof tables.users.$inferSelect;
type Profile = typeof tables.profiles.$inferSelect;

const parse = (s: string): string[] => {
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
};

/** The most precise location the owner chose to share — never more. */
export function locationLabel(profile: Profile): string | null {
  switch (profile.locationVisibility) {
    case "hidden":
      return null;
    case "country":
      return profile.country || null;
    case "state":
      return profile.state || null;
    case "county":
      return profile.county ? `${profile.county}${profile.state ? `, ${profile.state}` : ""}` : profile.state || null;
    default: // city
      return profile.city ? `${profile.city}${profile.state ? `, ${profile.state}` : ""}` : null;
  }
}

export function publicUser(
  user: Pick<User, "id" | "handle"> & Partial<Pick<User, "accountType" | "businessVerified">>,
  profile: Profile,
  opts?: { viewerIsOwner?: boolean }
) {
  const owner = !!opts?.viewerIsOwner;
  const showLoc = owner || (profile.showLocation && profile.locationVisibility !== "hidden");
  return {
    id: user.id,
    handle: user.handle,
    accountType: user.accountType ?? "individual",
    businessVerified: !!user.businessVerified,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    verified: profile.verified,
    primaryRole: profile.primaryRole,
    additionalRoles: parse(profile.additionalRoles),
    roleLine: [profile.primaryRole, ...parse(profile.additionalRoles)].filter(Boolean).join(" · "),
    bio: profile.bio,
    skills: parse(profile.skills),
    // city/state respect the visibility level; locationLabel is the
    // preferred display string for public surfaces
    city: showLoc && profile.locationVisibility === "city" ? profile.city : null,
    state: showLoc && ["city", "county", "state"].includes(profile.locationVisibility) ? profile.state : null,
    locationLabel: showLoc ? locationLabel(profile) : null,
    serviceArea: profile.serviceArea,
    openToWork: profile.openToWork && (owner || profile.showAvailability),
    hiringEnabled: profile.hiringEnabled,
    trustLevel: profile.trustLevel,
    // exact lat/lng deliberately omitted — server-side scoping only
  };
}

/** Full profile — only ever returned to its owner. */
export function ownProfile(user: User, profile: Profile) {
  return {
    id: user.id,
    email: user.email,
    handle: user.handle,
    role: user.role,
    plan: user.plan,
    accountType: user.accountType,
    businessVerified: !!user.businessVerified,
    profile: {
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      coverUrl: profile.coverUrl,
      coverPos: profile.coverPos,
      verified: profile.verified,
      city: profile.city,
      state: profile.state,
      county: profile.county,
      country: profile.country,
      locationVisibility: profile.locationVisibility,
      primaryRole: profile.primaryRole,
      additionalRoles: parse(profile.additionalRoles),
      skills: parse(profile.skills),
      interests: parse(profile.interests),
      serviceArea: profile.serviceArea,
      openToWork: profile.openToWork,
      availableFor: parse(profile.availableFor),
      availableFrom: profile.availableFrom,
      workLocation: profile.workLocation,
      minBudget: profile.minBudget,
      collabPref: profile.collabPref,
      hiringEnabled: profile.hiringEnabled,
      acceptOffers: profile.acceptOffers,
      acceptBookings: profile.acceptBookings,
      acceptCollabs: profile.acceptCollabs,
      whoCanMessage: profile.whoCanMessage,
      visibility: profile.visibility,
      showLocation: profile.showLocation,
      showEducation: profile.showEducation,
      showFollowers: profile.showFollowers,
      showFollowing: profile.showFollowing,
      showPortfolio: profile.showPortfolio,
      showCompletedProjects: profile.showCompletedProjects,
      showWorkPerformance: profile.showWorkPerformance,
      showAvailability: profile.showAvailability,
      links: (() => {
        try {
          return JSON.parse(profile.links);
        } catch {
          return [];
        }
      })(),
      education: (() => {
        try {
          return JSON.parse(profile.education);
        } catch {
          return [];
        }
      })(),
      trustLevel: profile.trustLevel,
    },
  };
}
