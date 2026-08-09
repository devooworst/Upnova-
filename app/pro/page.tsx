"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Check,
  CreditCard,
  GraduationCap,
  Receipt,
  Rocket,
  Sparkles,
  Star,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import Perforation from "@/components/Perforation";
import { getPlan, setPlan } from "@/lib/pro";
import { PRO_PRICE, COLLEGE_PRICE, money } from "@/lib/fees";
import { useSession, invalidateSession } from "@/lib/session";

/* Campus verification is a DATABASE FACT (campus_verifications row) —
   the same one the sidebar, /campus, and every campus API check.
   Only schools with a campuses row can verify; the rest are honest
   about not being onboarded yet. */
const SCHOOL_SLUGS: Record<string, string> = {
  "Bowie State University": "bowie-state",
  "Morgan State University": "morgan-state",
  "University of Maryland": "umd",
  "Towson University": "towson",
  "Johns Hopkins University": "jhu",
  "Coppin State University": "coppin-state",
};

/* ------------------------------------------------------------------ */
/* Three plans, three jobs:                                            */
/* Free = get discovered. College = build while you study (verified    */
/* students; ends at graduation → natural Pro pipeline). Pro = grow    */
/* your professional career. Earning is never paywalled.               */
/* ------------------------------------------------------------------ */

const freeFeatures = [
  "Profile & basic portfolio",
  "Follow creators & communities",
  "Messaging",
  "Apply to opportunities",
  "Offer basic services & get hired",
  "Events & basic earnings",
];

const collegeFeatures = [
  { icon: GraduationCap, text: "Verified Student badge" },
  { icon: Rocket, text: "Student Boost — extra discovery when you're a relevant match" },
  { icon: Zap, text: "Student Opportunities — work that fits around student life" },
  { icon: Star, text: "Campus discovery, student-only collabs & Spotlight eligibility" },
  { icon: BarChart3, text: "Student earnings dashboard & enhanced portfolio" },
];

const proBenefits = [
  { icon: Zap, title: "Priority Opportunities", desc: "Better visibility for paid work that matches your skills and radius." },
  { icon: BarChart3, title: "Advanced Analytics", desc: "Profile views, application rates, earnings, audience location." },
  { icon: Rocket, title: "Greater Reach", desc: "Your services and portfolio surface more widely in Discover." },
  { icon: Wrench, title: "Advanced Creator & Business Tools", desc: "Service management, project tools, brand tools, priority support." },
  { icon: Star, title: "Featured Creator placement", desc: "Eligibility for featured slots across Discover." },
];

type View = "plans" | "checkout" | "verify" | "success" | "college" | "manage";

export default function ProPage() {
  const { user } = useSession();
  const campus = user?.campus ?? null; // DB-backed verification — same fact the sidebar checks
  const [view, setView] = useState<View>("plans");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [school, setSchool] = useState("Bowie State University");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [gradDate, setGradDate] = useState("May 2028");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  useEffect(() => {
    const plan = getPlan();
    if (plan === "pro") setView("manage");
    if (plan === "college") setView("college");
  }, []);

  // default the school email from the signed-in account (never someone else's)
  useEffect(() => {
    if (user?.handle) setSchoolEmail((v) => v || `${user.handle}@students.bowiestate.edu`);
  }, [user?.handle]);

  /* REAL verification: persists a campus_verifications row via the same
     API /campus uses. Verifying NEVER touches the auth session — on any
     failure (including 401) we show an inline error and stay put. */
  const verifyStudent = async () => {
    setVerifyBusy(true);
    setVerifyError("");
    try {
      const slug = SCHOOL_SLUGS[school];
      if (!slug) {
        setVerifyError("That school isn't on UpNova yet — pick a listed school or check back soon.");
        return;
      }
      const yearMatch = gradDate.match(/(19|20)\d{2}/);
      const res = await fetch("/api/campus/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campus: slug,
          affiliation: "current_student",
          gradYear: yearMatch ? yearMatch[0] : "",
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (res.status === 401) {
        // do NOT redirect or clear anything — the session on this device is untouched
        setVerifyError("We couldn't confirm your session for this request. Refresh the page and try again — you have not been signed out.");
        return;
      }
      if (res.status === 404) {
        setVerifyError(`${school} isn't onboarded on UpNova yet. Bowie State University is live in this demo.`);
        return;
      }
      if (!res.ok) {
        setVerifyError(data?.error || "Verification failed — please try again.");
        return;
      }
      invalidateSession(); // soft refetch → user.campus arrives → sidebar item appears
      setView("college");
    } catch {
      setVerifyError("Network error — please try again.");
    } finally {
      setVerifyBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* ---------------- plans ---------------- */}
      {view === "plans" && (
        <>
          <header className="pt-2 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Choose how you grow</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
              Earning is free on UpNova, always. Plans buy growth — never the ability to make money.
            </p>
          </header>

          <div className="grid gap-4 md:grid-cols-3">
            {/* free */}
            <section className="card flex flex-col p-5">
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-100">Free</h2>
              <p className="text-xs text-zinc-500">Get discovered.</p>
              <p className="mt-1 text-xl font-extrabold tracking-tight text-zinc-400">$0</p>
              <ul className="mt-4 flex-1 space-y-2 text-xs text-zinc-400">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" /> {f}
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-line-soft pt-3 text-center text-xs text-zinc-600">
                Your current plan
              </p>
            </section>

            {/* college */}
            <section className="card-people relative flex flex-col border-violet-400/40 p-5">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-violet-400 px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-950">
                students
              </span>
              <h2 className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight text-violet-300">
                <GraduationCap className="h-4 w-4" /> College+
              </h2>
              <p className="text-xs text-zinc-500">Build while you study.</p>
              <p className="mt-1.5 rounded-md border border-violet-400/25 bg-violet-400/5 px-2.5 py-1.5 text-[10px] leading-relaxed text-zinc-400">
                <span className="font-semibold text-violet-300">Verification is free.</span>{" "}
                School community, campus chat, networking, applying — all $0. College+ is the
                optional exposure upgrade.
              </p>
              <p className="mt-1 text-xl font-extrabold tracking-tight text-zinc-50">
                ${COLLEGE_PRICE}
                <span className="text-sm font-medium text-zinc-500">/mo</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2.5 text-xs text-zinc-300">
                {collegeFeatures.map((f) => (
                  <li key={f.text} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" /> {f.text}
                  </li>
                ))}
              </ul>
              <p className="mt-3 rounded-md border border-line bg-card-raised p-2.5 text-[10px] leading-relaxed text-zinc-500">
                Boost is <span className="font-semibold text-zinc-300">relevance-first</span> — verified
                students get extra exposure when they&apos;re a qualified match, never just because they paid.
              </p>
              <button
                onClick={() => (campus ? setView("college") : setView("verify"))}
                className="mt-4 w-full rounded-md bg-violet-400 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-violet-300 hover:shadow-glow-violet"
              >
                {campus ? `Verified at ${campus.name} — open dashboard` : "Verify Student Status — Free"}
              </button>
              <p className="mt-2 text-center text-[10px] text-zinc-600">
                College+ ends at graduation; your alumni community and everything you built stay
                free, forever.
              </p>
            </section>

            {/* pro */}
            <section className="card-money flex flex-col p-5">
              <h2 className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight text-lime-300">
                <Sparkles className="h-4 w-4" /> Pro
              </h2>
              <p className="text-xs text-zinc-500">Grow your professional career.</p>
              <p className="mt-1 text-xl font-extrabold tracking-tight text-zinc-50">
                ${PRO_PRICE}
                <span className="text-sm font-medium text-zinc-500">/mo</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2.5">
                {proBenefits.map((b) => (
                  <li key={b.title} className="flex gap-2.5">
                    <b.icon className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />
                    <span>
                      <span className="block text-xs font-semibold text-zinc-100">{b.title}</span>
                      <span className="block text-[10px] leading-relaxed text-zinc-500">{b.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <button onClick={() => setView("checkout")} className="btn-lime mt-4 w-full rounded-md py-2.5 text-sm">
                Upgrade to Pro
              </button>
              <p className="mt-2 text-center text-[10px] text-zinc-600">Cancel anytime. Prices are test prices.</p>
            </section>
          </div>
        </>
      )}

      {/* ---------------- college verification ---------------- */}
      {view === "verify" && (
        <div className="card-people mx-auto max-w-sm border-violet-400/30 p-5">
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-50">
              <GraduationCap className="h-4 w-4 text-violet-400" /> Verify Student Status
              <span className="rounded-full border border-lime-400/40 bg-lime-400/10 px-2 py-0.5 text-[10px] font-bold text-lime-300">
                Free
              </span>
            </h1>
            <button onClick={() => setView("plans")} className="icon-btn h-8 w-8" aria-label="Back">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">School email</label>
              <input value={schoolEmail} onChange={(e) => setSchoolEmail(e.target.value)} className="input-dark mt-1.5" />
            </div>
            <div>
              <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">College / University</label>
              <select value={school} onChange={(e) => setSchool(e.target.value)} className="input-dark mt-1.5">
                <option>Bowie State University</option>
                <option>Morgan State University</option>
                <option>University of Maryland</option>
                <option>Towson University</option>
                <option>Johns Hopkins University</option>
                <option>Coppin State University</option>
                <option>Other…</option>
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Expected graduation</label>
              <input value={gradDate} onChange={(e) => setGradDate(e.target.value)} className="input-dark mt-1.5" />
            </div>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
            Verification runs through an education-verification provider in production — school
            email alone isn&apos;t the permanent source of truth, and your student email is never
            shown publicly. You get a simple status: Verified Student.
          </p>
          {verifyError && (
            <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11px] leading-relaxed text-red-300">
              {verifyError}
            </p>
          )}
          {user === null ? (
            <Link
              href="/login"
              className="mt-4 flex w-full items-center justify-center rounded-md bg-violet-400 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-violet-300 hover:shadow-glow-violet"
            >
              Sign in to verify
            </Link>
          ) : (
            <button
              onClick={verifyStudent}
              disabled={verifyBusy || user === undefined}
              className="mt-4 w-full rounded-md bg-violet-400 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-violet-300 hover:shadow-glow-violet disabled:opacity-50"
            >
              {verifyBusy ? "Verifying…" : "Verify — Free"}
            </button>
          )}
          <p className="mt-2.5 text-center text-[10px] leading-relaxed text-zinc-600">
            Verification unlocks your school community, campus chat, networking, and applying —
            all $0. You can add College+ ({money(COLLEGE_PRICE)}/mo) for extra exposure anytime.
          </p>
        </div>
      )}

      {/* ---------------- college active: campus-to-career dashboard ---------------- */}
      {view === "college" && (
        <>
          <header className="pt-2">
            <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-400">
              <GraduationCap className="h-3.5 w-3.5" />
              verified student · {getPlan() === "college" ? "college+ active" : "free"}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">
              Your campus-to-career network
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              School community, campus chat, networking, and applying are free
              {campus?.gradYear ? ` through ${campus.gradYear}` : " while you study"} —
              and your alumni community after that.
            </p>
          </header>

          <div className="grid gap-4 md:grid-cols-2">
            {/* campus */}
            <section className="card-people p-5">
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Your Campus</h2>
              <p className="mt-1 text-sm font-semibold text-violet-300">{campus?.name ?? school}</p>
              <p className="text-xs text-zinc-500">
                Verified {campus?.affiliation === "alumni" ? "alumni" : "student"}
                {campus?.gradYear ? ` · Class of ${campus.gradYear}` : ""}
              </p>
              <ul className="mt-3 space-y-1 text-xs text-zinc-400">
                {["Campus communities & events", "Student creators & businesses", "Campus gigs & study groups", "Student-only collabs"].map((i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-violet-400" /> {i}
                  </li>
                ))}
              </ul>
              <Link href="/campus" className="mt-3.5 flex w-full items-center justify-center rounded-full bg-violet-400 py-2 text-xs font-bold text-zinc-950 transition hover:bg-violet-300 hover:shadow-glow-violet">
                Enter your campus →
              </Link>
            </section>

            {/* student earnings */}
            <section className="card-money p-5">
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Student Earnings</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-2xl font-extrabold tracking-tight tabular-nums text-lime-400">$642</p>
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">this month</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold tracking-tight tabular-nums text-zinc-50">7</p>
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">projects</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold tracking-tight tabular-nums text-zinc-50">$92</p>
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">avg project</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold tracking-tight tabular-nums text-amber-400">$350</p>
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">upcoming</p>
                </div>
              </div>
              <div className="mt-3 border-t border-zinc-600" />
              <div className="mt-[3px] border-t border-zinc-600" />
              <p className="mt-2.5 flex items-baseline justify-between">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-400">earned through upnova · 2026</span>
                <span className="text-base font-extrabold tracking-tight tabular-nums text-lime-400">$2,840</span>
              </p>
            </section>
          </div>

          {/* boost + spotlight */}
          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-zinc-100">
                  <Rocket className="h-4 w-4 text-violet-400" />
                  {getPlan() === "college" ? "Student Boost — active" : "Student Boost — College+"}
                </h2>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-500">
                  Relevance first, always: location, skills, availability, reputation, activity —
                  then your student boost. You get extra exposure when you&apos;re a qualified
                  match, never just because you paid.
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-extrabold tabular-nums text-zinc-50">9</p>
                <p className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500">boosted matches this month</p>
              </div>
            </div>
            {getPlan() !== "college" && (
              <button
                onClick={() => setPlan("college")}
                className="mt-3 w-full rounded-md bg-violet-400 py-2 text-xs font-bold text-zinc-950 transition hover:bg-violet-300 hover:shadow-glow-violet"
              >
                Add College+ · {money(COLLEGE_PRICE)}/mo — extra exposure, featured portfolio, analytics
              </button>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3.5 text-xs">
              <span className="chip px-2 py-0.5 text-[11px]">Student Spotlight — eligible</span>
              <span className="chip px-2 py-0.5 text-[11px]">Campus Challenge: $500 prize</span>
              <Link href="/opportunities" className="ml-auto font-semibold text-violet-400 hover:text-violet-300">
                Student Opportunities →
              </Link>
            </div>
          </section>

          {/* graduation pipeline */}
          <section className="rounded-xl border border-line p-4">
            <p className="text-sm font-semibold text-zinc-200">When you graduate{campus?.gradYear ? ` (${campus.gradYear})` : ""}</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Your status changes from <span className="font-semibold text-zinc-300">{campus?.name ?? school} Student</span> to{" "}
              <span className="font-semibold text-zinc-300">{campus?.name ?? school} Alumni</span> — the alumni
              community is free, and your account, portfolio, projects, followers, reviews, and
              earnings history remain yours. Want to keep College+ benefits? Continue with Pro.
              No pressure.
            </p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => { setPlan("pro"); setView("manage"); }} className="btn-lime rounded-md px-4 py-1.5 text-xs">
                Preview Pro transition
              </button>
              <button
                onClick={() => { setPlan("free"); setView("plans"); }}
                className="rounded-full border border-line px-4 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-600"
              >
                Cancel College
              </button>
            </div>
            <p className="mt-2.5 text-[10px] leading-relaxed text-zinc-600">
              Plan ≠ identity: changing plans removes College perks only. Your verified school
              identity, campus access, and everything you built stay with your account.
            </p>
          </section>
        </>
      )}

      {/* ---------------- pro checkout ---------------- */}
      {view === "checkout" && (
        <div className="card-money mx-auto max-w-sm p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">UpNova</p>
            <button onClick={() => setView("plans")} className="icon-btn h-8 w-8" aria-label="Back">
              <X className="h-4 w-4" />
            </button>
          </div>
          <Perforation className="mt-3" />
          <h1 className="mt-4 text-[15px] font-bold tracking-tight text-zinc-50">Upgrade to UpNova Pro</h1>
          <p className="text-xs text-zinc-500">Pro Monthly</p>
          <div className="mt-4 flex items-center gap-2.5 rounded-md border border-line bg-card-raised px-3 py-2.5 text-sm text-zinc-200">
            <span className="font-mono font-medium">•••• 4242</span>
            <span className="ml-auto text-lg font-extrabold tracking-tight tabular-nums text-lime-400">${PRO_PRICE}</span>
          </div>
          <button
            onClick={() => { setPlan("pro"); setView("success"); }}
            className="btn-lime mt-4 w-full rounded-md py-2.5 text-sm"
          >
            Subscribe to UpNova Pro
          </button>
          <p className="mt-2.5 text-center font-mono text-[10px] font-medium text-zinc-500">
Billing runs on Stripe when we go live
          </p>
        </div>
      )}

      {/* ---------------- pro success ---------------- */}
      {view === "success" && (
        <div className="card-money mx-auto max-w-sm p-6 text-center">
          <Sparkles className="mx-auto h-9 w-9 text-lime-400" />
          <h1 className="mt-3 text-xl font-bold tracking-tight text-zinc-50">Welcome to UpNova Pro</h1>
          <p className="mt-1.5 text-sm text-zinc-500">Your Pro membership is now active.</p>
          <div className="mt-5 flex gap-2">
            <Link href="/analytics" className="btn-lime flex-1 rounded-md py-2 text-xs">Go to Dashboard</Link>
            <button onClick={() => setView("manage")} className="btn-ghost flex-1 py-2 text-xs">Manage Plan</button>
          </div>
        </div>
      )}

      {/* ---------------- pro manage ---------------- */}
      {view === "manage" && (
        <>
          <header className="pt-2">
            <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-lime-400">
              <Sparkles className="h-3.5 w-3.5" /> UpNova Pro
            </p>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Your subscription</h1>
              <span className="rounded-full border border-lime-400/40 bg-lime-400/10 px-2.5 py-0.5 text-[11px] font-bold text-lime-300">Active</span>
            </div>
          </header>
          <section className="card-money p-5">
            <p className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-zinc-200">Pro Monthly</span>
              <span className="text-xl font-extrabold tracking-tight tabular-nums text-lime-400">
                ${PRO_PRICE}<span className="text-xs font-medium text-zinc-500">/mo</span>
              </span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">Next billing date: September 7, 2026</p>
            {campus && (
              <p className="mt-2 rounded-md border border-violet-400/25 bg-violet-400/5 px-3 py-2 text-[11px] text-zinc-400">
                <span className="font-semibold text-violet-300">Verified Student — {campus.name}</span> — your
                school identity and campus access are independent of your plan and remain active.
              </p>
            )}
            <Perforation className="mt-4" />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button className="btn-ghost py-2 text-xs"><CreditCard className="h-3.5 w-3.5" /> Manage payment method</button>
              <button className="btn-ghost py-2 text-xs"><Receipt className="h-3.5 w-3.5" /> View billing history</button>
              <button onClick={() => setView("plans")} className="btn-ghost py-2 text-xs"><Sparkles className="h-3.5 w-3.5" /> Change plan</button>
              <button onClick={() => setCancelOpen(true)} className="rounded-full border border-red-500/30 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10">
                Cancel subscription
              </button>
            </div>
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
              <button onClick={() => setCancelOpen(false)} className="btn-lime flex-1 rounded-md py-2 text-xs">Keep Pro</button>
              <button
                onClick={() => { setPlan("free"); setCancelOpen(false); setView("plans"); }}
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
