/* ------------------------------------------------------------------ */
/*  APPLICATION SPEC — Mavyn provides the application infrastructure;  */
/*  the POSTER decides what to ask. One shared, client-safe module:    */
/*  the builder UI, the applicant UI, and the SERVER all import these  */
/*  same shapes and validators — required questions and answer types   */
/*  are enforced server-side with exactly this code.                   */
/*                                                                     */
/*  Principles: profile-first (never re-ask what Mavyn knows),         */
/*  structured controls over free text, simple by default, powerful    */
/*  when needed. One system for every industry — only questions vary.  */
/* ------------------------------------------------------------------ */

export type QuestionType = "short" | "long" | "yesno" | "choice" | "dropdown" | "number" | "date" | "link";

export interface AppQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  /** for choice (radio) and dropdown types */
  options?: string[];
}

export const QUESTION_TYPES: { id: QuestionType; label: string; hint: string }[] = [
  { id: "short", label: "Short answer", hint: "one line of text" },
  { id: "long", label: "Long answer", hint: "a paragraph" },
  { id: "yesno", label: "Yes / No", hint: "one tap" },
  { id: "choice", label: "Multiple choice", hint: "pick one option" },
  { id: "dropdown", label: "Dropdown", hint: "pick from a list" },
  { id: "number", label: "Number", hint: "e.g. years, rate, count" },
  { id: "date", label: "Date", hint: "date picker" },
  { id: "link", label: "Portfolio / link", hint: "URL — reel, GitHub, drive" },
];

export const MAX_QUESTIONS = 10;
const NEEDS_OPTIONS: QuestionType[] = ["choice", "dropdown"];

/** builder + server share one sanitizer — the stored config is always clean */
export function sanitizeQuestions(raw: unknown): AppQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: AppQuestion[] = [];
  for (const q of raw.slice(0, MAX_QUESTIONS)) {
    if (!q || typeof q !== "object") continue;
    const o = q as Record<string, unknown>;
    const label = String(o.label ?? "").trim().slice(0, 140);
    const type = QUESTION_TYPES.some((t) => t.id === o.type) ? (o.type as QuestionType) : "short";
    if (!label) continue;
    const options = NEEDS_OPTIONS.includes(type)
      ? (Array.isArray(o.options) ? o.options : [])
          .map((x) => String(x).trim().slice(0, 60))
          .filter(Boolean)
          .slice(0, 8)
      : undefined;
    if (NEEDS_OPTIONS.includes(type) && (!options || options.length < 2)) continue; // a choice needs choices
    out.push({
      id: String(o.id ?? "").trim().slice(0, 24) || `q${out.length + 1}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 16)}`,
      label,
      type,
      required: o.required !== false,
      options,
    });
  }
  return out;
}

/** one answer, validated by ITS question's type — server-enforced */
export function validateAnswer(q: AppQuestion, v: unknown): string | null {
  const s = v == null ? "" : String(v).trim();
  if (!s) return q.required ? `"${q.label}" is required` : null;
  switch (q.type) {
    case "yesno":
      return ["yes", "no"].includes(s.toLowerCase()) ? null : `"${q.label}" needs Yes or No`;
    case "choice":
    case "dropdown":
      return q.options?.includes(s) ? null : `"${q.label}" must be one of the listed options`;
    case "number":
      return /^-?\d+(\.\d+)?$/.test(s) && Math.abs(Number(s)) < 1_000_000_000 ? null : `"${q.label}" needs a number`;
    case "date":
      return Number.isFinite(Date.parse(s)) ? null : `"${q.label}" needs a valid date`;
    case "link":
      return /^https?:\/\/\S+$/i.test(s) || /^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(s) ? null : `"${q.label}" needs a link`;
    case "long":
      return s.length <= 2000 ? null : `"${q.label}" is limited to 2000 characters`;
    default:
      return s.length <= 300 ? null : `"${q.label}" is limited to 300 characters`;
  }
}

export function validateAnswers(questions: AppQuestion[], given: Record<string, unknown>): { ok: boolean; error?: string } {
  for (const q of questions) {
    const err = validateAnswer(q, given?.[q.id]);
    if (err) return { ok: false, error: err };
  }
  return { ok: true };
}

/** what gets stored on the application: question + typed answer, labeled */
export function answersForStorage(questions: AppQuestion[], given: Record<string, unknown>) {
  return questions
    .map((q) => ({ id: q.id, label: q.label, type: q.type, answer: given?.[q.id] == null ? "" : String(given[q.id]).trim().slice(0, 2000) }))
    .filter((a) => a.answer);
}

/* ---------------- length honesty for the poster ---------------- */

export function applicationLength(questions: AppQuestion[], requireMessage: boolean): { label: "Short" | "Moderate" | "Long"; advice: string | null } {
  const weight = questions.reduce((a, q) => a + (q.type === "long" ? 2 : 1), 0) + (requireMessage ? 1 : 0);
  if (weight <= 3) return { label: "Short", advice: null };
  if (weight <= 6) return { label: "Moderate", advice: null };
  return {
    label: "Long",
    advice: "This application is getting lengthy. Consider removing optional questions to make it easier for applicants to complete.",
  };
}
