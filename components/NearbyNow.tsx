"use client";

import { Plus } from "lucide-react";
import Avatar from "./Avatar";
import ProfilePreview from "./ProfilePreview";
import { useState } from "react";
import { creators, currentUser, type Creator } from "@/lib/data";

interface Tile {
  id: string;
  name: string;
  avatar?: string | null;
  initials: string;
  gradient: string;
  distance: string;
  line: string;
  role: "person" | "event" | "opportunity" | "self";
  online?: boolean;
}

/* shape follows category: people round, money sharp, events ticket-ish */
const roleShape: Record<Tile["role"], string> = {
  self: "rounded-2xl border-dashed border-line hover:border-white/40",
  person: "rounded-2xl border-line bg-card hover:border-violet-400/40 hover:bg-card-raised",
  event: "rounded-xl border-line bg-card hover:border-amber-400/40 hover:bg-card-raised",
  opportunity:
    "rounded-md border-line border-t-2 border-t-lime-400/70 bg-card hover:border-lime-400/40 hover:bg-card-raised",
};

const roleDot: Record<Tile["role"], string> = {
  person: "bg-violet-400",
  event: "bg-amber-400",
  opportunity: "bg-lime-400",
  self: "bg-white",
};

export default function NearbyNow() {
  const [preview, setPreview] = useState<Creator | null>(null);
  const near = creators.filter((c) => c.distanceMi !== undefined && c.distanceMi <= 40);

  const tiles: Tile[] = [
    {
      id: "you",
      name: "You",
      avatar: currentUser.avatar,
      initials: "D",
      gradient: currentUser.gradient,
      distance: "here",
      line: "Put something out there",
      role: "self",
    },
    ...near.map((c: Creator) => ({
      id: c.id,
      name: c.name.split(" ")[0],
      avatar: c.avatar,
      initials: c.initials,
      gradient: c.gradient,
      distance: `${c.distanceMi} mi`,
      line: c.activity ?? c.availability,
      role: "person" as const,
      online: c.online,
    })),
    {
      id: "meetup",
      name: "Creator Meetup",
      initials: "🤝",
      gradient: "from-amber-500/70 to-orange-800",
      distance: "3.1 mi",
      line: "Sat Aug 22 · 84 going",
      role: "event",
    },
    {
      id: "photo-gig",
      name: "Product Shoot",
      initials: "$",
      gradient: "from-lime-500/80 to-emerald-800",
      distance: "2.1 mi",
      line: "$600 · needs a photographer",
      role: "opportunity",
    },
  ];

  return (
    <section aria-label="Live near you" className="relative">
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1 pr-6">
        {tiles.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              if (t.role === "person") {
                const c = creators.find((cr) => cr.id === t.id);
                if (c) setPreview(c);
              }
            }}
            className={`group card-lift w-56 shrink-0 border p-3 text-left ${roleShape[t.role]}`}
          >
            <span className="flex items-center gap-2.5">
              {t.role === "self" ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-line text-zinc-500">
                  <Plus className="h-4 w-4" />
                </span>
              ) : (
                <span className="relative">
                  <Avatar
                    src={t.avatar}
                    initials={t.initials}
                    gradient={t.gradient}
                    size="xs"
                    className={t.role === "person" ? "" : "!rounded-md"}
                  />
                  {t.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-ink bg-violet-400" />
                  )}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">
                {t.name}
              </span>
              <span
                className={`shrink-0 font-mono text-[10px] font-medium ${
                  t.role === "opportunity" ? "font-semibold text-lime-400" : "text-zinc-500"
                }`}
              >
                {t.distance}
              </span>
            </span>
            <span className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${roleDot[t.role]}`} />
              <span className="truncate">{t.line}</span>
            </span>
          </button>
        ))}
      </div>
      {preview && <ProfilePreview creator={preview} onClose={() => setPreview(null)} />}
      {/* edge fade — partial tiles read as "scroll for more", not clipped */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-ink to-transparent" />
    </section>
  );
}
