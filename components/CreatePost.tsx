"use client";

import { Image, Briefcase, BarChart2, Radio, Calendar, Sparkles } from "lucide-react";
import Avatar from "./Avatar";
import { currentUser } from "@/lib/data";
import { openCreateModal } from "./CreateModalTrigger";

/* icon colors follow the accent-role system:
   lime = money (Opportunity, Service) · violet = people/content (Post, Poll)
   amber = events · red = live                                             */
const actions = [
  { label: "Photo / Video", kind: "Post", icon: Image, color: "text-violet-400" },
  { label: "Opportunity", kind: "Opportunity", icon: Briefcase, color: "text-lime-400" },
  { label: "Service", kind: "Service", icon: Sparkles, color: "text-lime-400" },
  { label: "Poll", kind: "Poll", icon: BarChart2, color: "text-violet-400" },
  { label: "Event", kind: "Event", icon: Calendar, color: "text-amber-400" },
  { label: "Live", kind: "Live", icon: Radio, color: "text-red-400" },
];

/** Unboxed composer — a row in the page, not another card. */
export default function CreatePost() {
  return (
    <section className="flex items-center gap-3 border-y border-line-soft py-3">
      <Avatar src={currentUser.avatar} initials={currentUser.initials} size="sm" />
      <button
        onClick={() => openCreateModal("Post")}
        className="min-w-0 flex-1 truncate rounded-full border border-line bg-card px-4 py-2 text-left text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-400"
      >
        What&apos;s happening near you?
      </button>
      <div className="flex shrink-0 items-center">
        {actions.map((a, i) => (
          <button
            key={a.label}
            onClick={() => openCreateModal(a.kind)}
            title={a.label}
            aria-label={a.label}
            className={`items-center justify-center rounded-full p-2 transition hover:bg-card-raised ${
              i > 2 ? "hidden md:flex" : "flex"
            }`}
          >
            <a.icon className={`h-[18px] w-[18px] ${a.color}`} />
          </button>
        ))}
      </div>
    </section>
  );
}
