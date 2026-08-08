import { aiPolicyInfo, type AiPolicy } from "@/lib/data";

/* The AI policy chip — clients never have to guess. */
export default function AiPolicyBadge({
  policy,
  detailed = false,
  className = "",
}: {
  policy: AiPolicy;
  detailed?: boolean;
  className?: string;
}) {
  const info = aiPolicyInfo[policy];
  return (
    <span
      title={info.desc}
      className={`inline-flex items-center gap-1 rounded-full border border-line bg-card-raised px-2 py-0.5 text-[11px] font-medium text-zinc-300 ${className}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${info.dot}`} />
      {info.label}
      {detailed && <span className="text-zinc-500"> · {info.desc}</span>}
    </span>
  );
}
