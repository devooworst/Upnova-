"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import { useSidebar, closeMobileSidebar } from "@/lib/sidebarStore";

/**
 * Renders the one Sidebar in both responsive forms:
 *   desktop (lg+)  — the classic sticky column; the hamburger collapses
 *                    it smoothly and content takes the width
 *   mobile (<lg)   — hidden by default; the hamburger slides in a drawer
 *                    under the header with a backdrop (tap outside, tap a
 *                    link, or press Escape to close)
 * Same component, same items, same functionality in both forms.
 */
export default function SidebarShell() {
  const { collapsed, mobileOpen } = useSidebar();
  const pathname = usePathname();

  // navigating closes the drawer — links inside it just work
  useEffect(() => {
    closeMobileSidebar();
  }, [pathname]);

  // Escape closes; lock body scroll while the drawer is open
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileSidebar();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <>
      {/* desktop column — collapsible, animated */}
      <Sidebar collapsed={collapsed} />

      {/* mobile backdrop — below the header so the hamburger stays reachable */}
      <div
        className={`fixed inset-x-0 bottom-0 top-16 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeMobileSidebar}
        aria-hidden
      />

      {/* mobile drawer */}
      <div
        className={`fixed bottom-0 left-0 top-16 z-50 w-[17rem] max-w-[85vw] border-r border-line bg-ink shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        aria-hidden={!mobileOpen}
      >
        <Sidebar variant="drawer" />
      </div>
    </>
  );
}
