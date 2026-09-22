import React, { useEffect, useState, useRef } from "react";
import {
  Tv,
  Shield,
  User,
  HelpCircle,
  Volume2,
  VolumeX,
  RefreshCw,
  ChevronDown,
  Clock,
  ArrowLeft,
  Play,
  Pause,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  Upload,
  Check,
  Smartphone,
  Sliders,
  Image as ImageIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface CharacterCard {
  name: string;
  actor: string;
  role: string;
  avatar?: string | null;
}

interface CompanionDossier {
  available?: boolean;
  message?: string | null;
  title: string;
  tagline?: string;
  season?: number;
  episode?: number;
  currentMinute?: number;
  storySoFar: string[];
  whoIsWho: CharacterCard[];
  whyAreTheyHere: string | null;
  whisperNotes: string[];
  spoilerShield: {
    active: boolean;
    safeThroughSeason: number;
    safeThroughEpisode: number;
    futureLoreBlocked: boolean;
  };
}

export function CompanionScreen({
  initialTitleId,
  initialSeason = 1,
  initialEpisode = 1,
}: {
  initialTitleId?: string;
  initialSeason?: number;
  initialEpisode?: number;
} = {}) {
  const [activeTab, setActiveTab] = useState<"dossier" | "remote" | "standby">("dossier");
  const [dossier, setDossier] = useState<CompanionDossier | null>(null);
  const [isActiveTv, setIsActiveTv] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openWhy, setOpenWhy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Section 70.5: Who's in the Room? Presence State
  const [kidsPresent, setKidsPresent] = useState(false);
  const [presenceLevel, setPresenceLevel] = useState<number>(0);

  const triggerHaptic = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(15);
      } catch {}
    }
  };

  const handleToggleKidsPresent = async (present: boolean) => {
    triggerHaptic();
    const nextLevel = present ? 3 : 0;
    setKidsPresent(present);
    setPresenceLevel(nextLevel);
    try {
      const res = await fetch("/api/companion/presence-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "living_room_tv",
          kidsPresent: present,
          filterLevel: nextLevel,
          filterBlasphemy: present,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(
          present
            ? "Kids are here. ReelOS will verify the family boundary before playback."
            : "Adult-only presence saved for this session.",
          "info"
        );
      }
    } catch {
      showToast("Could not sync room presence", "error");
    }
  };

  const fetchDossier = async () => {
    try {
      const res = await fetch("/api/companion/active");
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.dossier) {
          if (!data.active && initialTitleId) {
            const fallbackRes = await fetch(`/api/companion/${encodeURIComponent(initialTitleId)}?season=${initialSeason}&episode=${initialEpisode}`);
            if (fallbackRes.ok) {
              const fallbackData = await fallbackRes.json();
              if (fallbackData.ok && fallbackData.dossier) {
                setDossier(fallbackData.dossier);
                setIsActiveTv(false);
                setSessionInfo(null);
                return;
              }
            }
          }
          setDossier(data.dossier);
          setIsActiveTv(Boolean(data.active));
          setSessionInfo(data.session || null);
          if (data.session?.isPaused !== undefined) {
            setIsPlaying(!data.session.isPaused);
          }
        }
      }
    } catch {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDossier();
    const interval = setInterval(fetchDossier, 8000);
    return () => clearInterval(interval);
  }, []);

  const sendRemoteCommand = async (action: string, payload = {}) => {
    triggerHaptic();
    try {
      await fetch("/api/companion/remote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      if (action === "toggle") {
        setIsPlaying((prev) => !prev);
      } else if (action === "play") {
        setIsPlaying(true);
      } else if (action === "pause") {
        setIsPlaying(false);
      }
    } catch {}
  };

  const handleRoomHandoff = async (target: "tv" | "phone") => {
    triggerHaptic();
    try {
      const res = await fetch(`/api/companion/handoff?target=${target}`);
      if (res.ok) {
        showToast(target === "tv" ? "Sent playback to Living Room TV" : "Pulled playback to Phone", "success");
      }
    } catch {
      showToast("Room handoff failed", "error");
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    triggerHaptic();

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await fetch("/api/standby/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            data: base64,
          }),
        });
        if (res.ok) {
          showToast("Photo added to TV Standby Wall", "success");
        } else {
          showToast("Failed to upload photo", "error");
        }
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch {
      showToast("Upload error", "error");
      setUploadingPhoto(false);
    }
  };

  if (loading && !dossier) {
    return (
      <div className="min-h-screen bg-black text-foreground flex items-center justify-center p-6">
        <p className="text-sm font-mono text-muted animate-pulse">Syncing with Living Room Screen...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-foreground selection:bg-gold selection:text-black pb-28">
      {/* Top Ambient Bar */}
      <header className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-border/40 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/library"
            className="p-1.5 -ml-1 text-muted hover:text-foreground rounded-full transition-colors"
            title="Back to Library"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", isActiveTv ? "bg-emerald-400 animate-ping" : "bg-gold/60")} />
            <span className="text-xs font-mono uppercase tracking-wider text-muted">
              {isActiveTv ? "Living Room TV Synced" : "Companion Mode"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchDossier();
          }}
          className="text-xs font-mono text-muted hover:text-gold flex items-center gap-1 cursor-pointer transition-colors"
        >
          <RefreshCw className={cn("size-3.5", loading ? "animate-spin" : "")} />
          <span>Sync</span>
        </button>
      </header>

      {/* Segmented Mode Switcher */}
      <div className="max-w-md mx-auto px-5 pt-4">
        <div className="flex rounded-2xl bg-zinc-900/80 p-1 border border-border/60 backdrop-blur-md">
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setActiveTab("dossier");
            }}
            className={cn(
              "flex-1 py-2 text-xs font-medium rounded-xl transition-all",
              activeTab === "dossier" ? "bg-gold text-black font-bold shadow-sm" : "text-muted hover:text-foreground"
            )}
          >
            Dossier & Lore
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setActiveTab("remote");
            }}
            className={cn(
              "flex-1 py-2 text-xs font-medium rounded-xl transition-all",
              activeTab === "remote" ? "bg-gold text-black font-bold shadow-sm" : "text-muted hover:text-foreground"
            )}
          >
            Velvet Remote
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setActiveTab("standby");
            }}
            className={cn(
              "flex-1 py-2 text-xs font-medium rounded-xl transition-all",
              activeTab === "standby" ? "bg-gold text-black font-bold shadow-sm" : "text-muted hover:text-foreground"
            )}
          >
            Standby Art
          </button>
        </div>
      </div>

      <main className="max-w-md mx-auto px-5 pt-5 space-y-6">
        {/* Section 70.5: Who's in the Room? Dynamic Movie Night Presence Bar */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Who's in the Room?</span>
              <span className="text-[10px] text-muted">(Playback boundary)</span>
            </div>
            <button
              type="button"
              onClick={() => handleToggleKidsPresent(!kidsPresent)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer",
                kidsPresent
                  ? "bg-amber-500 text-black border-amber-400 font-bold shadow-sm"
                  : "bg-white/5 text-muted hover:text-foreground border-white/10"
              )}
            >
              {kidsPresent ? "🧸 Kids on Couch" : "🌙 Kids in Bed"}
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>
              {kidsPresent
                ? "ReelOS will verify title access; dialogue treatment depends on an available verified track."
                : "Adult-only policy is active for this session."}
            </span>
            <span className="font-mono text-amber-400 font-medium">
              {kidsPresent ? "Family" : "Adults"}
            </span>
          </div>
        </div>

        {/* Tab 1: Dossier & Lore */}
        {activeTab === "dossier" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Title Header Card */}
            <div className="space-y-1.5 border-b border-border/40 pb-5">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[10px] font-mono text-gold font-semibold uppercase">
                  Thoughtful Second Screen
                </span>
                {dossier?.season && dossier?.episode && (
                  <span className="text-xs font-mono text-muted">
                    S{dossier.season} · E{dossier.episode}
                  </span>
                )}
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                {dossier?.title || "Living Room Screen"}
              </h1>
              {dossier?.tagline && (
                <p className="text-xs text-muted/80 italic font-serif">
                  "{dossier.tagline}"
                </p>
              )}

              {dossier?.spoilerShield.active ? (
                <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-400">
                  <Shield className="size-3.5 shrink-0" />
                  <span>Verified through this playback position.</span>
                </div>
              ) : dossier?.message ? (
                <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-xs text-muted">
                  {dossier.message}
                </p>
              ) : null}
            </div>

            {/* 1. The Story So Far */}
            {dossier?.storySoFar && dossier.storySoFar.length > 0 && (
              <section className="rounded-2xl border border-border/80 bg-card/60 p-4.5 space-y-3">
                <div className="flex items-center gap-2 text-gold">
                  <Clock className="size-4" />
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wider">
                    The Story So Far (Catch Me Up)
                  </h2>
                </div>
                <ul className="space-y-2 text-xs text-muted leading-relaxed list-disc list-inside">
                  {dossier.storySoFar.map((bullet, idx) => (
                    <li key={idx} className="pl-1">
                      <span className="text-foreground/90">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 2. Who's Who Character Guide */}
            {dossier?.whoIsWho && dossier.whoIsWho.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-foreground">
                    <User className="size-4 text-gold" />
                    <h2 className="font-display text-sm font-semibold uppercase tracking-wider">
                      Who's Who On Screen?
                    </h2>
                  </div>
                  <span className="text-[10px] text-muted font-mono">1-Sentence Context</span>
                </div>

                <div className="grid gap-2.5">
                  {dossier.whoIsWho.map((char, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/50 p-3.5 backdrop-blur-sm"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold border border-gold/20 overflow-hidden font-bold text-xs">
                        {char.avatar ? (
                          <img src={char.avatar} alt={char.name} className="size-full object-cover" />
                        ) : (
                          char.name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-xs font-bold text-foreground truncate">{char.name}</p>
                          <span className="text-[10px] text-muted/80 truncate font-medium">{char.actor}</span>
                        </div>
                        <p className="text-[11px] text-muted leading-relaxed">{char.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 3. Wait, Why Are They Here? */}
            {dossier?.whyAreTheyHere && (
              <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setOpenWhy(!openWhy)}
                  className="flex items-center justify-between w-full text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2 text-amber-400">
                    <HelpCircle className="size-4" />
                    <h3 className="font-display text-xs font-bold uppercase tracking-wider">
                      Wait, What Is Happening Right Now?
                    </h3>
                  </div>
                  <ChevronDown className={cn("size-4 text-amber-400 transition-transform", openWhy ? "rotate-180" : "")} />
                </button>
                {openWhy && (
                  <p className="text-xs text-foreground/90 leading-relaxed pt-1 border-t border-amber-500/20">
                    {dossier.whyAreTheyHere}
                  </p>
                )}
              </section>
            )}

            {/* 4. Whisper Notes */}
            {dossier?.whisperNotes && dossier.whisperNotes.length > 0 && (
              <section className="rounded-2xl border border-border/60 bg-card/30 p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-muted">
                  <Volume2 className="size-3.5 text-gold/80" />
                  <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-foreground">
                    Whisper Notes & Subtle Details
                  </h3>
                </div>
                <ul className="space-y-1.5 text-[11px] text-muted leading-relaxed">
                  {dossier.whisperNotes.map((note, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-gold font-bold">·</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {/* Tab 2: Velvet Haptic Remote */}
        {activeTab === "remote" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="rounded-3xl border border-border/70 bg-card/70 p-6 backdrop-blur-xl shadow-2xl text-center space-y-6">
              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="text-left">
                  <p className="text-xs font-mono uppercase tracking-wider text-gold font-bold">Living Room Velvet Remote</p>
                  <p className="text-sm font-semibold text-foreground truncate max-w-[200px]">
                    {sessionInfo?.titleName || dossier?.title || "TV Player"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="quiet"
                    onClick={() => handleRoomHandoff("phone")}
                    className="h-8 text-[11px] border border-white/15 px-2.5 text-muted hover:text-white"
                    title="Pull playback to Phone"
                  >
                    Pull Here
                  </Button>
                  <Button
                    size="sm"
                    variant="quiet"
                    onClick={() => handleRoomHandoff("tv")}
                    className="h-8 text-[11px] border border-gold/40 bg-gold/10 px-2.5 text-gold hover:bg-gold/20"
                    title="Send playback to Living Room TV"
                  >
                    Send to TV
                  </Button>
                </div>
              </div>

              {/* Virtual Haptic D-Pad */}
              <div className="flex justify-center py-4">
                <div className="relative size-60 rounded-full bg-zinc-900 border border-white/10 shadow-inner flex items-center justify-center p-2">
                  {/* Up */}
                  <button
                    type="button"
                    onClick={() => sendRemoteCommand("dpad_up")}
                    className="absolute top-2 left-1/2 -translate-x-1/2 flex size-14 items-center justify-center rounded-2xl text-zinc-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                    title="D-Pad Up"
                  >
                    <ChevronUp className="size-6" />
                  </button>

                  {/* Down */}
                  <button
                    type="button"
                    onClick={() => sendRemoteCommand("dpad_down")}
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 flex size-14 items-center justify-center rounded-2xl text-zinc-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                    title="D-Pad Down"
                  >
                    <ChevronDown className="size-6" />
                  </button>

                  {/* Left */}
                  <button
                    type="button"
                    onClick={() => sendRemoteCommand("dpad_left")}
                    className="absolute left-2 top-1/2 -translate-y-1/2 flex size-14 items-center justify-center rounded-2xl text-zinc-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                    title="D-Pad Left"
                  >
                    <ChevronLeft className="size-6" />
                  </button>

                  {/* Right */}
                  <button
                    type="button"
                    onClick={() => sendRemoteCommand("dpad_right")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex size-14 items-center justify-center rounded-2xl text-zinc-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                    title="D-Pad Right"
                  >
                    <ChevronRight className="size-6" />
                  </button>

                  {/* Center OK / Select */}
                  <button
                    type="button"
                    onClick={() => sendRemoteCommand("dpad_select")}
                    className="flex size-20 items-center justify-center rounded-full bg-gold/90 text-black font-bold text-sm shadow-[var(--shadow-gold)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                    title="Select"
                  >
                    OK
                  </button>
                </div>
              </div>

              {/* Playback Controls Row */}
              <div className="flex items-center justify-center gap-4 pt-2 border-t border-border/40">
                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() => sendRemoteCommand("volume", { delta: -10 })}
                  className="size-11 rounded-2xl border border-white/10 text-muted hover:text-foreground"
                  title="Volume Down"
                >
                  <Volume2 className="size-4 opacity-70" />
                </Button>

                <Button
                  size="lg"
                  onClick={() => sendRemoteCommand("toggle")}
                  className="size-14 rounded-full bg-white/15 text-white hover:bg-white/25 active:scale-95 shadow-lg transition-all"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="size-6 fill-current" /> : <Play className="size-6 fill-current ml-0.5" />}
                </Button>

                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() => sendRemoteCommand("volume", { delta: 10 })}
                  className="size-11 rounded-2xl border border-white/10 text-muted hover:text-foreground"
                  title="Volume Up"
                >
                  <Volume2 className="size-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between px-4 text-xs text-muted font-mono">
                <button
                  type="button"
                  onClick={() => sendRemoteCommand("back")}
                  className="hover:text-gold cursor-pointer"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => sendRemoteCommand("mute")}
                  className="hover:text-gold cursor-pointer"
                >
                  Mute
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Standby Art & Sovereign Photo Upload */}
        {activeTab === "standby" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="rounded-3xl border border-border/70 bg-card/60 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-gold/15 text-gold border border-gold/30">
                  <ImageIcon className="size-5" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-foreground">Sovereign Family Photo Wall</h3>
                  <p className="text-xs text-muted">Stored locally on this ReelOS home</p>
                </div>
              </div>

              <p className="text-xs text-muted leading-relaxed">
                Add photos from your camera roll to the TV&apos;s idle Standby Ambiance wall. ReelOS stores these photos on this home and does not include them in taste sharing.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />

              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="w-full h-11 gap-2 rounded-2xl bg-gold text-black font-bold hover:brightness-110"
              >
                <Upload className="size-4" />
                <span>{uploadingPhoto ? "Uploading Photo..." : "Send Photo to TV Wall"}</span>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
