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
    <div className="rounded-2xl bg-card shadow-[var(--shadow-border)]">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-4 px-5 py-4 text-left"
      >
        <Icon className="size-5 text-gold" />
        <span className="flex-1">
          <span className="block font-display font-medium">{title}</span>
          <span className="mt-0.5 block text-sm text-muted">{hint}</span>
        </span>
        <ChevronRight className={cn("size-4 text-faint transition-transform", open && "rotate-90")} />
      </button>
      {open ? <div className="border-t border-border px-5 py-4">{children}</div> : null}
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
        "relative h-6 w-11 rounded-full transition-colors",
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
