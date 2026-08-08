"use client";

/** Deterministic fake QR block — placeholder until real ticketing issues codes. */
export default function QrCode({ seed, className = "" }: { seed: string; className?: string }) {
  let h = 2166136261;
  const rand = () => {
    h = Math.imul(h ^ (h >>> 13), 16777619) >>> 0;
    return h / 4294967295;
  };
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;

  const n = 21;
  const cells: boolean[] = [];
  for (let i = 0; i < n * n; i++) cells.push(rand() > 0.52);
  // finder squares
  const finder = (r: number, c: number, i: number) => {
    const y = Math.floor(i / n), x = i % n;
    return y >= r && y < r + 7 && x >= c && x < c + 7
      ? !(y > r && y < r + 6 && x > c && x < c + 6 && !(y > r + 1 && y < r + 5 && x > c + 1 && x < c + 5))
      : null;
  };

  return (
    <svg viewBox={`0 0 ${n} ${n}`} className={className} aria-label="Ticket QR code" role="img">
      <rect width={n} height={n} fill="#fff" />
      {cells.map((on, i) => {
        const f1 = finder(0, 0, i), f2 = finder(0, n - 7, i), f3 = finder(n - 7, 0, i);
        const filled = f1 ?? f2 ?? f3 ?? on;
        return filled ? (
          <rect key={i} x={i % n} y={Math.floor(i / n)} width={1} height={1} fill="#0A0A0F" />
        ) : null;
      })}
    </svg>
  );
}
