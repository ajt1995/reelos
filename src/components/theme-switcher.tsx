import { useEffect, useRef, useState } from "react";
import { Check, Palette, Sparkles, Sliders, Zap, BookOpen, Flame, Compass } from "lucide-react";
import { useReelStore, type ThemeName, type ThemeDesignLanguage, type MotionDial } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface ThemeOption {
  id: ThemeName;
  name: string;
  tagline: string;
  accent: string;
  bg: string;
  palette: [string, string, string];
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "gold-hashed",
    name: "Gold Hashed",
    tagline: "Signature ReelOS",
    accent: "#d4a017",
    bg: "#0b0d10",
    palette: ["#d4a017", "#12151b", "#181c24"],
  },
  {
    id: "oled-obsidian",
    name: "OLED Obsidian",
    tagline: "True Black OLED",
    accent: "#38bdf8",
    bg: "#000000",
    palette: ["#38bdf8", "#000000", "#0f1012"],
  },
  {
    id: "cinematic-velvet",
    name: "Cinematic Velvet",
    tagline: "Warm Cinema",
    accent: "#e11d48",
    bg: "#0c060a",
    palette: ["#e11d48", "#140b12", "#1c101a"],
  },
  {
    id: "midnight-slate",
    name: "Midnight Slate",
    tagline: "Studio Monitor",
    accent: "#3b82f6",
    bg: "#080c14",
    palette: ["#3b82f6", "#0e1522", "#141c2d"],
  },
];

export const DESIGN_LANGUAGES: Array<{
  id: ThemeDesignLanguage;
  name: string;
  tagline: string;
  icon: typeof Sparkles;
}> = [
  {
    id: "oled_cinema",
    name: "Spatial Cinema",
    tagline: "Leica / Apple TV inspired depth & frosted glass",
    icon: Sparkles,
  },
  {
    id: "futuristic_hud",
    name: "Tactile Modular",
    tagline: "Teenage Engineering / Dieter Rams mechanical grid",
    icon: Zap,
  },
  {
    id: "editorial_slate",
    name: "Editorial Canvas",
    tagline: "Nothing OS inspired dot-matrix & posterless curation",
    icon: BookOpen,
  },
  {
    id: "warm_velvet",
    name: "Warm Velvet",
    tagline: "Pill-soft curves & amber candlelight bloom",
    icon: Flame,
  },
];

export const MOTION_DIALS: Array<{
  id: MotionDial;
  name: string;
  tagline: string;
}> = [
  {
    id: "flashy",
    name: "Flashy & Bouncy",
    tagline: "Dynamic 3D tilts, pulse rings & micro-animations",
  },
  {
    id: "cinematic",
    name: "Cinematic Ease",
    tagline: "Silky 300ms smooth transitions & backdrop easing",
  },
  {
    id: "minimal_boring",
    name: "Minimal / Boring",
    tagline: "Instant 0ms clicks, zero motion or distraction",
  },
];

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const currentTheme = useReelStore((s) => s.theme);
  const setTheme = useReelStore((s) => s.setTheme);
  const residents = useReelStore((s) => s.residents);
  const activeResidentId = useReelStore((s) => s.activeResidentId);
  const patchResident = useReelStore((s) => s.patchResident);
  const activeResident = residents.find((r) => r.id === activeResidentId) ?? residents[0];

  const currentDesign: ThemeDesignLanguage = activeResident?.themeDesign || "oled_cinema";
  const currentMotion: MotionDial = activeResident?.motionStyle || "cinematic";

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"design" | "motion" | "palette">("design");
  const menuRef = useRef<HTMLDivElement>(null);

  const activeOption =
    THEME_OPTIONS.find((t) => t.id === currentTheme) ?? THEME_OPTIONS[0];

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) {
      document.addEventListener("mousedown", handleDown);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const selectDesign = (design: ThemeDesignLanguage) => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme-design", design);
      document.body.setAttribute("data-theme-design", design);
    }
    if (activeResident) {
      patchResident(activeResident.id, { themeDesign: design });
    }
  };

  const selectMotion = (motion: MotionDial) => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-motion", motion);
      document.body.setAttribute("data-motion", motion);
    }
    if (activeResident) {
      patchResident(activeResident.id, { motionStyle: motion });
    }
  };

  const selectTheme = (id: ThemeName) => {
    setTheme(id);
    if (activeResident) {
      patchResident(activeResident.id, { accentColor: id });
    }
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border bg-card/70 px-3 py-1.5 text-xs font-semibold text-muted shadow-sm backdrop-blur-md transition-all hover:border-gold/40 hover:text-foreground",
          open && "border-gold/50 bg-card text-foreground ring-1 ring-gold/40",
          compact && "size-9 justify-center p-0"
        )}
        title={`Style Studio: ${activeOption.name} · ${currentDesign} (Click to change)`}
      >
        <span
          className="size-2.5 rounded-full ring-1 ring-white/20 shadow-sm shrink-0"
          style={{ backgroundColor: activeOption.accent }}
        />
        {!compact ? (
          <>
            <span className="hidden lg:inline">{activeOption.name}</span>
            <Palette className="size-3 text-muted/70 lg:hidden" />
          </>
        ) : null}
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 sm:hidden bg-black/40 backdrop-blur-xs"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-4 top-16 z-50 mx-auto max-w-md sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 rounded-2xl border border-border/80 bg-raised/95 p-3 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-2 pb-2.5 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Palette className="size-3.5 text-gold" />
                  <span>Personal Style Studio</span>
                </div>
                <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[9px] font-mono text-gold font-semibold uppercase">
                  {activeResident?.name || "Profile"}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted">
                Design language, motion feel & atmosphere palette
              </p>
            </div>

            {/* Navigation Tabs */}
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-card p-1 border border-border/40">
              <button
                type="button"
                onClick={() => setActiveTab("design")}
                className={cn(
                  "rounded-lg py-1 text-[11px] font-medium transition-all",
                  activeTab === "design"
                    ? "bg-card-2 text-foreground shadow-xs font-semibold"
                    : "text-muted hover:text-foreground"
                )}
              >
                Design
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("motion")}
                className={cn(
                  "rounded-lg py-1 text-[11px] font-medium transition-all",
                  activeTab === "motion"
                    ? "bg-card-2 text-foreground shadow-xs font-semibold"
                    : "text-muted hover:text-foreground"
                )}
              >
                Motion
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("palette")}
                className={cn(
                  "rounded-lg py-1 text-[11px] font-medium transition-all",
                  activeTab === "palette"
                    ? "bg-card-2 text-foreground shadow-xs font-semibold"
                    : "text-muted hover:text-foreground"
                )}
              >
                Color
              </button>
            </div>

            {/* Tab 1: Design Language */}
            {activeTab === "design" && (
              <div className="mt-2.5 flex flex-col gap-1.5">
                {DESIGN_LANGUAGES.map((d) => {
                  const isSelected = d.id === currentDesign;
                  const Icon = d.icon;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => selectDesign(d.id)}
                      className={cn(
                        "group flex items-center justify-between gap-2.5 rounded-xl p-2 text-left text-xs transition-all",
                        isSelected
                          ? "bg-card border border-gold/40 shadow-sm"
                          : "hover:bg-card/60 hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={cn(
                            "flex size-7 items-center justify-center rounded-lg border shrink-0",
                            isSelected
                              ? "border-gold/50 bg-gold/15 text-gold"
                              : "border-white/10 bg-card-2 text-muted group-hover:text-foreground"
                          )}
                        >
                          <Icon className="size-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "font-medium truncate text-xs",
                              isSelected ? "text-foreground font-semibold" : "text-muted group-hover:text-foreground"
                            )}
                          >
                            {d.name}
                          </p>
                          <p className="text-[10px] text-faint truncate">{d.tagline}</p>
                        </div>
                      </div>
                      {isSelected ? (
                        <div className="flex size-4 shrink-0 items-center justify-center rounded-full bg-gold text-gold-fg">
                          <Check className="size-2.5 stroke-[3]" />
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tab 2: Motion Dial */}
            {activeTab === "motion" && (
              <div className="mt-2.5 flex flex-col gap-1.5">
                {MOTION_DIALS.map((m) => {
                  const isSelected = m.id === currentMotion;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => selectMotion(m.id)}
                      className={cn(
                        "group flex items-center justify-between gap-2.5 rounded-xl p-2 text-left text-xs transition-all",
                        isSelected
                          ? "bg-card border border-gold/40 shadow-sm"
                          : "hover:bg-card/60 hover:text-foreground"
                      )}
                    >
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "font-medium truncate text-xs",
                            isSelected ? "text-foreground font-semibold" : "text-muted group-hover:text-foreground"
                          )}
                        >
                          {m.name}
                        </p>
                        <p className="text-[10px] text-faint truncate">{m.tagline}</p>
                      </div>
                      {isSelected ? (
                        <div className="flex size-4 shrink-0 items-center justify-center rounded-full bg-gold text-gold-fg">
                          <Check className="size-2.5 stroke-[3]" />
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tab 3: Atmosphere Palette */}
            {activeTab === "palette" && (
              <div className="mt-2.5 flex flex-col gap-1.5">
                {THEME_OPTIONS.map((t) => {
                  const isSelected = t.id === currentTheme;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectTheme(t.id)}
                      className={cn(
                        "group flex items-center justify-between gap-2.5 rounded-xl p-2 text-left text-xs transition-all",
                        isSelected
                          ? "bg-card border border-gold/40 shadow-sm"
                          : "hover:bg-card/60 hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="flex size-7 items-center justify-center rounded-lg border border-white/10 shadow-inner shrink-0"
                          style={{ backgroundColor: t.bg }}
                        >
                          <div className="flex gap-0.5">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: t.palette[0] }}
                            />
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: t.palette[1] }}
                            />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "font-medium truncate text-xs",
                              isSelected ? "text-foreground font-semibold" : "text-muted group-hover:text-foreground"
                            )}
                          >
                            {t.name}
                          </p>
                          <p className="text-[10px] text-faint truncate">{t.tagline}</p>
                        </div>
                      </div>
                      {isSelected ? (
                        <div className="flex size-4 shrink-0 items-center justify-center rounded-full bg-gold text-gold-fg">
                          <Check className="size-2.5 stroke-[3]" />
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

