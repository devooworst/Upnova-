/* ------------------------------------------------------------------ */
/*  Profile store — the single source of truth for the current user's  */
/*  editable identity.                                                 */
/*                                                                     */
/*  Three kinds of information live on a profile, deliberately kept    */
/*  separate:                                                          */
/*    1. User-controlled   → everything in ProfileData (this file)     */
/*    2. Platform-verified → student status, identity trust (lib/pro)  */
/*    3. Platform-calculated → reliability, response time (lib/data)   */
/*                                                                     */
/*  Edit Profile only ever writes category 1. Categories 2 and 3 are   */
/*  displayed read-only with an explanation of where they come from.   */
/*                                                                     */
/*  Saving here updates every surface that reads the store: the        */
/*  public profile header, About tab, visitor preview, services list,  */
/*  and portfolio toggles — one record, many views.                    */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { workRecords } from "./data";

export const PROFILE_EVENT = "upnova:profile-changed";
const KEY = "upnova-profile";

/* ------------------------------- types ------------------------------- */

export interface ExperienceEntry {
  id: string;
  position: string;
  organization: string;
  start: string; // "2023"
  end: string; // "" = Present
  description?: string;
  location?: string;
}

export interface EducationEntry {
  id: string;
  school: string;
  program: string;
  gradYear?: string; // optional expected graduation
}

export interface SocialLink {
  id: string;
  platform: string;
  url: string;
}

export type ServiceArea = "5 miles" | "25 miles" | "50 miles" | "City" | "State" | "Remote" | "Custom";
export type WorkLocationPref = "Local" | "Remote" | "Hybrid";
export type CollabPref = "Paid" | "Collaboration" | "Either";
export type MessagePermission = "everyone" | "following" | "worked" | "nobody";
export type Visibility = "public" | "members" | "private";

export interface ServiceOverride {
  paused?: boolean;
  removed?: boolean;
  startingAt?: number;
}

export interface ProfileData {
  /* -- Profile -- */
  displayName: string;
  username: string;
  bio: string;
  city: string;
  state: string;
  country: string;
  serviceArea: ServiceArea;
  serviceAreaCustom: string;
  /** image path or data URL; null → initials tile */
  avatar: string | null;
  cover: string | null;
  /** vertical focal point of the cover, 0–100 (reposition) */
  coverPos: number;

  /* -- Professional -- */
  primaryRole: string;
  additionalRoles: string[];
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  /** work-record ids the creator chose to show in their portfolio */
  workInPortfolio: string[];

  /* -- Work -- */
  serviceOverrides: Record<string, ServiceOverride>;
  openToWork: boolean;
  availableFor: string[];
  availabilityMode: "now" | "from";
  availableFrom: string; // date string when mode = "from"
  interests: string[];
  workLocation: WorkLocationPref;
  minBudget: string; // optional, "" = none
  collabPref: CollabPref;

  /* -- Hiring & contact -- */
  hiringEnabled: boolean;
  acceptOffers: boolean;
  acceptBookings: boolean;
  acceptCollabs: boolean;
  whoCanMessage: MessagePermission;
  allowProjectRequests: boolean;
  allowServiceRequests: boolean;
  allowCollabRequests: boolean;

  /* -- Links -- */
  links: SocialLink[];

  /* -- Privacy -- */
  visibility: Visibility;
  showLocation: boolean;
  showEducation: boolean;
  showFollowers: boolean;
  showFollowing: boolean;
  showPortfolio: boolean;
  showCompletedProjects: boolean;
  showWorkPerformance: boolean;
  showAvailability: boolean;
}

/* ------------------------------ defaults ------------------------------ */

export const DEFAULT_PROFILE: ProfileData = {
  displayName: "Devin Carter",
  username: "devin",
  bio: "Building opportunities for creators through music, content, and collaboration. I help artists and brands connect and make things people remember.",
  city: "Baltimore",
  state: "MD",
  country: "United States",
  serviceArea: "25 miles",
  serviceAreaCustom: "",
  avatar: "/images/devin.jpg",
  cover: "/images/banner.jpg",
  coverPos: 50,

  primaryRole: "Music Producer",
  additionalRoles: ["Content Creator", "Entrepreneur"],
  skills: ["Mixing", "Mastering", "Beat Production", "Vocal Production", "Sound Design", "Video Editing"],
  experience: [
    {
      id: "xp-1",
      position: "Music Producer",
      organization: "Independent",
      start: "2021",
      end: "",
      description: "80+ releases produced for independent artists.",
      location: "Baltimore, MD",
    },
    {
      id: "xp-2",
      position: "Brand Collaborations",
      organization: "Nike, Spotify & independent brands",
      start: "2022",
      end: "",
      description: "Campaign audio and content for 12+ brands.",
    },
    {
      id: "xp-3",
      position: "Freelance Video Editor",
      organization: "Self-employed",
      start: "2020",
      end: "",
      description: "Reels, music videos, and recap films for creators and events.",
    },
  ],
  education: [{ id: "edu-1", school: "Bowie State University", program: "Cybersecurity", gradYear: "2027" }],
  workInPortfolio: workRecords.filter((w) => w.inPortfolio).map((w) => w.id),

  serviceOverrides: {},
  openToWork: true,
  availableFor: ["Freelance", "Projects", "Collaborations", "Gigs", "Brand partnerships"],
  availabilityMode: "now",
  availableFrom: "",
  interests: ["Music", "Photography", "Brands", "Events", "Technology"],
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

  links: [
    { id: "lnk-1", platform: "Instagram", url: "instagram.com/devincarter" },
    { id: "lnk-2", platform: "YouTube", url: "youtube.com/@devincarter" },
    { id: "lnk-3", platform: "Spotify", url: "open.spotify.com/artist/devincarter" },
  ],

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

/* ------------------------------- storage ------------------------------- */

export function getProfile(): ProfileData {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw);
    // merge so new fields added later never break old saved profiles
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(p: ProfileData) {
  window.localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new Event(PROFILE_EVENT));
}

/** Live subscription — re-renders when the profile changes anywhere. */
export function useProfile(): ProfileData {
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  useEffect(() => {
    const sync = () => setProfile(getProfile());
    sync();
    window.addEventListener(PROFILE_EVENT, sync);
    return () => window.removeEventListener(PROFILE_EVENT, sync);
  }, []);
  return profile;
}

/* ------------------------------- helpers ------------------------------- */

/** "Music Producer · Audio Engineer · Songwriter" */
export function roleLine(p: ProfileData): string {
  return [p.primaryRole, ...p.additionalRoles].filter(Boolean).join(" · ");
}

export function locationLine(p: ProfileData): string {
  return [p.city, p.state].filter(Boolean).join(", ");
}

/** Usernames already claimed on the platform — powers the availability check. */
export const TAKEN_USERNAMES = [
  "jordan",
  "jordanmiles",
  "ava",
  "avachen",
  "marcus",
  "marcusj",
  "nia",
  "lena",
  "maya",
  "sony",
  "nike",
  "upnova",
  "admin",
];

export type UsernameStatus = "current" | "available" | "unavailable" | "invalid";

export function checkUsername(name: string, current: string): UsernameStatus {
  const n = name.trim().toLowerCase().replace(/^@/, "");
  if (n === current.toLowerCase()) return "current";
  if (!/^[a-z0-9_.]{3,20}$/.test(n)) return "invalid";
  if (TAKEN_USERNAMES.includes(n)) return "unavailable";
  return "available";
}
