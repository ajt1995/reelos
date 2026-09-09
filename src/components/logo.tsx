import { cn } from "@/lib/utils";

export function ReelMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn("text-gold drop-shadow-[0_0_10px_rgb(232_197_71_/_0.45)]", className)}
    >
      <circle
        cx="32"
        cy="32"
        r="29"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="1.25"
      />
      <circle
        cx="32"
        cy="32"
        r="25.5"
        stroke="#00E5FF"
        strokeOpacity="0.75"
        strokeWidth="1.4"
        strokeDasharray="18 80"
        strokeDashoffset="8"
      />
      <circle cx="32" cy="32" r="23.5" stroke="currentColor" strokeWidth="3.2" />
      <circle cx="32" cy="32" r="11.2" stroke="currentColor" strokeWidth="2.4" />
      <path
        d="M30.4 7.2h3.2v14.6h-3.2zM30.4 42.2h3.2v14.6h-3.2zM7.2 30.4h14.6v3.2H7.2zM42.2 30.4h14.6v3.2H42.2z"
        fill="currentColor"
      />
      <path d="M28.2 24.4 42.4 32 28.2 39.6Z" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <ReelMark className={cn("size-8", markClassName)} />
      <span className="font-display text-[1.35rem] font-semibold tracking-[0.22em] text-gold drop-shadow-[0_0_12px_rgb(232_197_71_/_0.35)]">
        ReelOS
      </span>
    </span>
  );
}
