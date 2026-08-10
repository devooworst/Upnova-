"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Wrench, Palette, Sparkles } from "lucide-react";
import ProfileHeader from "./ProfileHeader";
import ProfileTabs from "./ProfileTabs";
import DbCreatorProfile from "@/components/db/DbCreatorProfile";
import { useSession } from "@/lib/session";
import { type StudioConfig } from "@/lib/profileStudio";

/**
 * /profile — YOUR profile, rendered from the SAME saved data visitors get.
 *
 * The presentation below is the real public profile component
 * (DbCreatorProfile) reading the saved Profile Studio configuration from
 * the database — never a preview copy that can drift. Customize → Save in
 * Studio → this page (and every visitor) renders it.
 *
 * "Management view" is the optional owner workspace (tabs, publishing
 * tools); it changes what YOU see while working, never what the profile is.
 */
export default function ProfileView() {
  const [management, setManagement] = useState(false);
  const { user } = useSession();

  // studio status for the banner — same endpoint the Studio editor uses
  const [studio, setStudio] = useState<{ cfg: StudioConfig; active: boolean; saved: boolean } | null>(null);
  useEffect(() => {
    if (!user) return;
    fetch("/api/me/studio", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.studio && setStudio({ cfg: d.studio, active: d.active, saved: d.saved }))
      .catch(() => {});
  }, [!!user]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      {/* state bar — ONE Studio entry, one view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-2.5">
        <p className="text-xs text-zinc-400">
          <span className="font-semibold text-zinc-200">This is your profile.</span>{" "}
          {management ? "Management view — visitors never see these tools." : "What you see below is exactly what visitors see."}
        </p>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/profile/studio"
            className="flex items-center gap-1.5 rounded-full border border-lime-400/40 bg-lime-400/5 px-3.5 py-1.5 text-xs font-semibold text-lime-300 transition hover:bg-lime-400/15"
          >
            <Palette className="h-3.5 w-3.5" /> Profile Studio
            <span className="rounded border border-lime-400/40 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-wide">pro</span>
          </Link>
          <button
            onClick={() => setManagement(!management)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              management
                ? "bg-violet-400 text-zinc-950 hover:bg-violet-300"
                : "border border-line text-zinc-300 hover:border-zinc-600 hover:bg-card-raised"
            }`}
          >
            {management ? (
              <>
                <Eye className="h-3.5 w-3.5" /> Back to profile
              </>
            ) : (
              <>
                <Wrench className="h-3.5 w-3.5" /> Management view
              </>
            )}
          </button>
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
        <DbCreatorProfile handle={user.handle} />
      ) : (
        <>
          <ProfileHeader isOwner={true} />
          <ProfileTabs isOwner={true} />
        </>
      )}
    </div>
  );
}
