"use client";

/* ------------------------------------------------------------------ */
/*  FeatureTour — contextual tutorials on the REAL page.               */
/*                                                                     */
/*  · First visit to a covered area → a small, non-blocking offer pill */
/*    ("quick tour?"). Never a forced walkthrough.                     */
/*  · A floating "?" button lets anyone reopen the tour at any time —  */
/*    including after skipping it.                                     */
/*  · Steps spotlight actual UI elements ([data-tut] anchors); steps   */
/*    without an anchor (or with one that isn't on screen) render as   */
/*    a centered card, so the walkthrough never breaks.                */
/*  · Controls: Back · Next/Finish · Skip tour · Exit (✕) ·            */
/*    Don't show again. Completion is tracked PER USER PER FEATURE     */
/*    server-side (/api/me/tours) — finishing or skipping means it     */
/*    never nags again; "Exit" just closes for now.                    */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, X } from "lucide-react";
import { useSession } from "@/lib/session";
import { tourForPath, type FeatureTourDef } from "@/lib/tours";
import { TOUR_TO_SCENARIO } from "@/lib/learnScenarios";
import { openLearnGuide } from "@/components/LearnGuide";

type Rect = { top: number; left: number; width: number; height: number } | null;

export default function FeatureTour() {
  const { user } = useSession();
  const pathname = usePathname();
  const [state, setState] = useState<Record<string, string> | null>(null); // per-feature status
  const [running, setRunning] = useState<FeatureTourDef | null>(null);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect>(null);
  const [offerHidden, setOfferHidden] = useState(false);
  const rafRef = useRef(0);

  const tour = pathname ? tourForPath(pathname) : null;

  /* load per-user tutorial state once per session */
  useEffect(() => {
    if (!user) return;
    let dead = false;
    fetch("/api/me/tours", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!dead) setState(d.tours ?? {}); })
      .catch(() => { if (!dead) setState({}); });
    return () => { dead = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* page change: close any running tour, reset the session-level offer */
  useEffect(() => {
    setRunning(null);
    setStep(0);
    try {
      setOfferHidden(!!tour && sessionStorage.getItem(`mavyn-tour-offer-${tour.id}`) === "later");
    } catch {
      setOfferHidden(false);
    }
  }, [pathname, tour?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = useCallback((id: string, status: "done" | "dismissed") => {
    setState((s) => ({ ...(s ?? {}), [id]: status }));
    fetch("/api/me/tours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    }).catch(() => {});
  }, []);

  /* measure the current step's anchor (if any) */
  const measure = useCallback(() => {
    if (!running) return setRect(null);
    const sel = running.steps[step]?.sel;
    if (!sel) return setRect(null);
    const el = document.querySelector(`[data-tut="${sel}"]`) as HTMLElement | null;
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return setRect(null);
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [running, step]);

  useEffect(() => {
    if (!running) return;
    const sel = running.steps[step]?.sel;
    if (sel) {
      const el = document.querySelector(`[data-tut="${sel}"]`) as HTMLElement | null;
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    const t = setTimeout(measure, 350); // after the scroll settles
    const onMove = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [running, step, measure]);

  if (!user || !tour) return null;

  const status = state?.[tour.id];
  const showOffer = state !== null && !status && !offerHidden && !running;

  const start = () => { setStep(0); setRunning(tour); };
  const later = () => {
    setOfferHidden(true);
    try { sessionStorage.setItem(`mavyn-tour-offer-${tour.id}`, "later"); } catch {}
  };

  const s = running?.steps[step];
  const last = running ? step === running.steps.length - 1 : false;

  /* card placement: under the anchor when there's room, else above, else centered */
  const cardPos: React.CSSProperties = rect
    ? rect.top + rect.height + 190 < window.innerHeight
      ? { top: rect.top + rect.height + 10, left: Math.min(Math.max(12, rect.left), window.innerWidth - 360) }
      : { top: Math.max(12, rect.top - 190), left: Math.min(Math.max(12, rect.left), window.innerWidth - 360) }
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <>
      {/* floating help — reopen the walkthrough any time */}
      {!running && (
        <button
          onClick={start}
          className="fixed bottom-20 right-4 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-zinc-400 shadow-card transition hover:border-zinc-600 hover:text-lime-300 md:bottom-5"
          title={`Learn this page — ${tour.title}`}
          aria-label="Open the page tutorial"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      )}

      {/* first-visit offer — small, dismissible, never a wall */}
      {showOffer && (
        <div className="fixed bottom-20 left-3 z-40 w-72 max-w-[85vw] rounded-2xl border border-line bg-card p-3.5 shadow-card md:bottom-5">
          <p className="text-xs font-bold text-zinc-100">New here? {tour.title}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">A {tour.steps.length}-step tour of this page — on the page itself.</p>
          <div className="mt-2 flex items-center gap-2">
            <button onClick={start} className="btn-lime px-3 py-1.5 text-[11px]">Take the tour</button>
            <button onClick={later} className="btn-ghost px-2.5 py-1.5 text-[11px]">Not now</button>
            <button onClick={() => persist(tour.id, "dismissed")} className="ml-auto text-[10px] text-zinc-600 underline-offset-2 hover:text-zinc-400 hover:underline">
              Don&apos;t show again
            </button>
          </div>
        </div>
      )}

      {/* the running tour */}
      {running && s && (
        <div className="fixed inset-0 z-[70]">
          {/* dim layer — click closes (exit, not persisted) */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setRunning(null)} aria-hidden />
          {/* spotlight ring on the real element */}
          {rect && (
            <div
              className="pointer-events-none absolute rounded-xl border-2 border-lime-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.6),0_0_24px_rgba(163,230,53,0.35)]"
              style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
              aria-hidden
            />
          )}
          {/* step card */}
          <div className="absolute w-[340px] max-w-[92vw] rounded-2xl border border-line bg-card p-4 shadow-2xl" style={cardPos} role="dialog" aria-modal="true">
            <div className="flex items-start justify-between gap-2">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-lime-300">
                {running.title} · {step + 1}/{running.steps.length}
              </p>
              <button onClick={() => setRunning(null)} className="rounded p-0.5 text-zinc-500 hover:text-zinc-200" title="Exit tutorial" aria-label="Exit tutorial">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <h3 className="mt-1.5 text-sm font-bold tracking-tight text-zinc-50">{s.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{s.body}</p>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => setStep((x) => Math.max(0, x - 1))} disabled={step === 0} className="btn-ghost px-3 py-1.5 text-[11px] disabled:opacity-30">
                Back
              </button>
              <button
                onClick={() => {
                  if (last) { persist(running.id, "done"); setRunning(null); }
                  else setStep((x) => x + 1);
                }}
                className="btn-lime px-4 py-1.5 text-[11px]"
              >
                {last ? "Finish" : "Next"}
              </button>
              {TOUR_TO_SCENARIO[running.id] && (
                <button
                  onClick={() => { setRunning(null); openLearnGuide(TOUR_TO_SCENARIO[running.id]); }}
                  className="text-[10px] font-semibold text-violet-300 hover:text-violet-200"
                  title="Open the deeper scenario guide for this feature"
                >
                  Learn more
                </button>
              )}
              <button onClick={() => { persist(running.id, "done"); setRunning(null); }} className="ml-auto text-[10px] text-zinc-500 hover:text-zinc-300">
                Skip tour
              </button>
              <button onClick={() => { persist(running.id, "dismissed"); setRunning(null); }} className="text-[10px] text-zinc-600 underline-offset-2 hover:text-zinc-400 hover:underline">
                Don&apos;t show again
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
