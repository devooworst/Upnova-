"use client";

/* ------------------------------------------------------------------ */
/*  PersonalizeFlow — the short post-signup personalization moment.    */
/*                                                                     */
/*  1 Interests → 2 Goals → 3 Your vibe → 4 More of → Mavyn tour       */
/*                                                                     */
/*  Design rules (deliberate):                                         */
/*   · chips and trait cards, never a form — fast, visual, tappable    */
/*   · everything optional: every step skips, the whole thing skips,   */
/*     and nothing in the app is gated behind it                       */
/*   · the vibe step reads like picking character traits, not a        */
/*     questionnaire — identity, not assessment                        */
/*   · no sensitive questions, ever (see lib/onboardingPrefs.ts)       */
/*   · honest about what it does: tunes the first For You/Discover,    */
/*     editable in Settings, behavior outweighs it over time           */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import {
  ArrowLeft, ArrowRight, Check,
  Music2, Clapperboard, Trophy, Palette, Camera, Shirt, Gamepad2, Cpu,
  Briefcase, Rocket, GraduationCap, UtensilsCrossed, Plane, Video,
  CalendarDays, Dumbbell, Users, Handshake,
  UserPlus, PenTool, DollarSign, ShoppingBag, Megaphone, Share2, BookOpen, Compass,
  Paintbrush, Flame, Telescope, Lightbulb, MessagesSquare, Target, Mountain,
  Mic, Wrench, Shuffle, Moon,
  Sparkles, MapPin, FolderKanban, MessageCircle,
} from "lucide-react";
import {
  INTEREST_OPTIONS, GOAL_OPTIONS, VIBE_OPTIONS, WANT_MORE_OPTIONS,
} from "@/lib/onboardingPrefs";

type Icon = typeof Music2;

const INTEREST_ICONS: Record<string, Icon> = {
  "Music": Music2, "Entertainment": Clapperboard, "Sports": Trophy, "Art & Design": Palette,
  "Photography": Camera, "Fashion": Shirt, "Gaming": Gamepad2, "Technology": Cpu,
  "Business": Briefcase, "Entrepreneurship": Rocket, "Education": GraduationCap, "Food": UtensilsCrossed,
  "Travel": Plane, "Content Creation": Video, "Events & Culture": CalendarDays, "Fitness": Dumbbell,
  "Community": Users, "Freelancing & Opportunities": Handshake,
};
const GOAL_ICONS: Record<string, Icon> = {
  "discover-people": Users, "create-share": PenTool, "make-money": DollarSign,
  "find-opportunities": Briefcase, "hire-people": UserPlus, "find-clients": Handshake,
  "sell-something": ShoppingBag, "build-brand": Megaphone, "network": Share2,
  "learn": BookOpen, "explore": Compass,
};
const VIBE_ICONS: Record<string, Icon> = {
  "creative": Paintbrush, "ambitious": Flame, "curious": Telescope, "innovative": Lightbulb,
  "social": MessagesSquare, "goal-oriented": Target, "independent": Mountain, "expressive": Mic,
  "hands-on": Wrench, "always-learning": BookOpen, "trying-new-things": Shuffle, "low-key": Moon,
};
const MORE_ICONS: Record<string, Icon> = {
  "inspiration": Sparkles, "opportunities": Briefcase, "people": Users, "learning": GraduationCap,
  "entertainment": Clapperboard, "creative-ideas": Lightbulb, "local-events": MapPin,
  "jobs-projects": FolderKanban, "products": ShoppingBag, "services": Wrench, "conversations": MessageCircle,
};

/* per-step accent — color never stands alone, the check mark travels with it */
const STEPS = [
  {
    id: "interests", short: "Interests",
    title: "What are you into?",
    sub: "Pick anything that sounds like you — it seeds your feed.",
    accent: "border-lime-400/60 bg-lime-400/10 text-lime-300",
  },
  {
    id: "goals", short: "Goals",
    title: "What brings you to Mavyn?",
    sub: "Choose as many as you want — Mavyn shapes itself around it.",
    accent: "border-sky-400/60 bg-sky-400/10 text-sky-300",
  },
  {
    id: "vibe", short: "Your vibe",
    title: "What's your vibe?",
    sub: "Pick your traits — like building a character, except it's you.",
    accent: "border-violet-400/60 bg-violet-400/10 text-violet-300",
  },
  {
    id: "wantMore", short: "More of",
    title: "What do you want more of?",
    sub: "Tell Mavyn what to hand you first.",
    accent: "border-amber-400/60 bg-amber-400/10 text-amber-300",
  },
] as const;

/* one selectable chip — icon + label + check, per-step accent.
   Module-scope so React keeps chip identity across renders. */
function Chip({ id, label, on, accent, onToggle, icons, big = false }: {
  id: string; label: string; on: boolean; accent: string; onToggle: () => void;
  icons: Record<string, Icon>; big?: boolean;
}) {
  const IconEl = icons[id] ?? Sparkles;
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      className={
        big
          ? `flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition active:scale-[0.97] ${on ? accent : "border-line bg-card-raised/40 text-zinc-400 hover:border-zinc-600"}`
          : `flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition active:scale-[0.97] ${on ? accent : "border-line text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"}`
      }
    >
      <IconEl className={big ? "h-5 w-5" : "h-3.5 w-3.5"} />
      <span className={big ? "text-xs font-semibold leading-tight" : ""}>{label}</span>
      {on && <Check className={big ? "h-3.5 w-3.5" : "h-3 w-3"} />}
    </button>
  );
}

export default function PersonalizeFlow({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [interests, setInterests] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [vibe, setVibe] = useState<string[]>([]);
  const [wantMore, setWantMore] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const picked = interests.length + goals.length + vibe.length + wantMore.length;

  const save = async (skippedAll: boolean) => {
    setSaving(true);
    await fetch("/api/me/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        skippedAll && picked === 0
          ? { skipped: true }
          : { interests, goals, vibe, wantMore }
      ),
    }).catch(() => {});
    setSaving(false);
    onDone(); // the tour takes over — never trap the user here
  };

  const next = () => (i < 3 ? setI(i + 1) : void save(false));
  const step = STEPS[i];


  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" data-guide="personalize-flow">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl border border-line bg-card shadow-2xl sm:rounded-2xl">
        {/* progress — 1 Interests → 2 Goals → 3 Your vibe → 4 More of → tour */}
        <div className="border-b border-line-soft px-5 pb-3 pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {i + 1} of 4 · then the Mavyn tour
            </p>
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="text-[11px] font-semibold text-zinc-500 transition hover:text-zinc-300"
              data-guide="personalize-skip"
            >
              Skip all
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1.5" aria-hidden>
            {STEPS.map((s, d) => (
              <span key={s.id} className={`h-1 flex-1 rounded-full transition-all ${d < i ? "bg-zinc-500" : d === i ? "bg-lime-400" : "bg-zinc-800"}`} />
            ))}
          </div>
          <div className="mt-1.5 hidden items-center gap-1 text-[10px] text-zinc-600 sm:flex">
            {STEPS.map((s, d) => (
              <span key={s.id} className="flex items-center gap-1">
                {d > 0 && <ArrowRight className="h-2.5 w-2.5" />}
                <span className={d === i ? "font-semibold text-zinc-300" : ""}>{s.short}</span>
              </span>
            ))}
          </div>
        </div>

        {/* the step — chips, never a form */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <h2 className="text-lg font-bold tracking-tight text-zinc-50">{step.title}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{step.sub}</p>

          {step.id === "interests" && (
            <div className="mt-4 flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((l) => (
                <Chip key={l} id={l} label={l} on={interests.includes(l)} accent={step.accent} onToggle={() => toggle(interests, setInterests, l)} icons={INTEREST_ICONS} />
              ))}
            </div>
          )}
          {step.id === "goals" && (
            <div className="mt-4 flex flex-wrap gap-2">
              {GOAL_OPTIONS.map((g) => (
                <Chip key={g.id} id={g.id} label={g.label} on={goals.includes(g.id)} accent={step.accent} onToggle={() => toggle(goals, setGoals, g.id)} icons={GOAL_ICONS} />
              ))}
            </div>
          )}
          {step.id === "vibe" && (
            /* character-select: trait cards, not a questionnaire */
            <div className="mt-4 grid grid-cols-3 gap-2">
              {VIBE_OPTIONS.map((v) => (
                <Chip key={v.id} id={v.id} label={v.label} on={vibe.includes(v.id)} accent={step.accent} onToggle={() => toggle(vibe, setVibe, v.id)} icons={VIBE_ICONS} big />
              ))}
            </div>
          )}
          {step.id === "wantMore" && (
            <div className="mt-4 flex flex-wrap gap-2">
              {WANT_MORE_OPTIONS.map((w) => (
                <Chip key={w.id} id={w.id} label={w.label} on={wantMore.includes(w.id)} accent={step.accent} onToggle={() => toggle(wantMore, setWantMore, w.id)} icons={MORE_ICONS} />
              ))}
            </div>
          )}
        </div>

        {/* footer — honest, optional, reversible */}
        <div className="border-t border-line-soft px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => i > 0 && setI(i - 1)}
              className={`btn-ghost px-3 py-2 text-xs ${i === 0 ? "invisible" : ""}`}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <div className="flex items-center gap-2">
              {/* skip appears only while the step is empty — once you've
                  picked, Next is the same action with a truthful label */}
              {[interests, goals, vibe, wantMore][i].length === 0 && (
                <button onClick={next} disabled={saving} className="btn-ghost px-3 py-2 text-xs text-zinc-400" data-guide="personalize-step-skip">
                  Skip this step
                </button>
              )}
              <button onClick={next} disabled={saving} className="btn-lime px-4 py-2 text-sm" data-guide="personalize-next">
                {i === 3 ? (saving ? "Saving…" : "Finish") : "Next"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] leading-relaxed text-zinc-600">
            This just tunes your first For You and Discover — change any of it in Settings, anytime.
            What you actually do on Mavyn matters more over time.
          </p>
        </div>
      </div>
    </div>
  );
}
