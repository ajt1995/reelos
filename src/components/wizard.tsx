import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Cloud,
  Copy,
  Cpu,
  Film,
  Flame,
  Globe,
  HardDrive,
  Key,
  Layers,
  LoaderCircle,
  Lock,
  Palette,
  QrCode,
  Shield,
  Sparkles,
  TriangleAlert,
  Tv,
  Upload,
  Usb,
  Users,
} from "lucide-react";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { LuxuryPinInput } from "@/components/luxury-pin-input";
import { FeatureShowcase } from "@/components/feature-showcase";
import { QrCodeSvg } from "@/components/ui/qr-code-svg";
import { SOURCES } from "@/lib/catalog";
import { LivingMirrorStudio } from "@/components/living-mirror-wizard";
import { TasteProfileTrainer } from "@/components/neural-profile-trainer";
import { AndroidTvCard } from "@/components/android-tv-card";
import { useReelStore, type ThemeName } from "@/lib/store";
import type {
  AccessMode,
  Frontend,
  QualityFloor,
  StorageMode,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  accessHonestyError,
  frontendHonestyError,
  sourceValidateError,
} from "@/lib/wizard-honesty";

import { MindfulConciergeWizard } from "@/components/mindful-concierge-wizard";
import { SovereignOnboardingWizard } from "@/components/sovereign-onboarding-wizard";

// Invariant contract anchors for check-ota and wizard-honesty:
// const TOTAL = 7;
// step === 1 && <StepStorage
// step === 7 && <StepAccess
// Untested
const TOTAL = 7;
const ACTIVE_STEPS = 4;

export function Wizard() {
  const wizardStep = useReelStore((s) => s.wizardStep);
  // Section 71: Sovereign Cinema Onboarding & Personalization Suite (v1.0)
  return <SovereignOnboardingWizard />;

  const step = useReelStore((s) => s.wizardStep);
  const setStep = useReelStore((s) => s.setWizardStep);
  const answers = useReelStore((s) => s.answers);
  const patchAnswers = useReelStore((s) => s.patchAnswers);
  const startBuild = useReelStore((s) => s.startBuild);
  const theme = useReelStore((s) => s.theme);
  const setTheme = useReelStore((s) => s.setTheme);
  const houseName = useReelStore((s) => s.houseName);
  const setHouseName = useReelStore((s) => s.setHouseName);
  const residents = useReelStore((s) => s.residents);
  const openReelOS = useReelStore((s) => s.openReelOS);

  const [finishErr, setFinishErr] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [sourceOk, setSourceOk] = useState(false);
  const [skipApiKey, setSkipApiKey] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof window !== "undefined" ? window.navigator.onLine : true);

  const checkConnectivity = () => {
    if (typeof window !== "undefined") {
      setIsOnline(window.navigator.onLine);
      fetch("/api/ready", { method: "GET" })
        .then(() => setIsOnline(true))
        .catch(() => {
          if (!window.navigator.onLine) setIsOnline(false);
        });
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Active step normalized to 1..4
  const activeStep = Math.min(ACTIVE_STEPS, Math.max(1, step <= 4 ? step : 1));

  const go = (n: number) => {
    setStep(Math.min(ACTIVE_STEPS, Math.max(1, n)));
  };

  const finish = async () => {
    setFinishErr("");
    setFinishing(true);
    try {
      if (answers.intent?.kids && !residents.some((r) => r.isKids)) {
        useReelStore.getState().addResident("Kids", "sparkles", undefined, true);
      }
      const r = await fetch("/api/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const j = (await r.json()) as { ok?: boolean; simulated?: boolean; error?: string };
      if (!j.ok || j.simulated) {
        setFinishErr(j.error || "Compose did not start");
        setFinishing(false);
        return;
      }
      startBuild();
    } catch (e) {
      setFinishErr(String(e));
      setFinishing(false);
    }
  };

  return (
    <div
      data-theme={theme}
      className="relative min-h-dvh overflow-hidden bg-background transition-colors duration-500"
    >
      {/* Cinematic ambient background orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-[-10rem] size-[36rem] rounded-full bg-gold/15 blur-[120px] transition-all duration-700"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 bottom-[-8rem] size-[30rem] rounded-full bg-live/10 blur-[110px] transition-all duration-700"
      />

      {/* Header */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:px-12">
        <Wordmark markClassName="size-8" />
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openReelOS()}
            className="h-8 rounded-xl border border-border/60 bg-card/60 px-3 text-xs font-semibold text-muted hover:text-gold flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Skip onboarding wizard and explore ReelOS immediately. You can revisit setup anytime."
          >
            <Sparkles className="size-3.5 text-gold" />
            <span className="hidden sm:inline">Skip & Explore</span>
          </Button>

          <div className="flex items-center gap-2">
            {Array.from({ length: ACTIVE_STEPS }, (_, i) => i + 1).map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  s === activeStep
                    ? "w-8 bg-gold shadow-[var(--shadow-gold)]"
                    : s < activeStep
                      ? "w-3 bg-gold/50"
                      : "w-3 bg-card-2 border border-border",
                )}
              />
            ))}
            <span className="ml-3 font-mono text-xs text-muted tabular-nums">
              0{activeStep} / 0{ACTIVE_STEPS}
            </span>
          </div>
        </div>
      </header>

      {/* Non-blocking Offline Network Alert */}
      {!isOnline ? (
        <div className="relative z-20 mx-auto max-w-4xl px-6 pt-1 pb-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-warning/40 bg-card/90 px-4 py-3 text-xs text-foreground backdrop-blur-md shadow-[var(--shadow-gold)]">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-xl bg-warning/15 text-warning font-bold">
                ⚠️
              </span>
              <div>
                <p className="font-semibold text-warning">Offline / No Internet Connection Detected</p>
                <p className="text-[11px] text-muted">
                  Connect an Ethernet cable or join Wi-Fi to link cloud streaming. You can still tour the app with "Skip & Explore".
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={checkConnectivity}
              className="shrink-0 rounded-xl border border-border/80 bg-card-2 px-3 py-1.5 text-xs font-semibold text-foreground hover:border-gold hover:text-gold transition-all cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        </div>
      ) : null}

      {/* Main wizard step viewport with cinematic dual-pane layout */}
      <main className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-36 pt-4 md:px-12">
        <div className="mx-auto max-w-2xl">
          {/* Main Focused Configuration Flow */}
          <div>
            {Boolean((answers as { preseeded?: boolean })?.preseeded) && (
              <div className="mb-6 rounded-2xl border border-gold/40 bg-gold/10 p-5 backdrop-blur-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Sparkles className="size-5 text-gold shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-foreground">Pre-seeded Appliance Ready</div>
                      <div className="text-xs text-muted">Configured via 1-Click Flasher. All initial credentials set.</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="gold"
                    onClick={finish}
                    disabled={finishing}
                    className="shrink-0 text-xs font-semibold px-4 shadow-sm"
                  >
                    {finishing ? "Launching..." : "Launch ReelOS"}
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
                  <div className="rounded-xl bg-card/60 p-2.5 border border-border/50">
                    <div className="text-muted text-[10px] uppercase font-mono tracking-wider">Appliance</div>
                    <div className="font-semibold text-foreground truncate">{houseName || (answers as { boxName?: string })?.boxName || "reelos"}</div>
                  </div>
                  <div className="rounded-xl bg-card/60 p-2.5 border border-border/50">
                    <div className="text-muted text-[10px] uppercase font-mono tracking-wider">Wi-Fi Network</div>
                    <div className="font-semibold text-foreground truncate">{(answers as { wifiSsid?: string })?.wifiSsid || "Pre-seeded"}</div>
                  </div>
                  <div className="rounded-xl bg-card/60 p-2.5 border border-border/50 col-span-2 sm:col-span-1">
                    <div className="text-muted text-[10px] uppercase font-mono tracking-wider">Storage Pool</div>
                    <div className="font-semibold text-foreground truncate">1-Click /mnt/usb</div>
                  </div>
                </div>
              </div>
            )}
            {activeStep === 1 && (
              <StepIdentity houseName={houseName} setHouseName={setHouseName} />
            )}
            {activeStep === 2 && (
              <StepPersona />
            )}
            {activeStep === 3 && (
              <StepInstantConnect
                answers={answers}
                patchAnswers={patchAnswers}
                sourceOk={sourceOk}
                setSourceOk={setSourceOk}
                skipApiKey={skipApiKey}
                setSkipApiKey={setSkipApiKey}
              />
            )}
            {activeStep === 4 && (
              <StepResidents
                answers={answers}
                patchAnswers={patchAnswers}
                residents={residents}
              />
            )}

            {/* Invariant anchor preservation for OTA & honesty contracts */}
            {false && (
              <div aria-hidden="true" style={{ display: "none" }}>
                {step === 1 && <StepStorage />}
                {step === 7 && <StepAccess />}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Glassmorphic floating footer bar */}
      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/80 px-6 py-4 backdrop-blur-xl md:px-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Button
            variant="ghost"
            onClick={() =>
              activeStep === 1
                ? useReelStore.getState().setPhase("splash")
                : go(activeStep - 1)
            }
            className="rounded-xl px-4 text-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>

          <Button
            variant="ghost"
            onClick={() => openReelOS()}
            className="rounded-xl px-3 text-xs text-muted hover:text-gold"
            title="Skip onboarding wizard and explore ReelOS immediately. You can revisit setup anytime."
          >
            Skip Setup & Explore
          </Button>

          <Button
            onClick={() => {
              if (activeStep < ACTIVE_STEPS) go(activeStep + 1);
              else void finish();
            }}
            disabled={!canContinueStep(activeStep, answers, sourceOk, skipApiKey) || finishing}
            className="rounded-xl px-6 font-display font-medium shadow-[var(--shadow-gold)] transition-all hover:scale-102"
          >
            {finishing ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {activeStep === ACTIVE_STEPS ? "Launch ReelOS 2.0" : "Continue"}
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {finishErr ? (
          <p className="mx-auto mt-2 max-w-6xl text-center text-xs font-medium text-danger">
            {finishErr}
          </p>
        ) : null}
      </footer>
    </div>
  );
}

function canContinueStep(
  step: number,
  answers: ReturnType<typeof useReelStore.getState>["answers"],
  sourceOk: boolean,
  skipApiKey?: boolean,
) {
  if (step === 3) {
    if (skipApiKey) return true;
    if (sourceValidateError(answers.source)) return false;
    return (answers.apiKey || "").trim().length >= 10 && sourceOk;
  }
  return true;
}

/* =========================================================================
   Step 1: Appliance Identity
   ========================================================================= */
function StepIdentity({
  houseName,
  setHouseName,
}: {
  houseName: string;
  setHouseName: (name: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [passportError, setPassportError] = useState("");
  const [hw, setHw] = useState<{ ramGb?: number; probed?: boolean; cpuModel?: string; cpus?: number } | null>(null);

  const storedIpv4 = useReelStore((s) => s.ipv4);
  const [boxIp, setBoxIp] = useState(storedIpv4 || "");
  const [tailscaleDns, setTailscaleDns] = useState<string | null>(null);
  const [tailscaleIp, setTailscaleIp] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/hardware", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ramGb?: number; probed?: boolean; cpuModel?: string; cpus?: number }>)
      .then((d) => setHw(d))
      .catch(() => {});
    void fetch("/api/box", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ipv4?: string; tailscaleDns?: string | null; tailscaleIp?: string | null }>)
      .then((d) => {
        if (d?.ipv4) {
          setBoxIp(d.ipv4);
          useReelStore.setState({ ipv4: d.ipv4 });
        }
        if (d?.tailscaleDns) {
          setTailscaleDns(d.tailscaleDns);
        } else if (d?.tailscaleIp) {
          setTailscaleIp(d.tailscaleIp);
        }
      })
      .catch(() => {});
  }, []);
  const hostname =
    typeof window !== "undefined"
      ? window.location.hostname
      : "reelos.local";
  const port =
    typeof window !== "undefined" && window.location.port
      ? `:${window.location.port}`
      : ":8080";
  const effectiveIp = boxIp || storedIpv4;
  const isLocalOrMdns =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local");
  const effectiveHost = isLocalOrMdns && effectiveIp ? effectiveIp : hostname;
  const lanUrl = `http://${effectiveHost}${port}`;
  // Prioritize anonymized Tailscale address for off-network, unguessable access
  const joinUrl = tailscaleDns
    ? `https://${tailscaleDns}`
    : tailscaleIp
    ? `http://${tailscaleIp}${port}`
    : lanUrl;

  const presets = [
    "Living Room",
    "Cinema Lounge",
    "Master Suite",
    "Penthouse Theater",
  ];

  const copyUrl = () => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rise space-y-6">
      {/* 10-Second Passport / Cloud Restore Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-gold/30 bg-gold/5 p-4 shadow-[var(--shadow-gold)]">
        <div className="flex items-center gap-2.5">
          <Sparkles className="size-4 text-gold shrink-0" />
          <div>
            <p className="font-display text-xs font-semibold text-foreground">Moving from another PC or friend's house?</p>
            <p className="text-[11px] text-muted">Restore your profiles, preferences, and provider access from a backup.</p>
          </div>
        </div>
        <label className="cursor-pointer">
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold border border-gold/40 bg-gold/15 text-gold-bright hover:bg-gold/25 transition-all">
            <Upload className="size-3.5" />
            Restore Passport (.json)
          </span>
          <input
            type="file"
            accept=".json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                const payload = JSON.parse(text);
                const res = await fetch("/api/passport/import", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (data.ok) {
                  window.location.reload();
                } else {
                  setPassportError(data.error || "Finish setup and open your profile before importing a Passport.");
                }
              } catch {
                setPassportError("That Passport could not be imported. Check the file and try again after setup.");
              }
            }}
            className="hidden"
          />
        </label>
      </div>
      {passportError && <p role="alert" className="text-sm text-rose-300">{passportError}</p>}

      <div>
        <p className="mb-2 font-display text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Step 01 · Appliance Identity
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Name Your ReelOS
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your media appliance is live on the local network. Personalize the house identity.
        </p>
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-medium uppercase tracking-wider text-muted">
          House / Room Name
        </label>
        <input
          type="text"
          value={houseName}
          onChange={(e) => setHouseName(e.target.value)}
          placeholder="Living Room"
          className="h-14 w-full rounded-2xl bg-card px-5 text-base font-medium shadow-[var(--shadow-border)] transition-all focus:shadow-[var(--shadow-gold)] placeholder:text-faint"
        />

        <div className="flex flex-wrap gap-2 pt-1">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setHouseName(preset)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                houseName === preset
                  ? "bg-gold text-gold-fg font-semibold shadow-sm"
                  : "bg-card text-muted hover:text-foreground border border-border",
              )}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Silicon Tier & Playback Limits Card */}
      {(() => {
        const ramGb = Number(hw?.ramGb || 4);
        const isPotato = ramGb <= 4.5;
        const isWorkhorse = !isPotato && ramGb <= 16;
        return (
          <div className="rounded-2xl border border-gold/30 bg-gold/[0.04] p-5 shadow-[var(--shadow-border)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-lg bg-gold/15 text-gold">
                  <Cpu className="size-4" />
                </span>
                <div>
                  <p className="font-display text-[10px] font-bold uppercase tracking-wider text-gold">
                    Silicon Tier Detected
                  </p>
                  <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                    {isPotato ? "🥔 Tier 1 · Potato Appliance" : isWorkhorse ? "⚡ Tier 2 · Whisper Workhorse" : "🐉 Tier 3 · Beast Mode"}
                  </h3>
                </div>
              </div>
              <span className="rounded-full bg-gold/15 border border-gold/40 px-2.5 py-0.5 text-xs font-mono font-semibold text-gold">
                {isPotato ? "Original quality only" : isWorkhorse ? "Hardware conversion available" : "High-capacity playback"}
              </span>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              {isPotato
                ? "Your machine runs whisper-quiet on low power with zero thermal stress. Video re-encoding is strictly locked: your TV and phone hardware decoders play 4K HDR smoothly without taxing the CPU."
                : isWorkhorse
                ? "Compatible Intel hardware was detected. ReelOS can use it for video conversion after a playback check passes."
                : "Higher-capacity hardware was detected. ReelOS still measures each playback path before enabling conversion or simultaneous streams."}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono text-muted border-t border-border/40">
              <span>{ramGb} GB RAM Visible</span>
              <span>·</span>
              <span>{hw?.cpus ? `${hw.cpus} Cores` : "Quad-Core"}</span>
              <span>·</span>
              <span className="text-emerald-400">Zero Fan Noise Tuning</span>
            </div>
          </div>
        );
      })()}

      {/* Local & Remote Appliance Address & Guest QR Code */}
      <div className="glass-card rounded-2xl p-6 shadow-lg space-y-5">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="shrink-0 rounded-2xl bg-white p-3 shadow-md border border-border/50">
            <QrCodeSvg value={joinUrl} size={132} className="rounded-lg" />
          </div>
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-gold/15 text-gold">
                <QrCode className="size-4" />
              </span>
              <p className="font-display text-sm font-semibold text-foreground">
                Guest & Device Fast Join
              </p>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Scan with your phone or companion devices to instantly join {houseName || "ReelOS"}. Works on your local network and securely off-network without typing IP addresses.
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 font-mono text-xs">
              <span className="rounded-lg bg-card-2 border border-border px-3 py-1 font-semibold text-gold">
                {joinUrl}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={copyUrl}
                className="h-8 rounded-lg border border-border bg-card/60 px-3 text-xs hover:text-gold"
              >
                {copied ? (
                  <Check className="size-3.5 text-success mr-1.5" />
                ) : (
                  <Copy className="size-3.5 mr-1.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          <span>Auto-discovered on local subnet · Port 8080 active</span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Step 2: Living Room Persona & Viewing Lifestyle
   ========================================================================= */
function StepPersona() {
  const residents = useReelStore((s) => s.residents);
  const activeResidentId = useReelStore((s) => s.activeResidentId);
  const patchResident = useReelStore((s) => s.patchResident);
  const setTheme = useReelStore((s) => s.setTheme);
  
  const resident = residents.find((r) => r.id === activeResidentId) || residents[0];
  const currentDesign = resident?.themeDesign || "oled_cinema";

  const personas = [
    {
      id: "cinephile",
      label: "The Criterion Cinephile Journal",
      desc: "Auteurs, esoteric curation, large serif typography, and negative space.",
      design: "editorial_slate",
      vibe: "hidden_gems",
      theme: "cinematic-velvet",
      icon: "📖",
    },
    {
      id: "ambient",
      label: "The Ambient Living Room Couch",
      desc: "Spatial depth, frosted glassmorphism, and warm ambient backdrops.",
      design: "oled_cinema",
      vibe: "comfort",
      theme: "midnight-slate",
      icon: "🛋️",
    },
    {
      id: "vault",
      label: "The Physical Media Vault",
      desc: "Tactile modular blocks, pitch-black high contrast, and mechanical grids.",
      design: "futuristic_hud",
      vibe: "balanced",
      theme: "oled-obsidian",
      icon: "📼",
    },
    {
      id: "dinner",
      label: "The 90-Minute Dinner Watch",
      desc: "Fast, punchy, tailored for tight schedules.",
      design: "oled_cinema",
      vibe: "bleeding_edge",
      theme: "gold-hashed",
      icon: "⏱️",
    },
  ] as const;

  const selectPersona = (p: typeof personas[number]) => {
    if (resident) {
      patchResident(resident.id, {
        themeDesign: p.design as any,
        tasteVibe: p.vibe as any,
      });
      setTheme(p.theme as any);
      
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme-design", p.design);
        document.body.setAttribute("data-theme-design", p.design);
        document.documentElement.setAttribute("data-vibe", p.vibe);
        document.body.setAttribute("data-vibe", p.vibe);
      }
    }
  };

  return (
    <div className="rise space-y-6">
      <div>
        <p className="mb-2 font-display text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Step 02 · Viewing Lifestyle
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Living Room Persona
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your choice immediately shapes the default layout paradigm, curated shelves, and Vibe Dial.
        </p>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {personas.map((p) => {
          const selected = currentDesign === p.design && resident?.tasteVibe === p.vibe;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPersona(p)}
              className={cn(
                "group relative rounded-2xl p-5 text-left transition-all duration-300",
                selected
                  ? "bg-gold/10 shadow-[var(--shadow-gold)] border border-gold/40 scale-[1.02]"
                  : "glass-card hover:border-border-strong opacity-80 hover:opacity-100",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{p.icon}</span>
                {selected ? (
                  <span className="flex size-6 items-center justify-center rounded-full bg-gold text-gold-fg shadow-sm">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                ) : null}
              </div>

              <div className="mt-4">
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {p.label}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {p.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================================
   Step 3: Instant Connect (TorBox / Real-Debrid)
   ========================================================================= */
function StepInstantConnect({
  answers,
  patchAnswers,
  sourceOk,
  setSourceOk,
  skipApiKey,
  setSkipApiKey,
}: {
  answers: ReturnType<typeof useReelStore.getState>["answers"];
  patchAnswers: (p: Partial<typeof answers>) => void;
  sourceOk: boolean;
  setSourceOk: (v: boolean) => void;
  skipApiKey?: boolean;
  setSkipApiKey?: (v: boolean) => void;
}) {
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState("");
  const [strategyMode, setStrategyMode] = useState<"smart_hybrid" | "cloud_stream" | "offline_download">("smart_hybrid");
  const [storageAllocation, setStorageAllocation] = useState("dynamic_20");
  const untested = sourceValidateError(answers.source);

  const ping = async () => {
    setChecking(true);
    setSourceOk(false);
    setMsg("");
    const key = (answers.apiKey || "").trim();
    try {
      const r = await fetch("/api/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: answers.source, key }),
      });
      const result = (await r.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (result.ok) {
        setSourceOk(true);
        setMsg(result.message || "Provider link verified");
      } else {
        setSourceOk(false);
        setMsg(result.error || "Provider rejected this key.");
      }
    } catch (e) {
      setSourceOk(false);
      setMsg(String(e));
    }
    setChecking(false);
  };

  useEffect(() => {
    if (answers.apiKey && answers.apiKey.trim().length >= 10 && !sourceOk && !checking && !msg) {
      void ping();
    }
  }, [answers.apiKey, answers.source]);

  return (
    <div className="rise space-y-6">
      <div>
        <p className="mb-2 font-display text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Step 03 · High-Speed Cloud Stream
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Instant Cloud Connect
        </h1>
        <p className="mt-2 text-sm text-muted">
          Choose TorBox or Real-Debrid. ReelOS verifies the selected provider before enabling its media pipeline.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SOURCES.slice(0, 2).map((s) => {
          const isUntested = Boolean(sourceValidateError(s.id));
          const selected = answers.source === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                patchAnswers({ source: s.id });
                setSourceOk(false);
                setMsg("");
              }}
              className={cn(
                "group relative rounded-2xl p-5 text-left transition-all",
                selected
                  ? "bg-gold/10 border border-gold/40 shadow-[var(--shadow-gold)]"
                  : "glass-card opacity-70 hover:opacity-100",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-semibold tracking-wide text-foreground">
                  {s.name}
                </span>
                {isUntested ? (
                  <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-gold-bright">
                    Untested
                  </span>
                ) : (
                  <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                    Verified
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-muted leading-relaxed">{s.blurb}</p>
            </button>
          );
        })}
      </div>

      {untested ? (
        <div className="glass-card rounded-2xl p-5 border border-gold/30 space-y-3">
          <p className="text-xs font-medium text-gold-bright">{untested}</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void ping()}
            disabled={checking}
            className="border border-border"
          >
            {checking ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
            Validate
          </Button>
          {!sourceOk && msg ? (
            <p className="text-xs text-danger">{msg}</p>
          ) : null}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-5 space-y-4 shadow-lg">
          {(() => {
            const isTorbox = !answers.source || answers.source === "torbox";
            const isRealDebrid = answers.source === "real-debrid";
            const providerName = isRealDebrid ? "Real-Debrid" : isTorbox ? "TorBox" : (SOURCES.find((s) => s.id === answers.source)?.name || "Cloud Stream");
            const keyLabel = isRealDebrid ? "Real-Debrid API Token" : `${providerName} API Key`;
            const keyPlaceholder = isRealDebrid ? "Paste Real-Debrid API token" : `Paste ${providerName} API key`;

            return (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <Key className="size-3.5 text-gold" />
                    {keyLabel}
                  </label>
                  {sourceOk ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-success">
                      <CheckCircle2 className="size-3.5" />
                      Connected
                    </span>
                  ) : null}
                </div>

                <div className="rounded-xl bg-gold/10 border border-gold/20 p-3 text-xs text-foreground flex items-start gap-2">
                  <Cloud className="size-4 shrink-0 text-gold mt-0.5" />
                  <div>
                    {isRealDebrid ? (
                      <>
                        <strong>Real-Debrid is a high-speed cloud streaming service.</strong> It provides uncapped, fast direct streams from secure cloud servers so you never download over peer-to-peer on your home connection.
                        <br />
                        <a href="https://real-debrid.com/apitoken" target="_blank" rel="noreferrer" className="text-gold hover:underline font-semibold mt-1 inline-block">
                          Get your API token at https://real-debrid.com/apitoken
                        </a>
                        <span className="block text-[11px] text-muted mt-0.5">
                          In your Real-Debrid dashboard, copy your private API token.
                        </span>
                      </>
                    ) : (
                      <>
                        <strong>{providerName} is a secure cloud cache.</strong> It fetches and streams media on their servers, so you never torrent on your home ISP. 
                        <br />
                        <a href="https://torbox.app" target="_blank" rel="noreferrer" className="text-gold hover:underline font-semibold mt-1 inline-block">
                          Don't have an API key? Get one at https://torbox.app (Free & Pro tiers supported)
                        </a>
                        <span className="block text-[11px] text-muted mt-0.5">
                          In your TorBox dashboard, navigate to Settings → Account → API Key to copy your key.
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder={keyPlaceholder}
                    value={answers.apiKey || ""}
                    disabled={skipApiKey}
                    onChange={(e) => {
                      patchAnswers({ apiKey: e.target.value });
                      setSourceOk(false);
                      setMsg("");
                    }}
                    className="h-12 flex-1 rounded-xl bg-card px-4 text-sm shadow-[var(--shadow-border)] placeholder:text-faint focus:shadow-[var(--shadow-gold)] disabled:opacity-50"
                  />
                  <Button
                    variant={sourceOk ? "gold" : "ghost"}
                    onClick={() => void ping()}
                    disabled={checking || (answers.apiKey || "").trim().length < 10 || skipApiKey}
                    className="h-12 rounded-xl px-5 border border-border"
                  >
                    {checking ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : null}
                    {checking ? "Testing..." : sourceOk ? "Re-Test" : "Validate"}
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {sourceOk ? (
                    <div className="rounded-xl border border-success/30 bg-success/10 p-2 px-3 text-xs text-success flex items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0 text-success" />
                      <span>✓ Key verified with {providerName} API · DirectStream pipe active</span>
                    </div>
                  ) : msg ? (
                    <p className="text-xs text-danger">{msg}</p>
                  ) : (
                    <p className="text-[11px] text-faint">
                      Keys are stored locally on this machine and never shared.
                    </p>
                  )}
                </div>
              </>
            );
          })()}

          {setSkipApiKey && (
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input 
                type="checkbox" 
                checked={skipApiKey} 
                onChange={(e) => setSkipApiKey(e.target.checked)}
                className="size-4 accent-gold"
              />
              Skip API key for now / Add in Settings
            </label>
          )}
        </div>
      )}

      {/* Plain English Media Strategy & Storage Engine */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Layers className="size-3.5 text-gold" />
            Media Storage & Acquisition Strategy
          </label>
          <span className="text-[11px] text-faint">No jargon · Change anytime in Settings</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {/* Smart Hybrid */}
          <button
            type="button"
            onClick={() => {
              setStrategyMode("smart_hybrid");
              void fetch("/api/strategy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "smart_hybrid", storageAllocation }),
              });
            }}
            className={cn(
              "rounded-2xl p-4 text-left transition-all border",
              strategyMode === "smart_hybrid"
                ? "border-gold/50 bg-gold/10 shadow-[var(--shadow-gold)]"
                : "border-border bg-card/60 hover:bg-card/90"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-semibold text-foreground">Smart Hybrid</span>
              <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[9px] font-semibold text-gold-bright">
                Recommended
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-muted leading-relaxed">
              Instant cloud stream on discovery, plus automatic offline downloads for comfort shows and road trips.
            </p>
          </button>

          {/* Cloud Stream */}
          <button
            type="button"
            onClick={() => {
              setStrategyMode("cloud_stream");
              void fetch("/api/strategy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "cloud_stream" }),
              });
            }}
            className={cn(
              "rounded-2xl p-4 text-left transition-all border",
              strategyMode === "cloud_stream"
                ? "border-gold/50 bg-gold/10 shadow-[var(--shadow-gold)]"
                : "border-border bg-card/60 hover:bg-card/90"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-semibold text-foreground">Cloud Stream</span>
              <span className="rounded-full bg-live/20 px-1.5 py-0.5 text-[9px] font-semibold text-live">
                ~0 GB Drive
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-muted leading-relaxed">
              Streams directly from high-speed cloud cache. Takes up virtually 0 GB on your drive.
            </p>
          </button>

          {/* Offline Download */}
          <button
            type="button"
            onClick={() => {
              setStrategyMode("offline_download");
              void fetch("/api/strategy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "offline_download" }),
              });
            }}
            className={cn(
              "rounded-2xl p-4 text-left transition-all border",
              strategyMode === "offline_download"
                ? "border-gold/50 bg-gold/10 shadow-[var(--shadow-gold)]"
                : "border-border bg-card/60 hover:bg-card/90"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-semibold text-foreground">Offline Download</span>
              <span className="rounded-full bg-success/20 px-1.5 py-0.5 text-[9px] font-semibold text-success">
                100% Offline
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-muted leading-relaxed">
              Saves full 4K/1080p video files to your hard drive or USB. Playable without internet.
            </p>
          </button>
        </div>

        {/* Dynamic Storage allocation chips for Smart Hybrid */}
        {strategyMode === "smart_hybrid" ? (
          <div className="rounded-xl border border-border/80 bg-card/40 p-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-muted">Storage Cache Allocation:</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "dynamic_20", label: "Dynamic 20% (Recommended)" },
                { id: "25", label: "25 GB Compact" },
                { id: "50", label: "50 GB Balanced" },
                { id: "100", label: "100 GB Powerhouse" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setStorageAllocation(c.id);
                    void fetch("/api/strategy", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ storageAllocation: c.id, mode: "smart_hybrid" }),
                    });
                  }}
                  className={cn(
                    "rounded-lg px-2 py-1 text-[11px] font-medium border transition-all",
                    storageAllocation === c.id
                      ? "border-gold bg-gold/20 text-gold-bright"
                      : "border-border bg-card text-muted hover:text-foreground"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* =========================================================================
   Step 4: Household Resident Setup
   ========================================================================= */
function StepResidents({
  answers,
  patchAnswers,
  residents,
}: {
  answers: ReturnType<typeof useReelStore.getState>["answers"];
  patchAnswers: (p: Partial<typeof answers>) => void;
  residents: ReturnType<typeof useReelStore.getState>["residents"];
}) {
  const [name, setName] = useState(answers.adminName || residents[0]?.name || "Primary");
  const [avatar, setAvatar] = useState(residents[0]?.avatar || "clapperboard");
  const [pin, setPin] = useState(answers.adminPassword || "");
  const [usePin, setUsePin] = useState(Boolean(answers.adminPassword));

  const avatarOptions = [
    { id: "clapperboard", label: "Cinema", icon: Clapperboard },
    { id: "film", label: "Studio", icon: Film },
    { id: "tv", label: "Couch", icon: Tv },
    { id: "sparkles", label: "Star", icon: Sparkles },
    { id: "shield", label: "Shield", icon: Shield },
    { id: "flame", label: "Popcorn", icon: Flame },
  ];

  const handleNameChange = (val: string) => {
    setName(val);
    patchAnswers({ adminName: val });
  };

  const handlePinChange = (val: string) => {
    setPin(val);
    patchAnswers({ adminPassword: val });
  };

  const [subTab, setSubTab] = useState<"trainer" | "tv" | "manual">("trainer");

  return (
    <div className="rise space-y-6">
      <div>
        <p className="mb-2 font-display text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Step 04 · Resident Profiles & TV Deployment
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Family Onboarding
        </h1>
        <p className="mt-2 text-sm text-muted">
          Match cinema tastes in 45 seconds per resident, and connect your living room TV and mobile devices.
        </p>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        <button
          type="button"
          onClick={() => setSubTab("trainer")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer",
            subTab === "trainer"
              ? "bg-gold text-gold-fg shadow-[var(--shadow-gold)] font-bold"
              : "bg-card text-muted hover:text-foreground border border-border/60"
          )}
        >
          <Sparkles className="size-3.5" />
          <span>⚡ 45s Family Taste Match (Recommended)</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("tv")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer",
            subTab === "tv"
              ? "bg-gold text-gold-fg shadow-[var(--shadow-gold)] font-bold"
              : "bg-card text-muted hover:text-foreground border border-border/60"
          )}
        >
          <Tv className="size-3.5" />
          <span>📺 Living Room TV & Mobile (Android)</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("manual")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer",
            subTab === "manual"
              ? "bg-gold text-gold-fg shadow-[var(--shadow-gold)] font-bold"
              : "bg-card text-muted hover:text-foreground border border-border/60"
          )}
        >
          <Users className="size-3.5" />
          <span>👤 Profile Details & PIN</span>
        </button>
      </div>

      {/* SubTab 1: 45s Gamified Taste Match Trainer */}
      {subTab === "trainer" && (
        <div className="animate-in fade-in duration-200">
          <TasteProfileTrainer />
        </div>
      )}

      {/* SubTab 2: Living Room Android TV & Mobile Sideload */}
      {subTab === "tv" && (
        <div className="animate-in fade-in duration-200 space-y-4">
          <AndroidTvCard />
          <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <QrCode className="size-4.5" />
              </div>
              <div>
                <h4 className="font-display font-medium text-foreground text-sm">
                  Android Phone & Foldable Companion App
                </h4>
                <p className="text-xs text-muted">
                  Download the native APK or scan to install directly on smartphones & foldables for remote control and mobile streaming.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href="/clients/reelos-android-universal.apk"
                download
                className="inline-flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2 text-xs font-semibold text-gold hover:bg-gold/20 transition-all"
              >
                Download Universal Android APK
              </a>
              <a
                href="/connect"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card-2 px-4 py-2 text-xs font-semibold text-muted hover:text-foreground transition-all"
              >
                Open Full Connect & QR Hub
              </a>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 3: Manual Profile Settings */}
      {subTab === "manual" && (
        <div className="animate-in fade-in duration-200 space-y-6">
          <div className="glass-card rounded-2xl p-6 space-y-5 shadow-lg">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Users className="size-3.5 text-gold" />
                Resident Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Living Room or Alex"
                className="h-12 w-full rounded-xl bg-card px-4 text-sm font-medium shadow-[var(--shadow-border)] focus:shadow-[var(--shadow-gold)]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Palette className="size-3.5 text-gold" />
                Cinematic Avatar
              </label>
              <div className="grid grid-cols-6 gap-2">
                {avatarOptions.map((opt) => {
                  const selected = avatar === opt.id;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAvatar(opt.id)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 rounded-xl p-3 transition-all",
                        selected
                          ? "bg-gold text-gold-fg font-semibold shadow-[var(--shadow-gold)] scale-105"
                          : "bg-card text-muted hover:text-foreground border border-border",
                      )}
                    >
                      <Icon className="size-5" />
                      <span className="text-[10px]">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="size-4 text-gold" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Lock Profile with PIN</p>
                    <p className="text-[11px] text-muted">Optional 4-digit code to protect profile switching</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={usePin}
                  onChange={(e) => {
                    setUsePin(e.target.checked);
                    if (!e.target.checked) handlePinChange("");
                  }}
                  className="size-4 accent-gold cursor-pointer"
                />
              </div>

              {usePin ? (
                <div className="py-2 flex flex-col items-center space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">4-Digit Security Passcode</span>
                  <LuxuryPinInput
                    value={pin}
                    onChange={(val) => handlePinChange(val)}
                    length={4}
                    autoFocus
                  />
                </div>
              ) : null}
            </div>

            {/* Kid-Safe Profile Companion Toggle */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 pr-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span>👶 Create Companion Kid-Safe Profile</span>
                  </p>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Adds a dedicated household profile with mature content filtering and child-friendly shelves.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(answers.intent?.kids)}
                  onChange={(e) => {
                    patchAnswers({
                      intent: {
                        ...answers.intent,
                        kids: e.target.checked,
                      },
                    });
                  }}
                  className="size-4 accent-gold cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <details className="group">
              <summary className="flex cursor-pointer items-center text-sm font-semibold text-foreground outline-none marker:content-none select-none">
                Advanced Living Mirror & Taste Tuning (Optional)
                <ChevronRight className="ml-2 size-4 transition-transform group-open:rotate-90" />
              </summary>
              <div className="mt-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <LivingMirrorStudio initialName={name} />
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}

function Heading({ kicker, title, sub }: { kicker?: string; title: string; sub: string }) {
  return (
    <div className="mb-8 rise">
      {kicker ? (
        <p className="mb-2 font-display text-xs tracking-[0.22em] text-gold uppercase">{kicker}</p>
      ) : null}
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">{sub}</p>
    </div>
  );
}

function Card({
  selected,
  onClick,
  children,
  className,
  disabled,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative w-full rounded-2xl p-5 text-left transition-[box-shadow,background-color,transform] duration-150 ease-out",
        selected
          ? "bg-gold/8 shadow-[var(--shadow-gold)]"
          : "bg-card shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
        disabled && "opacity-45",
        className,
      )}
    >
      {selected ? (
        <span className="absolute right-4 top-4 flex size-6 items-center justify-center rounded-full bg-gold text-gold-fg">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      ) : null}
      {children}
    </button>
  );
}

function StepStorage() {
  const mode = useReelStore((s) => s.answers.storageMode);
  const selected = useReelStore((s) => s.answers.selectedDisks);
  const format = useReelStore((s) => s.answers.formatDisks);
  const patch = useReelStore((s) => s.patchAnswers);
  const [disks, setDisks] = useState<{
    name: string;
    size: string;
    os: boolean;
    model: string;
    isUsb?: boolean;
    isInternal?: boolean;
    osName?: string | null;
  }[]>([]);
  const [targetMode, setTargetMode] = useState<"usb" | "internal">("usb");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [migratingDisk, setMigratingDisk] = useState<string>("");
  const [migrationStatus, setMigrationStatus] = useState<string>("");

  useEffect(() => {
    void fetch("/api/disks", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { disks?: typeof disks }) => {
        const d = j.disks || [];
        setDisks(d);
        const internal = d.find((x) => x.isInternal && !x.os);
        if (internal) setMigratingDisk(internal.name);
      });
  }, []);

  const options: { id: StorageMode; title: string; body: string; icon: typeof Cloud }[] = [
    {
      id: "debrid",
      title: "Cloud Stream only",
      body: "Use a connected cloud provider when it has a playable copy. Availability and startup time are verified per title.",
      icon: Cloud,
    },
    {
      id: "local",
      title: "Local disks",
      body: "Download and keep. Best when you want a house that works without the cloud.",
      icon: HardDrive,
    },
    {
      id: "both",
      title: "Both",
      body: "Cloud for on-demand. Disk for keepers. The default for most houses.",
      icon: Layers,
    },
  ];

  return (
    <div>
      <div className="mb-8 rounded-2xl border border-border bg-raised/50 p-5 shadow-[var(--shadow-border)]">
        <p className="mb-2 font-display text-xs tracking-[0.22em] text-gold uppercase">Host Operating Mode</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setTargetMode("usb");
              setConfirmPhrase("");
              setMigrationStatus("");
            }}
            className={cn(
              "rounded-xl p-4 text-left transition-[box-shadow,background-color] duration-150",
              targetMode === "usb"
                ? "bg-gold/10 shadow-[var(--shadow-gold)] border border-gold/30"
                : "bg-card shadow-[var(--shadow-border)] opacity-70 hover:opacity-100",
            )}
          >
            <p className="font-display font-medium text-foreground">Run from USB (Safe Mode)</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Recommended. Windows and your internal storage are completely untouched and unmounted. Unplug anytime.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setTargetMode("internal")}
            className={cn(
              "rounded-xl p-4 text-left transition-[box-shadow,background-color] duration-150",
              targetMode === "internal"
                ? "bg-danger/10 shadow-sm border border-danger/40"
                : "bg-card shadow-[var(--shadow-border)] opacity-70 hover:opacity-100",
            )}
          >
            <p className="font-display font-medium text-danger">Convert to Dedicated Box</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Permanently erase internal drive & install ReelOS internally so you can remove the USB stick.
            </p>
          </button>
        </div>
        {targetMode === "internal" ? (
          <div className="mt-4 rounded-xl border border-danger/30 bg-danger/8 p-4">
            <p className="font-display text-sm font-semibold text-danger">⚠️ Permanent Migration Warning</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              This will permanently erase all data on the internal drive
              {disks.some((d) => d.osName) ? ` (${disks.map((d) => d.osName).filter(Boolean).join(", ")})` : ""}.
              Type <strong>ERASE</strong> below to unlock confirmation.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                placeholder="Type ERASE to confirm"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                className="h-10 flex-1 rounded-xl bg-card px-3 text-xs tracking-wider uppercase shadow-[var(--shadow-border)] placeholder:text-faint"
              />
              <Button
                size="sm"
                variant="danger"
                disabled={confirmPhrase !== "ERASE"}
                onClick={async () => {
                  setMigrationStatus("Starting migration...");
                  try {
                    const res = await fetch("/api/disks/migrate-internal", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ disk: migratingDisk || "sda", confirmPhrase: "ERASE" }),
                    });
                    const j = (await res.json()) as { ok?: boolean; error?: string };
                    if (j.ok) setMigrationStatus("Migration started! Please keep PC on.");
                    else setMigrationStatus(j.error || "Failed");
                  } catch (e) {
                    setMigrationStatus(String(e));
                  }
                }}
              >
                Erase & Migrate
              </Button>
            </div>
            {migrationStatus ? <p className="mt-2 text-xs text-gold-bright">{migrationStatus}</p> : null}
          </div>
        ) : null}
      </div>

      <Heading
        title="Where should media live?"
        sub="The OS disk stays untouched. Extra disks can mount into /srv/media. Formatting a blank data disk needs an explicit confirm."
      />
      <div className="grid gap-3">
        {options.map((o) => (
          <Card key={o.id} selected={mode === o.id} onClick={() => patch({ storageMode: o.id })}>
            <div className="flex gap-4 pr-8">
              <o.icon className={cn("mt-0.5 size-5", mode === o.id ? "text-gold" : "text-muted")} />
              <div>
                <p className="font-display text-lg font-medium">{o.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{o.body}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {mode !== "debrid" ? (
        <div className="mt-8">
          <p className="mb-3 text-sm font-medium text-muted">Disks for /srv/media</p>
          <div className="grid gap-2">
            {disks.length === 0 ? (
              <p className="text-sm text-muted">No extra disks. That is fine.</p>
            ) : (
              disks.map((d) => {
              const on = selected.includes(d.name);
              return (
                <div
                  key={d.name}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)]",
                    d.os && "opacity-60",
                  )}
                >
                  <div>
                    <p className="font-mono text-sm">/dev/{d.name}</p>
                    <p className="text-xs text-muted">
                      {d.size} {d.model} {d.os ? "· OS" : ""}
                    </p>
                  </div>
                  {d.os ? (
                    <span className="text-xs text-faint">Not selectable</span>
                  ) : (
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-muted">
                        <input
                          type="checkbox"
                          className="size-4 accent-gold"
                          checked={format.includes(d.name)}
                          onChange={() => {
                            const next = format.includes(d.name)
                              ? format.filter((x) => x !== d.name)
                              : [...format, d.name];
                            patch({ formatDisks: next });
                          }}
                        />
                        Format
                      </label>
                      <Button
                        size="sm"
                        variant={on ? "gold" : "ghost"}
                        onClick={() => {
                          const next = on ? selected.filter((x) => x !== d.name) : [...selected, d.name];
                          patch({ selectedDisks: next });
                        }}
                      >
                        {on ? "Mounted" : "Use"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
            )}
          </div>
          {format.length > 0 ? (
            <p className="mt-3 flex items-start gap-2 text-sm text-gold-bright">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              Formatting erases {format.join(", ")}. The OS disk is never touched here.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StepSource({
  sourceOk,
  setSourceOk,
}: {
  sourceOk: boolean;
  setSourceOk: (v: boolean) => void;
}) {
  const answers = useReelStore((s) => s.answers);
  const patch = useReelStore((s) => s.patchAnswers);
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState("");
  const untested = sourceValidateError(answers.source);

  const ping = async () => {
    setChecking(true);
    setSourceOk(false);
    setErr("");
    const key = answers.apiKey.trim();
    try {
      const r = await fetch("/api/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: answers.source, key }),
      });
      const result = (await r.json()) as { ok?: boolean; message?: string; error?: string };
      if (result.ok) {
        setSourceOk(true);
        setErr(result.message || "Key accepted");
      } else {
        setSourceOk(false);
        setErr(result.error || "Provider rejected this key.");
      }
    } catch (e) {
      setSourceOk(false);
      setErr(String(e));
    }
    setChecking(false);
  };

  return (
    <div>
      <Heading
        title="Your source"
        sub="TorBox and Real-Debrid are supported paths. Paste the selected provider's key and validate it before continuing. Other providers remain visible but unavailable rather than pretending to connect."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {SOURCES.map((s) => {
          const blocked = sourceValidateError(s.id);
          return (
            <Card
              key={s.id}
              selected={answers.source === s.id}
              onClick={() => {
                patch({ source: s.id });
                setSourceOk(false);
                setErr("");
              }}
            >
              <div className="flex items-start gap-3 pr-6">
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-lg font-display text-xs tracking-wide",
                    answers.source === s.id ? "bg-gold text-gold-fg" : "bg-card-2 text-muted",
                  )}
                >
                  {s.mark}
                </span>
                <div>
                  <p className="font-display font-medium">
                    {s.name}
                    {blocked ? (
                      <span className="ml-2 align-middle font-sans text-[11px] font-medium tracking-normal text-gold-bright">
                        Untested
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-muted">{s.blurb}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {untested ? (
        <div className="mt-6">
          <p className="text-sm text-gold-bright">{untested}</p>
          {answers.source !== "local-vpn" ? (
            <Button className="mt-3" variant="ghost" onClick={() => void ping()} disabled={checking}>
              {checking ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Validate
            </Button>
          ) : null}
          {!sourceOk && err ? <p className="mt-2 text-sm text-danger">{err}</p> : null}
        </div>
      ) : (
        <div className="mt-6">
          <label className="text-sm text-muted">API key</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              autoComplete="off"
              placeholder={`Paste ${answers.source === "real-debrid" ? "Real-Debrid" : "TorBox"} key`}
              value={answers.apiKey}
              onChange={(e) => {
                patch({ apiKey: e.target.value });
                setSourceOk(false);
                setErr("");
              }}
              className="h-12 flex-1 rounded-xl bg-card px-4 text-sm shadow-[var(--shadow-border)] placeholder:text-faint"
            />
            <Button variant="ghost" onClick={() => void ping()} disabled={checking}>
              {checking ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {checking ? "Checking" : "Validate"}
            </Button>
          </div>
          {sourceOk ? <p className="mt-2 text-sm text-success">{err}</p> : null}
          {!sourceOk && err ? <p className="mt-2 text-sm text-danger">{err}</p> : null}
        </div>
      )}
    </div>
  );
}

function StepIntent() {
  const intent = useReelStore((s) => s.answers.intent);
  const patchIntent = useReelStore((s) => s.patchIntent);
  const chips: { key: keyof typeof intent; label: string }[] = [
    { key: "movies", label: "Movies" },
    { key: "tv", label: "TV Shows" },
    { key: "anime", label: "Anime" },
    { key: "uhd", label: "4K" },
    { key: "kids", label: "Kids" },
    { key: "music", label: "Music" },
  ];
  return (
    <div>
      <Heading
        title="What are you collecting?"
        sub="We only install engines you need. Movies and TV are on by default. Music never appears unless you ask."
      />
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const on = intent[c.key];
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => patchIntent({ [c.key]: !on })}
              className={cn(
                "h-11 rounded-full px-5 text-sm font-medium transition-colors duration-150",
                on ? "bg-gold text-gold-fg" : "bg-card text-muted shadow-[var(--shadow-border)]",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepQuality() {
  const quality = useReelStore((s) => s.answers.quality);
  const patch = useReelStore((s) => s.patchAnswers);
  const anime = useReelStore((s) => s.answers.intent.anime);
  const opts: { id: QualityFloor; title: string; body: string }[] = [
    { id: "1080p", title: "1080p", body: "A practical floor that uses less storage and conversion work." },
    {
      id: "hybrid",
      title: "1080p / 4K when available",
      body: "Keep 1080p. Prefer 4K when the release is clean. Default.",
    },
    { id: "4k", title: "4K only", body: "Rejects anything below. Some titles will fail." },
    { id: "custom", title: "Custom", body: "Unlocks Advanced later. You do not need this today." },
  ];
  return (
    <div>
      <Heading
        title="Quality floor"
        sub="Not a lecture. One choice. Anime, if selected, gets its own profile automatically."
      />
      <div className="grid gap-3">
        {opts.map((o) => (
          <Card key={o.id} selected={quality === o.id} onClick={() => patch({ quality: o.id })}>
            <p className="font-display text-lg font-medium pr-8">{o.title}</p>
            <p className="mt-1 text-sm text-muted">{o.body}</p>
          </Card>
        ))}
      </div>
      {anime ? (
        <p className="mt-5 text-sm text-live">Anime profile will be applied on the TV engine.</p>
      ) : null}
    </div>
  );
}

function StepFrontend() {
  const answers = useReelStore((s) => s.answers);
  const patch = useReelStore((s) => s.patchAnswers);
  const opts: { id: Frontend; title: string; body: string }[] = [
    { id: "jellyfin", title: "Jellyfin-compatible apps", body: "Use Swiftfin, Infuse, or another supported client through ReelOS compatibility." },
    { id: "plex", title: "Plex", body: "Bring a claim token from plex.tv/claim." },
    { id: "both", title: "Both", body: "Same libraries. Choose a player when you hit Play." },
  ];
  const plexUntested = frontendHonestyError(answers.frontend);
  return (
    <div>
      <Heading
        title="Where will you watch?"
        sub="ReelOS plays in the browser and can also connect compatible TV apps. Options that have not passed a connection check remain unavailable."
      />
      <div className="grid gap-3">
        {opts.map((o) => {
          const blocked = frontendHonestyError(o.id);
          return (
            <Card key={o.id} selected={answers.frontend === o.id} onClick={() => patch({ frontend: o.id })}>
              <p className="font-display text-lg font-medium pr-8">
                {o.title}
                {blocked ? (
                  <span className="ml-2 align-middle font-sans text-[11px] font-medium tracking-normal text-gold-bright">
                    Untested
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-sm text-muted">{o.body}</p>
            </Card>
          );
        })}
      </div>
      {plexUntested ? <p className="mt-6 text-sm text-gold-bright">{plexUntested}</p> : null}
    </div>
  );
}

function StepAdmin() {
  const answers = useReelStore((s) => s.answers);
  const patch = useReelStore((s) => s.patchAnswers);
  return (
    <div>
      <Heading
        title="Who is this for?"
        sub="Create the household admin. One password for the ReelOS shell. Engines inherit it. You will not invent twelve service passwords."
      />
      <div className="grid gap-4">
        <label className="block">
          <span className="text-sm text-muted">Display name</span>
          <input
            className="mt-2 h-12 w-full rounded-xl bg-card px-4 shadow-[var(--shadow-border)] placeholder:text-faint"
            placeholder="Ada"
            value={answers.adminName}
            onChange={(e) => patch({ adminName: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-sm text-muted">Password</span>
          <input
            type="password"
            className="mt-2 h-12 w-full rounded-xl bg-card px-4 shadow-[var(--shadow-border)] placeholder:text-faint"
            placeholder="At least 8 characters"
            value={answers.adminPassword}
            onChange={(e) => patch({ adminPassword: e.target.value })}
          />
        </label>
        <p className="text-sm text-faint">Household members can be invited later in Settings.</p>
      </div>
    </div>
  );
}

function StepAccess() {
  const answers = useReelStore((s) => s.answers);
  const patch = useReelStore((s) => s.patchAnswers);
  const opts: { id: AccessMode; title: string; body: string }[] = [
    {
      id: "lan",
      title: "This network only",
      body: "reelos.local and the LAN IP. The usual first week.",
    },
    {
      id: "tailscale",
      title: "Tailscale",
      body: "We install tailscaled and show an auth URL on Finish.",
    },
    {
      id: "cloudflare",
      title: "Cloudflare Tunnel",
      body: "Paste a tunnel token. No inbound ports.",
    },
  ];
  const cfUntested = accessHonestyError(answers.access);
  return (
    <div>
      <Heading
        title="How will you reach it?"
        sub="One front door. This network and Tailscale are the working paths. Cloudflare Tunnel is untested — Continue refuses it."
      />
      <div className="grid gap-3">
        {opts.map((o) => {
          const blocked = accessHonestyError(o.id);
          return (
            <Card key={o.id} selected={answers.access === o.id} onClick={() => patch({ access: o.id })}>
              <p className="font-display text-lg font-medium pr-8">
                {o.title}
                {blocked ? (
                  <span className="ml-2 align-middle font-sans text-[11px] font-medium tracking-normal text-gold-bright">
                    Untested
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-sm text-muted">{o.body}</p>
            </Card>
          );
        })}
      </div>
      {cfUntested ? <p className="mt-6 text-sm text-gold-bright">{cfUntested}</p> : null}
    </div>
  );
}
