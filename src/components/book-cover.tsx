import { useState } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

function toStandardEbooksSlug(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getStandardEbooksCover(title: string, author: string): string | null {
  const a = toStandardEbooksSlug(author);
  const t = toStandardEbooksSlug(title);
  if (!a || !t) return null;
  return `https://standardebooks.org/ebooks/${a}/${t}/downloads/cover-thumbnail.jpg`;
}

// Deterministic tactile palettes based on title string
const JACKET_PALETTES = [
  {
    gradient: "from-[#4c1318] via-[#2c0b0e] to-[#140305]",
    border: "border-red-500/30",
    foil: "text-amber-200",
    accent: "text-amber-300/80",
    spine: "from-black/60 via-black/25 to-transparent",
  },
  {
    gradient: "from-[#0f243c] via-[#0b1726] to-[#04080e]",
    border: "border-sky-500/30",
    foil: "text-sky-200",
    accent: "text-sky-300/80",
    spine: "from-black/60 via-black/25 to-transparent",
  },
  {
    gradient: "from-[#0e3322] via-[#091f15] to-[#030a07]",
    border: "border-emerald-500/30",
    foil: "text-emerald-200",
    accent: "text-emerald-300/80",
    spine: "from-black/60 via-black/25 to-transparent",
  },
  {
    gradient: "from-[#252220] via-[#161413] to-[#0a0908]",
    border: "border-amber-500/30",
    foil: "text-amber-100",
    accent: "text-amber-200/70",
    spine: "from-black/70 via-black/30 to-transparent",
  },
  {
    gradient: "from-[#35153b] via-[#200b24] to-[#0b030d]",
    border: "border-purple-500/30",
    foil: "text-purple-200",
    accent: "text-purple-300/80",
    spine: "from-black/60 via-black/25 to-transparent",
  },
  {
    gradient: "from-[#43230e] via-[#261307] to-[#0f0702]",
    border: "border-amber-600/30",
    foil: "text-amber-200",
    accent: "text-amber-300/80",
    spine: "from-black/60 via-black/25 to-transparent",
  },
];

function paletteFor(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  }
  return JACKET_PALETTES[hash % JACKET_PALETTES.length];
}

interface BookCoverProps {
  title: string;
  author: string;
  coverUrl?: string | null;
  format?: string;
  className?: string;
  badge?: string;
}

export function BookCover({
  title,
  author,
  coverUrl,
  format,
  className,
  badge,
}: BookCoverProps) {
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Candidates in priority order:
  // 1. Provided coverUrl
  // 2. Computed Standard Ebooks cover thumbnail
  const candidates: string[] = [];
  if (coverUrl && /^https?:\/\//i.test(coverUrl)) {
    candidates.push(coverUrl);
  }
  const seUrl = getStandardEbooksCover(title, author);
  if (seUrl && !candidates.includes(seUrl)) {
    candidates.push(seUrl);
  }

  const currentSrc = candidates[candidateIdx];
  const hasImage = Boolean(currentSrc);
  const palette = paletteFor(title);

  const handleImageError = () => {
    if (candidateIdx + 1 < candidates.length) {
      setCandidateIdx((prev) => prev + 1);
    } else {
      setCandidateIdx(candidates.length); // All exhausted -> fallback jacket
    }
  };

  return (
    <div
      className={cn(
        "group relative aspect-[2/3] w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-border/50 select-none transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] hover:ring-gold/40",
        className,
      )}
    >
      {/* Real Cover Image */}
      {hasImage ? (
        <img
          src={currentSrc}
          alt={`Cover of ${title}`}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={handleImageError}
          className={cn(
            "size-full object-cover object-center transition-opacity duration-300",
            imageLoaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}

      {/* Tactile Book Jacket Fallback (shown when no image, image failed, or loading) */}
      {(!hasImage || !imageLoaded) ? (
        <div
          className={cn(
            "absolute inset-0 flex flex-col justify-between p-3.5 bg-gradient-to-b transition-all",
            palette.gradient,
            palette.border,
          )}
        >
          {/* Subtle cloth weave background noise */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-black/30 opacity-70" />

          {/* Top Emblem & Format */}
          <div className="relative z-10 flex items-center justify-between">
            <BookOpen className={cn("size-3.5 opacity-60", palette.foil)} />
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-black/40",
                palette.accent,
              )}
            >
              {format || "EPUB"}
            </span>
          </div>

          {/* Center Title & Author inside Embossed Foil Frame */}
          <div
            className={cn(
              "relative z-10 my-auto flex flex-col items-center justify-center rounded-lg border px-2 py-3 text-center backdrop-blur-[1px]",
              palette.border,
              "bg-black/25 shadow-inner",
            )}
          >
            <h3
              className={cn(
                "font-serif text-xs sm:text-sm font-bold tracking-tight leading-snug line-clamp-3 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]",
                palette.foil,
              )}
            >
              {title}
            </h3>
            <div className="my-1.5 flex items-center justify-center gap-1 opacity-50">
              <span className={cn("text-[8px]", palette.accent)}>✦</span>
              <span className={cn("h-[1px] w-5 bg-current", palette.accent)} />
              <span className={cn("text-[8px]", palette.accent)}>✦</span>
            </div>
            <p
              className={cn(
                "text-[10px] sm:text-[11px] font-medium tracking-wide uppercase line-clamp-2 opacity-90",
                palette.accent,
              )}
            >
              {author}
            </p>
          </div>

          {/* Bottom Foil Stamp */}
          <div className="relative z-10 flex items-center justify-center pt-1">
            <span
              className={cn(
                "text-[8px] font-mono uppercase tracking-[0.2em] opacity-40",
                palette.foil,
              )}
            >
              REELOS LIBRARY
            </span>
          </div>
        </div>
      ) : null}

      {/* Book Spine Crease & Shadow Overlay (Tactile 3D effect) */}
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-3 bg-gradient-to-r z-20",
          palette.spine,
        )}
      />
      <div className="pointer-events-none absolute inset-y-0 left-1 w-[1px] bg-white/20 z-20 opacity-40" />

      {/* Right Edge Page Block Shadow */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1 bg-gradient-to-l from-black/40 to-transparent z-20" />

      {/* Badge (e.g. "On Shelf" or "Classic") */}
      {badge ? (
        <div className="absolute top-2 right-2 z-30">
          <span className="rounded-full bg-gold/90 px-2 py-0.5 text-[9px] font-bold tracking-wide text-gold-fg shadow-md">
            {badge}
          </span>
        </div>
      ) : null}

      {/* Hover Glass Highlight */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20" />
    </div>
  );
}
