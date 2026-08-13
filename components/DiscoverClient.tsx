"use client";

/* ------------------------------------------------------------------ */
/*  Discover — search people + explore the Mavyn ecosystem.            */
/*                                                                     */
/*  One surface at every width. No category tabs, no filter sidebar:   */
/*  intentional navigation to Opportunities / Services / Shop / Works  */
/*  / Bookings / Clients / Activity / Analytics lives in the sidebar,  */
/*  and Discover refuses to duplicate it. The old desktop version of   */
/*  this page (Creators/Services/… tabs over hardcoded lib/data with   */
/*  a dead search box) is gone — DiscoverGrid is real data end to end. */
/* ------------------------------------------------------------------ */

import DiscoverGrid from "@/components/DiscoverGrid";

export default function DiscoverClient() {
  return (
    <div className="space-y-5">
      <header className="px-1">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Discover</h1>
        <p className="mt-1 hidden text-sm text-zinc-500 sm:block">
          Search for anyone, or explore everything happening on Mavyn.
        </p>
      </header>
      <DiscoverGrid />
    </div>
  );
}
