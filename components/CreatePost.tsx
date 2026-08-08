"use client";

import { Image, Briefcase, BarChart2, Radio, Calendar, Sparkles } from "lucide-react";
import Avatar from "./Avatar";
import { currentUser } from "@/lib/data";
import { openCreateModal } from "./CreateModalTrigger";

const actions = [
  { label: "Photo / Video", kind: "Post", icon: Image, color: "text-violet-400" },
  { label: "Opportunity", kind: "Opportunity", icon: Briefcase, color: "text-lime-400" },
  { label: "Service", kind: "Service", icon: Sparkles, color: "text-amber-400" },
  { label: "Poll", kind: "Poll", icon: BarChart2, color: "text-amber-400" },
  { label: "Live", kind: "Live", icon: Radio, color: "text-red-400" },
  { label: "Event", kind: "Event", icon: Calendar, color: "text-emerald-400" },
];

export default function CreatePost() {
  return (
    <section className="card p-4">
      <div className="flex items-center gap-3">
        <Avatar src={currentUser.avatar} initials={currentUser.initials} size="md" />
        <button
          onClick={() => openCreateModal("Post")}
          className="flex-1 rounded-full border border-line bg-card-raised px-4 py-2.5 text-left text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-400"
        >
          What&apos;s on your mind?
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1 border-t border-line-soft pt-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={() => openCreateModal(a.kind)}
            className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-zinc-400 transition hover:bg-card-raised hover:text-zinc-200 sm:text-[13px]"
          >
            <a.icon className={`h-4 w-4 ${a.color}`} />
            <span className="hidden sm:inline">{a.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
