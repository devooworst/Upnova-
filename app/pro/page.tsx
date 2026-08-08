"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Check,
  CreditCard,
  Receipt,
  Rocket,
  Sparkles,
  Star,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import Perforation from "@/components/Perforation";
import { isPro, setPro } from "@/lib/pro";

const PRICE = 9.99;

const proBenefits = [
  { icon: Zap, title: "Priority Opportunities", desc: "Better visibility for paid opportunities that match your skills and radius." },
  { icon: BarChart3, title: "Advanced Analytics", desc: "Profile views, portfolio views, application rates, earnings, audience location." },
  { icon: Rocket, title: "Greater Reach", desc: "Your services and portfolio surface more widely in Discover and search." },
  { icon: Wrench, title: "Advanced Creator Tools", desc: "Better service management, project tools, and booking controls." },
  { icon: Star, title: "Featured Creator placement", desc: "Eligibility for featured slots across Discover." },
];

const freeFeatures = [
  "Basic creator profile",
  "Portfolio",
  "Communities",
  "Basic opportunities",
  "Messaging",
  "Basic analytics",
];

type View = "pitch" | "checkout" | "success" | "manage";

export default function ProPage() {
  const [view, setView] = useState<View>("pitch");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [method, setMethod] = useState("card");

  useEffect(() => {
    if (isPro()) setView("manage");
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* ---------------- pitch ---------------- */}
      {view === "pitch" && (
        <>
          <header className="pt-2 text-center">
            <p className="flex items-center justify-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-lime-400">
              <Sparkles className="h-3.5 w-3.5" /> UpNova Pro
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-50">
              Create more. Reach more. Earn more.
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
              Everything in free stays free. Pro puts your work in front of more people and more money.
            </p>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* free */}
            <section className="card p-5">
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-100">Free</h2>
              <p className="mt-0.5 text-xl font-extrabold tracking-tight text-zinc-400">$0</p>
              <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-zinc-600" /> {f}
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-line-soft pt-3 text-center text-xs text-zinc-600">
                Your current plan
              </p>
            </section>

            {/* pro */}
            <section className="card-money relative p-5">
              <h2 className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight text-lime-300">
                <Sparkles className="h-4 w-4" /> Pro
              </h2>
              <p className="mt-0.5 text-xl font-extrabold tracking-tight text-zinc-50">
                ${PRICE}
                <span className="text-sm font-medium text-zinc-500">/month</span>
              </p>
              <ul className="mt-4 space-y-3">
                {proBenefits.map((b) => (
                  <li key={b.title} className="flex gap-2.5">
                    <b.icon className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />
                    <span>
                      <span className="block text-sm font-semibold text-zinc-100">{b.title}</span>
                      <span className="block text-xs leading-relaxed text-zinc-500">{b.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <button onClick={() => setView("checkout")} className="btn-lime mt-5 w-full rounded-md py-2.5 text-sm">
                Upgrade to Pro
              </button>
              <p className="mt-2 text-center text-[10px] text-zinc-600">Cancel anytime.</p>
            </section>
          </div>
        </>
      )}

      {/* ---------------- checkout ---------------- */}
      {view === "checkout" && (
        <div className="card-money mx-auto max-w-sm p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">UpNova</p>
            <button onClick={() => setView("pitch")} className="icon-btn h-8 w-8" aria-label="Back">
              <X className="h-4 w-4" />
            </button>
          </div>
          <Perforation className="mt-3" />
          <h1 className="mt-4 text-[15px] font-bold tracking-tight text-zinc-50">Upgrade to UpNova Pro</h1>
          <p className="text-xs text-zinc-500">Pro Monthly</p>

          <ul className="mt-3 space-y-1.5 text-xs text-zinc-400">
            {["Advanced analytics", "Priority opportunities", "Greater creator reach", "Advanced creator tools"].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-lime-400" /> {f}
              </li>
            ))}
          </ul>

          <div className="mt-4">
            <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Email</label>
            <input defaultValue="devin@upnova.app" className="input-dark mt-1.5" />
          </div>
          <div className="mt-3">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Payment method</p>
            <div className="mt-1.5 space-y-1.5">
              {[
                ["card", "💳 Credit/debit card · •••• 4242"],
                ["apple", " Apple Pay"],
                ["google", "G  Google Pay"],
              ].map(([id, label]) => (
                <label key={id} className="flex cursor-pointer items-center gap-2.5 rounded-md border border-line bg-card-raised px-3 py-2 text-sm text-zinc-200">
                  <input type="radio" checked={method === id} onChange={() => setMethod(id)} className="accent-lime-400" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-1 text-sm">
            <p className="flex justify-between text-zinc-400"><span>Subtotal</span><span className="tabular-nums">${PRICE}</span></p>
            <p className="flex justify-between text-xs text-zinc-500"><span>Tax</span><span>calculated at checkout</span></p>
            <p className="flex justify-between border-t border-line-soft pt-2 text-zinc-200">
              <span className="text-xs">Total today</span>
              <span className="text-lg font-extrabold tracking-tight tabular-nums text-lime-400">${PRICE}</span>
            </p>
          </div>

          <button
            onClick={() => {
              setPro(true);
              setView("success");
            }}
            className="btn-lime mt-4 w-full rounded-md py-2.5 text-sm"
          >
            Subscribe to UpNova Pro
          </button>
          <p className="mt-2.5 text-center font-mono text-[10px] font-medium text-zinc-500">
            🔒 billing runs on Stripe when we go live — no card data touches UpNova
          </p>
        </div>
      )}

      {/* ---------------- success ---------------- */}
      {view === "success" && (
        <div className="card-money mx-auto max-w-sm p-6 text-center">
          <p className="text-4xl" aria-hidden>🎉</p>
          <h1 className="mt-3 text-xl font-bold tracking-tight text-zinc-50">Welcome to UpNova Pro</h1>
          <p className="mt-1.5 text-sm text-zinc-500">Your Pro membership is now active.</p>
          <ul className="mx-auto mt-4 w-fit space-y-1.5 text-left text-sm text-zinc-300">
            {["Advanced Analytics", "Priority Opportunities", "Greater Reach", "Creator Tools"].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-lime-400" /> {f}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex gap-2">
            <Link href="/analytics" className="btn-lime flex-1 rounded-md py-2 text-xs">
              Go to Dashboard
            </Link>
            <button onClick={() => setView("manage")} className="btn-ghost flex-1 py-2 text-xs">
              Manage Plan
            </button>
          </div>
        </div>
      )}

      {/* ---------------- manage ---------------- */}
      {view === "manage" && (
        <>
          <header className="pt-2">
            <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-lime-400">
              <Sparkles className="h-3.5 w-3.5" /> UpNova Pro
            </p>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Your subscription</h1>
              <span className="rounded-full border border-lime-400/40 bg-lime-400/10 px-2.5 py-0.5 text-[11px] font-bold text-lime-300">
                Active
              </span>
            </div>
          </header>

          <section className="card-money p-5">
            <p className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-zinc-200">Pro Monthly</span>
              <span className="text-xl font-extrabold tracking-tight tabular-nums text-lime-400">
                ${PRICE}<span className="text-xs font-medium text-zinc-500">/mo</span>
              </span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">Next billing date: September 7, 2026</p>
            <Perforation className="mt-4" />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button className="btn-ghost py-2 text-xs"><CreditCard className="h-3.5 w-3.5" /> Manage payment method</button>
              <button className="btn-ghost py-2 text-xs"><Receipt className="h-3.5 w-3.5" /> View billing history</button>
              <button className="btn-ghost py-2 text-xs"><Sparkles className="h-3.5 w-3.5" /> Change plan</button>
              <button
                onClick={() => setCancelOpen(true)}
                className="rounded-full border border-red-500/30 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10"
              >
                Cancel subscription
              </button>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-[15px] font-bold tracking-tight text-zinc-100">What Pro is doing for you</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-400">
              <li className="flex justify-between"><span>Profile views this month</span><span className="font-bold tabular-nums text-zinc-200">1,284 <span className="text-xs font-medium text-lime-400">+38%</span></span></li>
              <li className="flex justify-between"><span>Priority opportunity matches</span><span className="font-bold tabular-nums text-zinc-200">11</span></li>
              <li className="flex justify-between"><span>Featured placements</span><span className="font-bold tabular-nums text-zinc-200">2</span></li>
            </ul>
          </section>
        </>
      )}

      {/* cancel confirmation */}
      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setCancelOpen(false)}>
          <div className="card w-full max-w-xs p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-bold tracking-tight text-zinc-50">Cancel UpNova Pro?</p>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              You&apos;ll keep Pro benefits until the end of your current billing period (September 7).
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setCancelOpen(false)} className="btn-lime flex-1 rounded-md py-2 text-xs">
                Keep Pro
              </button>
              <button
                onClick={() => {
                  setPro(false);
                  setCancelOpen(false);
                  setView("pitch");
                }}
                className="flex-1 rounded-full border border-red-500/40 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
              >
                Cancel Pro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
