import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface LuxuryPinInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
  onComplete?: (pin: string) => void;
  className?: string;
  label?: string;
}

/**
 * Luxury tactile Apple/Criterion style PIN input.
 * Renders discrete frosted glass pill boxes with glowing golden ember dots.
 * Eliminates browser blue outlines, handles mobile soft-keyboards seamlessly,
 * and maintains >= 44pt touch targets on each cell.
 */
export function LuxuryPinInput({
  value,
  onChange,
  length = 4,
  disabled = false,
  error = false,
  autoFocus = false,
  onComplete,
  className,
  label = "Passcode",
}: LuxuryPinInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleCellClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, length);
    onChange(raw);
    if (raw.length === length && onComplete) {
      onComplete(raw);
    }
  };

  return (
    <div className={cn("relative flex flex-col items-center select-none", className)}>
      {/* Hidden native input capturing numeric keypad focus without default blue outlines */}
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={length}
        disabled={disabled}
        value={value}
        onChange={handleChange}
        onFocus={(e) => {
          setIsFocused(true);
          setTimeout(() => {
            e.target.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 300);
        }}
        onBlur={() => setIsFocused(false)}
        aria-label={label}
        className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0 outline-none focus:outline-none focus:ring-0"
        style={{
          caretColor: "transparent",
          WebkitTapHighlightColor: "transparent",
          outline: "none",
          boxShadow: "none",
        }}
      />

      {/* Discrete Luxury Tactile Pill Boxes */}
      <div
        onClick={handleCellClick}
        className="flex items-center justify-center gap-3 sm:gap-4 py-2"
        role="group"
        aria-label={label}
      >
        {Array.from({ length }).map((_, index) => {
          const isFilled = index < value.length;
          const isActive = isFocused && index === value.length;
          const isPast = index < value.length;

          return (
            <div
              key={index}
              className={cn(
                "relative flex h-16 w-14 sm:h-20 sm:w-16 items-center justify-center rounded-2xl sm:rounded-3xl transition-all duration-200",
                "border bg-white/[0.04] backdrop-blur-md",
                error
                  ? "border-rose-500/80 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.35)] animate-shake"
                  : isActive
                  ? "border-gold/90 bg-gold/[0.08] shadow-[0_0_22px_rgba(245,197,24,0.35)] scale-[1.04]"
                  : isFilled
                  ? "border-white/25 bg-white/[0.07] shadow-sm"
                  : "border-white/10 text-white/20",
                disabled && "opacity-40 cursor-not-allowed"
              )}
            >
              {/* Glowing Amber/Gold Ember Dot when filled */}
              {isFilled ? (
                <span
                  className={cn(
                    "size-3.5 sm:size-4 rounded-full transition-transform duration-200",
                    error
                      ? "bg-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.9)]"
                      : "bg-[#f5c518] shadow-[0_0_14px_rgba(245,197,24,0.9)] scale-100"
                  )}
                />
              ) : isActive ? (
                /* Glowing Gold Pulsing Cursor Indicator */
                <span className="h-6 w-0.5 rounded-full bg-gold shadow-[0_0_8px_rgba(245,197,24,0.9)] animate-pulse" />
              ) : (
                /* Idle Empty Dot Outline */
                <span className="size-2 rounded-full bg-white/15" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
