import { dismissToast, useToasts } from "@/lib/toast";
import { Check, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ToastHost() {
  const toasts = useToasts();
  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur-md transition-all duration-200",
            t.type === "error"
              ? "border-danger/40 bg-danger/20 text-danger"
              : t.type === "success"
                ? "border-success/40 bg-card text-success"
                : "border-gold/40 bg-card text-foreground shadow-[var(--shadow-border)]",
          )}
        >
          {t.type === "error" ? (
            <Info className="size-4 shrink-0 text-danger" />
          ) : (
            <Check className="size-4 shrink-0 text-gold" />
          )}
          <span>{t.message}</span>
          <button
            type="button"
            className="ml-1 text-muted hover:text-foreground"
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss toast"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
