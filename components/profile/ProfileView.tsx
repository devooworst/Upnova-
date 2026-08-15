"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Eye, Wrench, Palette, Settings2, Sparkles } from "lucide-react";
import ProfileHeader from "./ProfileHeader";
import ProfileTabs from "./ProfileTabs";
import ResponsiveProfile from "@/components/ResponsiveProfile";
import { useSession } from "@/lib/session";
import { type StudioConfig } from "@/lib/profileStudio";

/**
 * /profile — YOUR profile, rendered from the SAME saved data visitors get.
 *
 * The profile itself leads: the page opens with cover → avatar → identity,
 * exactly what a visitor sees (DbCreatorProfile / MobileProfile reading the
 * saved Profile Studio configuration — never a preview copy that can drift).
 *
 * Owner tooling is deliberately COMPACT: one "Manage profile" dropdown in
 * the top-right holding Profile Studio and the Management view toggle. The
 * old full-width explanatory card is gone — it consumed the top of the page
 * and pushed the actual profile down. Profile = "who is this person?", and
 * the answer should start at the first pixel.
 *
 * "Management view" is the optional owner workspace (tabs, publishing
 * tools); it changes what YOU see while working, never what the profile is.
 */
export default function ProfileView() {
  const [management, setManagement] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user } = useSession();

  // studio status for the downgrade notice — same endpoint the Studio editor uses
  const [studio, setStudio] = useState<{ cfg: StudioConfig; active: boolean; saved: boolean } | null>(null);
  useEffect(() => {
    if (!user) return;
    fetch("/api/me/studio", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.studio && setStudio({ cfg: d.studio, active: d.active, saved: d.saved }))
      .catch(() => {});
  }, [!!user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="space-y-4">
      {/* compact owner controls — a slim right-aligned row, not a card.
          In management view it also names the mode, honestly. */}
      <div className="flex items-center justify-end gap-3 px-1">
        {management && (
          <p className="min-w-0 flex-1 truncate text-xs text-zinc-500">
            <span className="font-semibold text-violet-300">Management view</span> — visitors never see these tools.
          </p>
        )}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            data-guide="profile-manage"
            className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
          >
            <Settings2 className="h-3.5 w-3.5" /> Manage profile
            <ChevronDown className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-card shadow-2xl animate-fade-up">
              <p className="border-b border-line-soft px-4 pb-2 pt-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                owner tools
              </p>
              <Link
                href="/profile/studio"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-3 text-sm text-zinc-300 transition hover:bg-card-raised"
              >
                <Palette className="h-4 w-4 text-lime-300" /> Profile Studio
                <span className="ml-auto rounded border border-lime-400/40 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-wide text-lime-300">pro</span>
              </Link>
              <button
                onClick={() => { setManagement(!management); setMenuOpen(false); }}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm text-zinc-300 transition hover:bg-card-raised"
              >
                {management ? (
                  <>
                    <Eye className="h-4 w-4 text-zinc-400" /> Back to profile
                  </>
                ) : (
                  <>
                    <Wrench className="h-4 w-4 text-violet-300" /> Management view
                  </>
                )}
              </button>
              <p className="border-t border-line-soft px-4 py-2.5 text-[11px] leading-relaxed text-zinc-500">
                What you see below is exactly what visitors see.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* saved-but-inactive is the only banner worth showing (downgrade case) */}
      {!management && studio?.saved && !studio.active && (
        <p className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-xs text-zinc-400">
          <Sparkles className="h-3.5 w-3.5 text-zinc-500" />
          Your Studio design is saved but inactive on your current plan — it returns the moment you upgrade.
        </p>
      )}

      {management ? (
        <>
          <ProfileHeader isOwner={true} />
          <ProfileTabs isOwner={true} />
        </>
      ) : user ? (
        /* THE profile — the same component, same API, same saved
           customization every visitor renders */
        <ResponsiveProfile handle={user.handle} />
      ) : (
        <>
          <ProfileHeader isOwner={true} />
          <ProfileTabs isOwner={true} />
        </>
      )}
    </div>
  );
}
