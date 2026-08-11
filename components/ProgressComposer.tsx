"use client";

/* ------------------------------------------------------------------ */
/*  Progress-composer shared pieces — one implementation for the       */
/*  project page AND the booking panel, so estimated completion        */
/*  behaves identically everywhere.                                    */
/*                                                                     */
/*  · EtaPicker    — date + time (the provider's estimate of WHEN      */
/*                   the work completes, to the minute)                */
/*  · combineEta   — date + time → one real datetime instant (ISO);    */
/*                   built in the provider's local timezone            */
/*  · fmtEta       — "August 15, 2026 at 6:30 PM", rendered in the     */
/*                   VIEWER's local timezone (client-side)             */
/*  · clampPercent — 0–100, digits only, no surprises                  */
/*  · UpdatePreview— exactly what will post, before it posts           */
/* ------------------------------------------------------------------ */

export function combineEta(date: string, time: string): string | null {
  if (!date) return null;
  const d = new Date(`${date}T${time || "17:00"}`); // local tz → real instant
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function fmtEta(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

export function fmtEtaShort(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

export function clampPercent(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits === "") return "";
  return String(Math.max(0, Math.min(100, Number(digits))));
}

export function EtaPicker({
  date,
  time,
  onDate,
  onTime,
  required = false,
}: {
  date: string;
  time: string;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        Estimated completion{required ? "" : " (optional)"}
      </span>
      <div className="mt-1 grid grid-cols-2 gap-1.5">
        <input
          type="date"
          value={date}
          onChange={(e) => onDate(e.target.value)}
          className="input-dark py-1.5 text-xs"
          aria-label="Estimated completion date"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => onTime(e.target.value)}
          className="input-dark py-1.5 text-xs"
          aria-label="Estimated completion time"
          title="The time of day you expect to finish (defaults to 5:00 PM)"
        />
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">
        Your estimate of when you&apos;ll complete this — date and time. Shown to the client in their local time.
      </p>
    </div>
  );
}

/** the update, exactly as it will read once posted */
export function UpdatePreview({
  statusLabel,
  percent,
  message,
  etaIso,
}: {
  statusLabel?: string;
  percent: string;
  message: string;
  etaIso: string | null;
}) {
  if (!percent && !message.trim() && !etaIso && !statusLabel) return null;
  return (
    <div className="rounded-xl border border-lime-400/20 bg-lime-400/5 p-3">
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-lime-300">Preview — what the client sees</p>
      <ul className="mt-1.5 space-y-0.5 text-xs leading-relaxed text-zinc-300">
        {statusLabel && <li><span className="text-zinc-500">Status:</span> {statusLabel}</li>}
        {percent !== "" && <li><span className="text-zinc-500">Progress:</span> {percent}% complete</li>}
        {message.trim() && <li><span className="text-zinc-500">Currently working on:</span> {message.trim()}</li>}
        {etaIso && <li><span className="text-zinc-500">Estimated completion:</span> {fmtEta(etaIso)}</li>}
      </ul>
    </div>
  );
}
