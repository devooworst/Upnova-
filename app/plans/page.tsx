"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Diamond,
  Minus,
  GraduationCap,
  Sparkles,
  Building2,
  User,
  ChevronDown,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { BUSINESS_LIMITS, LIMIT_ROWS } from "@/lib/businessPlans";
import { PRO_PRICE, COLLEGE_PRICE, ALUMNI_PRO_PRICE, BUSINESS_PRO_PRICE } from "@/lib/fees";

/* ------------------------------------------------------------------ */
/* Plans & Benefits — the ONE comparison screen.                       */
/*                                                                     */
/* Philosophy (enforced across the product, stated here): Mavyn is    */
/* never a walking paywall. The core social/networking experience —    */
/* posting, following, messaging, communities, events, applying,       */
/* earning — is FREE forever. Paid plans buy enhancement: student      */
/* tools, professional customization/visibility, or business           */
/* recruiting. Four plans, no fifth: Alumni is a STATUS, not a         */
/* subscription. Business is ONE plan (Agency merged in).              */
/* Reuses the existing pricing constants and /pro flows — no second    */
/* subscription system.                                                */
/* ------------------------------------------------------------------ */

type Mark = { m: "yes" | "plus" | "na"; note?: string };
const Y = (note?: string): Mark => ({ m: "yes", note });
const P = (note?: string): Mark => ({ m: "plus", note });
const NA = (note?: string): Mark => ({ m: "na", note });

/* rows explain DIFFERENCES — never a wall of locks */
const GRID: { label: string; cells: [Mark, Mark, Mark, Mark] }[] = [
  { label: "Profile", cells: [Y(), Y("Verified student pill"), Y("Advanced"), Y("Business profile")] },
  { label: "Posts & feed", cells: [Y(), Y(), Y(), Y()] },
  { label: "Following & connections", cells: [Y(), Y(), Y(), Y()] },
  { label: "Messaging", cells: [Y(), Y(), P("Enhanced"), P("Business messaging")] },
  { label: "Communities", cells: [Y(), P("Student & campus"), Y(), Y()] },
  { label: "Events", cells: [Y(), P("Campus events"), Y(), P("Organization events")] },
  { label: "Opportunities", cells: [Y("Browse & apply"), Y("Student-focused"), Y("Professional"), Y("Post & hire")] },
  { label: "Portfolio", cells: [Y("Basic"), P("Enhanced"), Y("Advanced"), Y("Company media")] },
  { label: "Services & earning", cells: [Y("Always free to earn"), Y(), P("Advanced tools"), Y("Business services")] },
  { label: "My World", cells: [Y("Basic"), P("Enhanced — student themes"), Y("Full Studio"), Y("Business World")] },
  { label: "Analytics", cells: [Y("Basic"), Y("Student"), Y("Advanced"), Y("Business analytics")] },
  { label: "Discovery & visibility", cells: [Y("Standard"), P("Student Boost"), P("Professional boost"), P("Promotion tools")] },
  { label: "Campus access", cells: [Y("With free verification"), Y("Verified"), Y("With verification"), NA("Not applicable")] },
  { label: "Hiring & talent tools", cells: [NA(), NA(), NA(), Y("Talent discovery, applicants")] },
  { label: "Team / admin tools", cells: [NA(), NA(), NA(), P("Rolling out")] },
];

const PLAN_META = [
  {
    id: "free",
    name: "Free",
    icon: User,
    price: 0,
    accent: "text-zinc-100",
    card: "card",
    best: "Anyone who wants to use Mavyn.",
    features: ["Free to use, forever", "Profile, posts & portfolio", "Follow, connect & message", "Communities & events", "Browse & apply to opportunities", "Offer services & earn", "Basic My World", "Basic discovery & analytics"],
    why: "Use Mavyn without paying for the core experience.",
  },
  {
    id: "college",
    name: "College+",
    icon: GraduationCap,
    price: COLLEGE_PRICE,
    accent: "text-violet-300",
    card: "card-people border-violet-400/40",
    best: "Students building their network and career while in college.",
    features: ["Everything in Free", "Student & campus communities", "Student opportunities & events", "Student Boost", "Verified-student identity features", "Enhanced portfolio & My World", "Student-focused discovery", "Career & networking features"],
    why: "Build your network, portfolio and career while you're in school.",
  },
  {
    id: "pro",
    name: "Pro",
    icon: Sparkles,
    price: PRO_PRICE,
    accent: "text-lime-300",
    card: "card-money",
    best: "Creators, freelancers and professionals building their brand.",
    features: ["Everything in Free", "Advanced Profile Studio", "Full My World customization", "Advanced profile & portfolio analytics", "Enhanced professional discovery", "Advanced services & creator tools", "Professional visibility tools", "Increased customization"],
    why: "Turn your Mavyn presence into a serious professional or creative brand.",
  },
  {
    id: "business_pro",
    name: "Business",
    icon: Building2,
    price: BUSINESS_PRO_PRICE,
    accent: "text-sky-300",
    card: "card border-sky-400/40",
    best: "Organizations hiring, promoting and building their presence.",
    features: ["Business profile & branding", "Business World customization", "Post opportunities & hire", "Talent discovery", "Applicant management", "Business analytics & promotion", "Organization & event management", "Team/admin tools (rolling out)"],
    why: "Build your organization's presence, discover talent and create opportunities.",
  },
] as const;

function MarkCell({ mark }: { mark: Mark }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-2 text-center">
      {mark.m === "yes" && <Check className="h-4 w-4 text-lime-400" aria-label="Included" />}
      {mark.m === "plus" && <Diamond className="h-3.5 w-3.5 text-violet-300" aria-label="Enhanced" />}
      {mark.m === "na" && <Minus className="h-3.5 w-3.5 text-zinc-700" aria-label="Not applicable" />}
      {mark.note && <span className="text-[9px] leading-tight text-zinc-500">{mark.note}</span>}
    </div>
  );
}

export default function PlansPage() {
  const { user } = useSession();
  const [alumniOpen, setAlumniOpen] = useState(false);
  const isBusiness = user?.accountType === "business";
  const plan = user?.plan ?? null;
  // legacy 'agency' reads as Business (one plan; Agency merged in)
  const effectivePlan = plan === "agency" ? "business_pro" : plan;
  const isAlumni = user?.campus?.affiliation === "alumni";

  const isCurrent = (id: string) =>
    id === "business_pro" ? isBusiness && (effectivePlan === "business_pro") : !isBusiness && effectivePlan === id && !(id === "free" && !user);

  const cta = (id: string) => {
    if (user && isCurrent(id)) return { label: "Current Plan", href: null as string | null };
    if (id === "free") return user ? (effectivePlan === "free" ? { label: "Current Plan", href: null } : { label: "Switch to Free", href: "/pro" }) : { label: "Get Started", href: "/signup" };
    if (id === "college") return isBusiness ? { label: "Personal accounts only", href: null } : { label: "Choose College+", href: "/pro?intent=college" };
    if (id === "pro") return isBusiness ? { label: "Personal accounts only", href: null } : { label: isAlumni ? `Go Pro — $${ALUMNI_PRO_PRICE}/mo alumni rate` : "Go Pro", href: "/pro" };
    return isBusiness ? { label: "Upgrade to Business", href: "/pro" } : { label: "Create Business Account", href: "/signup" };
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="pt-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Plans &amp; Benefits</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
          The core Mavyn experience — posting, connecting, messaging, communities, events,
          applying, and <span className="font-semibold text-lime-300">earning</span> — is free,
          always. Plans add student tools, professional power, or business capability. Never a
          paywall on being part of it.
        </p>
      </header>

      {/* ---------------- four plan cards ---------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLAN_META.map((p) => {
          const action = cta(p.id);
          const current = user && isCurrent(p.id);
          return (
            <section key={p.id} className={`relative flex flex-col p-5 ${p.card}`}>
              {current && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-lime-400 px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-950">
                  current plan
                </span>
              )}
              <h2 className={`flex items-center gap-1.5 text-[15px] font-bold tracking-tight ${p.accent}`}>
                <p.icon className="h-4 w-4" /> {p.name}
              </h2>
              <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                <span className="font-semibold text-zinc-400">Best for:</span> {p.best}
              </p>
              <p className="mt-2 text-xl font-extrabold tracking-tight text-zinc-50">
                ${p.id === "pro" && isAlumni ? ALUMNI_PRO_PRICE : p.price}
                <span className="text-sm font-medium text-zinc-500">{p.price === 0 ? "" : "/mo"}</span>
                {p.id === "pro" && isAlumni && (
                  <span className="ml-1.5 align-middle text-[10px] font-bold text-lime-300">alumni rate</span>
                )}
              </p>
              <ul className="mt-3 flex-1 space-y-1.5 text-[11px] leading-snug text-zinc-400">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <Check className={`mt-0.5 h-3 w-3 shrink-0 ${p.accent}`} /> {f}
                  </li>
                ))}
              </ul>
              {action.href ? (
                <Link
                  href={action.href}
                  data-guide={`plan-${p.id}`}
                  className={`mt-4 flex w-full items-center justify-center rounded-md py-2 text-xs font-bold transition ${
                    p.id === "pro" ? "bg-lime-400 text-zinc-950 hover:bg-lime-300" : p.id === "college" ? "bg-violet-400 text-zinc-950 hover:bg-violet-300" : p.id === "business_pro" ? "bg-sky-400 text-zinc-950 hover:bg-sky-300" : "border border-line text-zinc-200 hover:border-zinc-600"
                  }`}
                >
                  {action.label}
                </Link>
              ) : (
                <p className="mt-4 border-t border-line-soft pt-2.5 text-center text-xs font-semibold text-zinc-500">{action.label}</p>
              )}
            </section>
          );
        })}
      </div>

      {/* ---------------- comparison grid ---------------- */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-bold text-zinc-100">Compare in detail</h2>
          <p className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-wide text-zinc-500">
            <span className="flex items-center gap-1"><Check className="h-3 w-3 text-lime-400" /> included</span>
            <span className="flex items-center gap-1"><Diamond className="h-2.5 w-2.5 text-violet-300" /> enhanced</span>
            <span className="flex items-center gap-1"><Minus className="h-2.5 w-2.5 text-zinc-700" /> n/a</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-line-soft">
                <th className="px-4 py-2 text-[11px] font-semibold text-zinc-500">Feature</th>
                {PLAN_META.map((p) => (
                  <th key={p.id} className={`px-2 py-2 text-center text-[11px] font-bold ${p.accent}`}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {GRID.map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-1 text-xs font-medium text-zinc-300">{row.label}</td>
                  {row.cells.map((c, i) => (
                    <td key={i} className="px-2"><MarkCell mark={c} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------- why choose this plan ---------------- */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PLAN_META.map((p) => (
          <div key={p.id} className="rounded-xl border border-line p-4">
            <p className={`flex items-center gap-1.5 text-xs font-bold ${p.accent}`}>
              <p.icon className="h-3.5 w-3.5" /> Why {p.name}?
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">{p.why}</p>
          </div>
        ))}
      </section>

      {/* ---------------- Business: two tiers, Pro = scale not access ---------------- */}
      <section className="card border-sky-400/25 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-sky-300">
              <Building2 className="h-4 w-4" /> Business: Free vs Business Pro
            </h2>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-zinc-400">
              Business Free is a genuinely usable hiring account — find talent, post opportunities,
              receive applications, hire, run projects, pay, and get reviewed, all at $0.{" "}
              <span className="font-semibold text-zinc-200">Business Pro (${BUSINESS_PRO_PRICE}/mo) buys scale, never basic access.</span>{" "}
              Hitting a limit never deletes or locks anything — it only pauses creating new records.
            </p>
          </div>
        </div>

        {/* the capacity table — the honest core of the comparison */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead>
              <tr className="border-b border-line text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-3 font-mono">Capacity</th>
                <th className="py-2 pr-3">Business Free · $0</th>
                <th className="py-2 text-sky-300">Business Pro · ${BUSINESS_PRO_PRICE}/mo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {LIMIT_ROWS.map((r) => (
                <tr key={r.key}>
                  <td className="py-2 pr-3 text-zinc-300">{r.label}</td>
                  <td className="py-2 pr-3 font-mono tracking-[0.06em] text-zinc-200">{BUSINESS_LIMITS.free[r.key]}</td>
                  <td className="py-2 font-mono font-semibold tracking-[0.06em] text-sky-300">{BUSINESS_LIMITS.business_pro[r.key]}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 pr-3 text-zinc-300">Completed history</td>
                <td className="py-2 pr-3 font-mono tracking-[0.06em] text-zinc-200">Unlimited</td>
                <td className="py-2 font-mono font-semibold tracking-[0.06em] text-sky-300">Unlimited</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-3 border-t border-line-soft pt-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold text-zinc-200">Business Free — the full economic loop</p>
            <ul className="mt-1.5 space-y-1 text-[11px] text-zinc-400">
              {["Business profile, posts & basic branding", "Browse & discover talent, message anyone", "Post opportunities, review applications, hire", "Projects, bookings & TEST payments end to end", "People dashboard (team · clients · talent · contacts)", "Basic analytics & Business World", "Organic community visibility"].map((x) => (
                <li key={x} className="flex items-start gap-1.5"><Check className="mt-0.5 h-3 w-3 shrink-0 text-lime-400" /> {x}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-200">Business Pro adds</p>
            <ul className="mt-1.5 space-y-1 text-[11px] text-zinc-400">
              {["All the capacity above — scale for real volume", "Advanced talent discovery & applicant organization", "Advanced project, client & talent management", "Team & admin seats (delegated access rolling out)", "Advanced Business World customization", "Advanced analytics, promotion & visibility tools"].map((x) => (
                <li key={x} className="flex items-start gap-1.5"><Check className="mt-0.5 h-3 w-3 shrink-0 text-sky-400" /> {x}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
          Downgrading never deletes anything — team, clients, talent, projects, messages, bookings,
          payments, reviews, and history all stay fully accessible. If you&apos;re over a Free limit after
          downgrading, existing records keep working; only creating new ones pauses until you&apos;re back
          under the limit or upgrade again.
        </p>
      </section>

      {/* ---------------- Alumni: a status, never a fifth subscription ---------------- */}
      <section className="card-people border-violet-400/30 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-violet-300">
              <GraduationCap className="h-4 w-4" /> Graduating from College+?
            </h2>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-zinc-400">
              Your account transitions to <span className="font-semibold text-zinc-200">Alumni status</span> while
              everything you&apos;ve built on Mavyn stays with you. Alumni can upgrade to Pro at a
              discounted alumni rate (${ALUMNI_PRO_PRICE}/mo instead of ${PRO_PRICE}) — or keep using the free core
              experience forever. Alumni is a status, not a fifth subscription.
            </p>
          </div>
          <button onClick={() => setAlumniOpen(!alumniOpen)} className="btn-ghost shrink-0 px-4 py-2 text-xs">
            Learn about Alumni <ChevronDown className={`h-3.5 w-3.5 transition ${alumniOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        {alumniOpen && (
          <div className="mt-4 grid gap-3 border-t border-line-soft pt-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold text-zinc-200">Everything stays</p>
              <ul className="mt-1.5 space-y-1 text-[11px] text-zinc-400">
                {["Profile & verified school identity", "Posts, portfolio & work history", "Followers & connections", "Messages & communities", "Reviews & reputation"].map((x) => (
                  <li key={x} className="flex items-center gap-1.5"><Check className="h-3 w-3 text-violet-400" /> {x}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-200">What changes</p>
              <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-zinc-400">
                <li>College+ billing ends automatically — nobody is auto-charged for anything.</li>
                <li>Student-only areas close; the alumni environment and alumni communities open.</li>
                <li>Your profile shows your school with the Alumni marker (e.g. Bowie State &apos;27 · Alumni).</li>
                <li>Pro is optional, at your permanent alumni rate.</li>
              </ul>
              <Link href="/campus" className="mt-2 inline-block text-[11px] font-semibold text-violet-300 hover:underline">
                See your campus & alumni space →
              </Link>
            </div>
          </div>
        )}
      </section>

      <p className="pb-4 text-center text-[10px] text-zinc-600">
        Test prices. Plans change instantly in this demo — TEST/DEMO PAYMENT only, no real money can move.
      </p>
    </div>
  );
}
