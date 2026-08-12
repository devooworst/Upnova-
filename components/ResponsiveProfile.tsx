"use client";

/* ------------------------------------------------------------------ */
/*  ResponsiveProfile — ONE decision point for which profile renders.  */
/*                                                                     */
/*  ≥ lg (1024px): DbCreatorProfile — the established desktop          */
/*                 experience, byte-for-byte untouched.                */
/*  <  lg:         MobileProfile — the phone/tablet presentation.      */
/*                                                                     */
/*  The choice is made AFTER hydration via matchMedia (the same        */
/*  deterministic-first-render pattern as useHydrated) so exactly ONE  */
/*  component mounts and fetches — never both, never a mismatch.       */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import DbCreatorProfile from "@/components/db/DbCreatorProfile";
import MobileProfile from "@/components/MobileProfile";

export function useIsDesktop(): boolean | null {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

export default function ResponsiveProfile({ handle }: { handle: string }) {
  const isDesktop = useIsDesktop();
  if (isDesktop === null)
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="h-36 animate-pulse rounded-2xl bg-card" />
        <div className="h-44 animate-pulse rounded-2xl bg-card" />
      </div>
    );
  return isDesktop ? <DbCreatorProfile handle={handle} /> : <MobileProfile handle={handle} />;
}
