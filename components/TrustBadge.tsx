import { trustLevelInfo, type TrustLevel } from "@/lib/data";

/* Trust status, honestly stated — never "100% safe person". */
export default function TrustBadge({ level, className = "" }: { level: TrustLevel; className?: string }) {
  if (level === "standard") return null; // standard work doesn't need a badge
  const info = trustLevelInfo[level];
  return (
    <span
      title={`${info.desc} · ${info.checks.join(" · ")}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        level === "high-trust"
          ? "border-lime-400/40 bg-lime-400/10 text-lime-300"
          : "border-line bg-card-raised text-zinc-200"
      } ${className}`}
    >
      {level === "high-trust" ? "🟢 High-Trust Verified" : "🟢 Identity Verified"}
    </span>
  );
}
