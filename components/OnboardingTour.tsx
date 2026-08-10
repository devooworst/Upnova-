"use client";

/* ------------------------------------------------------------------ */
/*  First-run onboarding tour — "welcome in, let me show you around."  */
/*                                                                     */
/*  · Greets a user exactly once (users.onboarding in the database);   */
/*    Skip is always available and counts as done — never a trap.      */
/*  · Spotlights the REAL interface: each step highlights the actual   */
/*    navigation element (data-tour anchors) behind a dimmed overlay.  */
/*  · Steps come personalized from /api/onboarding/tour (student /     */
/*    creator / business), computed from real account facts.           */
/*  · Ends with a real profile checklist and next actions — education, */
/*    never a sales funnel, and it never blocks the app.               */
/*  · Replay anytime: Settings → Help → Take the tour again (?tour=1). */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  Compass,
  Sparkles,
  X,
} from "lucide-react";
import { useSession } from "@/lib/session";

type TourStep = { id: string; target: string; title: string; body: string; href?: string };
type Tour = { audience: string; demoMode: "demo" | "simulation" | null; steps: TourStep[] };

const HIDDEN_PATHS = ["/login", "/signup", "/welcome", "/forgot", "/reset", "/debug", "/profile/studio/world"];

export const TOUR_EVENT = "upnova:start-tour";

export default function OnboardingTour() {
  const { user, refresh } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // phase: idle → welcome → touring → finale → done
  const [phase, setPhase] = useState<"idle" | "welcome" | "touring" | "finale">("idle");
  const [tour, setTour] = useState<Tour | null>(null);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const startedRef = useRef(false);

  const hiddenHere = HIDDEN_PATHS.some((p) => pathname?.startsWith(p));

  /* ---------------- triggers: first run, ?tour=1, custom event ---------------- */
  useEffect(() => {
    if (!user || hiddenHere || startedRef.current) return;
    const forced = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tour") === "1";
    if (forced || user.onboarding?.completed === false) {
      startedRef.current = true;
      setPhase("welcome");
    }
  }, [user, hiddenHere]);

  useEffect(() => {
    const onStart = () => {
      startedRef.current = true;
      setPhase("welcome");
      setI(0);
    };
    window.addEventListener(TOUR_EVENT, onStart);
    return () => window.removeEventListener(TOUR_EVENT, onStart);
  }, []);

  /* ---------------- spotlight geometry ---------------- */
  const step = phase === "touring" && tour ? tour.steps[i] : null;

  const measure = useCallback(() => {
    if (!step) return setRect(null);
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`));
    const el = nodes.find((n) => {
      const r = n.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && n.offsetParent !== null;
    });
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useEffect(() => {
    measure();
    if (!step) return;
    const onScroll = () => measure();
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    const t = setInterval(measure, 400); // sidebar animations settle
    return () => {
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
      clearInterval(t);
    };
  }, [step, measure]);

  /* ---------------- actions ---------------- */
  const begin = async () => {
    const res = await fetch("/api/onboarding/tour", { cache: "no-store" });
    if (!res.ok) return finish(true); // never trap the user on an error
    setTour(await res.json());
    setI(0);
    setPhase("touring");
  };

  const finish = async (skipped: boolean) => {
    setPhase("idle");
    startedRef.current = true;
    await fetch("/api/me/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: skipped ? "skip" : "complete" }),
    }).catch(() => {});
    refresh();
    // drop a stale ?tour=1 so a reload doesn't restart it
    if (new URLSearchParams(window.location.search).get("tour") === "1") router.replace(pathname || "/");
  };

  const next = () => (tour && i < tour.steps.length - 1 ? setI(i + 1) : setPhase("finale"));
  const back = () => (i > 0 ? setI(i - 1) : setPhase("welcome"));

  /* ---------------- profile checklist (real account facts) ---------------- */
  const checklist = useMemo(() => {
    const p = user?.profile;
    const items: { label: string; done: boolean; href: string }[] = [
      { label: "Account created", done: true, href: "/settings" },
      { label: "Add a profile photo", done: !!p?.avatarUrl, href: "/profile/edit" },
      { label: "Write your bio", done: !!p?.bio, href: "/profile/edit" },
      { label: "Add interests", done: (p?.interests?.length ?? 0) > 0, href: "/profile/edit" },
      { label: "Add skills", done: (p?.skills?.length ?? 0) > 0, href: "/profile/edit" },
      { label: "Link your work", done: (p?.links?.length ?? 0) > 0, href: "/profile/edit" },
      {
        label: "Add school or work info",
        done: !!user?.campus || (p?.education?.length ?? 0) > 0,
        href: "/settings",
      },
      { label: "Customize My World", done: false, href: "/profile/studio" },
    ];
    const scored = items.slice(0, 7); // My World is an invitation, not a score
    const pct = Math.round((scored.filter((x) => x.done).length / scored.length) * 100);
    return { items, pct };
  }, [user]);

  if (!user || hiddenHere || phase === "idle") return null;

  /* ================================ WELCOME ================================ */
  if (phase === "welcome")
    return (
      <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/40 bg-violet-400/10">
            <Sparkles className="h-6 w-6 text-violet-300" />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-zinc-50">
            Welcome to UpNova, {user.profile.displayName.split(" ")[0]}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            You just entered a new world. Let&apos;s take a quick look around so you know your way —
            it takes about a minute, and you can leave whenever you want.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button onClick={begin} className="btn-lime w-full justify-center py-2.5 text-sm">
              <Compass className="h-4 w-4" /> Show me around
            </button>
            <button onClick={() => finish(true)} className="btn-ghost w-full justify-center py-2 text-xs text-zinc-400">
              Skip the tour
            </button>
          </div>
          <p className="mt-3 text-[10px] text-zinc-600">
            Nothing is locked behind this — UpNova is fully yours either way.
          </p>
        </div>
      </div>
    );

  /* ================================ FINALE ================================ */
  if (phase === "finale")
    return (
      <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-lime-400/40 bg-lime-400/10">
              <Check className="h-5 w-5 text-lime-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-50">You&apos;re all set.</h2>
              <p className="text-xs text-zinc-500">Welcome to UpNova. Your world starts here.</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-line bg-card-raised p-3.5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Your profile
              </p>
              <span className="font-mono text-[11px] font-bold tracking-[0.08em] text-lime-300">{checklist.pct}% complete</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
              <div className="h-full rounded-full bg-lime-400 transition-all" style={{ width: `${checklist.pct}%` }} />
            </div>
            <ul className="mt-3 space-y-1.5">
              {checklist.items.map((it) => (
                <li key={it.label} className="flex items-center gap-2 text-xs">
                  {it.done ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-lime-400" />
                  ) : (
                    <Circle className="h-3 w-3 shrink-0 text-zinc-600" />
                  )}
                  <span className={it.done ? "text-zinc-400" : "text-zinc-200"}>{it.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-zinc-600">Every step is optional — come back to any of it later.</p>
          </div>

          {/* LEVEL 2: now you know the basics — learn by scenario */}
          <div className="mt-4 rounded-xl border border-violet-400/25 bg-violet-400/5 p-3.5">
            <p className="text-xs font-bold text-zinc-100">Want to see how UpNova works for you?</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">Short real-world walkthroughs — pick your path:</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {[
                { label: "I'm here to book", path: "client" },
                { label: "I provide services", path: "provider" },
                { label: "I'm a business", path: "business" },
                { label: "I'm a creator", path: "creator" },
              ].map((p) => (
                <button
                  key={p.path}
                  onClick={async () => { await finish(false); router.push(`/learn?path=${p.path}`); }}
                  className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-violet-400/40 hover:text-violet-200"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { label: "Complete your profile", href: "/profile/edit" },
              { label: "Find people", href: "/discover" },
              { label: "Explore opportunities", href: "/opportunities" },
              { label: "Customize My World", href: "/profile/studio" },
            ].map((a) => (
              <button
                key={a.href}
                onClick={async () => {
                  await finish(false);
                  router.push(a.href);
                }}
                className="btn-ghost justify-center py-2 text-xs"
              >
                {a.label}
              </button>
            ))}
          </div>
          <button onClick={() => finish(false)} className="btn-lime mt-3 w-full justify-center py-2.5 text-sm">
            Explore UpNova <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );

  /* ================================ TOURING ================================ */
  if (!tour || !step) return null;
  const total = tour.steps.length;
  const pad = 6;

  // card placement: beside the spotlight when there's room, else centered
  const cardW = 340;
  let cardStyle: React.CSSProperties = {};
  let placed = false;
  if (rect && typeof window !== "undefined") {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.left + rect.width + cardW + 40 < vw) {
      cardStyle = { top: Math.max(16, Math.min(rect.top - 8, vh - 320)), left: rect.left + rect.width + 20 };
      placed = true;
    } else if (rect.top + rect.height + 240 < vh) {
      cardStyle = { top: rect.top + rect.height + 14, left: Math.max(16, Math.min(rect.left, vw - cardW - 16)) };
      placed = true;
    }
  }

  return (
    <div className="fixed inset-0 z-[95]" role="dialog" aria-label="UpNova tour">
      {/* dimmed world with a spotlight cut around the real element */}
      {rect ? (
        <div
          className="absolute rounded-xl ring-2 ring-lime-400/80 transition-all duration-300 ease-out"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(5,5,12,0.82)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/80" />
      )}

      {/* step card */}
      <div
        className={`absolute w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-card p-4 shadow-2xl transition-all duration-300 ${
          placed ? "" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        }`}
        style={placed ? cardStyle : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            {i + 1} of {total}
          </p>
          <button onClick={() => finish(true)} aria-label="Skip tour" className="text-zinc-500 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="mt-1 text-base font-bold text-zinc-50">{step.title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">{step.body}</p>
        {tour.demoMode && (
          <p className="mt-2 text-[10px] text-zinc-600">
            {tour.demoMode === "demo"
              ? "Demo Mode is on — you can explore features without the usual account restrictions."
              : "Simulation Mode is on — you're seeing exactly what a real account with your plan sees."}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {tour.steps.map((_, d) => (
              <span key={d} className={`h-1 rounded-full transition-all ${d === i ? "w-4 bg-lime-400" : "w-1 bg-zinc-700"}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={back} className="btn-ghost px-3 py-1.5 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button onClick={next} className="btn-lime px-3.5 py-1.5 text-xs">
              {i === total - 1 ? "Finish tour" : "Next"} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <button onClick={() => finish(true)} className="mt-2 w-full text-center text-[10px] font-semibold text-zinc-600 hover:text-zinc-400">
          Skip tour
        </button>
      </div>
    </div>
  );
}
