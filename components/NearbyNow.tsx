"use client";

import Image from "next/image";
import { Plus } from "lucide-react";
import Avatar from "./Avatar";
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

const roleDot: Record<Tile["role"], string> = {
  person: "bg-violet-400",
  event: "bg-amber-400",
  opportunity: "bg-lime-400",
  self: "bg-white",
};

export default function NearbyNow() {
  const near = creators.filter((c) => c.distanceMi !== undefined && c.distanceMi <= 40);

  const tiles: Tile[] = [
    {
      id: "you",
      name: "You",
      avatar: currentUser.avatar,
      initials: "D",
      gradient: currentUser.gradient,
      distance: "here",
      line: "Share what's happening",
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
      gradient: "from-lime-500/70 to-emerald-800",
      distance: "3.1 mi",
      line: "Sat Aug 22 • 84 going",
      role: "event",
    },
    {
      id: "photo-gig",
      name: "Product Shoot",
      initials: "$",
      gradient: "from-teal-600 to-emerald-700",
      distance: "2.1 mi",
      line: "$600 gig • needs a photographer",
      role: "opportunity",
    },
  ];

  return (
    <section aria-label="Live near you">
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
        {tiles.map((t) => (
          <button
            key={t.id}
            className={`group w-52 shrink-0 rounded-xl border p-3 text-left transition ${
              t.role === "self"
                ? "border-dashed border-line hover:border-white/40"
                : "border-line bg-card hover:border-white/25 hover:bg-card-raised"
            }`}
          >
            <span className="flex items-center gap-2.5">
              {t.role === "self" ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-dashed border-line text-zinc-500">
                  <Plus className="h-4 w-4" />
                </span>
              ) : (
                <span className="relative">
                  <Avatar src={t.avatar} initials={t.initials} gradient={t.gradient} size="xs" className="!rounded-lg" />
                  {t.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-ink bg-violet-400" />
                  )}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">
                {t.name}
              </span>
              <span className="shrink-0 font-mono text-[10px] tracking-tight text-zinc-500">
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
    </section>
  );
}
