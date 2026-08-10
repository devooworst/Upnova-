"use client";

import { useState } from "react";
import Link from "next/link";
import { useEffect } from "react";
import { Eye, PencilLine, Palette, Globe2 } from "lucide-react";
import ProfileHeader from "./ProfileHeader";
import ProfileTabs from "./ProfileTabs";
import DbCreatorProfile from "@/components/db/DbCreatorProfile";
import { useSession } from "@/lib/session";
import { THEMES, type StudioConfig } from "@/lib/profileStudio";

/**
 * Owner vs visitor profile states.
 * You own this profile, so it defaults to the owner view (management
 * controls, no hiring CTAs). The toggle previews exactly what a visitor
 * sees — public portfolio, services, and the Hire Me flow. Once auth
 * exists, isOwner comes from the session instead of this toggle.
 */
export default function ProfileView() {
  const [viewAsVisitor, setViewAsVisitor] = useState(false);
  const isOwner = !viewAsVisitor;
  const { user } = useSession();
  /* ONE source of truth: the same saved config the public page renders.
     The owner view shows the theme + a live banner; the visitor preview
     below renders the ACTUAL public profile component. */
  const [studio, setStudio] = useState<{ cfg: StudioConfig; active: boolean } | null>(null);
  useEffect(() => {
    if (!user) return;
    fetch("/api/me/studio", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.saved && setStudio({ cfg: d.studio, active: d.active }))
      .catch(() => {});
  }, [!!user]); // eslint-disable-line react-hooks/exhaustive-deps
  const theme = studio ? THEMES[studio.cfg.theme] ?? THEMES.none : THEMES.none;

  return (
    <div className="space-y-5">
      {/* state bar */}
      <div
        className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 ${
          isOwner ? "border-line bg-card" : "border-violet-400/30 bg-violet-400/5"
        }`}
      >
        <p className="text-xs text-zinc-400">
          {isOwner ? (
            <>
              <span className="font-semibold text-zinc-200">This is your profile.</span> Visitors
              see the public version with hiring enabled.
            </>
          ) : (
            <>
              <span className="font-semibold text-violet-300">Previewing as a visitor.</span> This
              is what people see before they hire you.
            </>
          )}
        </p>
        {isOwner && user && (
          <Link
            href="/profile/studio"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-lime-400/40 bg-lime-400/5 px-3.5 py-1.5 text-xs font-semibold text-lime-300 transition hover:bg-lime-400/15"
            title="Profile Studio — customize your profile's appearance (UpNova Pro)"
          >
            <Palette className="h-3.5 w-3.5" /> Profile Studio
            <span className="rounded border border-lime-400/40 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-wide">pro</span>
          </Link>
        )}
        <button
          onClick={() => setViewAsVisitor(!viewAsVisitor)}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            isOwner
              ? "border border-line text-zinc-300 hover:border-zinc-600 hover:bg-card-raised"
              : "bg-violet-400 text-zinc-950 hover:bg-violet-300"
          }`}
        >
          {isOwner ? (
            <>
              <Eye className="h-3.5 w-3.5" /> View public profile
            </>
          ) : (
            <>
              <PencilLine className="h-3.5 w-3.5" /> Back to owner view
            </>
          )}
        </button>
      </div>

      {!isOwner && user ? (
        /* visitor preview = the REAL public profile renderer — exactly what
           others see, My World and all. Never a copy that can drift. */
        <DbCreatorProfile handle={user.handle} />
      ) : (
        <div className={`space-y-5 rounded-2xl ${theme.wash} ${theme.wash ? "p-2 sm:p-3" : ""}`}>
          {studio?.active && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-lime-400/25 bg-lime-400/5 px-4 py-2.5">
              <p className="flex items-center gap-2 text-xs text-zinc-300">
                <Globe2 className="h-3.5 w-3.5 text-lime-400" />
                <span>
                  <span className="font-semibold text-lime-300">
                    {studio.cfg.world?.enabled ? "My World is live" : "Your Studio design is live"}
                  </span>{" "}
                  on your public profile — this owner view keeps the management layout.
                </span>
              </p>
              <span className="flex gap-2">
                <button onClick={() => setViewAsVisitor(true)} className="rounded-full border border-line px-3 py-1 text-[11px] font-semibold text-zinc-300 hover:border-zinc-600">
                  See it →
                </button>
                <Link href="/profile/studio" className="rounded-full border border-lime-400/40 bg-lime-400/10 px-3 py-1 text-[11px] font-semibold text-lime-300 hover:bg-lime-400/20">
                  Edit in Studio
                </Link>
              </span>
            </div>
          )}
          <ProfileHeader isOwner={isOwner} />
          <ProfileTabs isOwner={isOwner} />
        </div>
      )}
    </div>
  );
}
