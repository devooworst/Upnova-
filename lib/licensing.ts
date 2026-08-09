/* ------------------------------------------------------------------ */
/*  Licensing — the creator's terms, not UpNova's.                     */
/*                                                                     */
/*  A work carries the license OPTIONS its creator chose to offer:     */
/*  free use, non-commercial, commercial, exclusive, custom — each     */
/*  with the creator's own price, attribution requirement, permitted   */
/*  usage, and restrictions. Nobody is forced into a standard model.   */
/*                                                                     */
/*  Honesty rule: UpNova does NOT claim content can't be recorded or   */
/*  stolen. The protection stack is: streaming previews (configurable  */
/*  length, creator-controlled watermark labeling) instead of source   */
/*  files, clear terms, preserved license records, and a dispute lane  */
/*  where those records are the evidence.                              */
/* ------------------------------------------------------------------ */

export const WORK_KINDS = [
  { id: "beat", label: "Beat" },
  { id: "track", label: "Track" },
  { id: "sample_pack", label: "Sample pack" },
  { id: "photo", label: "Photo" },
  { id: "design", label: "Design" },
  { id: "video", label: "Video" },
  { id: "other", label: "Other" },
] as const;
export type WorkKind = (typeof WORK_KINDS)[number]["id"];

export const LICENSE_TYPES = [
  { id: "free", label: "Free use" },
  { id: "non_commercial", label: "Non-commercial" },
  { id: "commercial", label: "Commercial" },
  { id: "exclusive", label: "Exclusive" },
  { id: "custom", label: "Custom" },
] as const;
export type LicenseType = (typeof LICENSE_TYPES)[number]["id"];

export interface LicenseOption {
  id: string;
  type: LicenseType;
  name: string; // the creator's own label, e.g. "MP3 Lease", "Sync License"
  /** creator payout dollars; null = quote/negotiated in conversation */
  price: number | null;
  attribution: boolean;
  usage: string; // permitted usage, the creator's words
  restrictions: string; // what's NOT allowed
}

export function parseLicenseOptions(raw: string | null | undefined): LicenseOption[] {
  try {
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? normalizeLicenseOptions(arr) : [];
  } catch {
    return [];
  }
}

export function normalizeLicenseOptions(raw: unknown): LicenseOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
    .slice(0, 6)
    .map((o, i) => ({
      id: String(o.id || `l${i}`).slice(0, 24),
      type: (LICENSE_TYPES.find((t) => t.id === o.type)?.id ?? "custom") as LicenseType,
      name: String(o.name || "").trim().slice(0, 50),
      price:
        o.price == null || o.price === ""
          ? null
          : Math.min(1_000_000, Math.max(0, Math.round(Number(o.price) || 0))),
      attribution: o.attribution === true,
      usage: String(o.usage || "").trim().slice(0, 300),
      restrictions: String(o.restrictions || "").trim().slice(0, 300),
    }))
    .filter((o) => o.name);
}

/** Starting points the builder offers — fully editable, never forced. */
export const LICENSE_PRESETS: Omit<LicenseOption, "id">[] = [
  { type: "free", name: "Free demo use", price: 0, attribution: true, usage: "Non-monetized demos and personal projects.", restrictions: "No commercial release, no resale, no remix packs." },
  { type: "non_commercial", name: "Non-commercial lease", price: 25, attribution: true, usage: "Non-monetized releases, up to 10k streams.", restrictions: "No paid placements, no broadcast." },
  { type: "commercial", name: "Commercial lease", price: 75, attribution: false, usage: "Monetized release up to 100k streams, one music video.", restrictions: "No exclusivity — the work stays licensable to others." },
  { type: "exclusive", name: "Exclusive license", price: 400, attribution: false, usage: "Unlimited commercial use. Licensing to others STOPS when this sells.", restrictions: "Creator retains authorship credit." },
  { type: "custom", name: "Custom / sync", price: null, attribution: false, usage: "Negotiated per project in the conversation.", restrictions: "Per agreement." },
];

export const LICENSE_STATUS_LABEL: Record<string, string> = {
  issued: "Issued — payment secured, delivery pending",
  completed: "Completed — payout released",
};

/** What a creator can report about a work. */
export const WORK_REPORT_REASONS = [
  { id: "unauthorized_use", label: "My work is being used without a license" },
  { id: "license_violation", label: "A licensee is exceeding their license terms" },
  { id: "stolen_work", label: "Someone re-uploaded my work as theirs" },
  { id: "other", label: "Something else" },
] as const;
