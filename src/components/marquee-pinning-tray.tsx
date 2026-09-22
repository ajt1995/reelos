import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Pin, Sparkles, X, ArrowRight, Check, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReelStore } from "@/lib/store";
import { TITLES, getTitle } from "@/lib/catalog";
import type { Title } from "@/lib/types";
import type { HouseholdResident } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface MarqueePinningTrayProps {
  resident: HouseholdResident;
  catalog?: Title[];
  onComplete?: (pinnedIds: string[]) => void;
  onDismiss?: () => void;
}

export function MarqueePinningTray({
  resident,
  catalog = [],
  onComplete,
  onDismiss,
}: MarqueePinningTrayProps) {
  const navigate = useNavigate();
  const patchResident = useReelStore((s) => s.patchResident);

  // Pre-seed pinned IDs from existing resident pinnedTitleIds or favorites (up to 3)
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    const existing = resident.pinnedTitleIds || [];
    if (existing.length > 0) return existing.slice(0, 5);
    const favs = resident.favorites || [];
    return favs.slice(0, 3);
  });

  const [notice, setNotice] = useState<string | null>(null);

  // Candidate pool: combine catalog and curated TITLES
  const candidateTitles = useMemo(() => {
    const map = new Map<string, Title>();

    // Add catalog titles
    for (const t of catalog) {
      if (t && t.id && !map.has(t.id)) map.set(t.id, t);
    }
    // Add curated TITLES
    for (const t of TITLES) {
      if (t && t.id && !map.has(t.id)) map.set(t.id, t);
    }

    const all = Array.from(map.values());

    // Sort: titles in resident favorites or matching tasteVibe first
    const favSet = new Set(resident.favorites || []);
    return all.sort((a, b) => {
      const aFav = favSet.has(a.id) ? 1 : 0;
      const bFav = favSet.has(b.id) ? 1 : 0;
      return bFav - aFav;
    }).slice(0, 14);
  }, [catalog, resident.favorites]);

  const togglePin = (titleId: string) => {
    setNotice(null);
    if (pinnedIds.includes(titleId)) {
      setPinnedIds((prev) => prev.filter((id) => id !== titleId));
    } else {
      if (pinnedIds.length >= 5) {
        setNotice("Maximum 5 marquee titles pinned");
        return;
      }
      setPinnedIds((prev) => [...prev, titleId]);
    }
  };

  const handleFinishAndDiscover = () => {
    let finalPins = [...pinnedIds];
    if (finalPins.length < 3) {
      for (const t of candidateTitles) {
        if (!finalPins.includes(t.id)) {
          finalPins.push(t.id);
          if (finalPins.length >= 3) break;
        }
      }
    }

    try {
      localStorage.setItem(`reelos_marquee_pinned_${resident.id}`, "1");
    } catch {}

    patchResident(resident.id, {
      pinnedTitleIds: finalPins,
      hasCompletedMarqueePinning: true,
    });

    fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: resident.id,
        pinnedTitleIds: finalPins,
        hasCompletedMarqueePinning: true,
      }),
    }).catch(() => {});

    onComplete?.(finalPins);
    void navigate({ to: "/discover" });
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(`reelos_marquee_pinned_${resident.id}`, "1");
    } catch {}

    patchResident(resident.id, {
      hasCompletedMarqueePinning: true,
    });

    fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: resident.id,
        hasCompletedMarqueePinning: true,
      }),
    }).catch(() => {});

    onDismiss?.();
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-b from-card/90 via-card/75 to-card/95 p-5 md:p-7 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-400">
      {/* Subtle gold ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 right-1/4 size-72 rounded-full bg-gold/15 blur-[90px]"
      />

      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/15 px-3 py-0.5 text-xs font-bold text-gold">
              <Sparkles className="size-3.5" /> First-Visit Marquee Setup
            </span>
            <span className="font-mono text-xs font-semibold text-foreground/90">
              {pinnedIds.length}/5 Pinned {pinnedIds.length < 3 ? `(Select 3 or continue)` : `✓ Ready`}
            </span>
          </div>

          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Anchor your personal home screen
          </h2>
          <p className="text-xs sm:text-sm text-muted max-w-2xl">
            1-tap pin 3 to 5 cinema staples for your marquee showcase. This inaugural setup only appears once.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={handleDismiss}
            className="h-10 px-3 text-xs text-muted hover:text-foreground cursor-pointer"
            title="Skip marquee setup"
          >
            Skip for now
          </Button>

          <Button
            type="button"
            onClick={handleFinishAndDiscover}
            className="h-10 rounded-xl px-5 font-display text-xs font-bold transition-all shadow-md bg-gold text-background hover:bg-gold-bright shadow-[0_0_20px_rgba(212,175,55,0.35)] cursor-pointer"
          >
            <span>Continue to Discover</span>
            <ArrowRight className="ml-1.5 size-4" />
          </Button>

          <button
            type="button"
            onClick={handleDismiss}
            className="flex size-8 items-center justify-center rounded-full text-muted hover:text-foreground hover:bg-white/10 transition cursor-pointer"
            aria-label="Dismiss marquee setup"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {notice && (
        <div className="mt-3 text-xs font-semibold text-amber-300 animate-in fade-in">
          {notice}
        </div>
      )}

      {/* Horizontal Scrollable Title Shelf */}
      <div className="mt-5 flex gap-3.5 overflow-x-auto pb-3 pt-1 no-scrollbar">
        {candidateTitles.map((t) => {
          const isPinned = pinnedIds.includes(t.id);

          return (
            <div
              key={t.id}
              onClick={() => togglePin(t.id)}
              className={cn(
                "group relative shrink-0 w-[136px] sm:w-[156px] rounded-2xl p-2 transition-all duration-300 cursor-pointer border select-none flex flex-col justify-between",
                isPinned
                  ? "border-gold/90 bg-gold/15 shadow-[0_0_25px_rgba(212,175,55,0.3)] ring-2 ring-gold scale-[1.02]"
                  : "border-border/60 bg-card/60 hover:border-gold/40 hover:bg-card hover:scale-[1.01]"
              )}
            >
              {/* Poster Art */}
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-card-2 shadow-inner">
                {t.poster ? (
                  <img
                    src={t.poster}
                    alt={t.title}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-card-2 text-muted">
                    <Film className="size-8 opacity-40" />
                  </div>
                )}

                {/* Pinned Badge Overlay */}
                {isPinned && (
                  <div className="absolute top-2 right-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-background shadow-md flex items-center gap-1">
                    <Pin className="size-3 fill-background" />
                    <span>Pinned</span>
                  </div>
                )}
              </div>

              {/* Title & Metadata */}
              <div className="mt-2.5 space-y-1">
                <h4 className="font-display text-xs font-bold text-foreground line-clamp-1 group-hover:text-gold transition-colors">
                  {t.title}
                </h4>
                <p className="text-[10px] text-muted line-clamp-1">
                  {t.year || "Cinema"} {t.genres?.[0] ? `· ${t.genres[0]}` : ""}
                </p>
              </div>

              {/* 1-Tap Pin Button */}
              <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-center">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] font-semibold transition-colors",
                    isPinned ? "text-gold font-bold" : "text-muted group-hover:text-foreground"
                  )}
                >
                  {isPinned ? (
                    <>
                      <Check className="size-3 stroke-[2.5]" /> Pinned
                    </>
                  ) : (
                    <>
                      <Pin className="size-3" /> + 1-Tap Pin
                    </>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
