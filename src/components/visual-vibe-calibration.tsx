import React, { useState } from "react";
import { Film, Sparkles, Flame, Coffee, Zap, Check } from "lucide-react";
import { useReelStore, type TasteVibe } from "@/lib/store";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface VibeCard {
  id: TasteVibe;
  tag: string;
  title: string;
  era: string;
  desc: string;
  examples: string;
  icon: typeof Film;
  gradient: string;
}

export const VIBE_CARDS: VibeCard[] = [
  {
    id: "comfort",
    tag: "80s & 90s Nostalgia",
    title: "Vintage Synth & Warmth",
    era: "1980 - 1999",
    desc: "Iconic synth scores, practical effects, and cozy timeless adventure.",
    examples: "The Thing, Blade Runner, Jurassic Park, Back to the Future",
    icon: Flame,
    gradient: "from-amber-500/20 via-orange-500/10 to-transparent border-amber-500/30",
  },
  {
    id: "hidden_gems",
    tag: "A24 & Midnight",
    title: "Esoteric Mind-Benders",
    era: "Indie / Cult",
    desc: "Dark psychological mysteries, cerebral sci-fi, and unpredictable twists.",
    examples: "Ex Machina, Hereditary, Memento, Arrival, The Witch",
    icon: Sparkles,
    gradient: "from-purple-500/20 via-indigo-500/10 to-transparent border-purple-500/30",
  },
  {
    id: "balanced",
    tag: "Golden Popcorn",
    title: "Crowd-Pleasing Blockbusters",
    era: "All-Time Hits",
    desc: "Universal favorites, family consensus, and pure weekend escapism.",
    examples: "The Dark Knight, Inception, Top Gun, Guardians of the Galaxy",
    icon: Film,
    gradient: "from-gold/20 via-yellow-500/10 to-transparent border-gold/30",
  },
  {
    id: "comfort",
    tag: "Gentle & Whimsical",
    title: "Cozy Storybook & Ghibli",
    era: "Feel-Good",
    desc: "Heartwarming storytelling, gentle pacing, and beautiful art direction.",
    examples: "Spirited Away, Paddington 2, Amelie, Fantastic Mr. Fox",
    icon: Coffee,
    gradient: "from-emerald-500/20 via-teal-500/10 to-transparent border-emerald-500/30",
  },
  {
    id: "bleeding_edge",
    tag: "4K Spectacle",
    title: "Bleeding-Edge Powerhouse",
    era: "2020 - Present",
    desc: "Uncompressed Dolby Vision, IMAX soundscapes, and modern technical mastery.",
    examples: "Dune: Part Two, Oppenheimer, The Batman, Civil War",
    icon: Zap,
    gradient: "from-sky-500/20 via-blue-500/10 to-transparent border-sky-500/30",
  },
];

export function VisualVibeCalibration() {
  const activeId = useReelStore((s) => s.activeResidentId);
  const residents = useReelStore((s) => s.residents);
  const patchResident = useReelStore((s) => s.patchResident);

  const active = residents.find((r) => r.id === activeId) ?? residents[0];
  const [selectedVibe, setSelectedVibe] = useState<TasteVibe>(active?.tasteVibe || "comfort");

  const handleSelect = (vibe: TasteVibe, title: string) => {
    setSelectedVibe(vibe);
    if (active) {
      patchResident(active.id, { tasteVibe: vibe });
      showToast(`Taste preferences updated from ${title}`, "success");
    }
  };

  return (
    <div className="space-y-4 py-3">
      <div>
        <h4 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
          <Sparkles className="size-4 text-gold" />
          Taste & Era Calibration
        </h4>
        <p className="text-xs text-muted mt-0.5">
          Tap your favorite vibe. ReelOS will adapt recommendations to match your era and mood.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {VIBE_CARDS.map((c, idx) => {
          const isSelected = selectedVibe === c.id;
          const Icon = c.icon;
          return (
            <button
              key={`${c.id}-${idx}`}
              type="button"
              onClick={() => handleSelect(c.id, c.title)}
              className={cn(
                "relative flex flex-col p-4 rounded-2xl border text-left transition-all cursor-pointer bg-gradient-to-br shadow-sm hover:scale-[1.02]",
                c.gradient,
                isSelected
                  ? "ring-2 ring-gold border-gold shadow-[var(--shadow-gold)] bg-card/90"
                  : "bg-card/40 border-border/80 hover:border-border hover:bg-card/70"
              )}
            >
              {isSelected ? (
                <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-gold text-gold-fg">
                  <Check className="size-3 stroke-[3]" />
                </span>
              ) : null}

              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-xl bg-white/10 text-foreground">
                  <Icon className="size-3.5" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gold font-mono">
                  {c.tag}
                </span>
              </div>

              <h5 className="font-display text-sm font-semibold text-foreground mt-2">
                {c.title}
              </h5>
              <p className="text-xs text-muted mt-1 leading-relaxed line-clamp-2">
                {c.desc}
              </p>
              <p className="text-[11px] text-faint mt-2 italic truncate">
                {c.examples}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
