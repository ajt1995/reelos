import React, { useState, useEffect } from "react";
import {
  Shield,
  Sliders,
  Check,
  X,
  AlertTriangle,
  Clock,
  Sparkles,
  Lock,
  ArrowRight,
  ArrowLeft,
  Heart,
  Baby,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { createClientId } from "@/lib/client-id";

interface BoundaryCard {
  id: string;
  dimension: string;
  title: string;
  exampleFilm: string;
  description: string;
  severityWeight: number;
}

export function ChildProfileWizard({
  profileId,
  onFinished,
}: {
  profileId?: string;
  onFinished?: () => void;
}) {
  const [resolvedProfileId] = useState(
    () => profileId || createClientId("child-"),
  );
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("Kids Profile");
  const [preset, setPreset] = useState<"little_kids" | "big_kids" | "teens" | "mature_teens">("big_kids");

  // Step 2: 8-Card Match Game
  const [deck, setDeck] = useState<BoundaryCard[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [reactions, setReactions] = useState<Record<string, "fine" | "ask" | "block">>({});

  // Step 3: PIN & Curfew
  const [pin, setPin] = useState("");
  const [curfew, setCurfew] = useState("20:30");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/child-profile/deck")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.deck)) {
          setDeck(data.deck);
        }
      })
      .catch(() => {});
  }, []);

  const handleReaction = (reaction: "fine" | "ask" | "block") => {
    if (!deck[cardIndex]) return;
    const cardId = deck[cardIndex].id;
    const nextReactions = { ...reactions, [cardId]: reaction };
    setReactions(nextReactions);

    if (cardIndex + 1 < deck.length) {
      setCardIndex(cardIndex + 1);
    } else {
      // Completed deck! Move to Step 3
      setStep(3);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const matchResponses = Object.entries(reactions).map(([cardId, reaction]) => ({
        cardId,
        reaction,
      }));

      const boundaryPayload = {
        profileId: resolvedProfileId,
        name,
        maturityPreset: preset,
        curfewTime: curfew,
        matchGameResponses: matchResponses,
        whitelistOverrides: [],
      };

      const profileResponse = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: resolvedProfileId,
          name,
          experienceVersion: 2,
          isKids: true,
          pin,
          maturity:
            preset === "little_kids"
              ? "little"
              : preset === "mature_teens"
                ? "mature"
                : preset === "teens"
                  ? "teen"
                  : "big",
          bedtime: curfew,
          boundaries: Object.fromEntries(matchResponses.map(({ cardId, reaction }) => [cardId, reaction])),
        }),
      });
      const profileData = await profileResponse.json();
      if (!profileResponse.ok || !profileData.ok) {
        throw new Error(profileData.error || "The protected profile could not be saved");
      }

      const boundaryResponse = await fetch("/api/child-profile/calibrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(boundaryPayload),
      });
      const boundaryData = await boundaryResponse.json();
      if (boundaryResponse.ok && boundaryData.ok) {
        showToast("Child profile protected and boundaries saved.", "success");
        onFinished?.();
      } else {
        showToast("Profile protected, but its content boundaries need another try.", "error");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save child profile", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-card border border-white/10 max-w-xl mx-auto space-y-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Baby className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-medium text-foreground">Train Child Cinema Profile</h2>
            <p className="text-xs text-muted">Zero-judgment taste calibration for your household.</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs font-mono text-amber-400">
          Step {step} of 3
        </div>
      </div>

      {/* STEP 1: Baseline Maturity Slider */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Profile Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-foreground focus:outline-none focus:border-amber-400"
              placeholder="e.g. Maya's Cinema"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Baseline Age Spectrum</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "little_kids", label: "Little Kids", age: "Ages 2–6", desc: "Gentle animation, TV-Y/G" },
                { id: "big_kids", label: "Big Kids", age: "Ages 7–11", desc: "Fantasy adventure, TV-Y7/PG" },
                { id: "teens", label: "Teens", age: "Ages 12–15", desc: "Cinematic action, PG-13" },
                { id: "mature_teens", label: "Mature Teens", age: "Ages 16–17", desc: "Mature themes, Uncensored" },
              ].map((p) => {
                const active = preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreset(p.id as any)}
                    className={cn(
                      "p-3 rounded-2xl text-left border transition-all cursor-pointer",
                      active
                        ? "bg-amber-500/20 border-amber-400 text-foreground ring-1 ring-amber-400/30"
                        : "bg-white/[0.02] border-white/5 hover:border-white/15 text-muted hover:text-foreground"
                    )}
                  >
                    <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                      {p.label}
                      <span className="text-[10px] text-amber-400/80 font-mono">{p.age}</span>
                    </div>
                    <div className="text-[11px] text-muted mt-1 leading-snug">{p.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <Button
              onClick={() => setStep(2)}
              className="bg-amber-500 hover:bg-amber-400 text-black font-medium text-xs px-4 py-2 rounded-xl flex items-center gap-1.5"
            >
              Play Match Game <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: The 8-Card Boundary Match Game */}
      {step === 2 && deck.length > 0 && deck[cardIndex] && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Card {cardIndex + 1} of {deck.length}</span>
            <span className="text-amber-400 font-mono capitalize">{deck[cardIndex].dimension}</span>
          </div>

          {/* Vignette Card */}
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">{deck[cardIndex].title}</h3>
              <div className="text-xs text-amber-300 font-medium">
                Example: {deck[cardIndex].exampleFilm}
              </div>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              {deck[cardIndex].description}
            </p>
          </div>

          {/* Reactions */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <button
              type="button"
              onClick={() => handleReaction("fine")}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-all"
            >
              <Check className="size-4" />
              <span>Totally Fine</span>
            </button>
            <button
              type="button"
              onClick={() => handleReaction("ask")}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium transition-all"
            >
              <AlertTriangle className="size-4" />
              <span>Ask First</span>
            </button>
            <button
              type="button"
              onClick={() => handleReaction("block")}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium transition-all"
            >
              <X className="size-4" />
              <span>Never Show</span>
            </button>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-white/5 text-xs">
            <button
              type="button"
              onClick={() => {
                if (cardIndex > 0) setCardIndex(cardIndex - 1);
                else setStep(1);
              }}
              className="text-muted hover:text-foreground flex items-center gap-1"
            >
              <ArrowLeft className="size-3" /> Back
            </button>
            <button
              type="button"
              onClick={() => handleReaction("ask")}
              className="text-muted hover:text-amber-400"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Dual-Parent Sovereign PIN & Curfew */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
            <div className="text-foreground font-semibold flex items-center gap-1.5">
              <Lock className="size-3.5 text-amber-400" /> Dual-Sovereign Household PIN
            </div>
            <p className="text-muted">
              Either parent account can view, change, or reset this PIN from their phone companion. The child profile cannot exit without it.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">4-Digit Exit PIN</label>
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-mono text-center tracking-widest text-foreground focus:outline-none focus:border-amber-400"
                placeholder="1234"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Bedtime Curfew</label>
              <input
                type="time"
                value={curfew}
                onChange={(e) => setCurfew(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-mono text-center text-foreground focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-muted">
            <span className="text-foreground font-medium">Playback preference:</span> ReelOS will request the family dialogue policy when a verified dialogue track and playback adapter are available.
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-xs text-muted hover:text-foreground flex items-center gap-1"
            >
              <ArrowLeft className="size-3" /> Back to Match Game
            </button>
            <Button
              disabled={saving || pin.length !== 4}
              onClick={handleSaveProfile}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs px-5 py-2 rounded-xl"
            >
              {saving ? "Training..." : "Complete & Lock Profile"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
