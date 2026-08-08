"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Lock, X, Zap } from "lucide-react";
import Avatar from "./Avatar";
import Perforation from "./Perforation";
import { feeFor, totalFor, money, PLATFORM_FEE_RATE } from "@/lib/fees";
import type { CatalogService, Creator } from "@/lib/data";

/* The hiring screen: structure the ask BEFORE the conversation starts.
   Service → Hire Me → this form → Continue to Message → project flow. */

const needsByCategory: Record<string, string[]> = {
  Music: ["Beat production", "Recording", "Mixing", "Full production", "Custom project"],
  Video: ["Short-form edit", "Long-form edit", "Color grade", "Full post-production", "Custom project"],
  Photography: ["Portrait session", "Event coverage", "Product shoot", "Full-day coverage", "Custom project"],
  Design: ["Logo", "Cover art", "Full brand identity", "Motion graphics", "Custom project"],
  Fashion: ["Single look", "Lookbook content", "Drop campaign", "Custom project"],
  Writing: ["Hook / topline", "Full lyrics", "Co-writing session", "Custom project"],
};

interface HireModalProps {
  creator: Creator;
  service: CatalogService;
  onClose: () => void;
}

export default function HireModal({ creator, service, onClose }: HireModalProps) {
  const router = useRouter();
  const options = needsByCategory[service.category] ?? ["Standard package", "Custom project"];
  const [need, setNeed] = useState(options[0]);
  const [desc, setDesc] = useState("");
  const [deadline, setDeadline] = useState("");
  const [budget, setBudget] = useState(service.startingAt);
  const [aiReq, setAiReq] = useState("🔴 Not allowed");

  const price = Math.max(budget || 0, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="card-money max-h-[90dvh] w-full max-w-md overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar src={creator.avatar} initials={creator.initials} gradient={creator.gradient} size="md" className="ring-1 ring-line" />
            <div>
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">
                Hire {creator.name}
              </h2>
              <p className="text-xs text-zinc-500">
                {service.title} · starting at{" "}
                <span className="font-bold tabular-nums text-lime-400">${service.startingAt}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn h-8 w-8" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* what do you need */}
        <div className="mt-4">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
            What do you need?
          </p>
          <div className="mt-1.5 space-y-1.5">
            {options.map((o) => (
              <label
                key={o}
                className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition ${
                  need === o
                    ? "border-lime-400/50 bg-lime-400/5 text-zinc-100"
                    : "border-line bg-card-raised text-zinc-300 hover:border-zinc-600"
                }`}
              >
                <input type="radio" checked={need === o} onChange={() => setNeed(o)} className="accent-lime-400" />
                {o}
              </label>
            ))}
          </div>
        </div>

        {/* description */}
        <div className="mt-3">
          <label htmlFor="hire-desc" className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
            Project description
          </label>
          <textarea
            id="hire-desc"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            placeholder={`Tell ${creator.name.split(" ")[0]} what you're looking for…`}
            className="input-dark mt-1.5 resize-none"
          />
        </div>

        <div className="mt-3 flex gap-3">
          <div className="flex-1">
            <label htmlFor="hire-deadline" className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
              Desired deadline
            </label>
            <div className="relative mt-1.5">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                id="hire-deadline"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                placeholder="Sep 12"
                className="input-dark pl-9"
              />
            </div>
          </div>
          <div className="flex-1">
            <label htmlFor="hire-budget" className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
              Budget
            </label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
              <input
                id="hire-budget"
                value={budget || ""}
                onChange={(e) => setBudget(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                inputMode="numeric"
                className="input-dark pl-7 tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* creative requirements — part of the agreement from minute one */}
        <div className="mt-3">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
            AI-generated work
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {["🔴 Not allowed", "🟡 Allowed with disclosure", "🟢 Allowed"].map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setAiReq(o)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  aiReq === o
                    ? "border-zinc-400 bg-white/10 text-zinc-100"
                    : "border-line text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {o}
              </button>
            ))}
          </div>
          {aiReq === "🔴 Not allowed" && (
            <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
              Work must be created by the hired creator without undisclosed AI-generated material.
              This becomes part of the project agreement.
            </p>
          )}
        </div>

        {/* estimated total — the fee is visible before anyone talks */}
        <Perforation className="mt-4" />
        <div className="mt-3.5 space-y-1.5 text-sm">
          <p className="flex justify-between text-zinc-400">
            <span>Creator price</span>
            <span className="font-bold tabular-nums text-zinc-100">{money(price)}</span>
          </p>
          <p className="flex justify-between text-xs text-zinc-500">
            <span>UpNova service fee ({PLATFORM_FEE_RATE * 100}%)</span>
            <span className="tabular-nums">{money(feeFor(price))}</span>
          </p>
          <p className="flex justify-between border-t border-line-soft pt-2 text-zinc-300">
            <span className="text-xs">Estimated total</span>
            <span className="text-lg font-extrabold tracking-tight tabular-nums text-lime-400">
              {money(totalFor(price))}
            </span>
          </p>
        </div>
        <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] font-medium text-zinc-500">
          <Lock className="h-3 w-3" /> secure payment · nothing is charged until you both agree
        </p>
        <p className="mt-2 rounded-md border border-lime-400/25 bg-lime-400/5 p-2.5 text-[10px] leading-relaxed text-zinc-400">
          🛡️ <span className="font-semibold text-lime-300">UpNova Protected.</span> The agreement,
          payment, and delivery are recorded — if anything goes wrong, the Resolution Center has
          the full record. Never pay outside UpNova.
        </p>

        <button onClick={() => router.push(`/messages?to=${creator.id}`)} className="btn-lime mt-4 w-full rounded-md py-2.5 text-sm">
          <Zap className="h-4 w-4" /> Continue to Message
        </button>
      </div>
    </div>
  );
}
