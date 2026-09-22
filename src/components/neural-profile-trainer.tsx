import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Flame,
  Coffee,
  Zap,
  Film,
  Check,
  ChevronRight,
  ArrowRight,
  Volume2,
  VolumeX,
  ShieldCheck,
  Sliders,
  QrCode,
  RotateCcw,
  User,
  Heart,
  Eye,
  Clock,
  Play,
  Share2,
  X,
  Trash2,
} from "lucide-react";
import {
  useReelStore,
  type TasteVibe,
  type HouseholdResident,
} from "@/lib/store";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { QrCodeSvg } from "@/components/ui/qr-code-svg";
import { Button } from "@/components/ui/button";

interface VibeChoice {
  id: TasteVibe;
  title: string;
  tag: string;
  desc: string;
  badge: string;
  gradient: string;
  accent: string;
}

const VIBE_OPTIONS: VibeChoice[] = [
  {
    id: "comfort",
    tag: "80s & 90s Nostalgia",
    title: "Vintage Synth & Warmth",
    desc: "Practical effects, iconic scores, and timeless adventure.",
    badge: "📼 Retro Gold",
    gradient:
      "from-amber-500/20 via-orange-500/10 to-transparent border-amber-500/40",
    accent: "text-amber-400",
  },
  {
    id: "hidden_gems",
    tag: "A24 & Midnight",
    title: "Esoteric Mind-Benders",
    desc: "Dark psychological mysteries, cerebral sci-fi, and sharp twists.",
    badge: "🌙 Midnight Cult",
    gradient:
      "from-purple-500/20 via-indigo-500/10 to-transparent border-purple-500/40",
    accent: "text-purple-400",
  },
  {
    id: "balanced",
    tag: "Golden Popcorn",
    title: "Crowd-Pleasing Blockbusters",
    desc: "Universal favorites, high production, and Friday night escapism.",
    badge: "🍿 Crowd Favorite",
    gradient: "from-gold/20 via-yellow-500/10 to-transparent border-gold/40",
    accent: "text-gold",
  },
  {
    id: "comfort",
    tag: "Gentle & Whimsical",
    title: "Cozy Storybook & Ghibli",
    desc: "Heartwarming stories, gentle pacing, and beautiful animation.",
    badge: "☕ Pure Cozy",
    gradient:
      "from-emerald-500/20 via-teal-500/10 to-transparent border-emerald-500/40",
    accent: "text-emerald-400",
  },
  {
    id: "bleeding_edge",
    tag: "4K Spectacle",
    title: "Bleeding-Edge Powerhouse",
    desc: "Uncompressed Dolby Vision, IMAX soundscapes, and technical mastery.",
    badge: "⚡ 4K Reference",
    gradient:
      "from-sky-500/20 via-blue-500/10 to-transparent border-sky-500/40",
    accent: "text-sky-400",
  },
];

export interface CalibrationItem {
  id: string;
  type: "title" | "actor" | "genre";
  title: string;
  subtitle: string;
  badge: string;
  year?: string;
  genre?: string;
  poster?: string;
  gradient?: string;
  accent?: string;
  traits: string[];
}

const ADULT_TITLE_POOL: CalibrationItem[] = [
  {
    id: "t_inc",
    type: "title",
    title: "Inception",
    subtitle: "Mind-Bending Sci-Fi",
    year: "2010",
    genre: "Mind-Bending Sci-Fi",
    badge: "🎬 Cinema Classic",
    poster: "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
    traits: ["mind_bender", "spectacle"],
  },
  {
    id: "t_tdk",
    type: "title",
    title: "The Dark Knight",
    subtitle: "Kinetic Action Thriller",
    year: "2008",
    genre: "Kinetic Action",
    badge: "🎬 Masterpiece",
    poster: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
    traits: ["adrenaline", "intensity"],
  },
  {
    id: "t_int",
    type: "title",
    title: "Interstellar",
    subtitle: "Cosmic Odyssey",
    year: "2014",
    genre: "Cosmic Odyssey",
    badge: "🌌 70mm Spectacle",
    poster: "https://image.tmdb.org/t/p/w500/gEU2QlsUUHXjNpeEYZnW0XNe2M3.jpg",
    traits: ["spectacle", "cerebral"],
  },
  {
    id: "t_mtx",
    type: "title",
    title: "The Matrix",
    subtitle: "Cyberpunk Action",
    year: "1999",
    genre: "Cyberpunk Action",
    badge: "⚡ Cyberpunk",
    poster: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    traits: ["cyberpunk", "adrenaline"],
  },
  {
    id: "t_dune2",
    type: "title",
    title: "Dune: Part Two",
    subtitle: "Epic Sci-Fi Spectacle",
    year: "2024",
    genre: "Sci-Fi Spectacle",
    badge: "⚡ 4K Reference",
    poster: "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    traits: ["spectacle", "adrenaline"],
  },
  {
    id: "t_br2049",
    type: "title",
    title: "Blade Runner 2049",
    subtitle: "Neo-Noir Mystery",
    year: "2017",
    genre: "Neo-Noir Sci-Fi",
    badge: "🌧️ Neo-Noir",
    poster: "https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg",
    traits: ["cyberpunk", "mind_bender"],
  },
  {
    id: "t_opp",
    type: "title",
    title: "Oppenheimer",
    subtitle: "Historical Drama",
    year: "2023",
    genre: "Historical Drama",
    badge: "🎬 70mm Epic",
    poster: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    traits: ["drama", "mind_bender"],
  },
  {
    id: "t_pulp",
    type: "title",
    title: "Pulp Fiction",
    subtitle: "Crime Classic",
    year: "1994",
    genre: "Crime Classic",
    badge: "📼 90s Gold",
    poster: "https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
    traits: ["dialogue", "90s_bias"],
  },
  {
    id: "t_fc",
    type: "title",
    title: "Fight Club",
    subtitle: "Psychological Thriller",
    year: "1999",
    genre: "Psychological Thriller",
    badge: "🌙 Midnight Cult",
    poster: "https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
    traits: ["mind_bender", "intensity"],
  },
  {
    id: "t_sev",
    type: "title",
    title: "Severance",
    subtitle: "Dystopian Workplace Mystery",
    year: "2022",
    genre: "Psychological Sci-Fi",
    badge: "🏢 Mind-Bender",
    poster: "https://image.tmdb.org/t/p/w500/hZ3T2c0XvKx8mI0h1qRkP7yD9L0.jpg",
    traits: ["mind_bender", "cerebral"],
  },
  {
    id: "t_bear",
    type: "title",
    title: "The Bear",
    subtitle: "High-Tension Kitchen Drama",
    year: "2022",
    genre: "Intense Drama",
    badge: "🔥 Pure Adrenaline",
    poster: "https://image.tmdb.org/t/p/w500/sHqbe6m4rIS5b2b2vPz259O1wQf.jpg",
    traits: ["intensity", "drama"],
  },
  {
    id: "t_shogun",
    type: "title",
    title: "Shōgun",
    subtitle: "Feudal Japan Dynasty",
    year: "2024",
    genre: "Historical Epic",
    badge: "⚔️ Feudal Epic",
    poster: "https://image.tmdb.org/t/p/w500/7O4iVfOMQmdCSxhOg1WNzG1AgYT.jpg",
    traits: ["intensity", "spectacle"],
  },
  {
    id: "t_fallout",
    type: "title",
    title: "Fallout",
    subtitle: "Post-Apocalyptic Retro-Futurism",
    year: "2024",
    genre: "Sci-Fi Adventure",
    badge: "☢️ Retro Sci-Fi",
    poster: "https://image.tmdb.org/t/p/w500/AnsZu445z2hR68b191v38M8j6f8.jpg",
    traits: ["80s_bias", "spectacle"],
  },
  {
    id: "t_arcane",
    type: "title",
    title: "Arcane",
    subtitle: "Steampunk Masterpiece",
    year: "2021",
    genre: "Animated Spectacle",
    badge: "⚡ Kinetic Art",
    poster: "https://image.tmdb.org/t/p/w500/fqldf2t8ztc9aiwn39679G0bZtq.jpg",
    traits: ["spectacle", "adrenaline"],
  },
  {
    id: "t_jp",
    type: "title",
    title: "Jurassic Park",
    subtitle: "Retro Adventure Classic",
    year: "1993",
    genre: "Adventure Classic",
    badge: "🌲 Retro Wonder",
    poster: "https://image.tmdb.org/t/p/w500/b1x09nyJwQDU7z44Pj5fqzE2w7R.jpg",
    traits: ["warmth", "adventure"],
  },
  {
    id: "t_alien",
    type: "title",
    title: "Alien",
    subtitle: "Claustrophobic Sci-Fi Horror",
    year: "1979",
    genre: "Sci-Fi Horror",
    badge: "📼 Retro Gold",
    poster: "https://image.tmdb.org/t/p/w500/vfrQk5IPloGg1v9Rzbh2Eg3VGyM.jpg",
    traits: ["80s_bias", "intensity"],
  },
  {
    id: "t_jw",
    type: "title",
    title: "John Wick",
    subtitle: "Neon Bullet Ballet",
    year: "2014",
    genre: "Kinetic Action",
    badge: "⚡ Adrenaline",
    poster: "https://image.tmdb.org/t/p/w500/fZPSMVXTptipclsvJu29nR06os3.jpg",
    traits: ["adrenaline", "cyberpunk"],
  },
];

const KIDS_TITLE_POOL: CalibrationItem[] = [
  {
    id: "k_ts",
    type: "title",
    title: "Toy Story",
    subtitle: "Animation Classic",
    year: "1995",
    genre: "Animation Classic",
    badge: "🧸 Pixar Gold",
    poster: "https://image.tmdb.org/t/p/w500/uXDfjJbdP4ijW5hWSBrPrlKpxab.jpg",
    traits: ["whimsical", "warmth"],
  },
  {
    id: "k_nemo",
    type: "title",
    title: "Finding Nemo",
    subtitle: "Underwater Adventure",
    year: "2003",
    genre: "Underwater Adventure",
    badge: "🌊 Pure Cozy",
    poster: "https://image.tmdb.org/t/p/w500/eHuGQ10FUzK1mdOY69wF5pGgEf5.jpg",
    traits: ["whimsical", "warmth"],
  },
  {
    id: "k_lk",
    type: "title",
    title: "The Lion King",
    subtitle: "Musical Masterpiece",
    year: "1994",
    genre: "Musical Animation",
    badge: "👑 Disney Classic",
    poster: "https://image.tmdb.org/t/p/w500/sKCr78MXSLixwmZ8DyJLrcsHXWA.jpg",
    traits: ["spectacle", "warmth"],
  },
  {
    id: "k_sp",
    type: "title",
    title: "Spirited Away",
    subtitle: "Studio Ghibli Magic",
    year: "2001",
    genre: "Studio Ghibli",
    badge: "☕ Pure Cozy",
    poster: "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRU84mY2wR7E5.jpg",
    traits: ["whimsical", "warmth"],
  },
  {
    id: "k_sv",
    type: "title",
    title: "Spider-Verse",
    subtitle: "Into the Spider-Verse",
    year: "2018",
    genre: "Kinetic Animation",
    badge: "⚡ Kinetic Art",
    poster: "https://image.tmdb.org/t/p/w500/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg",
    traits: ["spectacle", "adrenaline"],
  },
  {
    id: "k_fro",
    type: "title",
    title: "Frozen",
    subtitle: "Winter Adventure",
    year: "2013",
    genre: "Winter Magic",
    badge: "❄️ Musical Wonder",
    poster: "https://image.tmdb.org/t/p/w500/kgwjIb2RWgXXtlcbGbcKy80qXU0.jpg",
    traits: ["whimsical", "warmth"],
  },
  {
    id: "k_moana",
    type: "title",
    title: "Moana",
    subtitle: "Ocean Quest",
    year: "2016",
    genre: "Ocean Quest",
    badge: "🌺 Epic Journey",
    poster: "https://image.tmdb.org/t/p/w500/r2305Z3P3hX243uD1E2lY2R6kY5.jpg",
    traits: ["warmth", "adventure"],
  },
  {
    id: "k_walle",
    type: "title",
    title: "WALL-E",
    subtitle: "Cosmic Friendship",
    year: "2008",
    genre: "Cosmic Animation",
    badge: "🚀 Cozy Classic",
    poster: "https://image.tmdb.org/t/p/w500/hbhFnRzzg6ZDmm8YAmxBnQpQIPh.jpg",
    traits: ["whimsical", "warmth"],
  },
  {
    id: "k_pad2",
    type: "title",
    title: "Paddington 2",
    subtitle: "Pure Warmth & Whimsy",
    year: "2017",
    genre: "Heartwarming Family",
    badge: "☕ Pure Cozy",
    poster: "https://image.tmdb.org/t/p/w500/gRhz5p941v1p397Z0Jv1P5x0Yy5.jpg",
    traits: ["whimsical", "warmth"],
  },
];

const ACTOR_POOL: CalibrationItem[] = [
  {
    id: "a_keanu",
    type: "actor",
    title: "Keanu Reeves",
    subtitle: "The Matrix · John Wick · Constantine",
    badge: "🎭 Star Spotlight",
    poster: "https://image.tmdb.org/t/p/w500/4D0PpNI0kmP58hgrwGC3wC5x0Vy.jpg",
    traits: ["cyberpunk", "adrenaline"],
  },
  {
    id: "a_cillian",
    type: "actor",
    title: "Cillian Murphy",
    subtitle: "Oppenheimer · Peaky Blinders · 28 Days Later",
    badge: "🎭 Star Spotlight",
    poster: "https://image.tmdb.org/t/p/w500/360RFrK1jA65q19X9x57xXy1B6n.jpg",
    traits: ["drama", "mind_bender"],
  },
  {
    id: "a_zendaya",
    type: "actor",
    title: "Zendaya",
    subtitle: "Dune: Part Two · Euphoria · Challengers",
    badge: "🎭 Star Spotlight",
    poster: "https://image.tmdb.org/t/p/w500/r3A7ev8Q887A890MhN88i3rM9o8.jpg",
    traits: ["modern", "spectacle"],
  },
  {
    id: "a_nolan",
    type: "actor",
    title: "Christopher Nolan",
    subtitle: "Oppenheimer · Inception · Interstellar",
    badge: "🎬 Director Spotlight",
    poster: "https://image.tmdb.org/t/p/w500/xuAIuYSmsUzKlUMBFGVZaWsY3Z5.jpg",
    traits: ["mind_bender", "spectacle"],
  },
  {
    id: "a_denis",
    type: "actor",
    title: "Denis Villeneuve",
    subtitle: "Dune · Blade Runner 2049 · Arrival · Sicario",
    badge: "🎬 Director Spotlight",
    poster: "https://image.tmdb.org/t/p/w500/3b5Gz6M9n79o0m8k8y10f9b6a12.jpg",
    traits: ["atmospheric", "spectacle"],
  },
  {
    id: "a_miyazaki",
    type: "actor",
    title: "Hayao Miyazaki",
    subtitle: "Spirited Away · Mononoke · Totoro · Boy & Heron",
    badge: "🎬 Director Spotlight",
    poster: "https://image.tmdb.org/t/p/w500/ocmrV31U0m7G77n16e4m1f0Q21b.jpg",
    traits: ["whimsical", "warmth"],
  },
  {
    id: "a_pedro",
    type: "actor",
    title: "Pedro Pascal",
    subtitle: "The Last of Us · The Mandalorian · Narcos",
    badge: "🎭 Star Spotlight",
    poster: "https://image.tmdb.org/t/p/w500/9vyK7HH9z6f7qB1G9w7vX8q3n2a.jpg",
    traits: ["adventure", "intensity"],
  },
  {
    id: "a_florence",
    type: "actor",
    title: "Florence Pugh",
    subtitle: "Midsommar · Dune: Part Two · Oppenheimer",
    badge: "🎭 Star Spotlight",
    poster: "https://image.tmdb.org/t/p/w500/75lVqV87qB5n9q7Y9w0M1n9b5a1.jpg",
    traits: ["drama", "intensity"],
  },
  {
    id: "a_tom",
    type: "actor",
    title: "Tom Cruise",
    subtitle: "Top Gun: Maverick · Mission: Impossible",
    badge: "🎭 Star Spotlight",
    poster: "https://image.tmdb.org/t/p/w500/8qBwAQGO5yL548W8tDmp5qF1V4e.jpg",
    traits: ["spectacle", "adrenaline"],
  },
  {
    id: "a_leo",
    type: "actor",
    title: "Leonardo DiCaprio",
    subtitle: "Inception · Shutter Island · The Revenant",
    badge: "🎭 Star Spotlight",
    poster: "https://image.tmdb.org/t/p/w500/wo2hJpn04vbtmh0B9utCFdsQhxM.jpg",
    traits: ["mind_bender", "intensity"],
  },
  {
    id: "a_christian",
    type: "actor",
    title: "Christian Bale",
    subtitle: "The Dark Knight · The Prestige · American Psycho",
    badge: "🎭 Star Spotlight",
    poster: "https://image.tmdb.org/t/p/w500/b7fTC9WFuvq0TFflA7asDp768mr.jpg",
    traits: ["intensity", "mind_bender"],
  },
  {
    id: "a_harrison",
    type: "actor",
    title: "Harrison Ford",
    subtitle: "Blade Runner · Indiana Jones · Star Wars",
    badge: "🎭 Star Spotlight",
    poster: "https://image.tmdb.org/t/p/w500/5lyvE4k7qf8m1c4d9h6e1a0b3c.jpg",
    traits: ["80s_bias", "adventure"],
  },
];

const GENRE_POOL: CalibrationItem[] = [
  {
    id: "g_cyberpunk",
    type: "genre",
    title: "Cyberpunk & Synthwave",
    subtitle: "Neon Rain · Rain-Slicked Asphalt · Analog Modular Synths",
    badge: "🌆 Aesthetic Motif",
    gradient:
      "from-amber-500/40 via-purple-700/30 to-black/90 border-amber-500/60",
    traits: ["cyberpunk", "80s_bias"],
  },
  {
    id: "g_cosmic",
    type: "genre",
    title: "Cosmic Mind-Benders",
    subtitle:
      "Black Holes · Gravitational Time Dilation · Deep Existential Space",
    badge: "🌌 Aesthetic Motif",
    gradient:
      "from-blue-600/40 via-indigo-700/30 to-black/90 border-blue-500/60",
    traits: ["mind_bender", "spectacle"],
  },
  {
    id: "g_ghibli",
    type: "genre",
    title: "Cozy Studio Ghibli & Whimsy",
    subtitle: "Steaming Ramen · Watercolor Sunsets · Gentle Rolling Hills",
    badge: "☕ Cozy Motif",
    gradient:
      "from-emerald-500/40 via-teal-700/30 to-black/90 border-emerald-500/60",
    traits: ["whimsical", "warmth"],
  },
  {
    id: "g_action",
    type: "genre",
    title: "Kinetic High-Octane Action",
    subtitle:
      "Hand-to-Hand Stunt Choreography · Heavy Impact · Relentless Rhythm",
    badge: "⚡ Adrenaline Motif",
    gradient: "from-red-600/40 via-orange-700/30 to-black/90 border-red-500/60",
    traits: ["adrenaline", "intensity"],
  },
  {
    id: "g_noir",
    type: "genre",
    title: "True Crime & Neo-Noir",
    subtitle:
      "Dark Corners · Unreliable Narrators · Cigarette Smoke · Cold Motives",
    badge: "🔍 Noir Motif",
    gradient:
      "from-stone-700/40 via-neutral-800/30 to-black/90 border-amber-400/50",
    traits: ["mind_bender", "noir"],
  },
  {
    id: "g_retro",
    type: "genre",
    title: "Golden 80s & 90s Adventure",
    subtitle:
      "Practical Creature FX · Bicycle Quests · Amber Pine Forest Sunsets",
    badge: "📼 Retro Motif",
    gradient:
      "from-orange-500/40 via-amber-700/30 to-black/90 border-orange-500/60",
    traits: ["80s_bias", "warmth"],
  },
  {
    id: "g_a24",
    type: "genre",
    title: "A24 Midnight Dread",
    subtitle:
      "Slow-Burn Psychological Tension · Unsettling Surrealism · Cult Enigmas",
    badge: "🌙 Midnight Motif",
    gradient:
      "from-purple-700/40 via-fuchsia-800/30 to-black/90 border-purple-500/60",
    traits: ["mind_bender", "cerebral"],
  },
  {
    id: "g_feudal",
    type: "genre",
    title: "Feudal Honor & Samurai",
    subtitle: "Katana Duels · Sovereign Codes · Ancient Dynastic Warfare",
    badge: "⚔️ Feudal Motif",
    gradient:
      "from-rose-700/40 via-amber-800/30 to-black/90 border-rose-500/60",
    traits: ["intensity", "spectacle"],
  },
];

// Compatibility aliases
const ADULT_DECK = ADULT_TITLE_POOL;
const KIDS_DECK = KIDS_TITLE_POOL;

const VISUAL_FLASH_CARDS = [
  {
    id: "neon_rain",
    title: "Neon Rain & Amber Shadows",
    subtitle: "Blade Runner 2049 · Drive · The Batman",
    desc: "80s analog synthesizers, rain-slicked pavement, neo-noir mystery, gritty urban atmosphere.",
    vibe: "comfort" as TasteVibe,
    traits: ["80s_bias", "neo_noir", "ambient_synth"],
    badge: "🌧️ Neo-Noir",
    gradient:
      "from-amber-500/25 via-purple-500/15 to-transparent border-amber-500/50 hover:border-amber-400",
    accent: "text-amber-400",
    glow: "shadow-[0_0_25px_rgba(245,158,11,0.25)]",
  },
  {
    id: "spectacle_70mm",
    title: "Bleeding-Edge 70mm Spectacle",
    subtitle: "Dune: Part Two · Oppenheimer · Top Gun",
    desc: "IMAX 70mm contrast, visceral cockpit sound design, reference-grade uncompressed demo material.",
    vibe: "bleeding_edge" as TasteVibe,
    traits: ["spectacle", "adrenaline", "imax_70mm"],
    badge: "⚡ 4K Spectacle",
    gradient:
      "from-sky-500/25 via-blue-500/15 to-transparent border-sky-500/50 hover:border-sky-400",
    accent: "text-sky-400",
    glow: "shadow-[0_0_25px_rgba(14,165,233,0.25)]",
  },
  {
    id: "golden_nostalgia",
    title: "Golden 80s/90s Nostalgia",
    subtitle: "Jurassic Park · Stranger Things · Back to the Future",
    desc: "Warm film grain, practical creature effects, bicycle adventures under amber pine tree sunsets.",
    vibe: "comfort" as TasteVibe,
    traits: ["80s_bias", "warmth", "adventure"],
    badge: "🌲 Retro Wonder",
    gradient:
      "from-orange-500/25 via-amber-500/15 to-transparent border-orange-500/50 hover:border-orange-400",
    accent: "text-orange-400",
    glow: "shadow-[0_0_25px_rgba(249,115,22,0.25)]",
  },
  {
    id: "clinical_cold",
    title: "Clinical Cold & Mind-Benders",
    subtitle: "Severance · Ex Machina · Sicario · Arrival",
    desc: "Razor-sharp modernism, unsettling psychological tension, existential sci-fi puzzles.",
    vibe: "hidden_gems" as TasteVibe,
    traits: ["mind_bender", "cerebral", "existential"],
    badge: "🌙 A24 Midnight",
    gradient:
      "from-purple-500/25 via-indigo-500/15 to-transparent border-purple-500/50 hover:border-purple-400",
    accent: "text-purple-400",
    glow: "shadow-[0_0_25px_rgba(168,85,247,0.25)]",
  },
  {
    id: "ghibli_cozy",
    title: "Hand-Painted Whimsy & Cozy Storybook",
    subtitle: "Spirited Away · Paddington 2 · Fantastic Mr. Fox",
    desc: "Gentle steaming tea, soft water-color hills, soothing pacing that melts away a long day.",
    vibe: "comfort" as TasteVibe,
    traits: ["whimsical", "warmth", "gentle"],
    badge: "☕ Pure Cozy",
    gradient:
      "from-emerald-500/25 via-teal-500/15 to-transparent border-emerald-500/50 hover:border-emerald-400",
    accent: "text-emerald-400",
    glow: "shadow-[0_0_25px_rgba(16,185,129,0.25)]",
  },
  {
    id: "gateway_classics",
    title: "Haven't seen these? Start with All-Time Classics",
    subtitle: "The Matrix · Jurassic Park · The Dark Knight",
    desc: "New to movies? Start with timeless crowd-pleasers, universal favorites, and perfect Friday night escapism.",
    vibe: "balanced" as TasteVibe,
    traits: ["spectacle", "adrenaline", "warmth"],
    badge: "🍿 Gateway Classics",
    gradient:
      "from-gold/25 via-yellow-500/15 to-transparent border-gold/50 hover:border-yellow-400",
    accent: "text-gold",
    glow: "shadow-[0_0_25px_rgba(250,204,21,0.25)]",
  },
];

export function TasteProfileTrainer({
  onCompleteAll,
  className,
  isStandalone,
}: {
  onCompleteAll?: () => void;
  className?: string;
  isStandalone?: boolean;
}) {
  const residents = useReelStore((s) => s.residents);
  const activeResidentId = useReelStore((s) => s.activeResidentId);
  const patchResident = useReelStore((s) => s.patchResident);
  const addResident = useReelStore((s) => s.addResident);
  const removeResident = useReelStore((s) => s.removeResident);
  const setActiveResident = useReelStore((s) => s.setActiveResident);

  const [activeResIndex, setActiveResIndex] = useState(0);
  const currentResident = residents[activeResIndex] || residents[0];

  // Game Phase: "intro" | "visual_flash" | "vibe" | "showdown" | "audio" | "synthesizing" | "results"
  const [phase, setPhase] = useState<
    | "intro"
    | "visual_flash"
    | "vibe"
    | "showdown"
    | "audio"
    | "synthesizing"
    | "results"
  >("intro");

  // 45s countdown
  const [timeLeft, setTimeLeft] = useState(45);
  const [isRunning, setIsRunning] = useState(false);

  // Calibration state for current resident
  const [selectedVibe, setSelectedVibe] = useState<TasteVibe>("balanced");
  const [showdownIndex, setShowdownIndex] = useState(0);
  const [userPicks, setUserPicks] = useState<string[]>([]);
  const [nightModeAudio, setNightModeAudio] = useState(false);
  const [kidSafe, setKidSafe] = useState(Boolean(currentResident?.isKids));
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // New resident creation prompt
  const [isAddingFamily, setIsAddingFamily] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState("");

  // Timer loop
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => Math.max(0, prev - 1));
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      finishTraining();
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  const startVisualFlash = () => {
    setIsRunning(false);
    setPhase("visual_flash");
  };

  const handleVisualFlashPick = (choice: (typeof VISUAL_FLASH_CARDS)[0]) => {
    setSelectedVibe(choice.vibe);
    setUserPicks(choice.traits);
    setIsRunning(false);
    setPhase("synthesizing");

    setTimeout(() => {
      const curationWeights: Record<string, number> = {
        "80s_bias": choice.traits.includes("80s_bias") ? 0.95 : 0.2,
        mind_bender: choice.traits.includes("mind_bender") ? 0.95 : 0.2,
        adrenaline: choice.traits.includes("adrenaline") ? 0.95 : 0.2,
        whimsical:
          choice.traits.includes("whimsical") ||
          choice.traits.includes("warmth")
            ? 0.95
            : 0.2,
        spectacle: choice.traits.includes("spectacle") ? 0.95 : 0.2,
      };

      const patchData = {
        tasteVibe: choice.vibe,
        curationWeights,
        isKids: kidSafe,
        hideKidsContent: !kidSafe,
        themeDesign:
          choice.vibe === "bleeding_edge"
            ? "futuristic_hud"
            : choice.vibe === "comfort"
              ? "warm_velvet"
              : "oled_cinema",
      };

      patchResident(currentResident.id, patchData as any);

      fetch("/api/curator/taste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ residentId: currentResident.id, ...patchData }),
      }).catch(() => {});

      setPhase("results");
      showToast(
        `⚡ Tuned in 5 seconds for ${currentResident.name}!`,
        "success",
      );
    }, 400);
  };

  const startTraining = () => {
    setTimeLeft(60);
    setIsRunning(false);
    setPhase("showdown");
    setUserPicks([]);
  };

  const handleVibePick = (vibe: TasteVibe) => {
    setSelectedVibe(vibe);
    setPhase("showdown");
  };

  const handleShowdownChoice = (bias: string) => {
    const updated = [...userPicks, bias];
    setUserPicks(updated);
    if (
      showdownIndex + 1 <
      (currentResident?.isKids ? KIDS_DECK.length : ADULT_DECK.length)
    ) {
      setShowdownIndex((prev) => prev + 1);
    } else {
      setPhase("audio");
    }
  };

  const finishTraining = () => {
    setIsRunning(false);
    setPhase("synthesizing");

    // Combine the profile's explicit preference signals.
    setTimeout(() => {
      const curationWeights: Record<string, number> = {
        "80s_bias": selectedVibe === "comfort" ? 0.9 : 0.2,
        mind_bender:
          userPicks.includes("cerebral") || userPicks.includes("psychological")
            ? 0.95
            : 0.3,
        adrenaline:
          userPicks.includes("adrenaline") || userPicks.includes("raw_energy")
            ? 0.9
            : 0.2,
        whimsical: userPicks.includes("warmth") ? 0.85 : 0.2,
        spectacle: selectedVibe === "bleeding_edge" ? 0.95 : 0.4,
      };

      const patchData = {
        tasteVibe: selectedVibe,
        curationWeights,
        isKids: kidSafe,
        hideKidsContent: !kidSafe,
        themeDesign:
          selectedVibe === "bleeding_edge"
            ? "futuristic_hud"
            : selectedVibe === "comfort"
              ? "warm_velvet"
              : "oled_cinema",
      };

      patchResident(currentResident.id, patchData as any);

      fetch("/api/curator/taste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ residentId: currentResident.id, ...patchData }),
      }).catch(() => {});

      setPhase("results");
      showToast(`Cinema shelf tuned for ${currentResident.name}!`, "success");
    }, 2200);
  };

  const nextResident = () => {
    if (activeResIndex + 1 < residents.length) {
      setActiveResIndex(activeResIndex + 1);
      setActiveResident(residents[activeResIndex + 1].id);
      setPhase("intro");
      setTimeLeft(45);
    } else {
      if (onCompleteAll) onCompleteAll();
    }
  };

  const handleCreateFamilyMember = () => {
    if (!newFamilyName.trim()) return;
    addResident(newFamilyName.trim(), "sparkles");
    setNewFamilyName("");
    setIsAddingFamily(false);
    setActiveResIndex(residents.length); // switch to newly created
    setPhase("intro");
    setTimeLeft(45);
    showToast(`Added ${newFamilyName.trim()} to household!`, "success");
  };

  const handleDeleteResident = (
    e: React.MouseEvent,
    id: string,
    name: string,
  ) => {
    e.stopPropagation();
    if (residents.length <= 1) {
      showToast("Household must have at least one profile.", "error");
      return;
    }
    removeResident(id);
    setActiveResIndex(0);
    const remaining = residents.filter((r) => r.id !== id);
    if (remaining.length > 0) {
      setActiveResident(remaining[0].id);
    }
    setPhase("intro");
    setIsRunning(false);
    setTimeLeft(45);
    showToast(`Removed profile: ${name}`, "info");
  };

  const boxIpv4 = useReelStore((s) => s.ipv4);
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "localhost";
  const port =
    typeof window !== "undefined" && window.location.port
      ? `:${window.location.port}`
      : ":8080";
  const isLocalOrMdns =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local");
  const effectiveHost =
    isLocalOrMdns && boxIpv4
      ? boxIpv4
      : hostname === "localhost"
        ? "192.168.1.214"
        : hostname;
  const shareUrl = `http://${effectiveHost}${port}/calibrate?resident=${currentResident?.id}`;

  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-4xl rounded-3xl border border-border/80 bg-card/60 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl space-y-6",
        className,
      )}
    >
      {/* Top HUD: Household Profile Switcher + 45s Clock */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-gold">
            <Sparkles className="size-4" />
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.2em]">
              45-Second Taste Match
            </span>
          </div>
          <h3 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Onboard Household: {currentResident?.name}
          </h3>
        </div>

        {/* 45-Second Countdown HUD */}
        {isRunning && (
          <div className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-2 shadow-inner">
            <Clock className="size-4 text-gold animate-pulse" />
            <div className="space-y-0.5">
              <div className="flex items-center justify-between gap-4 text-[10px] font-bold uppercase tracking-wider text-gold">
                <span>Match Timer</span>
                <span>{timeLeft}s</span>
              </div>
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-card">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-gold transition-all duration-1000 ease-linear"
                  style={{ width: `${(timeLeft / 45) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Resident Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {residents.map((r, i) => (
            <div
              key={r.id}
              onClick={() => {
                setActiveResIndex(i);
                setActiveResident(r.id);
                setPhase("intro");
                setIsRunning(false);
                setTimeLeft(45);
              }}
              className={cn(
                "group flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                activeResIndex === i
                  ? "border-gold bg-gold/15 text-gold shadow-sm"
                  : "border-border/60 bg-card/40 text-muted hover:text-foreground hover:bg-card",
              )}
            >
              <User className="size-3.5" />
              <span>{r.name}</span>
              {residents.length > 1 && (
                <button
                  type="button"
                  title={`Delete ${r.name}`}
                  onClick={(e) => handleDeleteResident(e, r.id, r.name)}
                  className="ml-1 rounded-full p-0.5 text-muted hover:bg-red-500/20 hover:text-red-400 transition-colors"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          ))}

          <button
            onClick={() => setIsAddingFamily(true)}
            className="flex items-center gap-1 rounded-xl border border-dashed border-border/80 px-2.5 py-1.5 text-xs font-medium text-muted hover:border-gold/60 hover:text-gold transition-all cursor-pointer"
          >
            + Add Family
          </button>
        </div>
      </div>

      {/* Add Family Member Inline Prompt */}
      {isAddingFamily && (
        <div className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/5 p-4 animate-in fade-in">
          <input
            type="text"
            placeholder="Family member name (e.g. Sarah, Dad, Kids)..."
            value={newFamilyName}
            onChange={(e) => setNewFamilyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateFamilyMember()}
            className="h-10 flex-1 rounded-xl border border-border bg-card px-4 text-xs text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
            autoFocus
          />
          <Button size="sm" variant="gold" onClick={handleCreateFamilyMember}>
            Add & Match
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsAddingFamily(false)}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* PHASE 1: INTRO SCREEN */}
      {phase === "intro" && (
        <div className="py-6 text-center space-y-6 max-w-xl mx-auto">
          <div className="mx-auto flex size-16 items-center justify-center rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/20 to-gold/5 shadow-[var(--shadow-gold)]">
            <Sparkles className="size-8 text-gold" />
          </div>

          <div className="space-y-2">
            <h4 className="font-display text-2xl font-extrabold text-foreground">
              45-Second Taste Match for {currentResident?.name}
            </h4>
            <p className="text-xs text-muted leading-relaxed">
              No boring forms or setup checklists. Tap through 3 rapid-fire
              cinematic choices to tailor {currentResident?.name}&apos;s
              personal cinema shelf.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              size="lg"
              variant="gold"
              onClick={startVisualFlash}
              className="rounded-2xl px-8 py-6 font-display text-sm font-bold shadow-lg bg-gradient-to-r from-amber-400 via-gold to-yellow-500 hover:brightness-110 cursor-pointer"
            >
              <Zap className="size-4 mr-2" />⚡ 5-Second Visual Flash (1-Tap)
            </Button>

            <Button
              size="lg"
              variant="ghost"
              onClick={startTraining}
              className="rounded-2xl px-6 py-6 text-xs text-muted hover:text-foreground border-border/80 cursor-pointer"
            >
              <Flame className="size-4 mr-2 text-orange-400" />
              Endless Taste Match Game
            </Button>

            <Button
              size="lg"
              variant="ghost"
              onClick={() => setQrModalOpen(true)}
              className="rounded-2xl px-5 py-6 text-xs text-muted hover:text-foreground cursor-pointer"
            >
              <QrCode className="size-4 mr-2 text-gold" />
              Match on Their Phone
            </Button>

            {residents.length > 1 && (
              <div className="w-full pt-3">
                <button
                  type="button"
                  onClick={(e) =>
                    handleDeleteResident(
                      e,
                      currentResident.id,
                      currentResident.name,
                    )
                  }
                  className="inline-flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 hover:underline cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                  <span>
                    Delete &quot;{currentResident?.name}&quot; profile
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PHASE 1.5: 5-SECOND VISUAL FLASH (1-TAP INSTANT CALIBRATION) */}
      {phase === "visual_flash" && (
        <div className="space-y-5 py-2 animate-in fade-in select-none">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gold flex items-center gap-1">
                <Zap className="size-3 text-gold" /> 5-Second Visual Flash
              </span>
              <h4 className="font-display text-xl font-black text-foreground">
                Tap the Frame That Calls to You
              </h4>
              <p className="text-xs text-muted mt-0.5">
                This choice adds a small preference signal for {currentResident?.name}&apos;s
                artwork, color tone, and sound-design recommendations.
              </p>
            </div>
            <button
              onClick={() => setPhase("intro")}
              className="text-xs text-muted hover:text-foreground underline cursor-pointer"
            >
              Back
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
            {VISUAL_FLASH_CARDS.map((card) => (
              <div
                key={card.id}
                onClick={() => handleVisualFlashPick(card)}
                className={cn(
                  "group relative flex flex-col justify-between rounded-3xl border p-5 transition-all duration-300 hover:scale-[1.02] cursor-pointer bg-card/70 backdrop-blur-md",
                  card.gradient,
                  card.glow,
                )}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "text-[10px] font-black uppercase tracking-wider",
                        card.accent,
                      )}
                    >
                      {card.badge}
                    </span>
                    <span className="text-[10px] rounded-full bg-card/90 px-2 py-0.5 border border-border/50 text-gold font-bold">
                      1-Tap Tune
                    </span>
                  </div>
                  <h5 className="font-display text-base font-bold text-foreground group-hover:text-gold transition-colors">
                    {card.title}
                  </h5>
                  <p className="text-[11px] font-medium text-muted/90 italic">
                    {card.subtitle}
                  </p>
                  <p className="text-xs text-muted leading-relaxed line-clamp-2">
                    {card.desc}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="text-[10px] uppercase tracking-wider text-muted group-hover:text-foreground">
                    Instant Cinema Profile
                  </span>
                  <div className="flex items-center text-xs font-bold text-gold group-hover:translate-x-1 transition-transform">
                    Select <ChevronRight className="size-3.5 ml-0.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center pt-2">
            <button
              onClick={startTraining}
              className="text-xs text-muted hover:text-gold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Flame className="size-3.5 text-orange-400" />
              Prefer to swipe movies? Switch to 45-Second Tinder Match Deck
            </button>
          </div>
        </div>
      )}

      {/* PHASE 2: CORE VIBE SELECTION */}
      {phase === "vibe" && (
        <div className="space-y-4 py-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gold">
                Step 1 of 3
              </span>
              <h4 className="font-display text-lg font-bold text-foreground">
                Pick Your Dominant Cinema Vibe
              </h4>
            </div>
            <span className="text-xs text-muted">Tap 1 to proceed</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {VIBE_OPTIONS.map((c) => (
              <button
                key={c.title}
                onClick={() => handleVibePick(c.id)}
                className={cn(
                  "group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 hover:scale-[1.02] cursor-pointer",
                  c.gradient,
                )}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        c.accent,
                      )}
                    >
                      {c.tag}
                    </span>
                    <span className="text-[10px] rounded-full bg-card/60 px-2 py-0.5 border border-border/50 text-muted">
                      {c.badge}
                    </span>
                  </div>
                  <p className="font-display text-sm font-bold text-foreground group-hover:text-gold transition-colors">
                    {c.title}
                  </p>
                  <p className="text-[11px] text-muted leading-relaxed line-clamp-2">
                    {c.desc}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-end text-[11px] font-semibold text-gold">
                  Select <ChevronRight className="size-3 ml-0.5" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PHASE 3: TINDER SWIPE DECK */}
      {phase === "showdown" && (
        <TinderSwiper
          deck={currentResident?.isKids ? KIDS_DECK : ADULT_DECK}
          isKids={Boolean(currentResident?.isKids)}
          residentName={currentResident?.name || "Family"}
          timeLeft={timeLeft}
          onComplete={(picks) => {
            setUserPicks(picks);
            finishTraining();
          }}
        />
      )}

      {/* PHASE 4: ACOUSTIC & SANDBOX TUNING */}
      {phase === "audio" && (
        <div className="space-y-5 py-2 animate-in fade-in">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gold">
              Final Step
            </span>
            <h4 className="font-display text-lg font-bold text-foreground">
              Acoustic Profile & Family Sandbox
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Audio Profile */}
            <div
              onClick={() => setNightModeAudio(!nightModeAudio)}
              className={cn(
                "cursor-pointer rounded-2xl border p-4 transition-all duration-200 space-y-2",
                nightModeAudio
                  ? "border-gold bg-gold/10"
                  : "border-border/80 bg-card/50",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                  <Volume2 className="size-4 text-gold" />
                  Night Owl Whisper Mode
                </div>
                {nightModeAudio && <Check className="size-4 text-gold" />}
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Boosts whispered dialogue by +6dB and compresses explosive
                gunshots for bedroom / late-night watching.
              </p>
            </div>

            {/* Kid-Safe Sandbox */}
            <div
              onClick={() => setKidSafe(!kidSafe)}
              className={cn(
                "cursor-pointer rounded-2xl border p-4 transition-all duration-200 space-y-2",
                kidSafe
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-border/80 bg-card/50",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                  <ShieldCheck className="size-4 text-emerald-400" />
                  Kid-Safe Sandbox
                </div>
                {kidSafe && <Check className="size-4 text-emerald-400" />}
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Filters adult content, prioritizing animated adventures and
                family classics for this profile.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              size="lg"
              variant="gold"
              onClick={finishTraining}
              className="rounded-2xl px-8 py-5"
            >
              Tune Cinema Shelf
              <Sparkles className="size-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* PHASE 5: SYNTHESIZING ANIMATION */}
      {phase === "synthesizing" && (
        <div className="py-12 text-center space-y-4">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full border border-gold/40 bg-gold/10 animate-pulse shadow-[var(--shadow-gold)]">
            <Zap className="size-10 text-gold animate-bounce" />
          </div>
          <div className="space-y-1">
            <h4 className="font-display text-xl font-extrabold text-foreground">
              Curating Cinema Shelf for {currentResident?.name}...
            </h4>
            <p className="text-xs text-muted">
              Crafting personal recommendations, picture atmosphere, and night
              audio.
            </p>
          </div>
        </div>
      )}

      {/* PHASE 6: RESULTS & NEXT FAMILY MEMBER */}
      {phase === "results" && (
        <div className="py-6 text-center space-y-6 max-w-lg mx-auto animate-in zoom-in-95">
          <div className="mx-auto flex size-16 items-center justify-center rounded-3xl border border-emerald-500/40 bg-emerald-500/15 shadow-xl">
            <Check className="size-8 text-emerald-400" />
          </div>

          <div className="space-y-2">
            <span className="rounded-full bg-gold/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gold">
              Matched in {45 - timeLeft} Seconds
            </span>
            <h4 className="font-display text-2xl font-black text-foreground">
              {currentResident?.name}&apos;s Shelf is Ready!
            </h4>
            <p className="text-xs text-muted leading-relaxed">
              Home shelf curation, picture tone, and acoustic preferences are
              tailored to {currentResident?.name}.
            </p>
          </div>

          {/* Calibrated Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <span className="rounded-full border border-white/10 bg-card px-3 py-1 text-[11px] font-semibold text-foreground">
              Vibe: {selectedVibe.toUpperCase()}
            </span>
            {userPicks.map((p) => (
              <span
                key={p}
                className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-bold text-gold"
              >
                {p}
              </span>
            ))}
            {nightModeAudio && (
              <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-[11px] font-bold text-sky-400">
                Night Mode Audio
              </span>
            )}
          </div>

          {/* Action to proceed to next family member or finish */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-border/50">
            {activeResIndex + 1 < residents.length ? (
              <Button
                size="lg"
                variant="gold"
                onClick={nextResident}
                className="rounded-2xl px-6 py-5 font-display text-xs font-bold"
              >
                Match Next: {residents[activeResIndex + 1]?.name} (45s)
                <ArrowRight className="size-4 ml-2" />
              </Button>
            ) : (
              <Button
                size="lg"
                variant="gold"
                onClick={onCompleteAll}
                className="rounded-2xl px-8 py-5 font-display text-xs font-bold"
              >
                All Profiles Matched! Start Movie Night
                <Sparkles className="size-4 ml-2" />
              </Button>
            )}

            <Button
              size="lg"
              variant="ghost"
              onClick={() => setIsAddingFamily(true)}
              className="rounded-2xl px-4 py-5 text-xs text-muted hover:text-foreground"
            >
              + Add Another Family Member
            </Button>
          </div>
        </div>
      )}

      {/* QR MODAL: Train on Their Phone */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-gold/15 text-gold">
              <QrCode className="size-6" />
            </div>
            <h5 className="font-display text-lg font-bold text-foreground">
              Match on {currentResident?.name}&apos;s Phone
            </h5>
            <p className="text-xs text-muted">
              Have {currentResident?.name} scan this code with their smartphone
              camera to run the 45-second game directly on their screen.
            </p>
            <div className="mx-auto size-48 rounded-2xl bg-white p-3 shadow-inner flex items-center justify-center">
              <QrCodeSvg value={shareUrl} size={170} />
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setQrModalOpen(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function buildInitialDeck(
  isKids: boolean,
  shownSet: Set<string>,
): CalibrationItem[] {
  const titles = isKids ? KIDS_TITLE_POOL : ADULT_TITLE_POOL;
  const actors = ACTOR_POOL;
  const genres = GENRE_POOL;

  const deck: CalibrationItem[] = [];
  let tIdx = 0,
    aIdx = 0,
    gIdx = 0;

  while (
    deck.length < 12 &&
    (tIdx < titles.length || aIdx < actors.length || gIdx < genres.length)
  ) {
    if (tIdx < titles.length) {
      const item = titles[tIdx++];
      if (!shownSet.has(item.id)) {
        shownSet.add(item.id);
        deck.push(item);
      }
    }
    if (aIdx < actors.length) {
      const item = actors[aIdx++];
      if (!shownSet.has(item.id)) {
        shownSet.add(item.id);
        deck.push(item);
      }
    }
    if (tIdx < titles.length) {
      const item = titles[tIdx++];
      if (!shownSet.has(item.id)) {
        shownSet.add(item.id);
        deck.push(item);
      }
    }
    if (gIdx < genres.length) {
      const item = genres[gIdx++];
      if (!shownSet.has(item.id)) {
        shownSet.add(item.id);
        deck.push(item);
      }
    }
  }
  return deck;
}

function getRefillCards(
  isKids: boolean,
  shownSet: Set<string>,
): CalibrationItem[] {
  const titles = isKids ? KIDS_TITLE_POOL : ADULT_TITLE_POOL;
  const actors = ACTOR_POOL;
  const genres = GENRE_POOL;

  const refills: CalibrationItem[] = [];

  // Find unshown titles
  for (const t of titles) {
    if (!shownSet.has(t.id)) {
      shownSet.add(t.id);
      refills.push(t);
      if (refills.length >= 3) break;
    }
  }
  // Find unshown actors
  for (const a of actors) {
    if (!shownSet.has(a.id)) {
      shownSet.add(a.id);
      refills.push(a);
      if (refills.length >= 5) break;
    }
  }
  // Find unshown genres
  for (const g of genres) {
    if (!shownSet.has(g.id)) {
      shownSet.add(g.id);
      refills.push(g);
      if (refills.length >= 7) break;
    }
  }

  // If everything has been shown once, reset shown set and cycle infinitely
  if (refills.length === 0) {
    shownSet.clear();
    const all = [...titles, ...actors, ...genres].sort(
      () => Math.random() - 0.5,
    );
    for (const item of all.slice(0, 8)) {
      shownSet.add(item.id);
      refills.push(item);
    }
    return refills;
  }

  return refills;
}

function TinderSwiper({
  isKids,
  residentName,
  timeLeft,
  onComplete,
}: {
  deck?: any;
  isKids?: boolean;
  residentName: string;
  timeLeft: number;
  onComplete: (picks: string[]) => void;
}) {
  const shownIdsRef = useRef<Set<string>>(new Set());
  const isSwipingRef = useRef<boolean>(false);
  const [deckQueue, setDeckQueue] = useState<CalibrationItem[]>(() => {
    const set = new Set<string>();
    shownIdsRef.current = set;
    return buildInitialDeck(Boolean(isKids), set);
  });

  const [picks, setPicks] = useState<string[]>([]);
  const [learnedCount, setLearnedCount] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [focusedBtn, setFocusedBtn] = useState<0 | 1 | 2>(2);
  const [swipeBadge, setSwipeBadge] = useState<
    "love" | "pass" | "comfort" | null
  >(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    dragging: boolean;
  }>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    dragging: false,
  });

  const currentCard = deckQueue[0];

  // Preload next upcoming card posters
  useEffect(() => {
    for (let i = 1; i <= Math.min(3, deckQueue.length - 1); i++) {
      if (deckQueue[i]?.poster) {
        const pre = new Image();
        pre.src = deckQueue[i].poster!;
      }
    }
  }, [deckQueue]);

  // Reset card physics and errors on advance
  useEffect(() => {
    setImgError(false);
    setSwipeBadge(null);
    isSwipingRef.current = false;
    if (cardRef.current) {
      cardRef.current.style.transform =
        "translate3d(0px, 0px, 0px) rotate(0deg)";
      cardRef.current.style.opacity = "1";
      cardRef.current.style.filter = "none";
      cardRef.current.style.transition =
        "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)";
    }
  }, [currentCard?.id]);

  const handleSwipe = (action: "love" | "pass" | "comfort") => {
    if (isSwipingRef.current || !currentCard) return;
    isSwipingRef.current = true;
    setSwipeBadge(action);

    // Immediate fluid physical disappearance
    if (cardRef.current) {
      if (action === "pass") {
        // Disappear unloved titles immediately with high-speed left exit and blur
        cardRef.current.style.transition =
          "transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.22s ease, filter 0.22s ease";
        cardRef.current.style.transform =
          "translate3d(-600px, 30px, 0px) rotate(-28deg)";
        cardRef.current.style.opacity = "0";
        cardRef.current.style.filter = "blur(6px)";
      } else if (action === "love") {
        cardRef.current.style.transition =
          "transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.25s ease";
        cardRef.current.style.transform =
          "translate3d(600px, 30px, 0px) rotate(28deg)";
        cardRef.current.style.opacity = "0";
      } else if (action === "comfort") {
        cardRef.current.style.transition =
          "transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.25s ease";
        cardRef.current.style.transform =
          "translate3d(0px, -500px, 0px) scale(0.85)";
        cardRef.current.style.opacity = "0";
      }
    }

    if (currentCard) {
      const rating =
        action === "love" ? "love" : action === "comfort" ? "cozy" : "pass";
      fetch("/api/curator/teach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentCard.id,
          title: currentCard.title,
          rating,
          type: currentCard.type,
        }),
      }).catch(() => {});
    }

    setTimeout(() => {
      let updatedPicks = picks;
      if (action !== "pass" && currentCard) {
        updatedPicks = [...picks, ...currentCard.traits];
        setPicks(updatedPicks);
        setLearnedCount((prev) => prev + 1);
      }

      // Drop the swiped card from queue and refill dynamically
      setDeckQueue((prev) => {
        const nextDeck = prev.slice(1);
        if (nextDeck.length < 5) {
          const refills = getRefillCards(Boolean(isKids), shownIdsRef.current);
          return [...nextDeck, ...refills];
        }
        return nextDeck;
      });
      isSwipingRef.current = false;
    }, 200);
  };

  // TV Remote D-Pad and Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "1") {
        e.preventDefault();
        setFocusedBtn(0);
        handleSwipe("pass");
      } else if (e.key === "ArrowDown" || e.key === "2") {
        e.preventDefault();
        setFocusedBtn(1);
        handleSwipe("comfort");
      } else if (e.key === "ArrowRight" || e.key === "3") {
        e.preventDefault();
        setFocusedBtn(2);
        handleSwipe("love");
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (focusedBtn === 0) handleSwipe("pass");
        else if (focusedBtn === 1) handleSwipe("comfort");
        else if (focusedBtn === 2) handleSwipe("love");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentCard, focusedBtn, picks]);

  // 120Hz GPU-accelerated Pointer Drag
  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      currentX: 0,
      currentY: 0,
      dragging: true,
    };
    if (cardRef.current) {
      cardRef.current.style.transition = "none";
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.dragging || !cardRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    dragRef.current.currentX = dx;
    dragRef.current.currentY = dy;
    const rotate = dx * 0.05;
    cardRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0px) rotate(${rotate}deg)`;

    if (dx > 55) setSwipeBadge("love");
    else if (dx < -55) setSwipeBadge("pass");
    else if (dy < -55) setSwipeBadge("comfort");
    else setSwipeBadge(null);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const { currentX, currentY } = dragRef.current;
    const threshold = 75;
    if (currentX > threshold) {
      handleSwipe("love");
    } else if (currentX < -threshold) {
      handleSwipe("pass");
    } else if (currentY < -threshold) {
      handleSwipe("comfort");
    } else {
      setSwipeBadge(null);
      if (cardRef.current) {
        cardRef.current.style.transition =
          "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)";
        cardRef.current.style.transform =
          "translate3d(0px, 0px, 0px) rotate(0deg)";
      }
    }
  };

  if (!currentCard) return null;

  return (
    <div className="space-y-5 py-2 animate-in fade-in select-none">
      {/* HUD Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gold">
              Endless Taste Discovery · Continuous Deck
            </span>
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[9px] font-bold uppercase text-gold">
              {currentCard.type === "title"
                ? "🎬 Cinema Title"
                : currentCard.type === "actor"
                  ? "🎭 Star Spotlight"
                  : "🌌 Aesthetic Motif"}
            </span>
          </div>
          <h4 className="font-display text-lg font-bold text-foreground">
            Taste Match for {residentName}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs text-muted font-mono">
            {learnedCount} signals calibrated
          </span>
        </div>
      </div>

      {/* The Central Swipe Card Container */}
      <div className="flex flex-col items-center justify-center">
        <div className="relative w-72 h-[26rem] mx-auto perspective-1000">
          <div
            ref={cardRef}
            className={cn(
              "absolute inset-0 rounded-3xl overflow-hidden shadow-2xl touch-none border border-border/50 bg-card will-change-transform transform-gpu flex flex-col justify-between",
              currentCard.gradient,
            )}
            style={{
              transform: "translate3d(0px, 0px, 0px) rotate(0deg)",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* Visual Media Layer */}
            {currentCard.type === "genre" ? (
              <div className="size-full flex flex-col justify-between p-7 bg-gradient-to-br from-card/90 via-card/70 to-black/90">
                <div className="space-y-2">
                  <span className="rounded-full bg-gold/25 px-3 py-1 text-[10px] font-bold text-gold uppercase tracking-wider">
                    {currentCard.badge}
                  </span>
                  <h5 className="font-display text-2xl font-black text-foreground pt-3 leading-tight">
                    {currentCard.title}
                  </h5>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {currentCard.subtitle}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm text-[11px] text-muted-foreground space-y-1">
                  <div className="font-semibold text-foreground">
                    Aesthetic Traits:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentCard.traits.map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] text-gold font-mono"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : imgError || !currentCard.poster ? (
              <div className="size-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-card-2 via-card to-background text-center">
                <Film className="size-12 text-gold/40 mb-3" />
                <span className="rounded-full bg-gold/30 px-2.5 py-0.5 text-[10px] font-bold text-gold uppercase shadow-sm mb-2">
                  {currentCard.badge}
                </span>
                <h5 className="font-display text-2xl font-bold text-foreground drop-shadow-md">
                  {currentCard.title}
                </h5>
                <p className="text-xs text-muted mt-1">
                  {currentCard.subtitle}
                </p>
              </div>
            ) : (
              <div className="relative size-full">
                <img
                  src={currentCard.poster}
                  alt={currentCard.title}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover pointer-events-none"
                  draggable={false}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-5 pt-16 pointer-events-none space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-gold/30 px-2.5 py-0.5 text-[10px] font-bold text-gold uppercase shadow-sm">
                      {currentCard.badge}
                    </span>
                    {currentCard.year && (
                      <span className="text-[11px] font-medium text-white/70">
                        {currentCard.year}
                      </span>
                    )}
                  </div>
                  <h5 className="font-display text-2xl font-black text-white drop-shadow-md">
                    {currentCard.title}
                  </h5>
                  <p className="text-xs font-medium text-white/80 line-clamp-1">
                    {currentCard.subtitle}
                  </p>
                </div>
              </div>
            )}

            {/* In-Flight Reaction Stamps */}
            {swipeBadge === "love" && (
              <div className="absolute top-4 left-4 border-4 border-green-500 text-green-400 font-black text-xl px-3 py-1 rounded-2xl shadow-2xl transform -rotate-12 bg-black/80 backdrop-blur-md">
                ❤️ LOVE THIS
              </div>
            )}
            {swipeBadge === "pass" && (
              <div className="absolute top-4 right-4 border-4 border-red-500 text-red-400 font-black text-xl px-3 py-1 rounded-2xl shadow-2xl transform rotate-12 bg-black/80 backdrop-blur-md">
                ✕ PASS / DON&apos;T CARE
              </div>
            )}
            {swipeBadge === "comfort" && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-gold text-gold font-black text-xl px-4 py-1.5 rounded-2xl shadow-2xl bg-black/85 backdrop-blur-md text-center whitespace-nowrap">
                ☕ COZY VIBE
              </div>
            )}
          </div>
        </div>

        {/* 10-Foot TV & Rapid Click Action Controls */}
        <div className="flex items-center justify-center gap-6 mt-7">
          <button
            type="button"
            onClick={() => handleSwipe("pass")}
            title="Pass / Disappear Title"
            className={cn(
              "flex items-center justify-center size-14 rounded-full border border-red-500/50 bg-card text-red-500 shadow-lg transition-all cursor-pointer hover:scale-110",
              focusedBtn === 0 &&
                "ring-4 ring-red-500/50 scale-125 bg-red-500/15 shadow-red-500/20 shadow-2xl",
            )}
          >
            <X className="size-6 stroke-[3]" />
          </button>
          <button
            type="button"
            onClick={() => handleSwipe("comfort")}
            title="Cozy Vibe"
            className={cn(
              "flex items-center justify-center size-12 rounded-full border border-gold/50 bg-card text-gold shadow-lg transition-all cursor-pointer hover:scale-110",
              focusedBtn === 1 &&
                "ring-4 ring-gold/50 scale-125 bg-gold/15 shadow-gold/20 shadow-2xl",
            )}
          >
            <Sparkles className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => handleSwipe("love")}
            title="Love / Must Watch"
            className={cn(
              "flex items-center justify-center size-14 rounded-full border border-green-500/50 bg-card text-green-500 shadow-lg transition-all cursor-pointer hover:scale-110",
              focusedBtn === 2 &&
                "ring-4 ring-green-500/50 scale-125 bg-green-500/15 shadow-green-500/20 shadow-2xl",
            )}
          >
            <Heart className="size-6 stroke-[3]" />
          </button>
        </div>

        {/* TV Remote Helper Hint */}
        <p className="text-[10px] text-muted mt-3 uppercase tracking-widest text-center font-mono">
          ◀ Left: Pass · ▼ Down: Cozy · ▶ Right: Love · Or Drag Card
        </p>
      </div>

      {/* Sovereign User Action Bar: User Decides When to Move On */}
      <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gold/30 bg-card/95 p-4 backdrop-blur-xl shadow-2xl mt-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-foreground">
              {learnedCount === 0
                ? "Swipe cards to calibrate taste"
                : `${learnedCount} personal preference${learnedCount > 1 ? "s" : ""} learned`}
            </span>
          </div>
          <p className="text-[11px] text-muted">
            Unloved titles disappear immediately. Keep swiping or move on
            whenever ready.
          </p>
        </div>

        <Button
          size="md"
          variant="gold"
          onClick={() => onComplete(picks.length > 0 ? picks : ["balanced"])}
          className="rounded-xl px-6 py-2.5 font-display text-xs font-bold shadow-lg bg-gradient-to-r from-amber-400 via-gold to-yellow-500 hover:brightness-110 cursor-pointer"
        >
          {learnedCount === 0 ? (
            <>
              Skip to Cinema Shelf <ArrowRight className="size-3.5 ml-1.5" />
            </>
          ) : (
            <>
              Done · Enter Cinema ({learnedCount} learned){" "}
              <ArrowRight className="size-3.5 ml-1.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
