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

export interface WorldElement {
  x: number; // % of canvas width (0–100)
  y: number; // px from canvas top (0–4000)
  w: number; // % width (24–100)
  /** min-height in px (0 = size to content). Content can never be clipped:
      cards grow with their real content, this only adds room. */
  h: number;
  rotate: number; // degrees, clamped ±8 — personality, never chaos
  layer: number; // z-order 0–20
  hidden: boolean;
}

export interface WorldConfig {
  enabled: boolean;
  environment: string; // ENVIRONMENTS id — the full-bleed backdrop scene
  elements: Record<string, WorldElement>; // keyed by APPROVED element ids
  /** the world headline — custom text ("welcome to my studio…") or the
      default "{name}'s world"; hideable entirely. Plain text only. */
  title?: string;
  showTitle?: boolean;
}

export interface StudioConfig {
  theme: string; // THEMES id
  frame: string; // FRAMES id — avatar treatment
  accent: string; // ACCENTS id — heading/highlight color
  font: string; // FONTS id — heading typeface (approved families only)
  effect: string; // EFFECTS id — subtle cosmetic effect
  sections: string[]; // order of APPROVED section ids
  /** approved banner strip above the profile header */
  banner?: string;
  /** approved decorative ornaments (max 3) */
  decorations?: string[];
  /** My World — free placement of approved elements on desktop; mobile
      always falls back to a clean stacked layout so small screens never
      break. Move/rotate/layer/hide only — never markup or scripts. */
  world?: WorldConfig;
}

/* My World canvas elements — the hero block (avatar, name, identity
   badges, Message/Book/Follow actions) is one indivisible element:
   its INTERNALS are UpNova's and can never be split or hidden. */
export const WORLD_ELEMENT_IDS = ["hero", "trust", "posts", "services", "reviews", "experience"] as const;
export const WORLD_ELEMENT_LABELS: Record<string, string> = {
  hero: "Profile card (picture, name, bio, actions)",
  trust: "Trust & authenticity",
  posts: "Posts & featured work",
  services: "Services",
  reviews: "Reviews",
  experience: "Experience",
};

/* THE CANONICAL DEFAULT = the original UpNova profile structure:
   one full-width column, original section order, original spacing,
   no rotation, content-sized heights. "Default layout" restores
   exactly this — the profile every visitor knows. */
export const DEFAULT_WORLD: WorldConfig = {
  enabled: false,
  environment: "cosmic",
  elements: {
    hero: { x: 0, y: 0, w: 100, h: 0, rotate: 0, layer: 10, hidden: false },
    trust: { x: 0, y: 560, w: 100, h: 0, rotate: 0, layer: 9, hidden: false },
    posts: { x: 0, y: 1000, w: 100, h: 0, rotate: 0, layer: 8, hidden: false },
    services: { x: 0, y: 1560, w: 100, h: 0, rotate: 0, layer: 7, hidden: false },
    reviews: { x: 0, y: 2040, w: 100, h: 0, rotate: 0, layer: 6, hidden: false },
    experience: { x: 0, y: 2440, w: 100, h: 0, rotate: 0, layer: 5, hidden: false },
  },
};

/* full-bleed environment scenes — pure CSS from THIS file only (users
   pick an id; they never supply style values). Text always sits on
   UpNova cards, so readability survives every scene. */
export const ENVIRONMENTS: Record<string, { label: string; desc: string; css: string; overlay: string }> = {
  cosmic: {
    label: "Cosmic",
    desc: "Deep space — nebulas and starfields",
    css: "radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.8) 50%, transparent 51%), radial-gradient(1px 1px at 70% 60%, rgba(255,255,255,0.7) 50%, transparent 51%), radial-gradient(1.5px 1.5px at 40% 80%, rgba(255,255,255,0.6) 50%, transparent 51%), radial-gradient(1px 1px at 85% 15%, rgba(255,255,255,0.7) 50%, transparent 51%), radial-gradient(ellipse 60% 40% at 70% 20%, rgba(139,92,246,0.25), transparent), radial-gradient(ellipse 50% 35% at 20% 75%, rgba(56,189,248,0.18), transparent), linear-gradient(180deg, #07070f 0%, #0d0a1f 50%, #07070f 100%)",
    overlay: "linear-gradient(180deg, rgba(10,10,15,0.25), rgba(10,10,15,0.55))",
  },
  earthy: {
    label: "Earthy",
    desc: "Forest floor — moss, vines, warm light",
    css: "radial-gradient(ellipse 70% 50% at 15% 10%, rgba(52,211,153,0.16), transparent), radial-gradient(ellipse 60% 40% at 85% 90%, rgba(217,119,6,0.12), transparent), repeating-linear-gradient(115deg, transparent 0 34px, rgba(52,211,153,0.05) 34px 36px), linear-gradient(180deg, #08120c 0%, #0a0f0a 100%)",
    overlay: "linear-gradient(180deg, rgba(8,12,8,0.2), rgba(8,12,8,0.5))",
  },
  emo: {
    label: "Dark Alternative",
    desc: "Black hearts, torn edges",
    css: "repeating-linear-gradient(45deg, transparent 0 28px, rgba(217,70,239,0.05) 28px 30px), radial-gradient(ellipse 55% 40% at 80% 15%, rgba(217,70,239,0.14), transparent), linear-gradient(180deg, #050505 0%, #120714 100%)",
    overlay: "linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.6))",
  },
  y2k: {
    label: "Y2K",
    desc: "Chrome, candy, dial-up dreams",
    css: "repeating-conic-gradient(from 0deg at 50% -20%, rgba(56,189,248,0.10) 0deg 12deg, transparent 12deg 24deg), radial-gradient(ellipse 60% 45% at 25% 20%, rgba(244,114,182,0.16), transparent), radial-gradient(ellipse 50% 40% at 80% 80%, rgba(56,189,248,0.15), transparent), linear-gradient(180deg, #060a14 0%, #120a14 100%)",
    overlay: "linear-gradient(180deg, rgba(6,10,20,0.25), rgba(6,10,20,0.55))",
  },
  gallery: {
    label: "Art Gallery",
    desc: "Neutral walls, spotlights on the work",
    css: "radial-gradient(ellipse 45% 30% at 30% 0%, rgba(255,255,255,0.10), transparent), radial-gradient(ellipse 45% 30% at 75% 0%, rgba(255,255,255,0.08), transparent), linear-gradient(180deg, #101012 0%, #0a0a0c 100%)",
    overlay: "none",
  },
  studio: {
    label: "Recording Studio",
    desc: "Dark booth, warm console glow",
    css: "radial-gradient(ellipse 55% 35% at 50% 100%, rgba(251,191,36,0.14), transparent), repeating-linear-gradient(90deg, transparent 0 60px, rgba(255,255,255,0.02) 60px 62px), linear-gradient(180deg, #0b0906 0%, #0d0a08 100%)",
    overlay: "linear-gradient(180deg, rgba(10,8,5,0.25), rgba(10,8,5,0.55))",
  },
  neon: {
    label: "Neon Grid",
    desc: "Electric horizon",
    css: "repeating-linear-gradient(0deg, transparent 0 46px, rgba(34,211,238,0.07) 46px 47px), repeating-linear-gradient(90deg, transparent 0 46px, rgba(34,211,238,0.07) 46px 47px), radial-gradient(ellipse 60% 40% at 50% 100%, rgba(217,70,239,0.16), transparent), linear-gradient(180deg, #04070d 0%, #0a0512 100%)",
    overlay: "linear-gradient(180deg, rgba(4,7,13,0.25), rgba(4,7,13,0.5))",
  },
  minimal: {
    label: "Minimal",
    desc: "Clean space, nothing loud",
    css: "linear-gradient(180deg, #0c0c10 0%, #0a0a0f 100%)",
    overlay: "none",
  },
};

const clamp = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

export function sanitizeWorld(input: unknown): WorldConfig {
  const o = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const elsIn = (typeof o.elements === "object" && o.elements !== null ? o.elements : {}) as Record<string, unknown>;
  const elements: Record<string, WorldElement> = {};
  for (const id of WORLD_ELEMENT_IDS) {
    const raw = (typeof elsIn[id] === "object" && elsIn[id] !== null ? elsIn[id] : {}) as Record<string, unknown>;
    const dflt = DEFAULT_WORLD.elements[id];
    elements[id] = {
      x: clamp(raw.x, 0, 100, dflt.x),
      y: clamp(raw.y, 0, 4000, dflt.y),
      w: clamp(raw.w, 24, 100, dflt.w),
      h: clamp(raw.h, 0, 1600, 0),
      rotate: clamp(raw.rotate, -8, 8, 0),
      layer: clamp(raw.layer, 0, 20, dflt.layer),
      hidden: id === "hero" ? false : !!raw.hidden, // the hero can NEVER be hidden
    };
  }
  return {
    enabled: !!o.enabled,
    environment: typeof o.environment === "string" && o.environment in ENVIRONMENTS ? o.environment : "cosmic",
    elements,
    // plain text only — control chars stripped, length capped; React
    // escaping keeps it inert everywhere it renders
    title: String(o.title ?? "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 80),
    showTitle: o.showTitle !== false,
  };
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
  campus: {
    label: "Campus",
    desc: "School colors, student energy",
    wash: "bg-gradient-to-b from-violet-950/40 via-transparent to-amber-950/20",
    card: "border-violet-400/25",
    deco: "bg-gradient-to-r from-violet-400/70 via-amber-400/50 to-violet-400/70",
    headerRing: "ring-1 ring-violet-400/30",
  },
  creative: {
    label: "Creative",
    desc: "Studio energy, maker vibes",
    wash: "bg-gradient-to-b from-rose-950/30 via-transparent to-sky-950/25",
    card: "border-rose-400/20",
    deco: "bg-gradient-to-r from-rose-400/60 via-amber-300/50 to-sky-400/60",
    headerRing: "ring-1 ring-rose-400/25",
  },
  academic: {
    label: "Academic",
    desc: "Library calm, ink and paper",
    wash: "bg-gradient-to-b from-sky-950/35 via-transparent to-zinc-950",
    card: "border-sky-400/20",
    deco: "bg-gradient-to-r from-sky-400/50 via-zinc-400/30 to-sky-400/50",
    headerRing: "ring-1 ring-sky-400/25",
  },
  artist: {
    label: "Artist",
    desc: "Gallery walls, paint accents",
    wash: "bg-gradient-to-b from-fuchsia-950/25 via-transparent to-emerald-950/20",
    card: "border-fuchsia-400/20",
    deco: "bg-gradient-to-r from-fuchsia-400/60 via-emerald-400/40 to-amber-400/60",
    headerRing: "ring-1 ring-fuchsia-400/25",
  },
};

/* approved banner strips (header top) — CSS only, from this file */
export const BANNERS: Record<string, { label: string; css: string }> = {
  none: { label: "None", css: "" },
  sunset: { label: "Sunset", css: "linear-gradient(90deg, #7c2d12, #be185d, #7c3aed)" },
  ocean: { label: "Ocean", css: "linear-gradient(90deg, #0c4a6e, #0e7490, #065f46)" },
  gold: { label: "Gold hour", css: "linear-gradient(90deg, #713f12, #d97706, #fbbf24)" },
  orchid: { label: "Orchid", css: "linear-gradient(90deg, #4a044e, #a21caf, #6d28d9)" },
  meadow: { label: "Meadow", css: "linear-gradient(90deg, #14532d, #4d7c0f, #a3e635)" },
  midnight: { label: "Midnight", css: "linear-gradient(90deg, #0f172a, #1e293b, #334155)" },
};

/* approved decorative elements — rendered as small lucide ornaments on the
   header; ids map to icons in the renderer. Max 3 at once. */
export const DECORATIONS: Record<string, { label: string }> = {
  stars: { label: "Stars" },
  hearts: { label: "Hearts" },
  vines: { label: "Vines" },
  sparkles: { label: "Sparkles" },
  notes: { label: "Music notes" },
  bolts: { label: "Lightning" },
};

/* ---- tier scopes: College+ decorates the room, Pro designs the house ---- */
export const COLLEGE_THEMES = ["none", "campus", "creative", "academic", "minimal", "artist"] as const;

/** Coerce a config to what College+ may SAVE and DISPLAY: student preset
    themes only, fixed section structure, no My World. Frames, accents,
    fonts, effects, banners, and decorations are theirs to play with. */
export function collegeRestrict(cfg: StudioConfig): StudioConfig {
  return {
    ...cfg,
    theme: (COLLEGE_THEMES as readonly string[]).includes(cfg.theme) ? cfg.theme : "none",
    sections: [...SECTION_IDS], // the house structure stays fixed
    world: cfg.world ? { ...cfg.world, enabled: false } : undefined,
  };
}

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
    banner: pick(o.banner, BANNERS, "none"),
    decorations: (Array.isArray(o.decorations) ? o.decorations.map(String) : [])
      .filter((d, i, arr) => d in DECORATIONS && arr.indexOf(d) === i)
      .slice(0, 3),
    world: o.world !== undefined ? sanitizeWorld(o.world) : undefined,
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
