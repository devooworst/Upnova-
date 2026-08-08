interface RadarRingsProps {
  radius: "5" | "25" | "city";
  className?: string;
}

/** Concentric-range radar: you at the center, rings = 5 mi / 25 mi / city. */
export default function RadarRings({ radius, className = "" }: RadarRingsProps) {
  const active = radius === "5" ? 26 : radius === "25" ? 50 : 74;

  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true">
      {[26, 50, 74].map((r) => (
        <circle
          key={r}
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke={r === active ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.1)"}
          strokeWidth={r === active ? 1.5 : 1}
          strokeDasharray={r === active ? undefined : "3 5"}
        />
      ))}
      {/* you */}
      <circle cx="80" cy="80" r="3.5" fill="#fff" />
      <circle cx="80" cy="80" r="7" fill="none" stroke="rgba(255,255,255,0.25)" />
      {/* nearby signals, colored by role */}
      <circle cx="62" cy="64" r="3" fill="#a3e635" /> {/* opportunity */}
      <circle cx="101" cy="61" r="3" fill="#a78bfa" /> {/* person */}
      <circle cx="95" cy="106" r="3" fill="#fbbf24" /> {/* event */}
      <circle cx="45" cy="97" r="2.5" fill="#a78bfa" opacity="0.8" />
      <circle cx="122" cy="88" r="2.5" fill="#a3e635" opacity="0.7" />
    </svg>
  );
}
