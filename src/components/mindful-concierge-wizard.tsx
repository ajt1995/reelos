import React, { useState, useEffect } from "react";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  X,
  Tv,
  Smartphone,
  Laptop,
  Apple,
  Cloud,
  HardDrive,
  Layers,
  Key,
  Flame,
  Coffee,
  Zap,
  Film,
  Shield,
  Download,
  ExternalLink,
  LoaderCircle,
  Volume2,
  Server,
  Globe,
  Copy,
  Send,
  Cpu,
  Folder,
  Sliders,
  Database,
  Disc,
  RefreshCw,
  Power,
} from "lucide-react";
import { useReelStore, type TasteVibe, type HouseholdResident } from "@/lib/store";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { QrCodeSvg } from "@/components/ui/qr-code-svg";
import { Button } from "@/components/ui/button";
import { WifiPicker } from "@/components/wifi-picker";
import { sourceValidateError } from "@/lib/wizard-honesty";
import type { StorageMode, SourceId } from "@/lib/types";
import { TastePrimer } from "@/components/taste-primer";
import { TvAdbGuide } from "@/components/tv-adb-guide";
import { RemoteComputeModal } from "@/components/remote-compute-modal";
import { HeadlessScreen } from "@/components/headless-screen";

// 120Hz hardware-accelerated container classes
const FLUID_CARD =
  "transition-all duration-200 ease-out will-change-transform transform-gpu cursor-pointer select-none";

export function MindfulConciergeWizard() {
  const step = useReelStore((s) => s.wizardStep) || 1;
  const setStep = useReelStore((s) => s.setWizardStep);
  const provisioned = useReelStore((s) => s.provisioned);
  const hasEverCompletedStep1 = useReelStore((s) => s.hasEverCompletedStep1);
  const setHasEverCompletedStep1 = useReelStore((s) => s.setHasEverCompletedStep1);
  const TOTAL_STEPS = 4;

  // Store hooks
  const answers = useReelStore((s) => s.answers);
  const patchAnswers = useReelStore((s) => s.patchAnswers);
  const residents = useReelStore((s) => s.residents);
  const addResident = useReelStore((s) => s.addResident);
  const removeResident = useReelStore((s) => s.removeResident);
  const patchResident = useReelStore((s) => s.patchResident);
  const setHouseName = useReelStore((s) => s.setHouseName);
  const houseName = useReelStore((s) => s.houseName);
  const startBuild = useReelStore((s) => s.startBuild);
  const openReelOS = useReelStore((s) => s.openReelOS);

  useEffect(() => {
    if (!provisioned && step > 1 && !hasEverCompletedStep1) {
      setStep(1);
    }
  }, [provisioned, step, hasEverCompletedStep1, setStep]);

  // Hotspot Mode (Appliance needs Wi-Fi)
  const [isHotspotMode, setIsHotspotMode] = useState(false);
  const [checkingHotspot, setCheckingHotspot] = useState(true);

  useEffect(() => {
    fetch("/api/wifi/status")
      .then((r) => r.json())
      .then((data) => {
        if (data?.hotspotActive) setIsHotspotMode(true);
      })
      .catch(() => {})
      .finally(() => setCheckingHotspot(false));
  }, []);

  // Roaming & Network Pairing Hooks
  const [pairingBaseUrl, setPairingBaseUrl] = useState<string>("");
  const storeIpv4 = useReelStore((s) => s.ipv4);
  const storeTsIp = useReelStore((s) => s.tailscaleIp);

  useEffect(() => {
    fetch("/api/gate/status")
      .then((r) => r.json())
      .then((d) => {
        if (d?.publicUrl) setPairingBaseUrl(d.publicUrl);
      })
      .catch(() => {});
  }, []);

  // Mode Selection
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);
  const [tvAdbGuideOpen, setTvAdbGuideOpen] = useState(false);
  const [showExpressKeyModal, setShowExpressKeyModal] = useState(false);

  // Section 40: Remote Computer Mode & Hidden Triggers
  const [remoteComputeModalOpen, setRemoteComputeModalOpen] = useState(false);
  const [isHeadlessActive, setIsHeadlessActive] = useState(false);
  const [remoteComputeLoading, setRemoteComputeLoading] = useState(false);
  const [logoTapCount, setLogoTapCount] = useState<number[]>([]);
  const [rKeyTaps, setRKeyTaps] = useState<number[]>([]);

  // Check if appliance is already in headless mode
  useEffect(() => {
    fetch("/api/system/remote-compute")
      .then((r) => r.json())
      .then((d) => {
        if (d?.remoteCompute) setIsHeadlessActive(true);
      })
      .catch(() => {});
  }, []);

  // Zero-Config Peer Mesh Node Discovery
  const [peerGridNodes, setPeerGridNodes] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/grid/status")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.peerNodes)) setPeerGridNodes(d.peerNodes);
      })
      .catch(() => {});
  }, []);

  // Keyboard shortcut (Ctrl+Shift+H or spamming R 4 times)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "H" || e.key === "h")) {
        e.preventDefault();
        setRemoteComputeModalOpen(true);
        return;
      }
      if (e.key === "r" || e.key === "R") {
        const target = e.target as HTMLElement | null;
        if (target && target.tagName === "INPUT") {
          return;
        }
        const now = Date.now();
        setRKeyTaps((prev) => {
          const recent = [...prev.filter((t) => now - t < 1500), now];
          if (recent.length >= 4) {
            setRemoteComputeModalOpen(true);
            return [];
          }
          return recent;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogoTap = () => {
    const now = Date.now();
    setLogoTapCount((prev) => {
      const recent = [...prev.filter((t) => now - t < 2500), now];
      if (recent.length >= 5) {
        setRemoteComputeModalOpen(true);
        return [];
      }
      return recent;
    });
  };

  const handleConfirmRemoteCompute = async () => {
    setRemoteComputeLoading(true);
    try {
      await fetch("/api/system/remote-compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });
      setRemoteComputeModalOpen(false);
      setIsHeadlessActive(true);
      showToast("Entering Remote Computer Mode · Screen Blanked", "success");
    } catch {
      showToast("Error enabling remote compute mode", "error");
    } finally {
      setRemoteComputeLoading(false);
    }
  };

  // Step 1: Admin Name & Hand-Holding Spectrum
  const [nameInput, setNameInput] = useState(
    () => answers.adminName || residents.find((r) => !r.isGuest && !r.isKids)?.name || ""
  );
  const [handHoldingMode, setHandHoldingMode] = useState<"guided" | "balanced" | "express">("balanced");

  // Step 3: Storage Configuration & Hardware Audit
  const [storageMode, setStorageMode] = useState<StorageMode>(answers.storageMode || "debrid");
  const [hwInfo, setHwInfo] = useState<{ ramGb?: number; cpus?: number; gpuType?: string; potatoMode?: boolean; summary?: string } | null>(null);
  const [availableDrives, setAvailableDrives] = useState<Array<{ name: string; label?: string; size?: string; sizeGb?: number; freeGb?: number; mount?: string; isUsb?: boolean; model?: string; os?: boolean }>>([]);
  const [storageTarget, setStorageTarget] = useState<string>(answers.storageTarget || "default");
  const [customPath, setCustomPath] = useState<string>("");
  const [storageQuotaGb, setStorageQuotaGb] = useState<number>(answers.storageQuotaGb || 50);

  useEffect(() => {
    fetch("/api/box")
      .then((r) => r.json())
      .then((d) => {
        if (d?.hardware) {
          setHwInfo(d.hardware);
        }
      })
      .catch(() => {});

    fetch("/api/disks")
      .then((r) => r.json())
      .then((d) => {
        if (d?.disks && Array.isArray(d.disks)) {
          setAvailableDrives(d.disks);
        }
      })
      .catch(() => {});
  }, []);

  // Streaming Key & Sample Library
  const [sourceType, setSourceType] = useState<SourceId>(answers.source || "torbox");
  const [apiKey, setApiKey] = useState(answers.apiKey || "");
  const [keyVerified, setKeyVerified] = useState(Boolean(answers.apiKey));
  const [verifying, setVerifying] = useState(false);
  const [sampleMode, setSampleMode] = useState(false);
  const [seedingSample, setSeedingSample] = useState(false);

  // Step 4: Devices & Sideloading
  const [selectedDevices, setSelectedDevices] = useState<string[]>([
    "tv_livingroom",
    "android_mobile",
    "pc_native",
  ]);
  const [discoveredTvs, setDiscoveredTvs] = useState<Array<{ ip: string; port: number; name?: string }>>([]);
  const [scanningTvs, setScanningTvs] = useState(false);
  const [pushingTvIp, setPushingTvIp] = useState<string | null>(null);
  const [tvStatusMsg, setTvStatusMsg] = useState("");
  const [startOnBoot, setStartOnBoot] = useState(true);

  // Launch & Finishing State
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState("");
  const [deploymentTarget, setDeploymentTarget] = useState<"native" | "usb">("native");

  // Multi-Device Pairing Modals
  const [activeQrModal, setActiveQrModal] = useState<string | null>(null);
  const [pairTab, setPairTab] = useState<"android" | "ios" | "remote">("android");
  const [copiedRemote, setCopiedRemote] = useState(false);

  // Detect Android User Agent
  const isAndroid =
    typeof window !== "undefined" && /Android/i.test(navigator.userAgent);

  // Scan for TVs on LAN
  const handleScanTvs = async () => {
    setScanningTvs(true);
    setTvStatusMsg("");
    try {
      const res = await fetch("/api/apps/android/scan", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setDiscoveredTvs(Array.isArray(data.devices) ? data.devices : []);
        if (!data.devices || data.devices.length === 0) {
          setTvStatusMsg("No Android TV found responding on port 5555. Tap the guide below to enable Network ADB on your TV.");
        }
      }
    } catch {
      setTvStatusMsg("Unable to scan local subnet. Check your Wi-Fi connection.");
    } finally {
      setScanningTvs(false);
    }
  };

  useEffect(() => {
    if (step === 4) {
      handleScanTvs();
    }
  }, [step]);

  // Push APK to TV
  const handlePushTv = async (ip: string) => {
    if (!ip) return;
    setPushingTvIp(ip);
    setTvStatusMsg(`Connecting to TV at ${ip}:5555 and deploying ReelOS…`);
    try {
      const res = await fetch("/api/apps/android/sideload-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, port: 5555 }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTvStatusMsg(`Success! ReelOS TV has been installed and launched on ${ip}!`);
        showToast(`ReelOS installed on ${ip}!`, "success");
      } else if (data.unauthorized) {
        setTvStatusMsg("Please look at your TV screen and tap 'Always allow from this computer', then click Deploy again.");
        showToast("Tap 'Always allow' on TV screen", "info");
      } else {
        setTvStatusMsg(`Note: ${data.error || "Could not connect to TV. Verify Developer Options > Network Debugging is ON."}`);
      }
    } catch (err) {
      setTvStatusMsg(`Error pushing to TV: ${String(err)}`);
    } finally {
      setPushingTvIp(null);
    }
  };

  // Toggle device multi-select
  const toggleDevice = (devId: string) => {
    setSelectedDevices((prev) =>
      prev.includes(devId) ? prev.filter((d) => d !== devId) : [...prev, devId]
    );
  };

  // Step 1: Submit Identity & Hand-Holding Spectrum
  const handleNameSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = nameInput.trim() || "Resident";
    patchAnswers({ adminName: clean });
    if (!houseName || houseName === "Living Room" || houseName === "reelos") {
      setHouseName(`${clean}'s Cinema`);
    }
    const primary = residents.find((r) => !r.isGuest && !r.isKids);
    if (primary) {
      patchResident(primary.id, { name: clean });
    } else {
      addResident(clean, "popcorn", undefined, false);
    }

    if (handHoldingMode === "express") {
      setHasEverCompletedStep1(true);
      // 🚀 "I'll figure it out": Check if TorBox key is configured
      if (!apiKey.trim()) {
        setShowExpressKeyModal(true);
      } else {
        handleFinishExpress(clean);
      }
    } else {
      setHasEverCompletedStep1(true);
      setStep(2);
    }
  };

  // Express finish for 0-technical user who wants instant jump
  const handleFinishExpress = async (adminName: string) => {
    setIsFinishing(true);
    try {
      const fullAnswers = {
        ...answers,
        adminName,
        storageMode: "debrid" as StorageMode,
        storageTarget: "cloud",
        storageQuotaGb: 0,
        source: "torbox" as SourceId,
        apiKey: apiKey.trim(),
        frontend: answers.frontend || "jellyfin",
        access: answers.access || "lan",
      };
      patchAnswers(fullAnswers);
      startBuild();
      openReelOS();
    } catch {
      openReelOS();
    } finally {
      setIsFinishing(false);
    }
  };

  // Step 2: Taste Primer Complete
  const handleTasteComplete = (
    selectedIds: string[],
    synthesizedWeights: Record<string, number>,
    reactionBuckets?: { favorites: string[]; likes: string[]; cozy: string[] }
  ) => {
    const primary = residents.find((r) => !r.isGuest && !r.isKids);
    if (primary) {
      const favorites = reactionBuckets?.favorites?.length ? reactionBuckets.favorites : selectedIds.slice(0, 3);
      const likes = reactionBuckets?.likes || [];
      const cozy = reactionBuckets?.cozy || [];

      // Dynamically derive tasteVibe from weights & cozy reactions
      let derivedVibe: TasteVibe = "balanced";
      if ((synthesizedWeights.comfort || 0) > 0.6 || cozy.length > favorites.length) {
        derivedVibe = "comfort";
      } else if (
        (synthesizedWeights.neo_noir || 0) > 0.5 ||
        (synthesizedWeights.cerebral || 0) > 0.6 ||
        (synthesizedWeights.indie || 0) > 0.6
      ) {
        derivedVibe = "hidden_gems";
      } else if (
        (synthesizedWeights.spectacle || 0) > 0.6 ||
        (synthesizedWeights.scifi || 0) > 0.6 ||
        (synthesizedWeights.intensity || 0) > 0.6
      ) {
        derivedVibe = "bleeding_edge";
      }

      patchResident(primary.id, {
        tasteVibe: derivedVibe,
        themeDesign: "oled_cinema",
        favorites,
        likes,
        cozy,
        curationWeights: synthesizedWeights,
      });

      // Save via /api/curator/taste
      fetch("/api/curator/taste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          residentId: primary.id,
          weights: synthesizedWeights,
          curationWeights: synthesizedWeights,
          archetypes: selectedIds,
          favorites,
          likes,
          cozy,
          tasteVibe: derivedVibe,
          vibe: derivedVibe,
        }),
      }).catch(() => {});

      // Persist to /api/profiles
      fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: primary.id,
          tasteVibe: derivedVibe,
          themeDesign: "oled_cinema",
          favorites,
          likes,
          cozy,
          curationWeights: synthesizedWeights,
        }),
      }).catch(() => {});
    }
    setStep(3);
  };

  // Step 3: Verify Key
  const handleVerifyKey = async () => {
    if (!apiKey.trim()) return;
    const honestyErr = sourceValidateError(sourceType);
    if (honestyErr) {
      setKeyVerified(false);
      showToast(honestyErr, "error");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: sourceType, key: apiKey.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (data && data.ok) {
        patchAnswers({ source: sourceType, apiKey: apiKey.trim() });
        setKeyVerified(true);
        showToast("TorBox API key verified!", "success");
      } else {
        setKeyVerified(false);
        showToast(data?.error || "Invalid TorBox API key.", "error");
      }
    } catch {
      setKeyVerified(false);
      showToast("Network error verifying API key.", "error");
    } finally {
      setVerifying(false);
    }
  };

  // Step 3: Try Sample Library
  const handleTrySampleLibrary = async () => {
    setSeedingSample(true);
    try {
      const res = await fetch("/api/library/seed-samples", { method: "POST" });
      patchAnswers({
        source: "torbox",
        apiKey: "",
        sampleMode: true,
      });
      setApiKey("");
      setKeyVerified(true);
      setSampleMode(true);
      showToast("Sample Public Domain Cinema Loaded! Ready to evaluate.", "success");
      setStep(4);
    } catch {
      patchAnswers({
        source: "torbox",
        apiKey: "",
        sampleMode: true,
      });
      setApiKey("");
      setKeyVerified(true);
      setSampleMode(true);
      showToast("Sample Cinema ready!", "success");
      setStep(4);
    } finally {
      setSeedingSample(false);
    }
  };

  // Step 4: Final Launch
  const handleFinish = async () => {
    setIsFinishing(true);
    setFinishError("");
    try {
      const fullAnswers = {
        ...answers,
        adminName: nameInput.trim() || "Resident",
        storageMode: isStandaloneApp ? "debrid" : storageMode,
        storageTarget: storageTarget === "custom" ? (customPath || "C:\\ReelOS-Media") : storageTarget,
        storageQuotaGb: storageMode === "debrid" ? 0 : storageQuotaGb,
        source: sourceType,
        apiKey: apiKey.trim(),
        frontend: answers.frontend || "jellyfin",
        access: answers.access || "lan",
      };

      patchAnswers(fullAnswers);

      const res = await fetch("/api/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: fullAnswers }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) {
        const err = data.error || "Provisioning failed. Please check your configuration.";
        setFinishError(err);
        showToast(err, "error");
        return;
      }
      startBuild();
      openReelOS();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to communicate with provisioning service.";
      setFinishError(msg);
      showToast(msg, "error");
    } finally {
      setIsFinishing(false);
    }
  };

  if (checkingHotspot) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background text-foreground">
        <LoaderCircle className="size-8 animate-spin text-gold" />
      </div>
    );
  }

  if (isHotspotMode) {
    return (
      <div className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden bg-background text-foreground p-4">
        <WifiPicker onConnected={() => setIsHotspotMode(false)} />
      </div>
    );
  }

  if (isHeadlessActive) {
    return <HeadlessScreen onWake={() => setIsHeadlessActive(false)} />;
  }

  return (
    <div className="relative min-h-dvh flex flex-col justify-between overflow-x-hidden overflow-y-auto bg-background text-foreground transition-colors duration-300">
      {/* 120Hz Ambient Glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-[-10rem] size-[38rem] rounded-full bg-gold/10 blur-[130px] will-change-transform transform-gpu"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 bottom-[-8rem] size-[32rem] rounded-full bg-sky-500/10 blur-[120px] will-change-transform transform-gpu"
      />

      {/* Header */}
      <header className={cn("relative z-20 mx-auto flex w-full items-center justify-between px-6 py-5 md:px-8", step === 2 ? "max-w-6xl" : "max-w-4xl")}>
        <div className="flex items-center gap-3">
          <div
            onClick={handleLogoTap}
            title="Tap 5 times for Remote Computer mode"
            className="flex size-9 items-center justify-center rounded-2xl bg-gold/15 text-gold font-display font-bold text-lg shadow-[0_0_15px_rgba(212,175,55,0.2)] cursor-pointer active:scale-95 transition-transform"
          >
            R
          </div>
          <div>
            <h1 className="font-display text-sm font-semibold tracking-wide text-foreground">ReelOS Concierge</h1>
            <p className="text-[11px] text-muted">
              {isStandaloneApp ? "Standalone Mobile App" : "Home Cinema Appliance"} · Step {step} of {TOTAL_STEPS}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-muted hover:text-foreground transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="size-3" />
              Reset
            </button>
          )}
          {/* Step Progress Pills */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => s < step && setStep(s)}
                disabled={s > step}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-250 transform-gpu",
                  s === step
                    ? "w-7 bg-gold shadow-[0_0_10px_rgba(212,175,55,0.4)]"
                    : s < step
                    ? "w-2.5 bg-gold/50 cursor-pointer"
                    : "w-2 bg-card-2 border border-border/60"
                )}
              />
            ))}
          </div>
        </div>
      </header>

      <TvAdbGuide
        open={tvAdbGuideOpen}
        onClose={() => setTvAdbGuideOpen(false)}
        onScanAgain={handleScanTvs}
      />
      <RemoteComputeModal
        open={remoteComputeModalOpen}
        onClose={() => setRemoteComputeModalOpen(false)}
        onConfirm={handleConfirmRemoteCompute}
        loading={remoteComputeLoading}
      />

      {/* Main Conversational Viewport */}
      <main className={cn("relative z-10 mx-auto w-full px-4 sm:px-6 md:px-8 flex-1 flex flex-col", step === 2 ? "max-w-6xl justify-start pt-2 pb-36" : "max-w-2xl justify-center py-6")}>
        {/* =========================================================================
            SCREEN 1: What is your name? & Hand-Holding Spectrum
            ========================================================================= */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-250">
            <div className="space-y-2 text-center sm:text-left">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                <Film className="size-3.5" /> Welcome to ReelOS
              </span>
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
                Hi, what should we call you?
              </h2>
              <p className="text-sm text-muted">
                ReelOS personalizes your experience, recommendations, and cinema shelf.
              </p>
            </div>

            <form onSubmit={handleNameSubmit} className="space-y-5 pt-1">
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g., Ripley, Neo, or The Architect..."
                  className="h-14 w-full rounded-2xl border border-border/80 bg-card/80 px-5 text-lg font-medium text-foreground placeholder:text-muted/50 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30 shadow-inner backdrop-blur-md"
                />
              </div>

              {/* Zero-Config Mesh Remote Node Notification */}
              {peerGridNodes.length > 0 && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center gap-3 text-left animate-in fade-in duration-300">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                    <Zap className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-foreground truncate">
                        Household Compute Node Detected
                      </p>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-mono font-medium text-emerald-300">
                        Zero-Config Mesh
                      </span>
                    </div>
                    <p className="text-[11px] text-muted truncate mt-0.5">
                      Lending {peerGridNodes[0].hardware?.coreCount || 4}-core compute from {peerGridNodes[0].machineId || "Home Appliance"} · Connected automatically.
                    </p>
                  </div>
                </div>
              )}

              {/* Hand-Holding Spectrum Selector */}
              <div className="space-y-2.5 pt-1 text-left">
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                  How much guidance do you want?
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <div
                    onClick={() => setHandHoldingMode("guided")}
                    className={cn(
                      FLUID_CARD,
                      "rounded-2xl border p-3.5 text-center backdrop-blur-md",
                      handHoldingMode === "guided"
                        ? "border-gold bg-gold/15 shadow-[0_0_15px_rgba(212,175,55,0.2)] ring-1 ring-gold/50"
                        : "border-border/70 bg-card/60 hover:border-border"
                    )}
                  >
                    <div className="text-2xl mb-1.5 select-none">🤝</div>
                    <p className="text-xs font-bold text-foreground">Hold my hand</p>
                    <p className="text-[10px] text-muted mt-0.5 leading-tight">
                      Step-by-step guidance & recommendations
                    </p>
                  </div>

                  <div
                    onClick={() => setHandHoldingMode("balanced")}
                    className={cn(
                      FLUID_CARD,
                      "rounded-2xl border p-3.5 text-center backdrop-blur-md",
                      handHoldingMode === "balanced"
                        ? "border-sky-400 bg-sky-500/15 shadow-[0_0_15px_rgba(56,189,248,0.2)] ring-1 ring-sky-400/50"
                        : "border-border/70 bg-card/60 hover:border-border"
                    )}
                  >
                    <div className="text-2xl mb-1.5 select-none">⚖️</div>
                    <p className="text-xs font-bold text-foreground">Balanced</p>
                    <p className="text-[10px] text-muted mt-0.5 leading-tight">
                      Smart defaults with quick taste primer
                    </p>
                  </div>

                  <div
                    onClick={() => setHandHoldingMode("express")}
                    className={cn(
                      FLUID_CARD,
                      "rounded-2xl border p-3.5 text-center backdrop-blur-md",
                      handHoldingMode === "express"
                        ? "border-emerald-400 bg-emerald-500/15 shadow-[0_0_15px_rgba(52,211,153,0.2)] ring-1 ring-emerald-400/50"
                        : "border-border/70 bg-card/60 hover:border-border"
                    )}
                  >
                    <div className="text-2xl mb-1.5 select-none">🚀</div>
                    <p className="text-xs font-bold text-foreground">I'll figure it out</p>
                    <p className="text-[10px] text-muted mt-0.5 leading-tight">
                      Instant jump directly to cinema grid
                    </p>
                  </div>
                </div>
              </div>

              {/* TorBox Warning for "I'll figure it out" */}
              {handHoldingMode === "express" && (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex items-start gap-3 backdrop-blur-md animate-in fade-in duration-200 text-left">
                  <Key className="size-4 shrink-0 text-amber-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-amber-300">
                      TorBox Streaming Key Still Required
                    </p>
                    <p className="text-[11px] text-muted leading-relaxed">
                      Jumping straight into the cinema grid lets you explore the interface and free sample cinema immediately, but streaming new 4K releases requires entering your TorBox API key later in <strong>Settings → Streaming</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Machine Role Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-left">
                <div
                  onClick={() => setIsStandaloneApp(false)}
                  className={cn(
                    FLUID_CARD,
                    "rounded-2xl border p-3.5 backdrop-blur-md",
                    !isStandaloneApp
                      ? "border-gold bg-gold/15 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                      : "border-border/70 bg-card/60 hover:border-border"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Server className="size-4 text-gold" />
                    <p className="text-xs font-semibold text-foreground">Home Cinema Appliance</p>
                  </div>
                  <p className="text-[11px] text-muted mt-1">This PC or box hosts your household server.</p>
                </div>

                <div
                  onClick={() => {
                    setIsStandaloneApp(true);
                    setStorageMode("debrid");
                  }}
                  className={cn(
                    FLUID_CARD,
                    "rounded-2xl border p-3.5 backdrop-blur-md",
                    isStandaloneApp
                      ? "border-emerald-400 bg-emerald-500/15 shadow-[0_0_15px_rgba(52,211,153,0.2)]"
                      : "border-border/70 bg-card/60 hover:border-border"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Globe className="size-4 text-emerald-400" />
                    <p className="text-xs font-semibold text-foreground">Standalone Mobile / Cloud</p>
                  </div>
                  <p className="text-[11px] text-muted mt-1">No home server needed. Cloud streaming anywhere.</p>
                </div>
              </div>

              <Button
                type="submit"
                disabled={!nameInput.trim()}
                className="h-12 w-full rounded-2xl bg-gold text-background font-display font-semibold hover:bg-gold-bright transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] disabled:opacity-50"
              >
                {handHoldingMode === "express" ? "Jump Directly to Cinema Grid" : "Continue"} <ChevronRight className="ml-1.5 size-4" />
              </Button>
            </form>
          </div>
        )}

        {/* =========================================================================
            SCREEN 2: Tidal-Style Dynamic Bubble Taste Calibration (Tap 1=Like, Tap 2=Love)
            ========================================================================= */}
        {step === 2 && (
          <div className="space-y-4">
            <TastePrimer
              onComplete={handleTasteComplete}
              onSkip={() => {
                handleTasteComplete([], {
                  spectacle: 0.7,
                  comfort: 0.7,
                  drama: 0.6,
                  scifi: 0.6,
                  comedy: 0.5,
                });
              }}
            />
            <div className="pt-2">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                className="h-10 text-xs text-muted hover:text-foreground"
              >
                <ChevronLeft className="size-4 mr-1" /> Back to Identity
              </Button>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 3: Storage Mode & Streaming Key (with Try Sample Library)
            ========================================================================= */}
        {step === 3 && (() => {
          const hwRamGb = Number(hwInfo?.ramGb || 0);
          const hwGpu = hwInfo?.gpuType || "none";
          const isNvenc = hwGpu === "nvenc";
          const isQsv = hwGpu === "qsv";
          const isBeast = isNvenc || hwRamGb >= 16;
          const isWorkhorse = !isBeast && (isQsv || hwRamGb > 4.5);

          return (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-250">
              <div className="space-y-2 text-center sm:text-left">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                  <HardDrive className="size-3.5" /> Storage & Streaming
                </span>
                <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
                  How should we stream?
                </h2>
                <p className="text-sm text-muted">
                  Pure cloud streaming requires zero local hard drive space. Or attach a disk for local caching.
                </p>
              </div>

              {/* Hardware Reassurance */}
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-3.5 flex items-start gap-3 backdrop-blur-md">
                <span className="text-xl select-none mt-0.5">⚡</span>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <span>{isBeast ? "High-Performance Workstation" : isWorkhorse ? "Efficient Hardware Acceleration" : "Lightweight Appliance Silicon"}</span>
                    <span className="rounded-full bg-sky-500/20 px-2 py-0.2 text-[10px] font-mono text-sky-300 font-bold">
                      {hwRamGb ? `${Math.round(hwRamGb)} GB RAM` : "DirectPlay Ready"}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted leading-relaxed">
                    ReelOS offloads 4K video rendering directly to your TV and mobile screens for zero-fan-stress whisper-quiet operation.
                  </p>
                </div>
              </div>

              {/* Storage Mode Cards */}
              <div className="grid gap-2.5">
                {/* 1. Pure Cloud Streaming */}
                <div
                  onClick={() => {
                    setStorageMode("debrid");
                    patchAnswers({ storageMode: "debrid", storageTarget: "cloud", storageQuotaGb: 0 });
                  }}
                  className={cn(
                    FLUID_CARD,
                    "rounded-2xl border p-3.5 backdrop-blur-md relative overflow-hidden",
                    storageMode === "debrid"
                      ? "border-emerald-400 bg-emerald-500/15 shadow-[0_0_20px_rgba(52,211,153,0.25)]"
                      : "border-border/80 bg-card/60 hover:border-emerald-500/50"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-9 items-center justify-center rounded-xl font-bold",
                          storageMode === "debrid" ? "bg-emerald-400 text-background" : "bg-card-2 text-muted"
                        )}
                      >
                        <Cloud className="size-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">Pure Cloud (Zero Local Disk)</p>
                          <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.2 text-[10px] font-bold text-emerald-400">
                            ⭐ RECOMMENDED
                          </span>
                        </div>
                        <p className="text-[11px] text-muted">Streams directly from high-speed cloud cinema servers</p>
                      </div>
                    </div>
                    {storageMode === "debrid" && (
                      <div className="flex size-5 items-center justify-center rounded-full bg-emerald-400 text-background">
                        <Check className="size-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Smart Hybrid */}
                <div
                  onClick={() => {
                    setStorageMode("both");
                    patchAnswers({ storageMode: "both", storageTarget, storageQuotaGb });
                  }}
                  className={cn(
                    FLUID_CARD,
                    "rounded-2xl border p-3.5 backdrop-blur-md",
                    storageMode === "both"
                      ? "border-gold bg-gold/15 shadow-[0_0_20px_rgba(212,175,55,0.25)]"
                      : "border-border/80 bg-card/60 hover:border-border"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-9 items-center justify-center rounded-xl font-bold",
                          storageMode === "both" ? "bg-gold text-background" : "bg-card-2 text-muted"
                        )}
                      >
                        <Layers className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Smart Hybrid</p>
                        <p className="text-[11px] text-muted">Cloud streaming with local speed cache</p>
                      </div>
                    </div>
                    {storageMode === "both" && (
                      <div className="flex size-5 items-center justify-center rounded-full bg-gold text-background">
                        <Check className="size-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Streaming Key Section */}
              <div className="space-y-3 rounded-2xl border border-border/80 bg-card/70 p-4.5 backdrop-blur-md text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="size-3.5 text-gold" />
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                      TorBox Streaming API Key
                    </label>
                  </div>
                  {keyVerified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      <Check className="size-3 stroke-[3]" /> {sampleMode ? "Sample Mode Active" : "Key Verified"}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setKeyVerified(false);
                      setSampleMode(false);
                    }}
                    placeholder="tb_..."
                    className="h-11 flex-1 rounded-xl border border-border/70 bg-background/80 px-3.5 font-mono text-xs text-foreground placeholder:text-muted/50 focus:border-gold focus:outline-none"
                  />
                  <Button
                    type="button"
                    variant="gold"
                    onClick={handleVerifyKey}
                    disabled={!apiKey.trim() || verifying}
                    className="text-xs font-semibold px-4 h-11 shrink-0"
                  >
                    {verifying ? <LoaderCircle className="size-3.5 animate-spin" /> : "Verify"}
                  </Button>
                </div>

                {/* Zero-Key Evaluation: Try Sample Library Button */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-border/40 pt-3 gap-2">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Don't have a streaming key yet?</p>
                    <p className="text-[11px] text-muted">Test ReelOS with verified public domain cinema immediately.</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleTrySampleLibrary}
                    disabled={seedingSample}
                    className="h-8.5 rounded-xl border border-gold/40 bg-gold/10 px-3 text-xs font-semibold text-gold hover:bg-gold/20 shrink-0"
                  >
                    <Sparkles className="size-3.5 mr-1.5" />
                    {seedingSample ? "Seeding..." : "Try Sample Library"}
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  variant="ghost"
                  onClick={() => setStep(2)}
                  className="h-12 rounded-2xl px-5 text-muted hover:text-foreground"
                >
                  <ChevronLeft className="size-4 mr-1" /> Back
                </Button>
                <Button
                  onClick={() => {
                    patchAnswers({ apiKey: apiKey.trim(), source: sourceType });
                    setStep(4);
                  }}
                  disabled={!keyVerified && !apiKey.trim()}
                  className="h-12 flex-1 rounded-2xl bg-gold text-background font-display font-semibold hover:bg-gold-bright transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] disabled:opacity-50"
                >
                  Next: Multi-Device Setup <ChevronRight className="ml-1.5 size-4" />
                </Button>
              </div>
            </div>
          );
        })()}

        {/* =========================================================================
            SCREEN 4: Get on Every Screen & Multi-Device Deployment
            ========================================================================= */}
        {step === 4 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-250 text-center sm:text-left">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                <Tv className="size-3.5" /> Multi-Screen Cinema
              </span>
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
                Get ReelOS on Every Screen
              </h2>
              <p className="text-sm text-muted">
                Push directly to your Living Room TV over Wi-Fi, scan to download the 120Hz mobile app, and launch.
              </p>
            </div>

            {/* Android TV Sideload Card */}
            <div className="rounded-2xl border border-gold/40 bg-card/80 p-4.5 space-y-3 backdrop-blur-md text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-gold/20 text-gold">
                    <Tv className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-foreground">
                      Living Room Android TV / Chromecast
                    </h3>
                    <p className="text-[11px] text-muted">Wireless ADB push over port 5555</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleScanTvs}
                  disabled={scanningTvs}
                  className="h-8 text-xs border border-border/60 hover:border-gold/40 hover:text-gold"
                >
                  <RefreshCw className={cn("size-3 mr-1.5", scanningTvs && "animate-spin")} />
                  {scanningTvs ? "Scanning..." : "Scan TV"}
                </Button>
              </div>

              {/* TV List */}
              {discoveredTvs.length > 0 ? (
                <div className="space-y-2 pt-1">
                  {discoveredTvs.map((tv) => (
                    <div
                      key={tv.ip}
                      className="flex items-center justify-between rounded-xl bg-card-2 p-3 border border-border/70"
                    >
                      <div>
                        <p className="text-xs font-semibold text-foreground">{tv.name || "Android TV"}</p>
                        <p className="text-[10px] text-emerald-400 font-mono">{tv.ip}:5555 ONLINE</p>
                      </div>
                      <Button
                        type="button"
                        variant="gold"
                        size="sm"
                        disabled={pushingTvIp === tv.ip}
                        onClick={() => handlePushTv(tv.ip)}
                        className="h-8 text-xs font-semibold px-3"
                      >
                        {pushingTvIp === tv.ip ? (
                          <LoaderCircle className="size-3.5 animate-spin mr-1" />
                        ) : (
                          <Send className="size-3.5 mr-1" />
                        )}
                        1-Click Deploy
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 p-3.5 text-center space-y-2">
                  <p className="text-xs text-muted">
                    {tvStatusMsg || "Scanning your home Wi-Fi for Android TVs on port 5555..."}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setTvAdbGuideOpen(true)}
                    className="text-xs text-gold hover:text-gold-bright border border-gold/30 bg-gold/5 h-8 px-3"
                  >
                    <Zap className="size-3 mr-1 text-gold" />
                    How to Enable Network ADB on your TV (30s Guide)
                  </Button>
                </div>
              )}
            </div>

            {/* Mobile & Windows Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {/* Mobile QR Card */}
              <div className="rounded-2xl border border-border/80 bg-card/70 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="size-4 text-emerald-400" />
                  <p className="text-xs font-semibold text-foreground">Mobile & Tablet App</p>
                </div>
                <p className="text-[11px] text-muted">
                  Download the 120Hz native APK or use Safari on iPhone.
                </p>
                <div className="flex gap-2 pt-1">
                  <a
                    href="/clients/reelos-android-universal.apk"
                    download
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                  >
                    <Download className="size-3" /> Android APK
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      const primary = residents.find((r) => !r.isGuest && !r.isKids);
                      if (primary) setActiveQrModal(primary.id);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-card-2 border border-border px-2.5 py-1 text-[11px] font-semibold text-muted hover:text-foreground transition-colors"
                  >
                    Show Pairing QR
                  </button>
                </div>
              </div>

              {/* Start on Windows Boot Toggle */}
              <div className="rounded-2xl border border-border/80 bg-card/70 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Power className="size-4 text-sky-400" />
                    <p className="text-xs font-semibold text-foreground">Start on Boot</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={startOnBoot}
                    onChange={(e) => setStartOnBoot(e.target.checked)}
                    className="size-4 rounded border-border text-gold focus:ring-gold/40 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-muted">
                  Automatically launches ReelOS quietly in the background when Windows turns on.
                </p>
              </div>
            </div>

            {/* Launch Buttons */}
            {finishError && (
              <p className="text-xs font-medium text-danger">{finishError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setStep(3)}
                className="h-12 rounded-2xl px-5 text-muted hover:text-foreground"
              >
                <ChevronLeft className="size-4 mr-1" /> Back
              </Button>
              <Button
                onClick={handleFinish}
                disabled={isFinishing}
                className="h-12 flex-1 rounded-2xl bg-gold text-background font-display font-bold text-base hover:bg-gold-bright transition-all shadow-[0_0_25px_rgba(212,175,55,0.4)]"
              >
                {isFinishing ? (
                  <LoaderCircle className="size-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="size-4 mr-2" />
                )}
                Launch ReelOS Cinema
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="relative z-10 mx-auto w-full max-w-4xl px-6 py-4 text-center text-xs text-muted/60">
        ReelOS 2.0 · Personal cinema for this home
      </footer>

      {/* 1-Tap TorBox Key Notice Modal for Express Users */}
      {showExpressKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-amber-500/40 bg-card p-6 shadow-2xl space-y-4 text-left relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                  <Key className="size-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-foreground">
                    TorBox Streaming Key Required
                  </h3>
                  <p className="text-[11px] text-muted">Cloud streaming requires an active key</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExpressKeyModal(false)}
                className="p-1 text-muted hover:text-foreground rounded-full hover:bg-card-2 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              You chose <strong>"I'll figure it out"</strong> to jump ahead. ReelOS needs a TorBox API key to stream releases from the cloud without storing them on your hard drive.
            </p>

            <div className="grid gap-2.5 pt-2">
              <Button
                type="button"
                variant="gold"
                onClick={() => {
                  setShowExpressKeyModal(false);
                  setStep(3);
                }}
                className="h-11 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-gold/20"
              >
                <Key className="size-3.5" />
                Enter TorBox Key Now (Takes 10s)
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowExpressKeyModal(false);
                  handleTrySampleLibrary();
                  handleFinishExpress(nameInput.trim() || "Resident");
                }}
                className="h-11 rounded-xl border border-border/80 text-xs font-semibold text-foreground hover:bg-card-2 flex items-center justify-center gap-2"
              >
                <Film className="size-3.5 text-gold" />
                Explore Free Sample Cinema First
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Device Pairing Modal */}
      {activeQrModal && (() => {
        const targetRes = residents.find((r) => r.id === activeQrModal);
        const resName = targetRes?.name || nameInput || "Resident";
        const effectiveBase =
          pairingBaseUrl ||
          (storeTsIp
            ? `http://${storeTsIp}:8080`
            : storeIpv4
            ? `http://${storeIpv4}:8080`
            : typeof window !== "undefined"
            ? window.location.origin
            : "http://reelos.local:8080");
        const apkUrl = `${effectiveBase.replace(/\/+$/, "")}/clients/reelos-android-universal.apk`;
        const profileLink = `${effectiveBase.replace(/\/+$/, "")}/calibrate?resident=${activeQrModal}`;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl border border-gold/40 bg-card p-6 shadow-2xl space-y-4 text-center relative">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="size-4 text-gold" /> Pair & Onboard: {resName}
                  </h3>
                  <p className="text-[11px] text-muted">Direct home connection or independent cloud streaming</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveQrModal(null)}
                  className="p-1 text-muted hover:text-foreground rounded-full hover:bg-card-2 transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Mode Tabs */}
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-card-2/80 p-1 border border-border/70 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPairTab("android")}
                  className={cn(
                    "rounded-xl py-2 transition-all",
                    pairTab === "android"
                      ? "bg-gold text-background shadow-md"
                      : "text-muted hover:text-foreground"
                  )}
                >
                  Android APK
                </button>
                <button
                  type="button"
                  onClick={() => setPairTab("ios")}
                  className={cn(
                    "rounded-xl py-2 transition-all",
                    pairTab === "ios"
                      ? "bg-gold text-background shadow-md"
                      : "text-muted hover:text-foreground"
                  )}
                >
                  iPhone / Web
                </button>
              </div>

              {/* QR display */}
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card-2 p-5 space-y-3">
                <div className="rounded-xl bg-white p-3 shadow-md">
                  <QrCodeSvg
                    value={pairTab === "android" ? apkUrl : profileLink}
                    size={160}
                  />
                </div>
                <p className="text-xs text-muted max-w-xs">
                  {pairTab === "android"
                    ? "Point camera to download 120Hz APK installer"
                    : "Point camera to open ReelOS directly on iPhone"}
                </p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
