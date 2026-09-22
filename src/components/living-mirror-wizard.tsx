import { useState } from "react";
import {
  Film,
  Tv,
  BookOpen,
  Sparkles,
  Zap,
  Coffee,
  Gem,
  Flame,
  Check,
  Eye,
  Sliders,
} from "lucide-react";
import {
  useReelStore,
  type TasteVibe,
  type ThemeDesignLanguage,
  type MotionDial,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { VisualVibeCalibration } from "./visual-vibe-calibration";

export interface LivingMirrorState {
  moviesPriority: number;
  tvPriority: number;
  booksPriority: number;
  tasteVibe: TasteVibe;
  themeDesign: ThemeDesignLanguage;
  motionStyle: MotionDial;
}

const SAMPLE_MOVIES = [
  { id: "m1", title: "Oppenheimer", year: 2023, rating: "8.9", tag: "4K Ultra HD" },
  { id: "m2", title: "Dune: Part Two", year: 2024, rating: "8.6", tag: "IMAX Enhanced" },
  { id: "m3", title: "Interstellar", year: 2014, rating: "8.7", tag: "Dolby Vision" },
];

const SAMPLE_SHOWS = [
  { id: "s1", title: "Succession", year: "2018–2023", episodes: "39 Eps", tag: "4 Seasons" },
  { id: "s2", title: "Silo", year: "2023–", episodes: "20 Eps", tag: "Apple TV+" },
  { id: "s3", title: "The Bear", year: "2022–", episodes: "28 Eps", tag: "FX / Hulu" },
];

const SAMPLE_BOOKS = [
  { id: "b1", title: "Dune", author: "Frank Herbert", tag: "Novel · Screen Adaptation" },
  { id: "b2", title: "Wool (Silo)", author: "Hugh Howey", tag: "Post-Apocalyptic Sci-Fi" },
  { id: "b3", title: "Foundation", author: "Isaac Asimov", tag: "Epic Space Opera" },
];

export function LivingMirrorStudio({
  initialName = "Living Room",
  onApply,
}: {
  initialName?: string;
  onApply?: (state: LivingMirrorState) => void;
}) {
  const residents = useReelStore((s) => s.residents);
  const activeResidentId = useReelStore((s) => s.activeResidentId);
  const patchResident = useReelStore((s) => s.patchResident);
  const activeRes = residents.find((r) => r.id === activeResidentId) ?? residents[0];

  const [moviesPriority, setMoviesPriority] = useState(activeRes?.mediaPriorities?.movies ?? 75);
  const [tvPriority, setTvPriority] = useState(activeRes?.mediaPriorities?.tv ?? 60);
  const [booksPriority, setBooksPriority] = useState(activeRes?.mediaPriorities?.books ?? 35);
  const [tasteVibe, setTasteVibe] = useState<TasteVibe>(activeRes?.tasteVibe ?? "balanced");
  const [themeDesign, setThemeDesign] = useState<ThemeDesignLanguage>(activeRes?.themeDesign ?? "oled_cinema");
  const [motionStyle, setMotionStyle] = useState<MotionDial>(activeRes?.motionStyle ?? "cinematic");

  const handleSave = () => {
    const nextState: LivingMirrorState = {
      moviesPriority,
      tvPriority,
      booksPriority,
      tasteVibe,
      themeDesign,
      motionStyle,
    };

    if (activeRes) {
      patchResident(activeRes.id, {
        mediaPriorities: {
          movies: moviesPriority,
          tv: tvPriority,
          books: booksPriority,
        },
        tasteVibe,
        themeDesign,
        motionStyle,
      });
    }

    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme-design", themeDesign);
      document.body.setAttribute("data-theme-design", themeDesign);
      document.documentElement.setAttribute("data-motion", motionStyle);
      document.body.setAttribute("data-motion", motionStyle);
    }

    if (onApply) onApply(nextState);
  };

  return (
    <div className="rise grid gap-8 lg:grid-cols-12 lg:items-start">
      {/* Left Column: Interactive Controls */}
      <div className="space-y-6 lg:col-span-6 xl:col-span-6">
        <div>
          <div className="flex items-center gap-2 text-gold">
            <Sliders className="size-4" />
            <p className="font-display text-xs font-semibold tracking-[0.22em] uppercase">
              Living Mirror Studio
            </p>
          </div>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Tailor Your Experience
          </h2>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            Adjust your media balance, curation personality, and visual design language. The viewport on the right responds in real time.
          </p>
        </div>

        {/* Section 1: Media Sliders */}
        <div className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-xl shadow-lg space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Film className="size-3.5 text-gold" />
            Media Balance Sliders
          </p>

          {/* Movies Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Film className="size-3.5 text-muted" /> Movies
              </span>
              <span className="font-mono text-gold font-bold">{moviesPriority}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={moviesPriority}
              onChange={(e) => setMoviesPriority(Number(e.target.value))}
              className="h-2 w-full accent-gold cursor-pointer rounded-lg bg-card-2"
            />
          </div>

          {/* TV Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Tv className="size-3.5 text-muted" /> TV Shows & Series
              </span>
              <span className="font-mono text-gold font-bold">{tvPriority}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={tvPriority}
              onChange={(e) => setTvPriority(Number(e.target.value))}
              className="h-2 w-full accent-gold cursor-pointer rounded-lg bg-card-2"
            />
          </div>

          {/* Books Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <BookOpen className="size-3.5 text-muted" /> Books & Page-to-Screen
              </span>
              <span className="font-mono text-gold font-bold">{booksPriority}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={booksPriority}
              onChange={(e) => setBooksPriority(Number(e.target.value))}
              className="h-2 w-full accent-gold cursor-pointer rounded-lg bg-card-2"
            />
          </div>
        </div>

        {/* Section 2: Taste Vibe */}
        <div className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-xl shadow-lg space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-gold" />
            Curation Personality & Taste Vibe
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            {[
              {
                id: "bleeding_edge" as TasteVibe,
                label: "Bleeding Edge",
                desc: "Same-week theatrical drops & latest seasons",
                icon: Zap,
              },
              {
                id: "comfort" as TasteVibe,
                label: "Comfort Classics",
                desc: "Familiar sitcoms, procedurals & cozy reruns",
                icon: Coffee,
              },
              {
                id: "hidden_gems" as TasteVibe,
                label: "Hidden Gems",
                desc: "Cult treasures & high-rated indie cinema",
                icon: Gem,
              },
              {
                id: "balanced" as TasteVibe,
                label: "Balanced",
                desc: "Harmonious blend across all eras and formats",
                icon: Sparkles,
              },
            ].map((v) => {
              const selected = tasteVibe === v.id;
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setTasteVibe(v.id)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
                    selected
                      ? "border-gold/50 bg-gold/15 text-foreground shadow-sm"
                      : "border-border/60 bg-card hover:border-gold/30 hover:bg-card-2 text-muted hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                    <Icon className={cn("size-3.5", selected ? "text-gold" : "text-muted")} />
                    <span>{v.label}</span>
                  </div>
                  <p className="text-[10px] text-faint line-clamp-2">{v.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Design Language */}
        <div className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-xl shadow-lg space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Flame className="size-3.5 text-gold" />
            Theme Design Language
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            {[
              {
                id: "oled_cinema" as ThemeDesignLanguage,
                label: "OLED Cinema",
                desc: "Pitch obsidian black, borderless floating art",
              },
              {
                id: "futuristic_hud" as ThemeDesignLanguage,
                label: "Futuristic HUD",
                desc: "Sharp corners, tech monospace & scanlines",
              },
              {
                id: "editorial_slate" as ThemeDesignLanguage,
                label: "Editorial Slate",
                desc: "Magazine serif typography & parchment frames",
              },
              {
                id: "warm_velvet" as ThemeDesignLanguage,
                label: "Warm Velvet",
                desc: "Pill-soft curves & amber candlelight bloom",
              },
            ].map((d) => {
              const selected = themeDesign === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setThemeDesign(d.id)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
                    selected
                      ? "border-gold/50 bg-gold/15 text-foreground shadow-sm"
                      : "border-border/60 bg-card hover:border-gold/30 hover:bg-card-2 text-muted hover:text-foreground"
                  )}
                >
                  <span className="font-semibold text-xs text-foreground">{d.label}</span>
                  <p className="text-[10px] text-faint line-clamp-2">{d.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 4: Motion Dial */}
        <div className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-xl shadow-lg space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Motion & Animation Dial
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "flashy" as MotionDial, label: "Flashy & Bouncy" },
              { id: "cinematic" as MotionDial, label: "Cinematic Ease" },
              { id: "minimal_boring" as MotionDial, label: "Minimal / Zero" },
            ].map((m) => {
              const selected = motionStyle === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMotionStyle(m.id)}
                  className={cn(
                    "rounded-xl border py-2 px-2.5 text-center text-xs font-medium transition-all",
                    selected
                      ? "border-gold bg-gold text-gold-fg font-semibold shadow-xs"
                      : "border-border/60 bg-card hover:bg-card-2 text-muted hover:text-foreground"
                  )}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 5: Visual Vibe Calibration */}
        <div className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-xl shadow-lg space-y-3">
          <VisualVibeCalibration />
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold font-display text-sm font-semibold text-gold-fg shadow-[var(--shadow-gold)] transition-all hover:brightness-110 active:scale-[0.99]"
        >
          <Check className="size-4 stroke-[3]" />
          Apply My Taste & Enter ReelOS
        </button>
      </div>

      {/* Right Column: The Living Mirror Viewport */}
      <div className="lg:col-span-6 xl:col-span-6 sticky top-6">
        <div className="rounded-3xl border-2 border-gold/30 bg-black/80 p-5 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="size-4 text-gold animate-pulse" />
              <span className="font-display text-xs font-bold tracking-wider uppercase text-gold">
                Living Mirror · Dynamic Simulation
              </span>
            </div>
            <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-zinc-300">
              {themeDesign.replace("_", " ").toUpperCase()}
            </span>
          </div>

          {/* Miniature ReelOS Interface Container */}
          <div
            data-theme-design={themeDesign}
            data-motion={motionStyle}
            className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-raised/90 p-4 transition-all"
          >
            {/* Mini Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-sm font-bold text-foreground">
                  Welcome to {initialName || "Living Room"}
                </p>
                <p className="text-[10px] text-muted">
                  Vibe: <span className="text-gold font-semibold uppercase">{tasteVibe.replace("_", " ")}</span>
                </p>
              </div>
              <span className="rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 text-[9px] font-mono text-gold">
                4K HDR ATMOS
              </span>
            </div>

            {/* Dynamic Shelves Order based on Priorities */}
            {/* Shelf A: Books & Page-to-Screen (Shows up high if booksPriority > 30) */}
            {booksPriority >= 30 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-display font-semibold text-foreground flex items-center gap-1.5">
                    <BookOpen className="size-3 text-gold" /> Page to Screen & Literary Worlds
                  </span>
                  <span className="text-[9px] text-muted font-mono">{booksPriority}% Weight</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {SAMPLE_BOOKS.map((b) => (
                    <div key={b.id} className="glass-card rounded-lg p-2 text-left">
                      <div className="h-14 rounded bg-zinc-800/80 mb-1.5 flex items-center justify-center text-[10px] text-zinc-500 font-mono">
                        COVER
                      </div>
                      <p className="truncate text-[10px] font-semibold text-foreground">{b.title}</p>
                      <p className="truncate text-[8px] text-muted">{b.author}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shelf B: Movies Shelf */}
            {moviesPriority >= 20 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-display font-semibold text-foreground flex items-center gap-1.5">
                    <Film className="size-3 text-gold" /> Curated Theatrical Releases
                  </span>
                  <span className="text-[9px] text-muted font-mono">{moviesPriority}% Weight</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {SAMPLE_MOVIES.map((m) => (
                    <div key={m.id} className="glass-card rounded-lg p-2 text-left">
                      <div className="h-16 rounded bg-zinc-800/80 mb-1.5 flex items-center justify-center text-[10px] text-zinc-500 font-mono">
                        POSTER
                      </div>
                      <p className="truncate text-[10px] font-semibold text-foreground">{m.title}</p>
                      <p className="truncate text-[8px] text-muted">{m.year} · ★ {m.rating}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shelf C: TV Shows */}
            {tvPriority >= 20 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-display font-semibold text-foreground flex items-center gap-1.5">
                    <Tv className="size-3 text-gold" /> Continuous Serial Television
                  </span>
                  <span className="text-[9px] text-muted font-mono">{tvPriority}% Weight</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {SAMPLE_SHOWS.map((s) => (
                    <div key={s.id} className="glass-card rounded-lg p-2 text-left">
                      <div className="h-14 rounded bg-zinc-800/80 mb-1.5 flex items-center justify-center text-[10px] text-zinc-500 font-mono">
                        BACKDROP
                      </div>
                      <p className="truncate text-[10px] font-semibold text-foreground">{s.title}</p>
                      <p className="truncate text-[8px] text-muted">{s.episodes}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
