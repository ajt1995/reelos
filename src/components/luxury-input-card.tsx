import { useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LuxuryInputCardProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
  type?: string;
  className?: string;
  error?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputMode?: "text" | "none" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
  maxLength?: number;
  pattern?: string;
}

/**
 * Luxury tactile input card designed to Criterion & physical box set standards.
 * Eliminates default browser rectangular blue outlines, positions caret with
 * generous breathing room, handles mobile keyboard scrollIntoView, and displays
 * clean physical card boundaries.
 */
export function LuxuryInputCard({
  value,
  onChange,
  placeholder,
  label,
  autoFocus = false,
  type = "text",
  className = "",
  error,
  onKeyDown,
  inputMode,
  maxLength,
  pattern,
}: LuxuryInputCardProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={cn(
        "group relative flex flex-col rounded-2xl border px-5 py-4 transition-all duration-300 cursor-text",
        focused
          ? "border-[#f0ba61]/70 bg-white/[0.08] shadow-[0_0_24px_rgba(240,186,97,0.18)]"
          : "border-white/12 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]",
        error && "border-rose-500/80 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.25)]",
        className
      )}
    >
      {label && (
        <span
          className={cn(
            "text-[11px] font-semibold tracking-wider uppercase transition-colors duration-200 select-none mb-1.5",
            error ? "text-rose-400" : focused ? "text-[#f0ba61]" : "text-white/40"
          )}
        >
          {label}
        </span>
      )}
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          inputMode={inputMode}
          maxLength={maxLength}
          pattern={pattern}
          onFocus={(e) => {
            setFocused(true);
            setTimeout(() => {
              e.target.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 300);
          }}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full bg-transparent text-xl sm:text-2xl font-medium text-white placeholder:text-white/25 border-none outline-none focus:outline-none focus:ring-0 p-0 caret-[#f0ba61]"
          style={{
            WebkitTapHighlightColor: "transparent",
            outline: "none",
            boxShadow: "none",
          }}
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              inputRef.current?.focus();
            }}
            aria-label="Clear input"
            className="grid size-7 place-items-center rounded-full bg-white/10 text-white/50 hover:bg-white/20 hover:text-white transition-all shrink-0 active:scale-90"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {error && (
        <span className="mt-1.5 text-xs text-rose-400">{error}</span>
      )}
    </div>
  );
}
