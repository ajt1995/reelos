import { useEffect, useState } from "react";
import type { Title } from "@/lib/types";
import { cn } from "@/lib/utils";

function posterInitial(title?: Title | null) {
  const ch = String(title?.title || "")
    .replace(/^[^A-Za-z0-9]+/, "")
    .charAt(0)
    .toUpperCase();
  return ch || "•";
}

export function Poster({
  title,
  className,
  sizes = "poster",
  placeholder = "letter",
}: {
  title?: Title | null;
  className?: string;
  sizes?: "poster" | "hero";
  placeholder?: "letter" | "empty";
}) {
  const src = String(title?.poster || "").trim();
  const [ok, setOk] = useState(Boolean(src));
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setOk(Boolean(src));
    setLoaded(false);
  }, [src]);
  return (
    <div
      className={cn(
        "relative w-full min-h-0 min-w-0 max-w-full overflow-hidden bg-card-2",
        sizes === "poster" ? "aspect-[2/3]" : "aspect-[16/9]",
        className,
      )}
    >
      {src && ok ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn(
            "poster absolute inset-0 size-full object-cover transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setOk(false)}
        />
      ) : null}
      {!loaded ? (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            src && ok
              ? "shimmer-skeleton"
              : "bg-linear-to-br from-card-2 via-card to-background",
          )}
          aria-hidden
        >
          {placeholder === "letter" && (!src || !ok) ? (
            <span className="font-display text-xl sm:text-2xl font-medium text-muted/70">{posterInitial(title)}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
