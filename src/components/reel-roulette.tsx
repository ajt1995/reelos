import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Clock, Dices, Flame, Rocket, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReelStore } from "@/lib/store";
import { TITLES } from "@/lib/catalog";
import type { Title } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VibeOption {
  id: string;
  label: string;
  sublabel: string;
  icon: typeof Rocket;
  badge: string;
  filter: (t: Title) => boolean;
}

const VIBES: VibeOption[] = [
  {
    id: "scifi",
    label: "Mind-Bending Sci-Fi",
    sublabel: "Space, paradoxes & alternate realities",
    icon: Rocket,
    badge: "Cosmic",
    filter: (t) => {
      const g = (t.genres || []).map((x) => x.toLowerCase());
      return g.includes("science fiction") || g.includes("sci-fi");
    },
  },
  {
    id: "comedy",
    label: "Comfort Comedy",
    sublabel: "Laughs and lighthearted vibes",
    icon: Sparkles,
    badge: "Feel-Good",
    filter: (t) => (t.genres || []).map((x) => x.toLowerCase()).includes("comedy"),
  },
  {
    id: "action90s",
    label: "90s Action Blast",
    sublabel: "Explosions, grit & practical stunts",
    icon: Flame,
    badge: "High-Octane",
    filter: (t) => {
      const g = (t.genres || []).map((x) => x.toLowerCase());
      const y = Number(t.year);
      return g.includes("action") && y >= 1990 && y <= 1999;
    },
  },
  {
    id: "short",
    label: "Under 90 Minutes",
    sublabel: "Crisp storytelling, pure cinema",
    icon: Clock,
    badge: "Brisk",
    filter: (t) => {
      const dur = typeof t.runtime === "number" ? t.runtime : 0;
      return dur > 0 && dur <= 90;
    },
  },
];

export function ReelRoulette() {
  const navigate = useNavigate();
  const shelf = useReelStore((s) => s.shelf);
  const remoteTitles = useReelStore((s) => s.remoteTitles);
  const [spinning, setSpinning] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<Title | null>(null);

  // Multi-tier candidate pool: local shelf -> remote discovered titles -> curated catalog
  const allAvailable = useMemo(() => {
    const map = new Map<string, Title>();
    for (const t of [...shelf, ...remoteTitles, ...TITLES]) {
      if (t && (t.id || t.jellyfinId)) {
        const key = t.id || t.jellyfinId!;
        if (!map.has(key)) {
          map.set(key, t);
        }
      }
    }
    return Array.from(map.values());
  }, [shelf, remoteTitles]);

  const handlePickVibe = (vibe: VibeOption) => {
    setSpinning(vibe.id);
    setSelectedTitle(null);

    // Find candidates from unified catalog
    let candidates = allAvailable.filter(vibe.filter);
    if (candidates.length === 0) {
      // Fallback to all available candidates if specific vibe has no candidates
      candidates = allAvailable;
    }

    if (candidates.length === 0) {
      setTimeout(() => setSpinning(null), 1000);
      return;
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];

    setTimeout(() => {
      setSpinning(null);
      setSelectedTitle(chosen);
    }, 600);
  };

  const handleRandomSurprise = () => {
    setSpinning("random");
    setSelectedTitle(null);
    if (allAvailable.length === 0) {
      setTimeout(() => setSpinning(null), 800);
      return;
    }
    const chosen = allAvailable[Math.floor(Math.random() * allAvailable.length)];
    setTimeout(() => {
      setSpinning(null);
      setSelectedTitle(chosen);
    }, 600);
  };

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 md:p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-gold/15 text-gold border border-gold/30">
            <Zap className="size-4" />
          </span>
          <div>
            <h3 className="font-display text-sm font-semibold tracking-wide text-foreground">
              ReelRoulette · Instant Vibe Play
            </h3>
            <p className="text-[11px] text-muted">
              Can't decide? 1 tap finds a matching title and starts streaming in 3 seconds.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRandomSurprise}
          disabled={spinning !== null}
          className="gap-1.5 rounded-xl border-border bg-raised/60 text-xs text-gold hover:text-gold-bright shadow-sm"
        >
          <Dices className="size-3.5" />
          Surprise Me
        </Button>
      </div>

      {/* Vibe Pills */}
      <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {VIBES.map((vibe) => {
          const Icon = vibe.icon;
          const isSpinning = spinning === vibe.id;
          return (
            <button
              key={vibe.id}
              type="button"
              onClick={() => handlePickVibe(vibe)}
              disabled={spinning !== null}
              className={cn(
                "group relative flex flex-col justify-between rounded-xl border border-border bg-card p-3 text-left transition-all duration-200 hover:border-gold/40 hover:bg-gold/5",
                isSpinning && "animate-pulse border-gold bg-gold/15"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex size-6 items-center justify-center rounded-lg bg-raised text-gold group-hover:bg-gold group-hover:text-gold-fg transition-colors">
                  <Icon className="size-3.5" />
                </span>
                <span className="rounded-full bg-raised/80 px-1.5 py-0.5 text-[9px] font-medium text-muted">
                  {vibe.badge}
                </span>
              </div>
              <div className="mt-2.5">
                <p className="font-display text-xs font-semibold text-foreground group-hover:text-gold-bright transition-colors">
                  {vibe.label}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-muted">{vibe.sublabel}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Chosen Title Modal / Banner */}
      {selectedTitle && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-gold/40 bg-gold/10 p-3.5 rise">
          <div className="flex items-center gap-3">
            {selectedTitle.poster && (
              <img
                src={selectedTitle.poster}
                alt={selectedTitle.title}
                className="size-12 rounded-lg object-cover shadow-md border border-white/10"
              />
            )}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">
                Roulette Picked:
              </p>
              <p className="font-display text-sm font-bold text-foreground">
                {selectedTitle.title}{" "}
                {selectedTitle.year ? (
                  <span className="text-xs font-normal text-muted">({selectedTitle.year})</span>
                ) : null}
              </p>
              <p className="line-clamp-1 text-[11px] text-muted">
                {(selectedTitle.genres || []).join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="gold"
              onClick={() => {
                navigate({
                  to: "/play/$id",
                  params: { id: selectedTitle.id || selectedTitle.jellyfinId || "" },
                });
              }}
              className="gap-1.5 rounded-xl px-4 text-xs font-semibold shadow-md"
            >
              Stream Now
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedTitle(null)}
              className="h-8 rounded-lg text-xs text-muted hover:text-foreground"
            >
              ✕
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
