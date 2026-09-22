import React, { useEffect, useState } from "react";
import {
  Palette,
  Smartphone,
  Film,
  Sparkles,
  Volume2,
  Eye,
  EyeOff,
  Cpu,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Shield,
  VolumeX,
  SlidersHorizontal,
  Baby,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { showToast } from "@/lib/toast";
import { ChildProfileWizard } from "./child-profile-wizard";

function Switch({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-amber-500" : "bg-white/15"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

function NeedsConnection({ label = "Needs connection" }: { label?: string }) {
  return (
    <span className="shrink-0 rounded-full bg-white/[.06] px-3 py-1 text-[11px] font-medium text-white/45">
      {label}
    </span>
  );
}

export function CinemaIntelligenceCard() {
  // Visible / Sensory Presentation Toggles (Persisted in localStorage)
  const [ambientEnabled, setAmbientEnabled] = useState(
    () => localStorage.getItem("reelos_feat_ambient") !== "false"
  );
  const [companionEnabled, setCompanionEnabled] = useState(
    () => localStorage.getItem("reelos_feat_companion") !== "false"
  );
  const [commentaryEnabled, setCommentaryEnabled] = useState(
    () => localStorage.getItem("reelos_feat_commentary") !== "false"
  );
  const [catchMeUpEnabled, setCatchMeUpEnabled] = useState(
    () => localStorage.getItem("reelos_feat_catchmeup") !== "false"
  );
  const [bedtimeEnabled, setBedtimeEnabled] = useState(
    () => localStorage.getItem("reelos_feat_bedtime") !== "false"
  );
  const [cinemagraphEnabled, setCinemagraphEnabled] = useState(
    () => localStorage.getItem("reelos_feat_cinemagraph") !== "false"
  );
  const [kinestheticEnabled, setKinestheticEnabled] = useState(
    () => localStorage.getItem("reelos_feat_kinesthetic") !== "false"
  );
  const [soundtrackEnabled, setSoundtrackEnabled] = useState(
    () => localStorage.getItem("reelos_feat_soundtrack") !== "false"
  );

  // Section 69: Family Cinema Shield Configuration
  const [profanityLevel, setProfanityLevel] = useState<number>(() => {
    const saved = localStorage.getItem("reelos_profanity_level");
    return saved !== null ? Number(saved) : 0; // default 0 (Pristine)
  });
  const [blasphemyShield, setBlasphemyShield] = useState<boolean>(() => {
    return localStorage.getItem("reelos_profanity_blasphemy") === "true";
  });
  const [silencingMode, setSilencingMode] = useState<"mute" | "bleep">(() => {
    return (localStorage.getItem("reelos_profanity_mode") as "mute" | "bleep") || "mute";
  });

  // Acoustic Room Auto-Tuning (TruePlay) State
  const [calibratingAcoustics, setCalibratingAcoustics] = useState(false);
  const [acousticProfile, setAcousticProfile] = useState<{
    rt60Seconds?: number;
    targetResponse?: string;
    filterType?: string;
  } | null>(null);

  // Section 70: Child Profile Wizard State
  const [showChildWizard, setShowChildWizard] = useState(false);

  // Live Telemetry & Advanced Drawer
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [paletteColors, setPaletteColors] = useState<string[]>([]);
  const [transcodeStats, setTranscodeStats] = useState<{
    memoryBackend?: string;
    zeroDiskWear?: boolean;
    virtualCenterSteering?: string;
    roomImpulseProfileActive?: boolean;
  } | null>(null);

  useEffect(() => {
    // Fetch live ambient palette preview
    void fetch("/api/ambient/palette", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ok?: boolean; colors?: string[] }>)
      .then((j) => {
        if (j.ok && Array.isArray(j.colors)) {
          setPaletteColors(j.colors);
        }
      })
      .catch(() => {});

    // Fetch transcode stats
    void fetch("/api/transcode/stats", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ok?: boolean; memoryBackend?: string; zeroDiskWear?: boolean; virtualCenterSteering?: string; roomImpulseProfileActive?: boolean }>)
      .then((j) => {
        if (j.ok) setTranscodeStats(j);
      })
      .catch(() => {});
  }, []);

  const updateToggle = (
    key: string,
    val: boolean,
    setter: (v: boolean) => void,
    label: string
  ) => {
    setter(val);
    localStorage.setItem(key, String(val));
    showToast(`${label} ${val ? "Enabled" : "Turned Off"}`, "info");
  };

  const handleProfanityLevelChange = (lvl: number) => {
    setProfanityLevel(lvl);
    localStorage.setItem("reelos_profanity_level", String(lvl));
    const labels = ["Uncensored (Pristine)", "Level 1 (Severe / Slurs)", "Level 2 (Moderate)", "Level 3 (All Mild)"];
    showToast(`Cinema Shield: ${labels[lvl] || "Updated"}`, "info");
  };

  const handleCalibrateAcoustics = async () => {
    setCalibratingAcoustics(true);
    try {
      const res = await fetch("/api/acoustic/impulse-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ measured: false }),
      });
      const data = await res.json();
      if (data.ok && data.profile) {
        setAcousticProfile(data.profile);
        showToast("Acoustic Room Auto-Tuning Calibrated (10-Band Biquad Active)", "success");
      } else {
        showToast(data.error || "A phone microphone measurement is required first.", "error");
      }
    } catch {
      showToast("Could not calibrate acoustics", "error");
    } finally {
      setCalibratingAcoustics(false);
    }
  };

  return (
    <div className="rounded-3xl bg-card p-6 shadow-[var(--shadow-border)] border border-white/5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-medium text-foreground tracking-tight">
              Cinema Presentation & Features
            </h2>
            <p className="text-xs text-muted">
              Sensory experiences for your screen, room lights, and companion devices.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 text-muted text-xs font-medium border border-white/10">
          <span className="size-1.5 rounded-full bg-amber-300" />
          Availability shown below
        </div>
      </div>

      {/* Section 69: The Sovereign Family Cinema Shield */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-white/[0.02] to-white/[0.01] border border-amber-500/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Shield className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Family Cinema Shield (Cuss Word & Dialogue Silencing)
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-300 text-[10px] font-medium border border-amber-400/20">
                  Dialogue balance
                </span>
              </div>
              <p className="text-xs text-muted">
                Applies the chosen dialogue treatment only when aligned audio and subtitle cues are available for this edition.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Audio Silencing:</span>
            <button
              type="button"
              onClick={() => {
                const next = silencingMode === "mute" ? "bleep" : "mute";
                setSilencingMode(next);
                localStorage.setItem("reelos_profanity_mode", next);
                showToast(`Silencing Mode: ${next === "mute" ? "Smooth Micro-Mute" : "Classic Broadcast Bleep"}`, "info");
              }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-foreground border border-white/10 transition-colors"
            >
              {silencingMode === "mute" ? "Smooth Mute (-48dB)" : "Broadcast Bleep"}
            </button>
          </div>
        </div>

        {/* Severity Level Selector */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-foreground">Dialogue Severity Filter:</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { lvl: 0, label: "0: Uncensored", desc: "Original Director's Cut" },
              { lvl: 1, label: "1: Severe Only", desc: "Extreme Slurs & Explicit" },
              { lvl: 2, label: "2: Moderate", desc: "+ Common Expletives" },
              { lvl: 3, label: "3: All Mild", desc: "+ Damn, Hell, Crap" },
            ].map(({ lvl, label, desc }) => {
              const active = profanityLevel === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => handleProfanityLevelChange(lvl)}
                  className={cn(
                    "p-2.5 rounded-xl text-left border transition-all cursor-pointer",
                    active
                      ? "bg-amber-500/20 border-amber-400/50 text-foreground shadow-sm ring-1 ring-amber-400/30"
                      : "bg-white/[0.02] border-white/5 hover:border-white/15 text-muted hover:text-foreground"
                  )}
                >
                  <div className="text-xs font-semibold">{label}</div>
                  <div className="text-[10px] text-muted truncate">{desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Blasphemy Filter Toggle */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
          <div className="flex items-center gap-2">
            <VolumeX className="size-3.5 text-amber-400" />
            <span className="text-foreground font-medium">Deity & Blasphemy Shield</span>
            <span className="text-[11px] text-muted">(Silence religious oaths & taking names in vain)</span>
          </div>
          <Switch
            checked={blasphemyShield}
            onCheckedChange={(val) => {
              setBlasphemyShield(val);
              localStorage.setItem("reelos_profanity_blasphemy", String(val));
              showToast(`Blasphemy Shield ${val ? "Enabled" : "Disabled"}`, "info");
            }}
          />
        </div>
      </div>

      {/* Section 70: Child Profile Training & Dual-Parent Governance */}
      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/20">
              <Baby className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Child Profile & Boundary Training</h3>
                <span className="px-2 py-0.5 rounded-md bg-purple-400/10 text-purple-300 text-[10px] font-medium border border-purple-400/20">
                  Dual-Parent PIN Protected
                </span>
              </div>
              <p className="text-xs text-muted">
                Train ReelOS using the 8-card boundary match game. Curates Discover strictly to your family's tastes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowChildWizard(!showChildWizard)}
            className="px-3.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-xs font-semibold border border-purple-500/30 transition-colors shrink-0 cursor-pointer"
          >
            {showChildWizard ? "Close Trainer" : "Train Profile"}
          </button>
        </div>

        {showChildWizard && (
          <div className="pt-3 border-t border-white/5">
            <ChildProfileWizard onFinished={() => setShowChildWizard(false)} />
          </div>
        )}
      </div>

      {/* Visible Toggles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Acoustic Room Impulse Auto-Tuning (TruePlay) */}
        <div className="flex items-start justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
          <div className="space-y-1.5 pr-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-emerald-400" />
              <span className="text-sm font-medium text-foreground">Acoustic Room Auto-Tuning (TruePlay)</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              10-band biquad parametric EQ synthesized in RAM to neutralize living room reverberation and TV chassis resonance.
            </p>
            {acousticProfile && (
              <div className="text-[11px] text-emerald-400 font-mono">
                ✓ RT60: {acousticProfile.rt60Seconds}s · 10-Band Biquad IIR Active
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={calibratingAcoustics}
            onClick={handleCalibrateAcoustics}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/30 transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
          >
            {calibratingAcoustics ? "Calibrating..." : acousticProfile ? "Recalibrate" : "Calibrate Acoustics"}
          </button>
        </div>

        {/* 1. 16-Color Ambient Room Lighting */}
        <div className="flex items-start justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
          <div className="space-y-1 pr-3">
            <div className="flex items-center gap-2">
              <Palette className="size-4 text-purple-400" />
              <span className="text-sm font-medium text-foreground">16-Color Ambient Room Sync</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Scene-aware physical lighting appears here after a supported Hue, Nanoleaf, or Matter bridge and real frame telemetry are connected.
            </p>
            {ambientEnabled && paletteColors.length > 0 && (
              <div className="flex items-center gap-1 pt-2">
                {paletteColors.slice(0, 12).map((c, i) => (
                  <span
                    key={i}
                    className="size-3.5 rounded-full border border-black/20 shadow-sm transition-transform hover:scale-125"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
          </div>
          <NeedsConnection label="Bridge required" />
        </div>

        {/* 2. Living Cinemagraph Posters */}
        <div className="flex items-start justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
          <div className="space-y-1 pr-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-400" />
              <span className="text-sm font-medium text-foreground">Living Cinemagraph Posters</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Uses a real loop supplied for the title. ReelOS falls back to still artwork instead of fabricating motion.
            </p>
          </div>
          <NeedsConnection label="Assets required" />
        </div>

        {/* 3. Companion Screen Second Screen Lore */}
        <div className="flex items-start justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
          <div className="space-y-1 pr-3">
            <div className="flex items-center gap-2">
              <Smartphone className="size-4 text-amber-300" />
              <span className="text-sm font-medium text-foreground">Companion Screen Dramaturg</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Displays camera lenses, historical context, and actor dossiers synchronously on your phone without cluttering the TV.
            </p>
          </div>
          <Switch
            checked={companionEnabled}
            onCheckedChange={(val) =>
              updateToggle("reelos_feat_companion", val, setCompanionEnabled, "Companion Screen Dramaturg")
            }
          />
        </div>

        {/* 4. Needle-Drop Soundtrack Identifier */}
        <div className="flex items-start justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
          <div className="space-y-1 pr-3">
            <div className="flex items-center gap-2">
              <Film className="size-4 text-pink-400" />
              <span className="text-sm font-medium text-foreground">Needle-Drop Soundtrack Lore</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Shows track and album details only when timestamped soundtrack metadata has been verified for the title.
            </p>
          </div>
          <NeedsConnection label="Metadata required" />
        </div>

        {/* 5. Kinesthetic Subtitle Typography */}
        <div className="flex items-start justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
          <div className="space-y-1 pr-3">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-cyan-400" />
              <span className="text-sm font-medium text-foreground">Kinesthetic Subtitle Typography</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Can shape verified subtitle cues using measured audio energy. Playback integration is still pending.
            </p>
          </div>
          <NeedsConnection label="Playback pending" />
        </div>

        {/* 6. Infinite Director's Commentary */}
        <div className="flex items-start justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
          <div className="space-y-1 pr-3">
            <div className="flex items-center gap-2">
              <Film className="size-4 text-cyan-300" />
              <span className="text-sm font-medium text-foreground">Director's Commentary Overlay</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Planned as a sourced film-scholar perspective. It remains unavailable until the model and title evidence adapters are connected.
            </p>
          </div>
          <NeedsConnection label="Model pending" />
        </div>

        {/* 7. Spoiler-Free 'Catch Me Up' Story Recaps */}
        <div className="flex items-start justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
          <div className="space-y-1 pr-3">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-emerald-400" />
              <span className="text-sm font-medium text-foreground">Spoiler-Free 'Catch Me Up' Recaps</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Will summarize only scenes already watched once a verified scene timeline is available. It never invents a recap.
            </p>
          </div>
          <NeedsConnection label="Timeline required" />
        </div>

        {/* 8. Bedtime Night Listening */}
        <div className="flex items-start justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
          <div className="space-y-1 pr-3">
            <div className="flex items-center gap-2">
              <Volume2 className="size-4 text-blue-400" />
              <span className="text-sm font-medium text-foreground">Bedtime Dialogue Lock</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Compresses sudden action and explosion spikes (-6dB) while holding actor dialogue crystal-clear for quiet night listening.
            </p>
          </div>
          <Switch
            checked={bedtimeEnabled}
            onCheckedChange={(val) =>
              updateToggle("reelos_feat_bedtime", val, setBedtimeEnabled, "Bedtime Dialogue Lock")
            }
          />
        </div>
      </div>

      {/* Safety boundaries remain visible even when optional features are unavailable. */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-muted">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
          <span>
            <strong className="text-foreground font-medium">Playback boundaries:</strong> ReelOS keeps family policy, source access, and playback protection enforced even when optional presentation features are unavailable.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-muted hover:text-foreground transition-colors shrink-0 cursor-pointer"
        >
          {showAdvanced ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {showAdvanced ? "Hide Diagnostics" : "Engine Diagnostics"}
        </button>
      </div>

      {/* Advanced Telemetry Drawer */}
      {showAdvanced && (
        <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between text-muted border-b border-white/5 pb-2">
            <span className="flex items-center gap-1.5 text-foreground font-semibold">
              <Cpu className="size-3.5 text-amber-400" /> Presentation capability status
            </span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="size-3" /> Measured when used
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-muted">Subtitle reading:</span>{" "}
              <span className="text-foreground">Available when a supported subtitle track is present</span>
            </div>
            <div>
              <span className="text-muted">Virtual Center Steering:</span>{" "}
              <span className="text-emerald-400">{transcodeStats?.virtualCenterSteering || "Not reported by this player"}</span>
            </div>
            <div>
              <span className="text-muted">Temporary work:</span>{" "}
              <span className="text-foreground">Uses the configured playback workspace</span>
            </div>
            <div>
              <span className="text-muted">Provider pacing:</span>{" "}
              <span className="text-foreground">Bounded by the active source policy</span>
            </div>
            <div>
              <span className="text-muted">Foreground activity:</span>{" "}
              <span className="text-foreground">Playback and user activity take priority</span>
            </div>
            <div>
              <span className="text-muted">Dialogue filter:</span>{" "}
              <span className="text-foreground">Requires edition-aligned cues</span>
            </div>
            <div>
              <span className="text-muted">Source preparation:</span>{" "}
              <span className="text-foreground">Runs only within storage and machine limits</span>
            </div>
            <div>
              <span className="text-muted">Acoustic TruePlay 10-Band:</span>{" "}
              <span className="text-emerald-400">{transcodeStats?.roomImpulseProfileActive || acousticProfile ? "Calibrated" : "Not calibrated"}</span>
            </div>
            <div>
              <span className="text-muted">Ambient color palette:</span>{" "}
              <span className="text-foreground">Shown only when verified frame colors are available</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
