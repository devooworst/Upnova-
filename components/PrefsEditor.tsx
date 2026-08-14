"use client";

/* ------------------------------------------------------------------ */
/*  PrefsEditor — Settings → Personalization.                          */
/*  The SAME four onboarding questions, editable forever: interests,   */
/*  goals, vibe, want-more. Reads and writes /api/me/preferences (one  */
/*  source of truth with the post-signup flow; interests share the     */
/*  profile's interests field). Honest framing: these tune             */
/*  recommendations, they never define the account — actual behavior   */
/*  outweighs them over time.                                          */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  INTEREST_OPTIONS, GOAL_OPTIONS, VIBE_OPTIONS, WANT_MORE_OPTIONS,
} from "@/lib/onboardingPrefs";

const ACCENTS = {
  interests: "border-lime-400/50 bg-lime-400/10 text-lime-300",
  goals: "border-sky-400/50 bg-sky-400/10 text-sky-300",
  vibe: "border-violet-400/50 bg-violet-400/10 text-violet-300",
  wantMore: "border-amber-400/50 bg-amber-400/10 text-amber-300",
} as const;

/* module-scope so React keeps chip identity across renders */
function Group({ title, hint, options, list, onToggle, accent }: {
  title: string; hint: string;
  options: readonly { id: string; label: string }[];
  list: string[]; onToggle: (v: string) => void; accent: string;
}) {
  return (
    <div className="mt-4">
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">{title}</p>
      <p className="mb-1.5 text-[11px] text-zinc-600">{hint}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = list.includes(o.id);
          return (
            <button
              key={o.id}
              onClick={() => onToggle(o.id)}
              aria-pressed={on}
              className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? accent : "border-line text-zinc-400 hover:border-zinc-600"}`}
            >
              {on && <Check className="h-3 w-3" />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PrefsEditor() {
  const [interests, setInterests] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [vibe, setVibe] = useState<string[]>([]);
  const [wantMore, setWantMore] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    fetch("/api/me/preferences", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setInterests(d.interests ?? []);
        setGoals(d.goals ?? []);
        setVibe(d.vibe ?? []);
        setWantMore(d.wantMore ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
    setDirty(true);
    setState("idle");
  };

  const save = async () => {
    setState("saving");
    try {
      const r = await fetch("/api/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests, goals, vibe, wantMore }),
      });
      setState(r.ok ? "saved" : "error");
      if (r.ok) setDirty(false);
    } catch {
      setState("error");
    }
  };

  if (!loaded) return <div className="h-40 animate-pulse rounded-xl bg-card-raised" aria-hidden />;

  return (
    <div data-guide="prefs-editor">
      <Group
        title="Interests — what you like"
        hint="Also editable from your profile. Seeds what shows up first."
        options={INTEREST_OPTIONS.map((l) => ({ id: l, label: l }))}
        list={interests} onToggle={(v) => toggle(interests, setInterests, v)} accent={ACCENTS.interests}
      />
      <Group
        title="Goals — what you want to do"
        hint="Shapes which cards Mavyn leads with (opportunities, services, work…)."
        options={GOAL_OPTIONS} list={goals} onToggle={(v) => toggle(goals, setGoals, v)} accent={ACCENTS.goals}
      />
      <Group
        title="Your vibe — how you describe yourself"
        hint="Identity, not assessment. Pick what feels like you."
        options={VIBE_OPTIONS} list={vibe} onToggle={(v) => toggle(vibe, setVibe, v)} accent={ACCENTS.vibe}
      />
      <Group
        title="More of — what you want Mavyn to give you"
        hint="Pulls what you asked for into the earliest feed slots."
        options={WANT_MORE_OPTIONS} list={wantMore} onToggle={(v) => toggle(wantMore, setWantMore, v)} accent={ACCENTS.wantMore}
      />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={!dirty || state === "saving"} className="btn-lime px-4 py-2 text-xs disabled:opacity-50" data-guide="prefs-save">
          {state === "saving" ? "Saving…" : "Save preferences"}
        </button>
        {state === "saved" && <span className="text-xs font-semibold text-lime-300">Saved — your feed updates immediately.</span>}
        {state === "error" && <span className="text-xs font-semibold text-rose-300">Couldn&apos;t save — try again.</span>}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
        These are starting signals, not labels. What you actually do — follow, like, save,
        search, mark not-interested — gradually outweighs them, so your feed evolves with you.
      </p>
    </div>
  );
}
