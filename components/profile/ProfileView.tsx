"use client";

import { useState } from "react";
import { Eye, PencilLine } from "lucide-react";
import ProfileHeader from "./ProfileHeader";
import ProfileTabs from "./ProfileTabs";

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

      <ProfileHeader isOwner={isOwner} />
      <ProfileTabs isOwner={isOwner} />
    </div>
  );
}
