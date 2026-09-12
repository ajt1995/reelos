import { useEffect, useState } from "react";
import type { Title } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Poster({
  title,
  className,
  sizes = "poster",
}: {
  title: Title;
  className?: string;
  sizes?: "poster" | "hero";
}) {
  const src = String(title.poster || "").trim();
  const [ok, setOk] = useState(Boolean(src));
  useEffect(() => {
    setOk(Boolean(src));
  }, [src]);
  return (
    <div
      className={cn(
        "relative min-w-0 max-w-full overflow-hidden bg-card-2",
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
        <div className="absolute inset-0 bg-linear-to-br from-card-2 to-background" />
      )}
    </div>
  );
}
