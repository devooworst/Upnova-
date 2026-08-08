"use client";

import { useState } from "react";
import { Check, Megaphone, X } from "lucide-react";
import Perforation from "./Perforation";
import { promoProducts, money } from "@/lib/fees";

/* Paid promotion: optional visibility, clearly labeled, never overrides
   relevance or location. Third revenue stream after fees + Pro. */

export default function PromoteModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<string>(promoProducts[0].id);
  const [done, setDone] = useState(false);
  const product = promoProducts.find((p) => p.id === selected)!;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={onClose}
    >
      <div className="card-money w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="py-4 text-center">
            <p className="text-3xl" aria-hidden>🚀</p>
            <h2 className="mt-2 text-[15px] font-bold tracking-tight text-zinc-50">
              {product.name} is live
            </h2>
            <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-zinc-500">
              Running for {product.duration}. It&apos;s labeled <span className="font-semibold text-amber-300">Featured</span> and
              shown to people it&apos;s actually relevant to — promotion never overrides relevance or location.
            </p>
            <button onClick={onClose} className="btn-lime mt-4 rounded-md px-6 py-2 text-xs">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-50">
                <Megaphone className="h-4 w-4 text-amber-400" /> Promote
              </h2>
              <button onClick={onClose} className="icon-btn h-8 w-8" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Optional visibility when you want more eyes. Always labeled, always relevant.
            </p>

            <div className="mt-4 space-y-2">
              {promoProducts.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition ${
                    selected === p.id
                      ? "border-amber-400/50 bg-amber-400/5"
                      : "border-line bg-card-raised hover:border-zinc-600"
                  }`}
                >
                  <input
                    type="radio"
                    checked={selected === p.id}
                    onChange={() => setSelected(p.id)}
                    className="mt-1 accent-amber-400"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold text-zinc-100">{p.name}</span>
                      <span className="shrink-0 text-sm font-bold tabular-nums tracking-tight text-zinc-100">
                        {money(p.price)}
                        <span className="font-mono text-[10px] font-medium text-zinc-500"> / {p.duration}</span>
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">{p.desc}</span>
                  </span>
                </label>
              ))}
            </div>

            <Perforation className="mt-4" />
            <p className="mt-3 flex items-baseline justify-between text-sm">
              <span className="text-xs text-zinc-500">Total</span>
              <span className="text-lg font-extrabold tracking-tight tabular-nums text-zinc-100">
                {money(product.price)}
              </span>
            </p>
            <button onClick={() => setDone(true)} className="mt-3 w-full rounded-md bg-amber-400 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-300 hover:shadow-glow-amber">
              <Check className="mr-1 inline h-4 w-4" /> Start {product.name}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
