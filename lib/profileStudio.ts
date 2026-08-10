/* ------------------------------------------------------------------ */
/* Profile Studio — the APPROVED design system (Pro feature).          */
/*                                                                     */
/* Appearance only, by construction: every option maps to a fixed,     */
/* readability-tested set of classes defined HERE. Users pick from     */
/* this menu — they never inject styles, scripts, or markup, so        */
/* navigation, messaging, payments, verification, reporting, auth,     */
/* and accessibility contrast are untouchable. Layout customization    */
/* reorders APPROVED content sections only; the profile header (name,  */
/* identity badges, actions) is fixed so core functionality stays      */
/* consistent everywhere.                                              */
/* ------------------------------------------------------------------ */

export interface StudioConfig {
  theme: string; // THEMES id
  frame: string; // FRAMES id — avatar treatment
  accent: string; // ACCENTS id — heading/highlight color
  font: string; // FONTS id — heading typeface (approved families only)
  effect: string; // EFFECTS id — subtle cosmetic effect
  sections: string[]; // order of APPROVED section ids
}

export const SECTION_IDS = ["trust", "posts", "services", "reviews", "experience"] as const;
export const SECTION_LABELS: Record<string, string> = {
  trust: "Trust & authenticity",
  posts: "Posts & featured work",
  services: "Services",
  reviews: "Reviews",
  experience: "Experience",
};

export const DEFAULT_STUDIO: StudioConfig = {
  theme: "none",
  frame: "none",
  accent: "none",
  font: "standard",
  effect: "none",
  sections: [...SECTION_IDS],
};

/* themes — page wash + card tint + decoration line. No emojis in UI;
   the vibe comes from color, texture, and the deco strip. */
export const THEMES: Record<string, { label: string; desc: string; wash: string; card: string; deco: string; headerRing: string }> = {
  none: { label: "UpNova Standard", desc: "The default look", wash: "", card: "", deco: "", headerRing: "" },
  earthy: {
    label: "Earthy",
    desc: "Nature — moss, leaves, warm ground",
    wash: "bg-gradient-to-b from-emerald-950/40 via-transparent to-amber-950/20",
    card: "border-emerald-400/20",
    deco: "bg-gradient-to-r from-emerald-400/60 via-lime-400/40 to-amber-400/60",
    headerRing: "ring-1 ring-emerald-400/30",
  },
  emo: {
    label: "Emo / Alternative",
    desc: "Black hearts, hard edges",
    wash: "bg-gradient-to-b from-zinc-950 via-transparent to-fuchsia-950/20",
    card: "border-fuchsia-400/20",
    deco: "bg-gradient-to-r from-zinc-600 via-fuchsia-500/50 to-zinc-600",
    headerRing: "ring-1 ring-fuchsia-400/25",
  },
  y2k: {
    label: "Y2K",
    desc: "MySpace-era chrome and candy",
    wash: "bg-gradient-to-b from-sky-950/40 via-transparent to-pink-950/30",
    card: "border-sky-400/25",
    deco: "bg-gradient-to-r from-sky-400/70 via-pink-400/60 to-violet-400/70",
    headerRing: "ring-2 ring-sky-400/30",
  },
  cosmic: {
    label: "Cosmic",
    desc: "Deep space, nebula purples",
    wash: "bg-gradient-to-b from-indigo-950/50 via-violet-950/20 to-transparent",
    card: "border-violet-400/25",
    deco: "bg-gradient-to-r from-indigo-400/60 via-violet-400/60 to-sky-400/60",
    headerRing: "ring-1 ring-violet-400/30",
  },
  gaming: {
    label: "Gaming",
    desc: "RGB glow, dark chassis",
    wash: "bg-gradient-to-b from-zinc-950 via-transparent to-emerald-950/20",
    card: "border-emerald-400/25",
    deco: "bg-gradient-to-r from-emerald-400/70 via-sky-400/60 to-fuchsia-400/70",
    headerRing: "ring-1 ring-emerald-400/30",
  },
  floral: {
    label: "Soft / Floral",
    desc: "Petals and pastels",
    wash: "bg-gradient-to-b from-rose-950/30 via-transparent to-violet-950/20",
    card: "border-rose-400/20",
    deco: "bg-gradient-to-r from-rose-400/50 via-pink-300/40 to-violet-300/50",
    headerRing: "ring-1 ring-rose-400/25",
  },
  neon: {
    label: "Neon / Futuristic",
    desc: "Electric edges",
    wash: "bg-gradient-to-b from-cyan-950/40 via-transparent to-fuchsia-950/30",
    card: "border-cyan-400/30",
    deco: "bg-gradient-to-r from-cyan-400/80 via-fuchsia-400/70 to-cyan-400/80",
    headerRing: "ring-2 ring-cyan-400/40",
  },
  minimal: {
    label: "Minimal",
    desc: "Quiet, more whitespace",
    wash: "",
    card: "border-zinc-700/60",
    deco: "bg-zinc-700",
    headerRing: "",
  },
};

/* avatar frames */
export const FRAMES: Record<string, { label: string; cls: string }> = {
  none: { label: "None", cls: "" },
  ring: { label: "Ring", cls: "ring-2 ring-zinc-300/70 rounded-full" },
  glow: { label: "Glow", cls: "rounded-full shadow-[0_0_24px_rgba(163,230,53,0.45)]" },
  gradient: { label: "Gradient ring", cls: "rounded-full p-0.5 bg-gradient-to-tr from-lime-400 via-sky-400 to-violet-400" },
  double: { label: "Double ring", cls: "rounded-full ring-2 ring-violet-400/70 ring-offset-2 ring-offset-ink" },
};

/* accent color for section headings + highlights (contrast-checked set) */
export const ACCENTS: Record<string, { label: string; text: string; bar: string }> = {
  none: { label: "Standard", text: "text-zinc-100", bar: "bg-zinc-600" },
  lime: { label: "Lime", text: "text-lime-300", bar: "bg-lime-400" },
  violet: { label: "Violet", text: "text-violet-300", bar: "bg-violet-400" },
  amber: { label: "Amber", text: "text-amber-300", bar: "bg-amber-400" },
  sky: { label: "Sky", text: "text-sky-300", bar: "bg-sky-400" },
  rose: { label: "Rose", text: "text-rose-300", bar: "bg-rose-400" },
  emerald: { label: "Emerald", text: "text-emerald-300", bar: "bg-emerald-400" },
};

/* heading typefaces — approved, already-bundled families only */
export const FONTS: Record<string, { label: string; cls: string }> = {
  standard: { label: "Standard", cls: "" },
  display: { label: "Display", cls: "font-display" },
  mono: { label: "Mono", cls: "font-mono tracking-tight" },
};

/* subtle cosmetic effects */
export const EFFECTS: Record<string, { label: string; cls: string }> = {
  none: { label: "None", cls: "" },
  glow: { label: "Card glow", cls: "shadow-[0_0_32px_rgba(139,92,246,0.12)]" },
  lift: { label: "Soft lift", cls: "shadow-xl shadow-black/40" },
};

/** Strict allow-list sanitizer — anything off-menu becomes the default.
    This is the entire security model: no free-form values ever persist. */
export function sanitizeStudio(input: unknown): StudioConfig {
  const o = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const pick = (v: unknown, table: Record<string, unknown>, fallback: string) =>
    typeof v === "string" && v in table ? v : fallback;
  const rawSections = Array.isArray(o.sections) ? o.sections.map(String) : [];
  const sections = rawSections.filter((s, i) => (SECTION_IDS as readonly string[]).includes(s) && rawSections.indexOf(s) === i);
  for (const s of SECTION_IDS) if (!sections.includes(s)) sections.push(s); // every approved section stays present
  return {
    theme: pick(o.theme, THEMES, "none"),
    frame: pick(o.frame, FRAMES, "none"),
    accent: pick(o.accent, ACCENTS, "none"),
    font: pick(o.font, FONTS, "standard"),
    effect: pick(o.effect, EFFECTS, "none"),
    sections,
  };
}

export function parseStudio(raw: string | null | undefined): StudioConfig | null {
  if (!raw) return null;
  try {
    return sanitizeStudio(JSON.parse(raw));
  } catch {
    return null;
  }
}
