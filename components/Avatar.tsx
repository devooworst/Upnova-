import Image from "next/image";

interface AvatarProps {
  src?: string | null;
  initials: string;
  gradient?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  ring?: boolean;
}

const sizes = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-28 w-28 text-3xl",
};

export default function Avatar({
  src,
  initials,
  gradient = "from-zinc-600 to-zinc-800",
  size = "md",
  className = "",
  ring = false,
}: AvatarProps) {
  const base = `${sizes[size]} ${
    ring ? "ring-2 ring-ink" : ""
  } relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold text-zinc-950`;

  if (src) {
    return (
      <span className={`${base} ${className}`}>
        <Image src={src} alt="" fill sizes="80px" className="object-cover" />
      </span>
    );
  }
  return (
    <span className={`${base} bg-gradient-to-br ${gradient} text-white ${className}`}>
      {initials}
    </span>
  );
}
