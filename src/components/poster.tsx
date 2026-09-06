import { useState } from "react";
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
  const [ok, setOk] = useState(true);
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-card-2",
        sizes === "poster" ? "aspect-[2/3]" : "aspect-[16/9]",
        className,
      )}
    >
      {ok ? (
        <img
          src={title.poster}
          alt=""
          className="poster absolute inset-0 size-full object-cover"
          onError={() => setOk(false)}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col justify-end bg-linear-to-br from-card-2 to-background p-4">
          <p className="font-display text-lg font-medium tracking-tight">{title.title}</p>
          <p className="text-xs text-muted">{title.year}</p>
        </div>
      )}
    </div>
  );
}
