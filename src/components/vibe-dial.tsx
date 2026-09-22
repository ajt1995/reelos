import { useState } from "react";
import { useReelStore, TasteVibe } from "@/lib/store";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const VIBES: { id: TasteVibe; label: string; desc: string; warm: boolean }[] = [
  { id: "balanced", label: "Golden Popcorn", desc: "Blockbusters & familiar favorites", warm: false },
  { id: "comfort", label: "35mm Film Warmth", desc: "Cozy, nostalgic, and uplifting", warm: true },
  { id: "hidden_gems", label: "A24 Midnight", desc: "Dark, esoteric, and moody", warm: false },
  { id: "bleeding_edge", label: "90-Min Dinner", desc: "Fast-paced & easy to digest", warm: false },
];

export function VibeDial() {
  const activeResidentId = useReelStore((s) => s.activeResidentId);
  const patchResident = useReelStore((s) => s.patchResident);
  const residents = useReelStore((s) => s.residents);
  const resident = residents.find((r) => r.id === activeResidentId);

  if (!resident) return null;

  const currentVibe = resident.tasteVibe || "balanced";

  return (
    <div className="flex flex-col gap-3 py-4">
      <h3 className="font-display text-sm font-bold text-foreground">Vibe Dial</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {VIBES.map((v) => {
          const active = currentVibe === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                patchResident(activeResidentId, { tasteVibe: v.id });
                showToast(`Vibe set to ${v.label}`, "info");
              }}
              className={cn(
                "flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                active
                  ? "border-gold bg-gold/10 text-gold shadow-sm shadow-gold/10"
                  : "border-border bg-card hover:bg-card/80 text-muted hover:text-foreground"
              )}
            >
              <span className="font-display font-semibold text-xs sm:text-sm">{v.label}</span>
              <span className="text-xs mt-1 text-muted leading-tight">{v.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
