import { BadgeCheck } from "lucide-react";

export default function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <BadgeCheck
      className={`h-4 w-4 shrink-0 fill-lime-400/15 text-lime-400 ${className}`}
      aria-label="Verified"
    />
  );
}
