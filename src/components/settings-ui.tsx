import type { ComponentType, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-medium">{title}</h2>
      {hint ? <p className="mt-1 max-w-xl text-sm text-muted">{hint}</p> : null}
      <div className="mt-3 grid gap-2.5">{children}</div>
    </section>
  );
}

export function persistUi(p: Record<string, unknown>) {
  void fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
}

export function Row({
  icon: Icon,
  title,
  hint,
  open,
  onClick,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  open: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card/80 shadow-[var(--shadow-border)] backdrop-blur-md transition-all">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.02] rounded-2xl transition-colors cursor-pointer"
      >
        <div className="flex size-9 items-center justify-center rounded-xl bg-gold/10 text-gold shrink-0 border border-gold/20">
          <Icon className="size-4 text-gold" />
        </div>
        <span className="flex-1 min-w-0">
          <span className="block font-display font-medium text-foreground">{title}</span>
          <span className="mt-0.5 block text-xs text-muted truncate">{hint}</span>
        </span>
        <ChevronRight className={cn("size-4 text-faint transition-transform", open && "rotate-90 text-gold")} />
      </button>
      {open ? <div className="border-t border-border/60 px-5 py-4">{children}</div> : null}
    </div>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold after:absolute after:-inset-2.5 after:content-['']",
        on ? "bg-gold" : "bg-card-2",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-foreground transition-transform",
          on ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
