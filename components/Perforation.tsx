/**
 * Ticket-style perforation: dashed rule with punched half-circles at both
 * edges. Parent card must be `relative overflow-hidden` with horizontal
 * padding matching the -mx offset (p-4 sm:p-5).
 */
export default function Perforation({ className = "" }: { className?: string }) {
  return (
    <div className={`relative -mx-4 sm:-mx-5 ${className}`} aria-hidden>
      <div className="border-t border-dashed border-zinc-700/70" />
      <span className="absolute -left-[9px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full border border-line bg-ink" />
      <span className="absolute -right-[9px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full border border-line bg-ink" />
    </div>
  );
}
