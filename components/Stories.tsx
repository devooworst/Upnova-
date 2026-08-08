"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, X } from "lucide-react";
import { stories, type Story } from "@/lib/data";

export default function Stories() {
  const [active, setActive] = useState<Story | null>(null);

  return (
    <>
      <section className="card p-4" aria-label="Stories">
        <div className="no-scrollbar flex gap-4 overflow-x-auto pb-1">
          {stories.map((story) => (
            <button
              key={story.id}
              onClick={() => !story.isSelf && setActive(story)}
              className="group flex w-16 shrink-0 flex-col items-center gap-1.5"
            >
              <span
                className={`relative flex h-16 w-16 items-center justify-center rounded-full p-[2.5px] ${
                  story.isSelf ? "bg-line" : "story-ring"
                }`}
              >
                <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-ink p-[2px]">
                  {story.image ? (
                    <span className="relative h-full w-full overflow-hidden rounded-full transition-transform duration-300 group-hover:scale-105">
                      <Image src={story.image} alt={story.name} fill sizes="64px" className="object-cover" />
                    </span>
                  ) : (
                    <span
                      className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br font-display text-lg font-bold text-white ${story.gradient}`}
                    >
                      {story.initials}
                    </span>
                  )}
                </span>
                {story.isSelf && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-ink bg-lime-400 text-zinc-950">
                    <Plus className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center text-[11px] text-zinc-400 group-hover:text-zinc-200">
                {story.name}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Story viewer */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <button
            onClick={() => setActive(null)}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close story"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative aspect-[9/16] w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 animate-fade-up">
            {active.image ? (
              <Image src={active.image} alt={active.name} fill sizes="420px" className="object-cover" />
            ) : (
              <div className={`flex h-full items-center justify-center bg-gradient-to-br ${active.gradient}`}>
                <span className="font-display text-7xl font-bold text-white">{active.initials}</span>
              </div>
            )}
            <div className="absolute inset-x-3 top-3">
              <div className="h-0.5 overflow-hidden rounded-full bg-white/25">
                <div className="h-full w-2/3 rounded-full bg-white" />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
              <p className="font-display text-sm font-semibold text-white">{active.name}</p>
              <p className="text-xs text-white/60">2h ago</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
