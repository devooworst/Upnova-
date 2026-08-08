"use client";

/* ------------------------------------------------------------------ */
/*  Profile store — API-backed.                                        */
/*                                                                     */
/*  Same ProfileData shape the UI already speaks, but the source of    */
/*  truth is now the database via /api/auth/me and /api/me/profile.    */
/*  localStorage is no longer involved: log in as a different user     */
/*  and every surface renders THAT user's record.                      */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import type { SessionUser } from "./session";

export const PROFILE_EVENT = "upnova:profile-changed";

/* ------------------------------- types ------------------------------- */

export interface ExperienceEntry {
  id: string;
  position: string;
  organization: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
}

export interface EducationEntry {
  id: string;
  school: string;
  program: string;
  gradYear?: string;
}

export interface SocialLink {
  id: string;
  platform: string;
  url: string;
}

export type ServiceArea = "5 miles" | "25 miles" | "50 miles" | "City" | "State" | "Remote" | "Custom";

export interface ProfileData {
  displayName: string;
  username: string;
  bio: string;
  city: string;
  state: string;
  country: string;
  serviceArea: string;
  serviceAreaCustom: string;
  avatar: string | null;
  cover: string | null;
  coverPos: number;

  primaryRole: string;
  additionalRoles: string[];
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  workInPortfolio: string[];

  openToWork: boolean;
  availableFor: string[];
  availabilityMode: "now" | "from";
  availableFrom: string;
  interests: string[];
  workLocation: string;
  minBudget: string;
  collabPref: string;

  hiringEnabled: boolean;
  acceptOffers: boolean;
  acceptBookings: boolean;
  acceptCollabs: boolean;
  whoCanMessage: string;
  allowProjectRequests: boolean;
  allowServiceRequests: boolean;
  allowCollabRequests: boolean;

  links: SocialLink[];

  visibility: string;
  showLocation: boolean;
  showEducation: boolean;
  showFollowers: boolean;
  showFollowing: boolean;
  showPortfolio: boolean;
  showCompletedProjects: boolean;
  showWorkPerformance: boolean;
  showAvailability: boolean;
}

export const DEFAULT_PROFILE: ProfileData = {
  displayName: "",
  username: "",
  bio: "",
  city: "",
  state: "",
  country: "",
  serviceArea: "25 miles",
  serviceAreaCustom: "",
  avatar: null,
  cover: null,
  coverPos: 50,
  primaryRole: "",
  additionalRoles: [],
  skills: [],
  experience: [],
  education: [],
  workInPortfolio: [],
  openToWork: true,
  availableFor: [],
  availabilityMode: "now",
  availableFrom: "",
  interests: [],
  workLocation: "Hybrid",
  minBudget: "",
  collabPref: "Either",
  hiringEnabled: true,
  acceptOffers: true,
  acceptBookings: true,
  acceptCollabs: true,
  whoCanMessage: "everyone",
  allowProjectRequests: true,
  allowServiceRequests: true,
  allowCollabRequests: true,
  links: [],
  visibility: "public",
  showLocation: true,
  showEducation: true,
  showFollowers: true,
  showFollowing: true,
  showPortfolio: true,
  showCompletedProjects: true,
  showWorkPerformance: true,
  showAvailability: true,
};

/* ------------------------------ mapping ------------------------------ */

type MeResponse = SessionUser & { experience?: (ExperienceEntry & { order?: number })[] };

function fromApi(user: MeResponse): ProfileData {
  const p = user.profile;
  return {
    displayName: p.displayName,
    username: user.handle,
    bio: p.bio,
    city: p.city,
    state: p.state,
    country: p.country,
    serviceArea: p.serviceArea,
    serviceAreaCustom: "",
    avatar: p.avatarUrl,
    cover: p.coverUrl,
    coverPos: p.coverPos,
    primaryRole: p.primaryRole,
    additionalRoles: p.additionalRoles,
    skills: p.skills,
    experience: (user.experience ?? []).map((x) => ({
      id: x.id,
      position: x.position,
      organization: x.organization,
      start: x.start,
      end: x.end,
      description: x.description,
      location: x.location,
    })),
    education: (p.education ?? []).map((e, i) => ({ id: `edu-${i}`, ...e })),
    workInPortfolio: [],
    openToWork: p.openToWork,
    availableFor: p.availableFor,
    availabilityMode: p.availableFrom ? "from" : "now",
    availableFrom: p.availableFrom,
    interests: p.interests,
    workLocation: p.workLocation,
    minBudget: p.minBudget != null ? String(p.minBudget) : "",
    collabPref: p.collabPref,
    hiringEnabled: p.hiringEnabled,
    acceptOffers: p.acceptOffers,
    acceptBookings: p.acceptBookings,
    acceptCollabs: p.acceptCollabs,
    whoCanMessage: p.whoCanMessage,
    // contact-permission toggles are backed by the same accept* columns
    allowProjectRequests: p.acceptOffers,
    allowServiceRequests: p.acceptBookings,
    allowCollabRequests: p.acceptCollabs,
    links: p.links.map((l, i) => ({ id: `lnk-${i}`, platform: l.platform, url: l.url })),
    visibility: p.visibility,
    showLocation: p.showLocation,
    showEducation: p.showEducation,
    showFollowers: p.showFollowers,
    showFollowing: p.showFollowing,
    showPortfolio: p.showPortfolio,
    showCompletedProjects: p.showCompletedProjects,
    showWorkPerformance: p.showWorkPerformance,
    showAvailability: p.showAvailability,
  };
}

function toApi(d: ProfileData) {
  return {
    displayName: d.displayName,
    bio: d.bio,
    avatarUrl: d.avatar,
    coverUrl: d.cover,
    coverPos: d.coverPos,
    city: d.city,
    state: d.state,
    country: d.country,
    serviceArea: d.serviceArea,
    primaryRole: d.primaryRole,
    additionalRoles: d.additionalRoles,
    skills: d.skills,
    interests: d.interests,
    openToWork: d.openToWork,
    availableFor: d.availableFor,
    availableFrom: d.availabilityMode === "from" ? d.availableFrom : "",
    workLocation: d.workLocation,
    minBudget: d.minBudget ? Number(d.minBudget) : undefined,
    collabPref: d.collabPref,
    hiringEnabled: d.hiringEnabled,
    acceptOffers: d.acceptOffers && d.allowProjectRequests,
    acceptBookings: d.acceptBookings && d.allowServiceRequests,
    acceptCollabs: d.acceptCollabs && d.allowCollabRequests,
    whoCanMessage: d.whoCanMessage,
    visibility: d.visibility,
    showLocation: d.showLocation,
    showEducation: d.showEducation,
    showFollowers: d.showFollowers,
    showFollowing: d.showFollowing,
    showPortfolio: d.showPortfolio,
    showCompletedProjects: d.showCompletedProjects,
    showWorkPerformance: d.showWorkPerformance,
    showAvailability: d.showAvailability,
    links: d.links.map((l) => ({ platform: l.platform, url: l.url })),
    education: d.education.map((e) => ({ school: e.school, program: e.program, gradYear: e.gradYear ?? "" })),
    experience: d.experience.map((x) => ({
      position: x.position,
      organization: x.organization,
      start: x.start,
      end: x.end,
      description: x.description ?? "",
      location: x.location ?? "",
    })),
  };
}

/* ------------------------------- store ------------------------------- */

let cache: ProfileData | null = null;
let loggedOut = false;

export async function loadProfile(force = false): Promise<ProfileData | null> {
  if (cache && !force) return cache;
  const res = await fetch("/api/auth/me", { cache: "no-store" });
  const data = await res.json();
  if (!data.user) {
    loggedOut = true;
    cache = null;
    return null;
  }
  loggedOut = false;
  cache = fromApi(data.user);
  window.dispatchEvent(new Event(PROFILE_EVENT));
  return cache;
}

/** Synchronous read of the last loaded profile (defaults until loaded). */
export function getProfile(): ProfileData {
  return cache ?? DEFAULT_PROFILE;
}

export function isLoggedOut() {
  return loggedOut;
}

/** Persist to the database, then refresh every subscriber. */
export async function saveProfile(p: ProfileData): Promise<boolean> {
  const res = await fetch("/api/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toApi(p)),
  });
  if (!res.ok) return false;
  await loadProfile(true);
  return true;
}

/** Live subscription — refetches when anything saves. */
export function useProfile(): ProfileData {
  const [profile, setProfile] = useState<ProfileData>(cache ?? DEFAULT_PROFILE);
  useEffect(() => {
    const sync = () => setProfile(cache ?? DEFAULT_PROFILE);
    window.addEventListener(PROFILE_EVENT, sync);
    loadProfile().then(sync);
    return () => window.removeEventListener(PROFILE_EVENT, sync);
  }, []);
  return profile;
}

/* ------------------------------- helpers ------------------------------- */

export function roleLine(p: ProfileData): string {
  return [p.primaryRole, ...p.additionalRoles].filter(Boolean).join(" · ");
}

export function locationLine(p: ProfileData): string {
  return [p.city, p.state].filter(Boolean).join(", ");
}

export type UsernameStatus = "current" | "available" | "unavailable" | "invalid";

/** Local format check only — real availability is enforced by the API. */
export function checkUsername(name: string, current: string): UsernameStatus {
  const n = name.trim().toLowerCase().replace(/^@/, "");
  if (n === current.toLowerCase()) return "current";
  if (!/^[a-z0-9_.]{3,20}$/.test(n)) return "invalid";
  return "available";
}
