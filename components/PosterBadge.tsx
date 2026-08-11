"use client";

/* ------------------------------------------------------------------ */
/*  Poster identity — communicates SOURCE and TRUST, never rank.       */
/*  A creator opportunity can be just as valuable as a business one.   */
/*                                                                     */
/*  Accessibility: every treatment is color + label + icon, so the     */
/*  distinction survives color-blindness, dark/light mode, and quick   */
/*  scanning. Business accent = sky (reserved: lime=money,             */
/*  violet=people, amber=events).                                      */
/*                                                                     */
/*  Verification is EARNED: a business account without verification    */
/*  shows "verification pending" — no subscription buys the badge.     */
/* ------------------------------------------------------------------ */

import { BadgeCheck, Building2, User, MapPin } from "lucide-react";

export type PosterType = "verified_business" | "business_pending" | "creator" | "community";

export function posterTypeOf(u: { accountType?: string; businessVerified?: boolean }): PosterType {
  if (u.accountType === "business") return u.businessVerified ? "verified_business" : "business_pending";
  return "creator";
}

/** Overline label above business opportunity titles. */
export function PosterOverline({ type }: { type: PosterType }) {
  if (type === "verified_business")
    return (
      <p className="mb-1 flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-400">
        <BadgeCheck className="h-3 w-3" /> Verified Business
      </p>
    );
  if (type === "business_pending")
    return (
      <p className="mb-1 flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        <Building2 className="h-3 w-3" /> Business · Verification pending
      </p>
    );
  return null;
}

/** Inline badge next to a poster's name — all four identities. */
export default function PosterBadge({
  type,
  locationLabel,
  size = "sm",
}: {
  type: PosterType;
  locationLabel?: string | null;
  size?: "sm" | "md";
}) {
  const base =
    size === "md"
      ? "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold"
      : "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]";

  switch (type) {
    case "verified_business":
      return (
        <span
          className={`${base} border-sky-400/40 bg-sky-400/10 text-sky-300`}
          title="This organization passed Mavyn's business verification. Verification is earned — never included with a subscription."
        >
          <BadgeCheck className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} /> Verified Business
        </span>
      );
    case "business_pending":
      return (
        <span
          className={`${base} border-line text-zinc-400`}
          title="Business account — Mavyn verification not completed yet."
        >
          <Building2 className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} /> Business · Pending
        </span>
      );
    case "creator":
      return (
        <span className={`${base} border-violet-400/30 text-violet-300/90`} title="Independent creator on Mavyn">
          <User className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} /> Independent Creator
        </span>
      );
    case "community":
      return (
        <span className={`${base} border-line text-zinc-400`} title="Community member">
          <MapPin className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />
          Local Creator{locationLabel ? ` · ${locationLabel.split(",")[0]}` : ""}
        </span>
      );
  }
}
