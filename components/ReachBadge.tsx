import { MapPin, Globe2 } from "lucide-react";
import type { ReachInfo } from "@/lib/data";

export default function ReachBadge({
  info,
  compact = false,
}: {
  info: ReachInfo;
  compact?: boolean;
}) {
  const Icon = info.reach === "Remote" || info.reach === "Global" ? Globe2 : MapPin;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card-raised px-2.5 py-1 text-xs font-medium text-zinc-300"
      title={`Reach: ${info.reach}${info.radius ? ` • ${info.radius}` : ""}`}
    >
      <Icon className="h-3.5 w-3.5 text-lime-400" aria-hidden />
      {info.location}
      {!compact && (
        <span className="text-zinc-500">
          • {info.reach}
          {info.radius ? ` (${info.radius})` : ""}
        </span>
      )}
    </span>
  );
}
