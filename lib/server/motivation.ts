/* ------------------------------------------------------------------ */
/*  Mavyn Motivation — the OPT-IN encouragement channel.               */
/*                                                                     */
/*  Rules (non-negotiable):                                            */
/*   · strictly opt-in: default OFF, one switch away from off again    */
/*   · never excessive: frequency + time window are user-controlled,   */
/*     delivery is idempotent per period (jobs.ts checks last send)    */
/*   · honest sources only: the general pool below is Mavyn's own      */
/*     voice; "from creators you follow" links to a REAL post by       */
/*     someone the user chose to follow — quotes are never invented    */
/*     or attributed to anyone                                         */
/* ------------------------------------------------------------------ */

export const MOTIVATION_QUOTES: string[] = [
  "Keep building. The work you're doing today is creating the opportunities you'll have tomorrow.",
  "Nobody starts great. They start — and then they get great.",
  "Your next client, collaborator, or breakthrough is one honest piece of work away.",
  "Done and shared beats perfect and hidden. Ship the thing.",
  "Small consistent reps compound into a reputation.",
  "The portfolio you wish you had is built one project at a time — this week counts.",
  "Talent gets you noticed. Follow-through gets you paid.",
  "Ask for the gig. The worst realistic outcome is exactly where you already are.",
  "Every creator you admire once had zero followers and kept going anyway.",
  "Protect two focused hours today. That's where the real work happens.",
  "Momentum loves a finished draft.",
  "You don't need permission to start — you need a first version.",
  "Rest is part of the work. Come back sharp.",
  "The niche feels small until it's yours.",
  "Show the process. People hire people they've watched improve.",
  "One outreach message a day is thirty doors a month.",
];

/** deterministic per-user daily pick — no repeats until the pool cycles */
export function quoteFor(userId: string, when = new Date()): string {
  const day = Math.floor(when.getTime() / 86_400_000);
  let h = 0;
  for (const ch of userId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MOTIVATION_QUOTES[(h + day) % MOTIVATION_QUOTES.length];
}

/** the delivery window in server-local hours (any = around the clock) */
export function inWindow(window: "any" | "morning" | "afternoon" | "evening", when = new Date()): boolean {
  const h = when.getHours();
  if (window === "morning") return h >= 7 && h < 12;
  if (window === "afternoon") return h >= 12 && h < 17;
  if (window === "evening") return h >= 17 && h < 22;
  return true;
}

/** minimum gap between sends per frequency setting */
export function minGapMs(frequency: "daily" | "few-week" | "weekly"): number {
  if (frequency === "daily") return 20 * 3600_000; // ~1/day
  if (frequency === "weekly") return 6.5 * 86_400_000; // ~1/week
  return 2.5 * 86_400_000; // a few times a week
}
