import { cn } from "@/lib/utils";

export function Chip({
  children,
  live,
  gold,
  magenta,
}: {
  children: React.ReactNode;
  live?: boolean;
  gold?: boolean;
  magenta?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full bg-card px-3 text-xs text-muted shadow-[var(--shadow-border)]",
        live && "text-live shadow-[var(--shadow-cyan)]",
        gold && "text-gold shadow-[var(--shadow-gold)]",
        magenta && "text-magenta",
      )}
    >
      {live ? <span className="live-dot" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-full px-4 text-sm transition-[background-color,box-shadow,color,transform] duration-150",
        active
          ? "bg-gold text-gold-fg shadow-[var(--shadow-gold)]"
          : "bg-card text-muted shadow-[var(--shadow-border)] hover:text-foreground hover:shadow-[var(--shadow-border-hover)]",
      )}
    >
      {children}
    </button>
  );
}
