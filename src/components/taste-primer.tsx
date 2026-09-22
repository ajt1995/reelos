import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Sparkles,
  Heart,
  ArrowRight,
  ThumbsUp,
  Coffee,
  X,
  RotateCcw,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TasteBubbleItem {
  id: string;
  title: string;
  category: "auteur" | "landmark" | "vibe";
  categoryLabel: string;
  tagline: string;
  accent: string;
  gradient: string;
  baseSize: "normal" | "large" | "hero";
  vectorWeights: Record<string, number>;
}

// Aliased as TasteArchetype for backwards-compatibility with existing imports
export type TasteArchetype = TasteBubbleItem;

export type BubbleReaction = "love" | "like" | "comfy" | "dismiss";

export const FALLBACK_TASTE_BUBBLES: TasteBubbleItem[] = [
  // Auteurs
  {
    id: "christopher-nolan",
    title: "Christopher Nolan",
    category: "auteur",
    categoryLabel: "Auteur",
    tagline: "Practical 70mm IMAX scale, non-linear time & thundering scores",
    accent: "text-amber-400",
    gradient: "from-amber-600/30 via-orange-600/20 to-neutral-950",
    baseSize: "large",
    vectorWeights: {
      spectacle: 0.95,
      scifi: 0.9,
      cerebral: 0.95,
      sound_design: 0.95,
    },
  },
  {
    id: "denis-villeneuve",
    title: "Denis Villeneuve",
    category: "auteur",
    categoryLabel: "Auteur",
    tagline:
      "Monumental sci-fi architecture, meditative dread & sweeping grandeur",
    accent: "text-sky-400",
    gradient: "from-sky-600/30 via-cyan-600/20 to-neutral-950",
    baseSize: "hero",
    vectorWeights: {
      spectacle: 0.95,
      scifi: 0.95,
      atmospheric: 0.95,
      pacing_slow: 0.8,
    },
  },
  {
    id: "hayao-miyazaki",
    title: "Hayao Miyazaki",
    category: "auteur",
    categoryLabel: "Auteur",
    tagline:
      "Hand-painted environmental wonder, childhood whimsy & gentle aviation",
    accent: "text-emerald-400",
    gradient: "from-emerald-600/30 via-teal-600/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: {
      comfort: 0.95,
      animation: 0.95,
      fantasy: 0.9,
      heart: 0.95,
    },
  },
  {
    id: "david-fincher",
    title: "David Fincher",
    category: "auteur",
    categoryLabel: "Auteur",
    tagline:
      "Obsessive digital perfection, clinical shadows & procedural tension",
    accent: "text-zinc-300",
    gradient: "from-zinc-600/30 via-neutral-700/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: {
      neo_noir: 0.95,
      tension: 0.95,
      cynical: 0.85,
      dialogue: 0.9,
    },
  },
  {
    id: "quentin-tarantino",
    title: "Quentin Tarantino",
    category: "auteur",
    categoryLabel: "Auteur",
    tagline: "Razor-sharp monologues, needle-drop funk & kinetic pulp violence",
    accent: "text-yellow-400",
    gradient: "from-yellow-600/30 via-amber-600/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: {
      dialogue: 0.95,
      adrenaline: 0.9,
      indie: 0.85,
      comedy: 0.8,
    },
  },
  {
    id: "greta-gerwig",
    title: "Greta Gerwig",
    category: "auteur",
    categoryLabel: "Auteur",
    tagline:
      "Lyrical humanism, razor wit & emotionally resonant character journeys",
    accent: "text-pink-400",
    gradient: "from-pink-600/30 via-rose-600/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: {
      heart: 0.95,
      dialogue: 0.9,
      aesthetic: 0.85,
      comedy: 0.85,
    },
  },
  {
    id: "wes-anderson",
    title: "Wes Anderson",
    category: "auteur",
    categoryLabel: "Auteur",
    tagline:
      "Pastel symmetry, deadpan narration & meticulous dollhouse framing",
    accent: "text-amber-300",
    gradient: "from-amber-500/30 via-yellow-600/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: {
      aesthetic: 0.95,
      comedy: 0.85,
      dialogue: 0.9,
      whimsical: 0.95,
    },
  },
  {
    id: "stanley-kubrick",
    title: "Stanley Kubrick",
    category: "auteur",
    categoryLabel: "Auteur",
    tagline:
      "Chilly metaphysical symmetry, unflinching gaze & philosophical grandeur",
    accent: "text-cyan-300",
    gradient: "from-cyan-700/30 via-slate-700/20 to-neutral-950",
    baseSize: "large",
    vectorWeights: {
      cerebral: 0.98,
      atmospheric: 0.95,
      scifi: 0.9,
      pacing_slow: 0.85,
    },
  },
  {
    id: "martin-scorsese",
    title: "Martin Scorsese",
    category: "auteur",
    categoryLabel: "Auteur",
    tagline:
      "Kinetic tracking shots, moral volatility & searing streetwise velocity",
    accent: "text-red-400",
    gradient: "from-red-700/30 via-amber-700/20 to-neutral-950",
    baseSize: "large",
    vectorWeights: {
      dialogue: 0.9,
      prestige: 0.95,
      intensity: 0.95,
      drama: 0.95,
    },
  },
  {
    id: "guillermo-del-toro",
    title: "Guillermo del Toro",
    category: "auteur",
    categoryLabel: "Auteur",
    tagline: "Gothic romance, poetic monsters & dark fairy-tale mechanics",
    accent: "text-amber-500",
    gradient: "from-amber-700/30 via-emerald-800/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: {
      aesthetic: 0.95,
      fantasy: 0.95,
      atmospheric: 0.9,
      heart: 0.85,
    },
  },
  {
    id: "bong-joon-ho",
    title: "Bong Joon-ho",
    category: "auteur",
    categoryLabel: "Auteur",
    tagline: "Sharp social satire, razor genre shifts & architectural blocking",
    accent: "text-emerald-300",
    gradient: "from-emerald-700/30 via-zinc-700/20 to-neutral-950",
    baseSize: "large",
    vectorWeights: { cynical: 0.9, tension: 0.95, comedy: 0.85, drama: 0.95 },
  },
  {
    id: "wong-kar-wai",
    title: "Wong Kar-wai",
    category: "auteur",
    categoryLabel: "Auteur",
    tagline: "Neon-lit romance, stepping-frame melancholy & yearning glances",
    accent: "text-rose-400",
    gradient: "from-rose-700/30 via-indigo-700/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: {
      aesthetic: 0.98,
      atmospheric: 0.95,
      comfort: 0.85,
      heart: 0.9,
    },
  },
  {
    id: "coen-brothers",
    title: "Coen Brothers",
    category: "auteur",
    categoryLabel: "Auteur",
    tagline: "Deadpan absurdism, fatalistic irony & crisp Americana dialogue",
    accent: "text-yellow-500",
    gradient: "from-yellow-700/30 via-orange-800/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: {
      comedy: 0.9,
      dialogue: 0.95,
      neo_noir: 0.85,
      cynical: 0.85,
    },
  },
  {
    id: "ridley-scott",
    title: "Ridley Scott",
    category: "auteur",
    categoryLabel: "Auteur",
    tagline:
      "Industrial sci-fi texture, sweeping historical scale & rich smoke",
    accent: "text-blue-400",
    gradient: "from-blue-700/30 via-slate-700/20 to-neutral-950",
    baseSize: "large",
    vectorWeights: {
      spectacle: 0.95,
      scifi: 0.9,
      atmospheric: 0.9,
      sound_design: 0.85,
    },
  },
  {
    id: "david-lynch",
    title: "David Lynch",
    category: "auteur",
    categoryLabel: "Auteur",
    tagline: "Surreal dream logic, industrial droning & subconscious mystery",
    accent: "text-purple-400",
    gradient: "from-purple-800/30 via-red-900/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: {
      atmospheric: 0.98,
      cerebral: 0.95,
      dread: 0.9,
      indie: 0.95,
    },
  },

  // Landmarks & Masterpieces
  {
    id: "dune-part-two",
    title: "Dune: Part Two",
    category: "landmark",
    categoryLabel: "Masterpiece",
    tagline: "Thunderous soundscapes, desert scale & mythic destiny",
    accent: "text-amber-400",
    gradient: "from-amber-600/30 via-orange-600/20 to-neutral-950",
    baseSize: "hero",
    vectorWeights: {
      spectacle: 0.95,
      scifi: 0.9,
      sound_design: 0.95,
      pacing_slow: 0.4,
    },
  },
  {
    id: "the-bear",
    title: "The Bear",
    category: "landmark",
    categoryLabel: "Masterpiece",
    tagline: "High-stakes culinary adrenaline, family grit & sharp editing",
    accent: "text-sky-400",
    gradient: "from-sky-600/30 via-cyan-600/20 to-neutral-950",
    baseSize: "large",
    vectorWeights: {
      intensity: 0.95,
      indie: 0.85,
      drama: 0.9,
      pacing_fast: 0.9,
    },
  },
  {
    id: "succession",
    title: "Succession",
    category: "landmark",
    categoryLabel: "Masterpiece",
    tagline: "Biting dialogue, boardroom betrayals & Shakespearean ego",
    accent: "text-rose-400",
    gradient: "from-rose-600/30 via-red-600/20 to-neutral-950",
    baseSize: "large",
    vectorWeights: { prestige: 0.95, dialogue: 0.95, drama: 0.9, cynical: 0.8 },
  },
  {
    id: "blade-runner-2049",
    title: "Blade Runner 2049",
    category: "landmark",
    categoryLabel: "Masterpiece",
    tagline: "Rain-slicked pavement, analog synths & existential longing",
    accent: "text-violet-400",
    gradient: "from-violet-600/30 via-indigo-600/20 to-neutral-950",
    baseSize: "large",
    vectorWeights: {
      neo_noir: 0.95,
      scifi: 0.9,
      atmospheric: 0.95,
      pacing_slow: 0.85,
    },
  },
  {
    id: "severance",
    title: "Severance",
    category: "landmark",
    categoryLabel: "Masterpiece",
    tagline:
      "Sterile corridors, corporate dystopian dread & mind-bending mystery",
    accent: "text-cyan-400",
    gradient: "from-cyan-600/30 via-blue-600/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: {
      cerebral: 0.95,
      tension: 0.9,
      neo_noir: 0.85,
      drama: 0.85,
    },
  },
  {
    id: "interstellar",
    title: "Interstellar",
    category: "landmark",
    categoryLabel: "Masterpiece",
    tagline: "Relativistic time, cathedral pipe organs & cosmic love",
    accent: "text-blue-400",
    gradient: "from-blue-600/30 via-indigo-600/20 to-neutral-950",
    baseSize: "large",
    vectorWeights: {
      scifi: 0.95,
      heart: 0.9,
      spectacle: 0.95,
      sound_design: 0.95,
    },
  },
  {
    id: "spirited-away",
    title: "Spirited Away",
    category: "landmark",
    categoryLabel: "Masterpiece",
    tagline: "Bathhouse spirits, unforgettable trains & timeless nostalgia",
    accent: "text-emerald-400",
    gradient: "from-emerald-600/30 via-teal-600/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: {
      comfort: 0.95,
      animation: 0.95,
      fantasy: 0.85,
      heart: 0.9,
    },
  },
  {
    id: "chernobyl",
    title: "Chernobyl",
    category: "landmark",
    categoryLabel: "Masterpiece",
    tagline: "Unflinching historical tension, geiger counters & human truth",
    accent: "text-yellow-400",
    gradient: "from-yellow-600/30 via-zinc-600/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: { dread: 0.95, prestige: 0.9, realism: 0.95, tension: 0.9 },
  },
  {
    id: "everything-everywhere",
    title: "Everything Everywhere All At Once",
    category: "landmark",
    categoryLabel: "Masterpiece",
    tagline: "Maximalist martial arts, multiverse madness & pure heart",
    accent: "text-fuchsia-400",
    gradient: "from-fuchsia-600/30 via-purple-600/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: { cerebral: 0.9, comedy: 0.8, heart: 0.9, creative: 0.95 },
  },
  {
    id: "parasite",
    title: "Parasite",
    category: "landmark",
    categoryLabel: "Masterpiece",
    tagline: "Architectural tension, class warfare & masterclass tragicomedy",
    accent: "text-emerald-400",
    gradient: "from-emerald-700/30 via-slate-700/20 to-neutral-950",
    baseSize: "hero",
    vectorWeights: {
      prestige: 0.95,
      tension: 0.95,
      cynical: 0.85,
      drama: 0.95,
    },
  },
  {
    id: "the-dark-knight",
    title: "The Dark Knight",
    category: "landmark",
    categoryLabel: "Masterpiece",
    tagline: "Operatic urban chaos, moral dilemmas & seismic IMAX action",
    accent: "text-blue-300",
    gradient: "from-blue-700/30 via-zinc-800/20 to-neutral-950",
    baseSize: "hero",
    vectorWeights: {
      spectacle: 0.95,
      adrenaline: 0.95,
      neo_noir: 0.9,
      prestige: 0.9,
    },
  },
  {
    id: "mad-max-fury-road",
    title: "Mad Max: Fury Road",
    category: "landmark",
    categoryLabel: "Masterpiece",
    tagline:
      "Relentless kinetic vehicular opera, practical stunts & desert fury",
    accent: "text-orange-400",
    gradient: "from-orange-600/30 via-red-600/20 to-neutral-950",
    baseSize: "large",
    vectorWeights: {
      adrenaline: 0.98,
      spectacle: 0.95,
      intensity: 0.95,
      pacing_fast: 0.98,
    },
  },
  {
    id: "arrival",
    title: "Arrival",
    category: "landmark",
    categoryLabel: "Masterpiece",
    tagline:
      "Non-linear linguistic revelation, melancholic alien majesty & grief",
    accent: "text-sky-300",
    gradient: "from-sky-700/30 via-indigo-700/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: {
      scifi: 0.95,
      cerebral: 0.95,
      heart: 0.9,
      atmospheric: 0.9,
    },
  },
  {
    id: "whiplash",
    title: "Whiplash",
    category: "landmark",
    categoryLabel: "Masterpiece",
    tagline: "Blood-stained drumheads, psychological tempo warfare & obsession",
    accent: "text-amber-400",
    gradient: "from-amber-700/30 via-red-800/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: {
      intensity: 0.98,
      drama: 0.95,
      sound_design: 0.95,
      pacing_fast: 0.9,
    },
  },
  {
    id: "heat",
    title: "Heat",
    category: "landmark",
    categoryLabel: "Masterpiece",
    tagline:
      "Melancholic neon Los Angeles, professional standoff & thunderous acoustics",
    accent: "text-indigo-400",
    gradient: "from-indigo-800/30 via-blue-900/20 to-neutral-950",
    baseSize: "large",
    vectorWeights: {
      neo_noir: 0.95,
      dialogue: 0.9,
      sound_design: 0.95,
      drama: 0.9,
    },
  },

  // Aesthetic Vibes & Worldbuilding
  {
    id: "vibe-scifi-worldbuilding",
    title: "Sci-Fi Worldbuilding",
    category: "vibe",
    categoryLabel: "Taste Vibe",
    tagline:
      "Expansive planetary lore, colossal starships & technological wonder",
    accent: "text-blue-300",
    gradient: "from-blue-600/30 via-cyan-600/20 to-neutral-950",
    baseSize: "hero",
    vectorWeights: { scifi: 0.95, spectacle: 0.9, atmospheric: 0.85 },
  },
  {
    id: "vibe-a24-midnight",
    title: "A24 Midnight Dread",
    category: "vibe",
    categoryLabel: "Taste Vibe",
    tagline:
      "Psychological folk dread, midnight thrills & uncompromising vision",
    accent: "text-purple-300",
    gradient: "from-purple-600/30 via-fuchsia-600/20 to-neutral-950",
    baseSize: "large",
    vectorWeights: { cerebral: 0.9, neo_noir: 0.85, tension: 0.9, indie: 0.95 },
  },
  {
    id: "vibe-35mm-warmth",
    title: "35mm Analog Warmth",
    category: "vibe",
    categoryLabel: "Taste Vibe",
    tagline: "Grainy optical textures, 70s pacing & tangible celluloid soul",
    accent: "text-amber-300",
    gradient: "from-amber-600/30 via-orange-600/20 to-neutral-950",
    baseSize: "large",
    vectorWeights: { aesthetic: 0.9, comfort: 0.85, indie: 0.85, realism: 0.8 },
  },
  {
    id: "vibe-slow-burn-noir",
    title: "Slow-Burn Neo-Noir",
    category: "vibe",
    categoryLabel: "Taste Vibe",
    tagline: "Smoke-filled rooms, moral ambiguity & relentless investigation",
    accent: "text-indigo-300",
    gradient: "from-indigo-600/30 via-slate-600/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: {
      neo_noir: 0.95,
      atmospheric: 0.9,
      pacing_slow: 0.85,
      tension: 0.85,
    },
  },
  {
    id: "vibe-cozy-whimsy",
    title: "Cozy Whimsy & Comfort",
    category: "vibe",
    categoryLabel: "Taste Vibe",
    tagline: "Gentle pacing, comforting optimism & beautiful storybook warmth",
    accent: "text-emerald-300",
    gradient: "from-emerald-600/30 via-lime-600/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: { comfort: 0.95, heart: 0.9, whimsical: 0.9, family: 0.85 },
  },
  {
    id: "vibe-boardroom-power",
    title: "Boardroom Betrayals",
    category: "vibe",
    categoryLabel: "Taste Vibe",
    tagline: "Hyper-articulate venom, financial empires & ruthless ambition",
    accent: "text-rose-300",
    gradient: "from-rose-600/30 via-zinc-600/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: {
      prestige: 0.95,
      dialogue: 0.95,
      cynical: 0.85,
      drama: 0.9,
    },
  },
  {
    id: "vibe-high-stakes-adrenaline",
    title: "High-Stakes Tension",
    category: "vibe",
    categoryLabel: "Taste Vibe",
    tagline:
      "Non-stop pulse-pounding editing, ticking clocks & raw nerve energy",
    accent: "text-red-400",
    gradient: "from-red-600/30 via-amber-600/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: { intensity: 0.95, pacing_fast: 0.95, adrenaline: 0.95 },
  },
  {
    id: "vibe-70mm-spectacle",
    title: "70mm IMAX Spectacle",
    category: "vibe",
    categoryLabel: "Taste Vibe",
    tagline: "Towering visual scope, reference dynamic range & seismic bass",
    accent: "text-yellow-400",
    gradient: "from-yellow-600/30 via-amber-600/20 to-neutral-950",
    baseSize: "hero",
    vectorWeights: { spectacle: 0.98, sound_design: 0.95, scifi: 0.85 },
  },
  {
    id: "vibe-synthwave-retro",
    title: "Synthwave Retro-Futurism",
    category: "vibe",
    categoryLabel: "Taste Vibe",
    tagline: "Arpeggiated analog synthesizers, neon rain & late-night asphalt",
    accent: "text-fuchsia-400",
    gradient: "from-fuchsia-600/30 via-violet-600/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: { aesthetic: 0.95, neo_noir: 0.85, sound_design: 0.9 },
  },
  {
    id: "vibe-arthouse-poetry",
    title: "Arthouse Poetic Cinema",
    category: "vibe",
    categoryLabel: "Taste Vibe",
    tagline: "Lingering contemplation, metaphysical mystery & painterly light",
    accent: "text-teal-300",
    gradient: "from-teal-600/30 via-cyan-800/20 to-neutral-950",
    baseSize: "normal",
    vectorWeights: {
      atmospheric: 0.98,
      cerebral: 0.9,
      pacing_slow: 0.9,
      indie: 0.9,
    },
  },
  {
    id: "vibe-cerebral-twists",
    title: "Cerebral Mind-Benders",
    category: "vibe",
    categoryLabel: "Taste Vibe",
    tagline: "Puzzle-box storytelling, fractured timelines & shocking reveals",
    accent: "text-indigo-300",
    gradient: "from-indigo-700/30 via-purple-700/20 to-neutral-950",
    baseSize: "large",
    vectorWeights: { cerebral: 0.98, tension: 0.9, neo_noir: 0.85 },
  },
];

export const TASTE_ARCHETYPES = FALLBACK_TASTE_BUBBLES;

export interface TastePrimerProps {
  onComplete: (
    selectedIds: string[],
    synthesizedWeights: Record<string, number>,
    reactionBuckets?: { favorites: string[]; likes: string[]; cozy: string[] },
  ) => void;
  onSkip?: () => void;
}

// Target active candidate bubble window count (14 to 18)
const ACTIVE_BUBBLE_TARGET = 16;

export function TastePrimer({ onComplete, onSkip }: TastePrimerProps) {
  // Bubbles state
  const [bubbles, setBubbles] = useState<TasteBubbleItem[]>(
    FALLBACK_TASTE_BUBBLES,
  );

  // Reactions map: id -> reaction
  const [reactions, setReactions] = useState<Record<string, BubbleReaction>>(
    {},
  );
  const [filterCategory, setFilterCategory] = useState<
    "all" | "auteur" | "landmark" | "vibe"
  >("all");

  // Evolving preference weights for this calibration session.
  const [centroidWeights, setCentroidWeights] = useState<
    Record<string, number>
  >({});

  // Active bubbles currently displayed on canvas
  const [activeBubbleIds, setActiveBubbleIds] = useState<string[]>(() => {
    return FALLBACK_TASTE_BUBBLES.slice(0, ACTIVE_BUBBLE_TARGET).map(
      (b) => b.id,
    );
  });

  useEffect(() => {
    fetch("/api/cinema/taste-bubbles")
      .then((r) => r.json())
      .then((d) => {
        if (d?.bubbles && Array.isArray(d.bubbles) && d.bubbles.length > 0) {
          const mapped = d.bubbles.map((b: any) => ({
            id: b.id,
            title: b.title,
            category: b.category,
            categoryLabel:
              b.categoryLabel ||
              (b.category === "auteur"
                ? "Auteur"
                : b.category === "landmark"
                  ? "Landmark"
                  : "Taste Vibe"),
            tagline: b.tagline || b.blurb || "",
            blurb: b.blurb || b.tagline || "",
            accent:
              b.accent ||
              (b.category === "auteur"
                ? "text-amber-400"
                : b.category === "landmark"
                  ? "text-gold"
                  : "text-emerald-400"),
            gradient:
              b.gradient ||
              "from-amber-600/30 via-orange-600/20 to-neutral-950",
            baseSize: b.baseSize || "normal",
            vectorWeights: b.vectorWeights || {},
          }));
          setBubbles(mapped);
          setActiveBubbleIds(
            mapped
              .slice(0, ACTIVE_BUBBLE_TARGET)
              .map((b: TasteBubbleItem) => b.id),
          );
        }
      })
      .catch(() => {
        // Keep the local starter set when the measured suggestions are unavailable.
      });
  }, []);

  // Track dynamically streamed in bubble count to celebrate progress
  const [streamedCount, setStreamedCount] = useState(0);

  // Compute live breakdown
  const reactionEntries = Object.entries(reactions);
  const lovedIds = useMemo(
    () => reactionEntries.filter(([_, r]) => r === "love").map(([id]) => id),
    [reactions],
  );
  const likedIds = useMemo(
    () => reactionEntries.filter(([_, r]) => r === "like").map(([id]) => id),
    [reactions],
  );
  const cozyIds = useMemo(
    () => reactionEntries.filter(([_, r]) => r === "comfy").map(([id]) => id),
    [reactions],
  );
  const dismissedIds = useMemo(
    () => reactionEntries.filter(([_, r]) => r === "dismiss").map(([id]) => id),
    [reactions],
  );

  const totalCalibrated = lovedIds.length + likedIds.length + cozyIds.length;

  // Real-time dynamic centroid weight recalculation
  useEffect(() => {
    const nextWeights: Record<string, number> = {};
    let totalMultiplier = 0;

    for (const [id, reaction] of Object.entries(reactions)) {
      if (reaction === "dismiss") continue;
      const item = bubbles.find((b) => b.id === id);
      if (!item) continue;

      // Love = 2.5x, Like = 1.0x, Comfy = 1.5x
      let multiplier = 1.0;
      if (reaction === "love") multiplier = 2.5;
      else if (reaction === "comfy") multiplier = 1.5;

      totalMultiplier += multiplier;

      for (const [dim, wt] of Object.entries(item.vectorWeights)) {
        nextWeights[dim] = (nextWeights[dim] || 0) + wt * multiplier;
      }

      // Give an explicit Comfy reaction extra weight.
      if (reaction === "comfy") {
        nextWeights.comfort = (nextWeights.comfort || 0) + 0.5 * multiplier;
        nextWeights.heart = (nextWeights.heart || 0) + 0.4 * multiplier;
      }
    }

    if (totalMultiplier > 0) {
      for (const dim of Object.keys(nextWeights)) {
        nextWeights[dim] =
          Math.round((nextWeights[dim] / totalMultiplier) * 1000) / 1000;
      }
    }

    setCentroidWeights(nextWeights);
  }, [reactions]);

  // Handle distinct 4-way affinity reaction
  const handleReaction = (id: string, reaction: BubbleReaction) => {
    setReactions((prev) => ({ ...prev, [id]: reaction }));
    setStreamedCount((c) => c + 1);

    // Asynchronously notify curator teach endpoint if available
    try {
      fetch("/api/curator/teach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action: reaction,
          centroid: centroidWeights,
        }),
      }).catch(() => {});
    } catch {}

    // Find a replacement bubble from the candidate pool not yet reacted to or on screen
    const availablePool = bubbles.filter(
      (b) =>
        !(b.id in reactions) && b.id !== id && !activeBubbleIds.includes(b.id),
    );

    let nextCandidate: TasteBubbleItem | undefined;

    if (availablePool.length > 0) {
      // Score available candidates against current centroid weights to pull correlated recommendations
      const scored = availablePool.map((item) => {
        let score = 0;
        for (const [dim, wt] of Object.entries(item.vectorWeights)) {
          if (centroidWeights[dim]) {
            score += wt * centroidWeights[dim];
          }
        }
        // Match current filter preference if active
        if (filterCategory !== "all" && item.category === filterCategory) {
          score += 0.5;
        }
        return { item, score };
      });

      scored.sort((a, b) => b.score - a.score);
      // Pick top scoring with slight variety
      const topPickIndex = Math.min(
        Math.floor(Math.random() * 2),
        scored.length - 1,
      );
      nextCandidate = scored[topPickIndex]?.item;
    }

    // Replace the reacted bubble in activeBubbleIds
    setActiveBubbleIds((current) => {
      const filtered = current.filter((bubbleId) => bubbleId !== id);
      if (nextCandidate) {
        return [...filtered, nextCandidate.id];
      }
      return filtered;
    });
  };

  // Reset all reactions
  const handleResetAll = () => {
    setReactions({});
    setCentroidWeights({});
    setActiveBubbleIds(bubbles.slice(0, ACTIVE_BUBBLE_TARGET).map((b) => b.id));
  };

  // Finish calibration whenever
  const handleFinish = () => {
    let finalWeights = { ...centroidWeights };
    const allSelectedIds = [...lovedIds, ...likedIds, ...cozyIds];

    if (allSelectedIds.length === 0) {
      // Fallback defaults if resident finished without clicking
      const defaults = [bubbles[0], bubbles[1], bubbles[2]];
      for (const item of defaults) {
        for (const [dim, wt] of Object.entries(item.vectorWeights)) {
          finalWeights[dim] = (finalWeights[dim] || 0) + wt / defaults.length;
        }
      }
      onComplete(
        defaults.map((d) => d.id),
        finalWeights,
        {
          favorites: [defaults[0].id],
          likes: [defaults[1].id],
          cozy: [defaults[2].id],
        },
      );
      return;
    }

    onComplete(allSelectedIds, finalWeights, {
      favorites: lovedIds,
      likes: likedIds,
      cozy: cozyIds,
    });
  };

  // Active bubbles to render
  const visibleBubbles = useMemo(() => {
    const list = activeBubbleIds
      .map((id) => bubbles.find((b) => b.id === id))
      .filter((b): b is TasteBubbleItem => Boolean(b));

    if (filterCategory === "all") return list;
    return list.filter((b) => b.category === filterCategory);
  }, [activeBubbleIds, filterCategory]);

  return (
    <div className="space-y-5 pb-44 animate-in fade-in duration-200">
      {/* Header & Interactivity Instructions */}
      <div className="space-y-2 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
            <Sparkles className="size-3.5" /> Endless Cinema Calibration
          </span>
          <div className="flex items-center gap-2 text-xs font-mono">
            {totalCalibrated > 0 ? (
              <span className="text-gold font-medium">
                {totalCalibrated} Anchors ({lovedIds.length} Loved ❤️ ·{" "}
                {likedIds.length} Liked 👍 · {cozyIds.length} Cozy ☕)
              </span>
            ) : (
              <span className="text-muted">
                4-Way Affinity · Choose as many as you like
              </span>
            )}
            {totalCalibrated > 0 && (
              <button
                type="button"
                onClick={handleResetAll}
                className="inline-flex items-center gap-1 text-muted hover:text-foreground text-[11px] underline ml-1 cursor-pointer"
                title="Reset calibration"
              >
                <RotateCcw className="size-3" /> Reset
              </button>
            )}
          </div>
        </div>

        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
          Calibrate your personal cinema
        </h2>
        <p className="text-xs sm:text-sm text-muted max-w-3xl leading-relaxed">
          An endless cinema canvas that tunes to your taste in real-time. Pick{" "}
          <strong className="text-gold font-bold">Love (❤️)</strong>,{" "}
          <strong className="text-amber-300 font-semibold">Like (👍)</strong>,{" "}
          <strong className="text-emerald-400 font-semibold">Comfy (☕)</strong>
          , or{" "}
          <strong className="text-zinc-400 font-normal">Dismiss (✕)</strong>.
          New candidates stream in dynamically as you react.
        </p>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1 no-scrollbar">
          {(["all", "vibe", "landmark", "auteur"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(cat)}
              className={cn(
                "rounded-full px-3.5 py-1 text-xs font-medium transition-all select-none capitalize cursor-pointer",
                filterCategory === cat
                  ? "bg-gold text-background font-semibold shadow-sm"
                  : "bg-card-2 border border-border text-muted hover:text-foreground hover:border-border-strong",
              )}
            >
              {cat === "all"
                ? "All Anchors"
                : cat === "vibe"
                  ? "Taste Vibes"
                  : cat === "landmark"
                    ? "Landmarks"
                    : "Auteurs"}
            </button>
          ))}
        </div>
      </div>

      {/* Endless Streaming Bubble Canvas */}
      <div className="relative rounded-3xl border border-border/50 bg-background/50 p-3.5 sm:p-5 backdrop-blur-md">
        {/* Subtle background glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 size-96 rounded-full bg-gold/10 blur-[100px]"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {visibleBubbles.map((item) => {
            const reaction = reactions[item.id];
            const isLoved = reaction === "love";
            const isLiked = reaction === "like";
            const isCozy = reaction === "comfy";

            return (
              <div
                key={item.id}
                className={cn(
                  "group relative select-none rounded-2xl transition-all duration-300 transform-gpu flex flex-col justify-between p-3.5 sm:p-4 text-left border shadow-sm w-full min-h-[188px]",
                  // Visual feedback state
                  isLoved
                    ? "border-gold/90 bg-gradient-to-br from-gold/25 via-amber-950/40 to-neutral-950 shadow-[0_0_30px_rgba(212,160,23,0.45)] ring-2 ring-gold"
                    : isLiked
                      ? "border-amber-400/80 bg-gradient-to-br from-amber-500/15 via-zinc-900/50 to-neutral-950 shadow-[0_0_20px_rgba(251,191,36,0.25)]"
                      : isCozy
                        ? "border-emerald-400/80 bg-gradient-to-br from-emerald-500/15 via-teal-950/40 to-neutral-950 shadow-[0_0_20px_rgba(52,211,153,0.25)]"
                        : "border-border/60 bg-card/75 hover:border-border-strong hover:bg-card hover:scale-[1.01]",
                )}
              >
                {/* Top Row: Category & Badges */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-muted">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        isLoved
                          ? "bg-gold ring-2 ring-gold-bright animate-ping"
                          : isLiked
                            ? "bg-amber-400"
                            : isCozy
                              ? "bg-emerald-400"
                              : "bg-muted/60",
                      )}
                    />
                    {item.categoryLabel ||
                      (item.category === "auteur"
                        ? "Auteur"
                        : item.category === "landmark"
                          ? "Landmark"
                          : "Taste Vibe")}
                  </span>

                  {reaction && (
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        isLoved && "bg-gold text-background",
                        isLiked &&
                          "bg-amber-400/20 text-amber-300 border border-amber-400/40",
                        isCozy &&
                          "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
                      )}
                    >
                      {isLoved ? "❤️ Loved" : isLiked ? "👍 Liked" : "☕ Cozy"}
                    </span>
                  )}
                </div>

                {/* Middle: Title & Tagline */}
                <div className="flex-1 mb-2.5">
                  <h3 className="font-display text-sm sm:text-base font-bold tracking-tight text-foreground line-clamp-1">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted/90 line-clamp-3 min-h-[46px]">
                    {item.tagline}
                  </p>
                </div>

                {/* Bottom 4-Way Affinity Reaction Dock */}
                <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-1">
                  {/* Love Button */}
                  <button
                    type="button"
                    onClick={() => handleReaction(item.id, "love")}
                    title="Love (❤️ 2.5x Weight)"
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                      isLoved
                        ? "bg-gold text-background shadow-md font-bold"
                        : "bg-background/40 hover:bg-gold/20 text-muted hover:text-gold border border-transparent hover:border-gold/40",
                    )}
                  >
                    <Heart
                      className={cn(
                        "size-3.5",
                        isLoved
                          ? "fill-background stroke-background"
                          : "fill-current",
                      )}
                    />
                    <span className="text-[10px] sm:inline">Love</span>
                  </button>

                  {/* Like Button */}
                  <button
                    type="button"
                    onClick={() => handleReaction(item.id, "like")}
                    title="Like (👍 1.0x Weight)"
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                      isLiked
                        ? "bg-amber-400 text-neutral-950 shadow-md font-bold"
                        : "bg-background/40 hover:bg-amber-400/20 text-muted hover:text-amber-300 border border-transparent hover:border-amber-400/40",
                    )}
                  >
                    <ThumbsUp className="size-3.5" />
                    <span className="text-[10px] sm:inline">Like</span>
                  </button>

                  {/* Comfy Button */}
                  <button
                    type="button"
                    onClick={() => handleReaction(item.id, "comfy")}
                    title="Comfy (☕ gentle and familiar)"
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                      isCozy
                        ? "bg-emerald-500 text-neutral-950 shadow-md font-bold"
                        : "bg-background/40 hover:bg-emerald-500/20 text-muted hover:text-emerald-300 border border-transparent hover:border-emerald-500/40",
                    )}
                  >
                    <Coffee className="size-3.5" />
                    <span className="text-[10px] sm:inline">Comfy</span>
                  </button>

                  {/* Dismiss Button */}
                  <button
                    type="button"
                    onClick={() => handleReaction(item.id, "dismiss")}
                    title="Dismiss (✕ Next Candidate)"
                    className="flex size-7 items-center justify-center rounded-lg text-muted/70 hover:text-foreground hover:bg-white/10 transition cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pinned Viewport Bottom Bar with Contained Boundaries */}
      <div className="fixed bottom-0 inset-x-0 z-50 border-t border-border/70 bg-background/95 backdrop-blur-xl shadow-2xl">
        <div className="mx-auto max-w-6xl w-full px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-gold font-bold text-sm sm:text-base">
              {totalCalibrated}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-foreground">
              Calibrated
            </span>
            {totalCalibrated > 0 && (
              <span className="hidden sm:inline text-muted text-xs truncate">
                ({lovedIds.length} Loved · {likedIds.length} Liked ·{" "}
                {cozyIds.length} Cozy)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onSkip && (
              <Button
                type="button"
                variant="ghost"
                onClick={onSkip}
                className="text-xs text-muted hover:text-foreground h-10 px-3 cursor-pointer"
              >
                Skip
              </Button>
            )}
            <Button
              type="button"
              onClick={handleFinish}
              className="h-10 sm:h-11 rounded-xl bg-gold px-4 sm:px-6 font-display text-xs sm:text-sm font-bold text-background hover:bg-gold-bright transition shadow-[0_0_20px_rgba(212,175,55,0.3)] cursor-pointer shrink-0"
            >
              <span>Finish Calibration</span>
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
