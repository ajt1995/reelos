import React, { useState, useEffect } from "react";
import { APP_VERSION } from "@/lib/version-stamp";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  Trash2,
  Tv,
  Smartphone,
  Shield,
  ShieldCheck,
  Film,
  Zap,
  Coffee,
  Flame,
  Layers,
  Sliders,
  QrCode,
  ArrowRight,
  Play,
  Heart,
  Gamepad2,
  Lock,
  Globe,
  Wifi,
  Copy,
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
import { ChildProfileWizard } from "@/components/child-profile-wizard";

interface MoodOption {
  id: TasteVibe;
  title: string;
  tag: string;
  desc: string;
  badge: string;
  sampleTitles: string[];
  gradient: string;
  glow: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  {
    id: "bleeding_edge",
    title: "Cosmic & Cerebral",
    tag: "Mind-Bending Sci-Fi",
    desc: "Vast expanses, quantum puzzles, and philosophical odysseys.",
    badge: "🌌 Deep Space",
    sampleTitles: [
      "Interstellar",
      "Dune: Part Two",
      "Arrival",
      "Blade Runner 2049",
    ],
    gradient: "from-sky-950/60 via-indigo-950/40 to-black/80 border-sky-500/40",
    glow: "rgba(56, 189, 248, 0.25)",
  },
  {
    id: "comfort",
    title: "Retro Synthwave",
    tag: "80s & 90s Adventure",
    desc: "Practical effects, heroic synth scores, and pure golden nostalgia.",
    badge: "📼 Retro Gold",
    sampleTitles: [
      "Back to the Future",
      "Raiders of the Lost Ark",
      "The Goonies",
      "Jurassic Park",
    ],
    gradient:
      "from-amber-950/60 via-orange-950/40 to-black/80 border-amber-500/40",
    glow: "rgba(245, 158, 11, 0.25)",
  },
  {
    id: "comfort",
    title: "Ghibli & Whimsical",
    tag: "Cozy Animation & Wonder",
    desc: "Heartwarming storybook journeys, gentle pacing, and lush watercolors.",
    badge: "☕ Pure Cozy",
    sampleTitles: [
      "Spirited Away",
      "My Neighbor Totoro",
      "Howl's Moving Castle",
      "Paddington 2",
    ],
    gradient:
      "from-emerald-950/60 via-teal-950/40 to-black/80 border-emerald-500/40",
    glow: "rgba(16, 185, 129, 0.25)",
  },
  {
    id: "balanced",
    title: "Crowd-Pleasing Popcorn",
    tag: "High-Octane Blockbusters",
    desc: "Universal favorites, breathless action sequences, and Friday night adrenaline.",
    badge: "🍿 Crowd Favorite",
    sampleTitles: [
      "Top Gun: Maverick",
      "The Dark Knight",
      "Mission: Impossible - Fallout",
      "Spider-Man",
    ],
    gradient: "from-yellow-950/60 via-amber-950/40 to-black/80 border-gold/40",
    glow: "rgba(245, 197, 24, 0.25)",
  },
  {
    id: "hidden_gems",
    title: "A24 & Midnight Cult",
    tag: "Cerebral Psychological Cinema",
    desc: "Dark tension, hypnotic auteur direction, and unforgettable narrative twists.",
    badge: "🎭 Auteur Cinema",
    sampleTitles: [
      "Everything Everywhere All at Once",
      "Ex Machina",
      "The Lighthouse",
      "Hereditary",
    ],
    gradient:
      "from-purple-950/60 via-violet-950/40 to-black/80 border-purple-500/40",
    glow: "rgba(168, 85, 247, 0.25)",
  },
  {
    id: "bleeding_edge",
    title: "4K Spectacle & IMAX Audio",
    tag: "Reference-Grade Home Theater",
    desc: "Uncompressed Dolby Atmos soundscapes, HDR10+ highlights, and acoustic impact.",
    badge: "⚡ Reference Grade",
    sampleTitles: [
      "Oppenheimer",
      "Mad Max: Fury Road",
      "The Batman",
      "Avatar: The Way of Water",
    ],
    gradient: "from-cyan-950/60 via-blue-950/40 to-black/80 border-cyan-500/40",
    glow: "rgba(6, 182, 212, 0.25)",
  },
];

export function SovereignOnboardingWizard() {
  const [act, setAct] = useState<1 | 2 | 3>(1);
  const houseName = useReelStore((s) => s.houseName);
  const setHouseName = useReelStore((s) => s.setHouseName);
  const residents = useReelStore((s) => s.residents);
  const addResident = useReelStore((s) => s.addResident);
  const removeResident = useReelStore((s) => s.removeResident);
  const patchResident = useReelStore((s) => s.patchResident);
  const openReelOS = useReelStore((s) => s.openReelOS);
  const setProvisioned = useReelStore((s) => s.setProvisioned);
  const setPhase = useReelStore((s) => s.setPhase);

  // MagicDNS, LAN & pairing state
  const [lanUrl, setLanUrl] = useState<string>("");
  const [tailscaleUrl, setTailscaleUrl] = useState<string>("");
  const [pairingMode, setPairingMode] = useState<"lan" | "tailscale">("lan");
  const [pairingUrl, setPairingUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // New resident creation draft
  const [newResName, setNewResName] = useState("");
  const [newResTier, setNewResTier] = useState<"adult" | "teen" | "child">(
    "adult",
  );
  const [trainingChildId, setTrainingChildId] = useState<string | null>(null);

  // Mood selections (multi-select)
  const [selectedMoods, setSelectedMoods] = useState<number[]>([0, 1, 3]);

  useEffect(() => {
    fetch("/api/gate/status")
      .then((r) => r.json())
      .then((d) => {
        const port = window.location.port
          ? `:${window.location.port}`
          : window.location.protocol === "https:"
            ? ""
            : ":8080";
        const detectedLan =
          d?.lanIp && d.lanIp !== "127.0.0.1"
            ? `http://${d.lanIp}${port}`
            : window.location.hostname !== "localhost" &&
                window.location.hostname !== "127.0.0.1"
              ? `${window.location.protocol}//${window.location.host}`
              : `http://${d?.lanIp || "127.0.0.1"}${port}`;
        setLanUrl(detectedLan);

        const ts =
          d?.publicUrl ||
          (d?.tailscaleDns ? `https://${d.tailscaleDns}` : null) ||
          d?.magicDnsUrl ||
          null;
        if (ts) {
          setTailscaleUrl(ts);
          setPairingUrl(ts);
          setPairingMode("tailscale");
        } else {
          setPairingUrl(detectedLan);
          setPairingMode("lan");
        }
      })
      .catch(() => {
        const fallback = window.location.origin;
        setLanUrl(fallback);
        setPairingUrl(fallback);
      });
  }, []);

  const handleAddResident = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newResName.trim();
    if (!name) return;

    addResident(name, "sparkles", undefined, newResTier === "child");
    const id = useReelStore.getState().activeResidentId;
    patchResident(id, {
      tasteVibe: "balanced",
      audioLanguagePreference: "sub",
      isKids: newResTier === "child",
    });
    setNewResName("");
    showToast(`Added ${name} to cinema household`);

    if (newResTier === "child") {
      setTrainingChildId(id);
    }
  };

  const toggleMood = (index: number) => {
    if (selectedMoods.includes(index)) {
      if (selectedMoods.length > 1) {
        setSelectedMoods(selectedMoods.filter((i) => i !== index));
      }
    } else {
      setSelectedMoods([...selectedMoods, index]);
    }
  };

  const handleLaunchCinema = () => {
    setProvisioned(true);
    setPhase("ready");
    openReelOS();
    showToast("Welcome to ReelOS Cinema Lounge!");
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  // Preview shelf calculation
  const previewShelf = Array.from(
    new Set(selectedMoods.flatMap((idx) => MOOD_OPTIONS[idx].sampleTitles)),
  ).slice(0, 6);

  if (trainingChildId) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl p-4 sm:p-8 flex items-center justify-center">
        <div className="w-full max-w-2xl bg-card border border-gold/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-border/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-gold/15 text-gold flex items-center justify-center font-bold">
                <Gamepad2 className="size-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">
                  Set Child Boundaries
                </h2>
                <p className="text-xs text-muted">
                  An 8-card match game for this child profile
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTrainingChildId(null)}
              className="text-muted hover:text-foreground"
            >
              Skip / Use Defaults
            </Button>
          </div>

          <ChildProfileWizard
            profileId={trainingChildId}
            onFinished={() => {
              setTrainingChildId(null);
              showToast("Child boundaries saved!");
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0D] text-foreground flex flex-col items-center justify-between p-4 sm:p-8 md:p-12 relative overflow-hidden select-none font-sans">
      {/* Background Cinematic Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 size-[45rem] rounded-full bg-gold/10 blur-[150px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 size-[45rem] rounded-full bg-sky-500/10 blur-[150px]"
      />

      {/* Top Header & Express Pass */}
      <header className="relative z-10 w-full max-w-5xl flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-gradient-to-br from-gold to-amber-600 flex items-center justify-center shadow-lg shadow-gold/20 text-black font-black text-xl">
            R
          </div>
          <div>
            <span className="font-display font-black text-xl tracking-wider text-foreground">
              REEL<span className="text-gold">OS</span>
            </span>
            <span className="ml-2 text-[10px] font-mono uppercase tracking-widest text-muted bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
              Sovereign Cinema Suite
            </span>
          </div>
        </div>

        {/* 3-Act Step Dots */}
        <div className="hidden sm:flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full backdrop-blur-md">
          <div
            className={cn(
              "flex items-center gap-2 text-xs font-medium transition-colors",
              act === 1 ? "text-gold" : "text-muted",
            )}
          >
            <span
              className={cn(
                "size-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                act === 1 ? "bg-gold text-black" : "bg-white/10 text-muted",
              )}
            >
              1
            </span>
            Cinema & Family
          </div>
          <span className="text-muted/40">➔</span>
          <div
            className={cn(
              "flex items-center gap-2 text-xs font-medium transition-colors",
              act === 2 ? "text-gold" : "text-muted",
            )}
          >
            <span
              className={cn(
                "size-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                act === 2 ? "bg-gold text-black" : "bg-white/10 text-muted",
              )}
            >
              2
            </span>
            Visual Taste
          </div>
          <span className="text-muted/40">➔</span>
          <div
            className={cn(
              "flex items-center gap-2 text-xs font-medium transition-colors",
              act === 3 ? "text-gold" : "text-muted",
            )}
          >
            <span
              className={cn(
                "size-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                act === 3 ? "bg-gold text-black" : "bg-white/10 text-muted",
              )}
            >
              3
            </span>
            Ready to Play
          </div>
        </div>

        {/* Fast-Pass Skip */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLaunchCinema}
          className="text-xs text-muted hover:text-gold hover:bg-gold/10 transition-colors"
        >
          Skip to Cinema ➔
        </Button>
      </header>

      {/* Main Interactive Stage */}
      <main className="relative z-10 w-full max-w-5xl my-auto py-8 flex flex-col items-center">
        {/* ========================================================================= */}
        {/* ACT 1: CINEMA IDENTITY & RESIDENTS                                       */}
        {/* ========================================================================= */}
        {act === 1 && (
          <div className="w-full max-w-3xl space-y-8 animate-in fade-in duration-300">
            <div className="text-center space-y-2">
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                Welcome to Your Personal Cinema Lounge
              </h1>
              <p className="text-sm sm:text-base text-muted max-w-lg mx-auto">
                Name your private screening room and tell ReelOS who is in the
                household for seamless audio, subtitle, and taste harmony.
              </p>
            </div>

            {/* Cinema Lounge Name */}
            <div className="bg-card/70 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl space-y-6 shadow-2xl">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                  <Tv className="size-4 text-gold" /> Cinema Lounge Name
                </label>
                <input
                  type="text"
                  value={houseName}
                  onChange={(e) => setHouseName(e.target.value)}
                  placeholder="e.g. Living Room Lounge, The Turner Cinema"
                  className="w-full bg-black/50 border border-white/10 focus:border-gold/60 focus:ring-1 focus:ring-gold/60 rounded-2xl px-5 py-3.5 text-foreground text-lg font-medium outline-none transition-all placeholder:text-muted/40"
                />
              </div>

              {/* Household Residents */}
              <div className="space-y-4 pt-2 border-t border-white/5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Heart className="size-4 text-gold" /> Household Residents &
                    Taste Profiles
                  </span>
                  <span className="text-[11px] lowercase text-muted/60">
                    {residents.length}{" "}
                    {residents.length === 1 ? "resident" : "residents"}
                  </span>
                </label>

                {/* Resident Chips */}
                <div className="flex flex-wrap gap-2.5">
                  {residents.map((res) => (
                    <div
                      key={res.id}
                      className={cn(
                        "flex items-center gap-2.5 px-4 py-2 rounded-2xl border transition-all",
                        res.isKids
                          ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                          : "bg-white/5 border-white/10 text-foreground",
                      )}
                    >
                      <div
                        className={cn(
                          "size-7 rounded-xl flex items-center justify-center font-bold text-xs",
                          res.isKids
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-gold/20 text-gold",
                        )}
                      >
                        {res.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold leading-tight">
                          {res.name}
                        </div>
                        <div className="text-[10px] text-muted leading-tight">
                          {res.isKids
                            ? "Child Profile"
                            : res.audioLanguagePreference === "sub"
                              ? "Sub (Original)"
                              : "Dub (English)"}
                        </div>
                      </div>

                      {res.isKids && (
                        <button
                          type="button"
                          onClick={() => setTrainingChildId(res.id)}
                          className="ml-1 text-[11px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-500/30 font-medium transition-all"
                          title="Calibrate 8-Card Boundaries"
                        >
                          Tune
                        </button>
                      )}

                      {residents.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeResident(res.id)}
                          className="text-muted/40 hover:text-rose-400 p-1 transition-colors"
                          title="Remove resident"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Resident Form */}
                <form
                  onSubmit={handleAddResident}
                  className="flex flex-col sm:flex-row gap-2.5 pt-2"
                >
                  <input
                    type="text"
                    value={newResName}
                    onChange={(e) => setNewResName(e.target.value)}
                    placeholder="Add resident (e.g. Austin, Sarah, Leo)..."
                    className="flex-1 bg-black/40 border border-white/10 focus:border-gold/60 rounded-2xl px-4 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted/40"
                  />

                  {/* Tier selector */}
                  <div className="flex gap-1.5 bg-black/40 border border-white/10 p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setNewResTier("adult")}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                        newResTier === "adult"
                          ? "bg-gold text-black shadow-md"
                          : "text-muted hover:text-foreground",
                      )}
                    >
                      Adult
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewResTier("teen")}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                        newResTier === "teen"
                          ? "bg-amber-500 text-black shadow-md"
                          : "text-muted hover:text-foreground",
                      )}
                    >
                      Teen
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewResTier("child")}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                        newResTier === "child"
                          ? "bg-emerald-500 text-black shadow-md"
                          : "text-muted hover:text-foreground",
                      )}
                    >
                      🧸 Child
                    </button>
                  </div>

                  <Button
                    type="submit"
                    variant="ghost"
                    disabled={!newResName.trim()}
                    className="rounded-2xl border-white/15 hover:border-gold/50 hover:bg-gold/10 text-foreground font-semibold px-4"
                  >
                    <Plus className="size-4 mr-1 text-gold" /> Add
                  </Button>
                </form>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                size="lg"
                onClick={() => setAct(2)}
                className="bg-gold hover:bg-gold/90 text-black font-bold px-8 py-6 rounded-2xl shadow-xl shadow-gold/20 text-base flex items-center gap-2 group transition-all"
              >
                Continue to Visual Taste{" "}
                <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ACT 2: 6-CARD VISUAL MOOD GRID & LIVE MARQUEE PREVIEW                     */}
        {/* ========================================================================= */}
        {act === 2 && (
          <div className="w-full max-w-4xl space-y-8 animate-in fade-in duration-300">
            <div className="text-center space-y-2">
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                Select Your Visual Aesthetics
              </h1>
              <p className="text-sm sm:text-base text-muted max-w-lg mx-auto">
                ReelOS curates your Day-1 cinema shelf instantly without noisy
                questionnaires. Select the visual vibes that speak to you:
              </p>
            </div>

            {/* 6-Card Visual Mood Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {MOOD_OPTIONS.map((mood, idx) => {
                const isSelected = selectedMoods.includes(idx);
                return (
                  <div
                    key={mood.title}
                    onClick={() => toggleMood(idx)}
                    style={{
                      boxShadow: isSelected
                        ? `0 10px 30px -10px ${mood.glow}`
                        : undefined,
                    }}
                    className={cn(
                      "relative p-5 rounded-3xl border text-left cursor-pointer transition-all duration-300 overflow-hidden group select-none",
                      "bg-gradient-to-b backdrop-blur-xl",
                      mood.gradient,
                      isSelected
                        ? "border-gold/80 scale-[1.02] ring-1 ring-gold/40"
                        : "border-white/10 opacity-75 hover:opacity-100 hover:scale-[1.01]",
                    )}
                  >
                    {/* Selected Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-black/50 border border-white/10 text-foreground/90">
                        {mood.badge}
                      </span>
                      <div
                        className={cn(
                          "size-6 rounded-full flex items-center justify-center transition-all",
                          isSelected
                            ? "bg-gold text-black font-bold shadow-lg"
                            : "border border-white/20 text-transparent",
                        )}
                      >
                        <Check className="size-3.5" />
                      </div>
                    </div>

                    <h3 className="font-display text-lg font-bold text-foreground group-hover:text-gold transition-colors">
                      {mood.title}
                    </h3>
                    <p className="text-xs text-muted/80 mt-1 line-clamp-2">
                      {mood.desc}
                    </p>

                    {/* Sample Titles Micro-Chips */}
                    <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-1">
                      {mood.sampleTitles.slice(0, 3).map((title) => (
                        <span
                          key={title}
                          className="text-[10px] bg-black/40 text-foreground/70 px-2 py-0.5 rounded-md border border-white/5"
                        >
                          {title}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Inaugural Shelf Preview */}
            <div className="w-full bg-card/60 border border-white/10 rounded-3xl p-6 backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-2">
                  <Film className="size-4" /> Live Preview: Your Inaugural
                  Cinema Shelf
                </span>
                <span className="text-[11px] text-muted">
                  Pins automatically to your Home screen
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
                {previewShelf.map((title, i) => (
                  <div
                    key={title}
                    className="relative aspect-[2/3] rounded-2xl bg-black/60 border border-white/10 p-3 flex flex-col justify-end overflow-hidden group shadow-lg"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />
                    <div className="relative z-20">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-gold/80 block mb-1">
                        #{i + 1} Pin
                      </span>
                      <div className="text-xs font-bold text-foreground leading-tight line-clamp-2">
                        {title}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setAct(1)}
                className="text-muted hover:text-foreground rounded-2xl"
              >
                <ChevronLeft className="size-5 mr-1" /> Back
              </Button>

              <Button
                size="lg"
                onClick={() => setAct(3)}
                className="bg-gold hover:bg-gold/90 text-black font-bold px-8 py-6 rounded-2xl shadow-xl shadow-gold/20 text-base flex items-center gap-2 group transition-all"
              >
                Continue to Companion Sync{" "}
                <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ACT 3: COMPANION MAGICDNS HANDSHAKE & LAUNCH                             */}
        {/* ========================================================================= */}
        {act === 3 && (
          <div className="w-full max-w-2xl space-y-6 text-center animate-in fade-in duration-300">
            <div className="space-y-2">
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                Your Cinema Lounge is Ready
              </h1>
              <p className="text-sm sm:text-base text-muted max-w-md mx-auto">
                Scan with your phone camera to pair your mobile companion screen
                for 2nd-screen controls, vinyl lore, and room presence.
              </p>
            </div>

            {/* Connection Mode Selector: Same House (Home Wi-Fi) vs Tailscale Funnel */}
            <div className="flex items-center justify-center gap-2 p-1 bg-black/40 border border-white/10 rounded-2xl max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => {
                  setPairingMode("lan");
                  if (lanUrl) setPairingUrl(lanUrl);
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all",
                  pairingMode === "lan"
                    ? "bg-gold text-black shadow-md shadow-gold/20"
                    : "text-muted hover:text-foreground",
                )}
              >
                <Wifi className="size-3.5" /> Same House (Wi-Fi)
              </button>
              <button
                type="button"
                onClick={() => {
                  setPairingMode("tailscale");
                  if (tailscaleUrl) setPairingUrl(tailscaleUrl);
                  else if (lanUrl) setPairingUrl(lanUrl);
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all",
                  pairingMode === "tailscale"
                    ? "bg-gold text-black shadow-md shadow-gold/20"
                    : "text-muted hover:text-foreground",
                )}
              >
                <Globe className="size-3.5" /> Tailscale Funnel
              </button>
            </div>

            {/* Glowing MagicDNS / LAN QR Card */}
            <div className="bg-card/70 border border-gold/30 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-gold/10 space-y-5 max-w-md mx-auto">
              <div className="bg-white p-4 rounded-2xl shadow-inner inline-block mx-auto border-4 border-gold/40">
                <QrCodeSvg
                  value={`${pairingUrl || lanUrl || window.location.origin}/companion`}
                  size={190}
                />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                  {pairingMode === "tailscale" && tailscaleUrl ? (
                    <>
                      <Globe className="size-3.5" /> Tailscale Funnel Mesh
                      Active
                    </>
                  ) : (
                    <>
                      <Wifi className="size-3.5" /> Same House (Home Wi-Fi)
                    </>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2 pt-0.5">
                  <span className="text-xs font-mono text-muted/80 break-all select-all">
                    {pairingUrl || lanUrl || window.location.origin}/companion
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${pairingUrl || lanUrl || window.location.origin}/companion`,
                      );
                      setCopied(true);
                      showToast("Companion link copied to clipboard");
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted hover:text-foreground transition-colors"
                    title="Copy Companion Link"
                  >
                    {copied ? (
                      <Check className="size-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* 1-Click APK Direct Download Buttons */}
              <div className="pt-3 border-t border-white/10 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gold/90 block">
                  Direct App Downloads for Phone & TV
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="/downloads/reelos-app.apk"
                    download="reelos-app.apk"
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground text-xs font-semibold transition-colors group"
                  >
                    <Smartphone className="size-3.5 text-gold group-hover:scale-110 transition-transform" />
                    <span>Android Phone</span>
                  </a>
                  <a
                    href="/clients/reelos-android-universal.apk"
                    download="reelos-tv.apk"
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground text-xs font-semibold transition-colors group"
                  >
                    <Tv className="size-3.5 text-gold group-hover:scale-110 transition-transform" />
                    <span>TV / FireStick</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Launch Primary CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-1">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setAct(2)}
                className="text-muted hover:text-foreground rounded-2xl order-2 sm:order-1"
              >
                <ChevronLeft className="size-5 mr-1" /> Back
              </Button>

              <Button
                size="lg"
                onClick={handleLaunchCinema}
                className="bg-gold hover:bg-gold/90 text-black font-extrabold px-10 py-7 rounded-2xl shadow-2xl shadow-gold/30 text-lg flex items-center gap-3 group transition-all order-1 sm:order-2"
              >
                <Play className="size-6 fill-black" /> Enter Cinema Lounge
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Footer System Status Bar */}
      <footer className="relative z-10 w-full max-w-5xl flex items-center justify-between text-[11px] text-muted/60 border-t border-white/5 pt-4">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Runs directly on your ReelOS home</span>
        </div>
        <div className="flex items-center gap-4">
          <span>TorBox Air-Gap Pacer Active</span>
          <span>ReelOS v{APP_VERSION}</span>
        </div>
      </footer>
    </div>
  );
}
