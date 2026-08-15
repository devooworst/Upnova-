"use client";

/* ------------------------------------------------------------------ */
/* Sidebar open/collapse — one tiny module store, breakpoint-aware:    */
/*   desktop (lg+)  — sidebar visible by default; the hamburger        */
/*                    collapses it (persisted per device)              */
/*   mobile (<lg)   — sidebar hidden by default; the hamburger opens   */
/*                    a slide-in drawer with a backdrop                */
/* Pure UI state: no navigation items, permissions, or auth involved.  */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";

const EVT = "mavyn:sidebar-changed";
const LS_KEY = "mavyn-sidebar-collapsed";

let collapsed = false; // desktop
let mobileOpen = false; // mobile drawer
let hydrated = false;

function emit() {
  window.dispatchEvent(new Event(EVT));
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    collapsed = window.localStorage.getItem(LS_KEY) === "1";
  } catch {
    /* storage may be blocked — default stays visible */
  }
}

export function toggleSidebar() {
  hydrate();
  if (window.matchMedia("(min-width: 1024px)").matches) {
    collapsed = !collapsed;
    try {
      window.localStorage.setItem(LS_KEY, collapsed ? "1" : "0");
    } catch {
      /* non-fatal */
    }
  } else {
    mobileOpen = !mobileOpen;
  }
  emit();
}

export function closeMobileSidebar() {
  if (!mobileOpen) return;
  mobileOpen = false;
  emit();
}

export function useSidebar() {
  const [state, setState] = useState({ collapsed: false, mobileOpen: false });
  useEffect(() => {
    hydrate();
    const sync = () => setState({ collapsed, mobileOpen });
    sync(); // post-hydration: apply the persisted desktop preference
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);
  return state;
}
