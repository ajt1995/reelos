import { useEffect, useState } from "react";
import type { Title } from "@/lib/types";
import { cn } from "@/lib/utils";

function posterInitial(title: Title) {
  const ch = String(title.title || "")
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
  title: Title;
  className?: string;
  sizes?: "poster" | "hero";
  placeholder?: "letter" | "empty";
}) {
  const src = String(title.poster || "").trim();
  const [ok, setOk] = useState(Boolean(src));
  useEffect(() => {
    setOk(Boolean(src));
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
          className="poster absolute inset-0 size-full object-cover"
          onError={() => setOk(false)}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-card-2 via-card to-background"
          aria-hidden
        >
          {placeholder === "letter" ? (
            <span className="font-display text-3xl font-medium text-muted/70">{posterInitial(title)}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
