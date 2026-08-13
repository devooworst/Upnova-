/* ------------------------------------------------------------------ */
/*  Mavyn's CATEGORY COLOR SYSTEM — the single source of truth.        */
/*                                                                     */
/*  One hue per content type, so a card's kind reads at a glance       */
/*  before the words do:                                               */
/*                                                                     */
/*    opportunity  lime    "a way to earn — apply"                     */
/*    service      sky     "someone offers a skill — book/request"     */
/*    shop         amber   "something for sale — buy"  (gold)          */
/*    work         violet  "a creation to license/see" (purple)        */
/*    booking      orange  "scheduled / reserved time"                 */
/*    client       rose    "a client relationship"     (coral)         */
/*    activity     zinc    "general activity"          (neutral)       */
/*                                                                     */
/*  RULES: subtle accents only — chips, dots, icons, thin top edges.   */
/*  Never whole-card floods, never navigation/header (Mavyn's nav      */
/*  stays Mavyn; lime remains THE brand + money color: prices, pay     */
/*  buttons and plan surfaces are untouched). Color is never the only  */
/*  signal — every chip carries its text label, matching a11y rules.   */
/*                                                                     */
/*  Card top-edge classes live in globals.css (.card-opportunity,      */
/*  .card-service, .card-shop, .card-work, …) sharing .card-money's    */
/*  exact geometry so nothing shifts — only the hue of the edge.       */
/* ------------------------------------------------------------------ */

export type ContentCategory =
  | "opportunity"
  | "service"
  | "shop"
  | "work"
  | "booking"
  | "client"
  | "activity";

export const CATEGORY_META: Record<
  ContentCategory,
  {
    label: string;
    /** tiny identity dot (feed ref chips, notification dots) */
    dot: string;
    /** text tint for icons/labels */
    text: string;
    /** full chip: border + faint bg + text */
    chip: string;
    /** card top-edge class (defined in globals.css) */
    card: string;
  }
> = {
  opportunity: {
    label: "Opportunity",
    dot: "bg-lime-400",
    text: "text-lime-300",
    chip: "border-lime-400/40 bg-lime-400/10 text-lime-300",
    card: "card-opportunity",
  },
  service: {
    label: "Service",
    dot: "bg-sky-400",
    text: "text-sky-300",
    chip: "border-sky-400/40 bg-sky-400/10 text-sky-300",
    card: "card-service",
  },
  shop: {
    label: "Shop",
    dot: "bg-amber-400",
    text: "text-amber-300",
    chip: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    card: "card-shop",
  },
  work: {
    label: "Work",
    dot: "bg-violet-400",
    text: "text-violet-300",
    chip: "border-violet-400/40 bg-violet-400/10 text-violet-300",
    card: "card-work",
  },
  booking: {
    label: "Booking",
    dot: "bg-orange-400",
    text: "text-orange-300",
    chip: "border-orange-400/40 bg-orange-400/10 text-orange-300",
    card: "card-booking",
  },
  client: {
    label: "Client",
    dot: "bg-rose-400",
    text: "text-rose-300",
    chip: "border-rose-400/40 bg-rose-400/10 text-rose-300",
    card: "card-client",
  },
  activity: {
    label: "Activity",
    dot: "bg-zinc-500",
    text: "text-zinc-400",
    chip: "border-zinc-500/40 bg-zinc-500/10 text-zinc-400",
    card: "card-activity",
  },
};

/** Small labeled category pill — dot + text so color is never the only signal. */
export function CategoryChip({ category, label, className = "" }: { category: ContentCategory; label?: string; className?: string }) {
  const m = CATEGORY_META[category];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${m.chip} ${className}`}
      data-category={category}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {label ?? m.label}
    </span>
  );
}
