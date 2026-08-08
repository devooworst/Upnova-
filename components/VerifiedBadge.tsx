import { BadgeCheck } from "lucide-react";

/** Neutral = trust. Accent colors are reserved for money / people / events. */
export default function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <BadgeCheck
      className={`h-4 w-4 shrink-0 fill-white/15 text-zinc-200 ${className}`}
      aria-label="Verified"
    />
  );
}
