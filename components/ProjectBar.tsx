"use client";

import { Check } from "lucide-react";
import type { ProjectStage } from "./ProjectDrawer";

/* Slim project bar above the conversation. The chat stays a chat —
   the project is its own structured thing attached to it. */

const steps = ["Offer", "Accepted", "Paid", "In progress", "Submitted", "Approved", "Complete"] as const;

function stepIndex(stage: ProjectStage): number {
  switch (stage) {
    case "offered":
    case "countered":
      return 0;
    case "agreed":
    case "checkout":
      return 1;
    case "paid":
    case "extension":
      return 3;
    case "submitted":
      return 4;
    case "reviewing":
      return 5;
    case "done":
      return 6;
    default:
      return -1;
  }
}

export default function ProjectBar({
  title,
  amount,
  stage,
  onOpen,
}: {
  title: string;
  amount: number;
  stage: ProjectStage;
  onOpen: () => void;
}) {
  const idx = stepIndex(stage);
  if (idx < 0) return null;

  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 border-b border-line-soft bg-card-raised/60 px-4 py-2.5 text-left transition hover:bg-card-raised"
      aria-label="Open project panel"
    >
      <span className="min-w-0">
        <span className="block truncate font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-lime-400">
          {title}
        </span>
        <span className="mt-1 flex items-center gap-1">
          {steps.map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              <span
                className={`flex items-center gap-1 font-mono text-[9px] font-medium uppercase tracking-tight ${
                  i < idx
                    ? "text-zinc-500"
                    : i === idx
                    ? "text-zinc-100"
                    : "text-zinc-700"
                }`}
              >
                {i < idx && <Check className="h-2.5 w-2.5 text-lime-400" />}
                {i === idx && <span className="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse-dot" />}
                <span className="hidden sm:inline">{s}</span>
              </span>
              {i < steps.length - 1 && <span className="hidden text-zinc-700 sm:inline">→</span>}
            </span>
          ))}
          <span className="ml-1 font-mono text-[9px] text-zinc-500 sm:hidden">
            {steps[idx]}
          </span>
        </span>
      </span>
      <span className="ml-auto shrink-0 text-sm font-bold tabular-nums tracking-tight text-lime-400">
        ${amount}
      </span>
    </button>
  );
}
