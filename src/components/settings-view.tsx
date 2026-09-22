import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { APP_VERSION } from "@/lib/version-stamp";
import {
  Bell,
  ChevronRight,
  Cloud,
  Cpu,
  HardDrive,
  KeyRound,
  Layers,
  MessageSquare,
  Radio,
  Server,
  Shield,
  SlidersHorizontal,
  Sparkles,
  ThumbsDown,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { showToast } from "@/lib/toast";
import { RemoteComputeModal } from "@/components/remote-compute-modal";
import { HeadlessScreen } from "@/components/headless-screen";
import {
  accessLabel,
  qualityLabel,
  sourceLabel,
  storageLabel,
  useReelStore,
} from "@/lib/store";
import { HouseCard } from "@/components/settings-house";
import {
  AccessPanel,
  FeedbackPanel,
  LibraryPanel,
  MediaStrategyPanel,
  NotesPanel,
  PassportBackupPanel,
  QualityPanel,
  UsersPanel,
} from "@/components/settings-accordions";
import { DisksRow, BatteryGuardianCard, CabinModeCard, ConsoleGamingSentinelCard, HardwareDetectedCard, DedicatedMachineCard, PerformanceRow, SiliconBenchmarkCard, ThemeSelectorCard, TasteRadarCard } from "@/components/settings-panels";
import { AuthorizedDevicesCard } from "@/components/authorized-devices-card";
import { SourcePanel } from "@/components/settings-source";
import { UpdatesRow } from "@/components/settings-updates";
import { LogsRow } from "@/components/settings-logs";
import { FixSection } from "@/components/settings-fix";
import { TerminalRow } from "@/components/settings-terminal";
import { VibeDial } from "@/components/vibe-dial";
import { Row, Section } from "@/components/settings-ui";
import { SupportDiagnosticsView } from "@/components/support-diagnostics-view";
import { ShadowLabPanel } from "@/components/shadow-lab-panel";
import { AndroidTvCard } from "@/components/android-tv-card";
import { CinemaIntelligenceCard } from "@/components/cinema-intelligence-card";

export { TerminalRow };

function CuratorResetRow() {
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    void fetch("/api/curator", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ count?: number }>)
      .then((j) => setCount(Number(j.count) || 0))
      .catch(() => {});
  }, []);
  const run = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/curator/reset", { method: "POST" });
      const j = (await r.json()) as { ok?: boolean; count?: number; error?: string };
      if (!j.ok && j.ok !== undefined) {
        setMsg(j.error || "Reset refused");
        setBusy(false);
        return;
      }
      setCount(Number(j.count) || 0);
      setMsg("Discover likes and Not interested cleared. Library on this box is unchanged.");
    } catch (e) {
      setMsg(String(e));
    }
    setBusy(false);
  };
  return (
    <div className="rounded-2xl border border-border/80 bg-card/80 px-5 py-4 shadow-[var(--shadow-border)] backdrop-blur-md">
      <div className="flex items-start gap-3.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-white/5 text-muted shrink-0 mt-0.5 border border-white/5">
          <ThumbsDown className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-medium text-foreground">Reset curator preferences</p>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            Clears Likes and Not interested on Discover. Titles on this box stay on Home. No Google account.
            {count ? ` ${count} saved.` : ""}
          </p>
          <Button className="mt-3 text-xs hover:border-gold/40 hover:text-gold transition-colors" variant="ghost" size="sm" disabled={busy} onClick={() => void run()}>
            {busy ? "Resetting…" : "Reset curator preferences"}
          </Button>
          {msg ? <p className="mt-2 text-xs text-gold">{msg}</p> : null}
        </div>
      </div>
    </div>
  );
}

function LibrarySanitizeRow() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const run = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/library/sanitize", { method: "POST" });
      const j = (await r.json()) as { ok?: boolean; sanitized?: number; error?: string };
      if (!j.ok) {
        setMsg(j.error || "Sanitize failed");
        setBusy(false);
        return;
      }
      setMsg(j.sanitized ? `Cleaned ${j.sanitized} title(s).` : "All titles already clean.");
      useReelStore.getState().hydrateShelf({ limit: 24, force: true });
    } catch (e) {
      setMsg(String(e));
    }
    setBusy(false);
  };
  return (
    <div className="rounded-2xl border border-border/80 bg-card/80 px-5 py-4 shadow-[var(--shadow-border)] backdrop-blur-md">
      <div className="flex items-start gap-3.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-gold/10 text-gold shrink-0 border border-gold/20 mt-0.5">
          <Sparkles className="size-4 text-gold" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-medium text-foreground">Clean Up Movie Names</p>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            Strips messy release tags (like 1080p, BluRay, x264) from downloads so movie and TV titles look clean and beautiful.
          </p>
          <Button className="mt-3 text-xs hover:border-gold/40 hover:text-gold transition-colors" variant="ghost" size="sm" disabled={busy} onClick={() => void run()}>
            {busy ? "Cleaning…" : "Clean Up Titles"}
          </Button>
          {msg ? <p className="mt-2 text-xs text-gold">{msg}</p> : null}
        </div>
      </div>
    </div>
  );
}

function LibraryResetRow() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const run = async (resync: boolean = false) => {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/library/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, resync: Boolean(resync) }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!j.ok) {
        setMsg(j.error || "Reset refused");
        setBusy(false);
        return;
      }
      if (!resync) {
        useReelStore.setState({ requests: [], activity: [] });
      }
      useReelStore.getState().hydrateShelf({ limit: 24, force: true });
      const statusText = resync ? "Library reset and re-synced from cloud." : "Media library refreshed. Saved titles and links cleaned up.";
      setMsg(statusText);
      showToast(statusText, "success");
      setBusy(false);
      setOpen(false);
    } catch (e) {
      setMsg(String(e));
      setBusy(false);
    }
  };
  return (
    <div className="rounded-2xl border border-border/80 bg-card/80 px-5 py-4 shadow-[var(--shadow-border)] backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display font-medium text-foreground">Reset Movie Library & Cloud Re-sync</p>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            Cleanly refresh movie catalog and playback links, or re-sync all titles from your cloud library.
          </p>
        </div>
      </div>
      {!open ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" className="text-xs hover:border-gold/40 hover:text-gold transition-colors" onClick={() => setOpen(true)}>
            Reset options
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="danger" size="sm" className="text-xs" disabled={busy} onClick={() => void run(true)}>
            {busy ? "Resetting…" : "Reset & Re-sync from Cloud"}
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" disabled={busy} onClick={() => void run(false)}>
            Clear Local Library
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      )}
      {msg ? <p className="mt-2 text-xs text-gold">{msg}</p> : null}
    </div>
  );
}

function FactoryResetRow() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const run = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/reset", { method: "POST" });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!j.ok) {
        setMsg(j.error || "Reset refused");
        setBusy(false);
        return;
      }
      useReelStore.getState().factoryReset();
      setMsg("Resetting. Wizard, then Connect.");
      window.setTimeout(() => window.location.reload(), 4000);
    } catch (e) {
      setMsg(String(e));
      setBusy(false);
    }
  };
  return (
    <div className="rounded-2xl border border-border/80 bg-card/80 px-5 py-4 shadow-[var(--shadow-border)] backdrop-blur-md">
      <p className="font-display font-medium text-foreground">Factory reset</p>
      <p className="mt-1 text-xs text-muted leading-relaxed">
        First-run again. Keeps media on disk. Wipes wizard answers and engine configs. Will not run during an update.
      </p>
      {!open ? (
        <Button className="mt-3 text-xs" variant="danger" size="sm" onClick={() => setOpen(true)}>
          Factory reset
        </Button>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="danger" size="sm" className="text-xs" disabled={busy} onClick={() => void run()}>
            {busy ? "Resetting…" : "Yes, reset"}
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      )}
      {msg ? <p className="mt-2 text-xs text-muted">{msg}</p> : null}
    </div>
  );
}

function SiliconTierCard() {
  const [hw, setHw] = useState<{ ramGb?: number; probed?: boolean; cpuModel?: string; cpus?: number } | null>(null);

  useEffect(() => {
    void fetch("/api/hardware", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ramGb?: number; probed?: boolean; cpuModel?: string; cpus?: number }>)
      .then((d) => setHw(d))
      .catch(() => {});
  }, []);

  const ramGb = Number(hw?.ramGb || 4);
  const isPotato = ramGb <= 4.5;
  const isWorkhorse = !isPotato && ramGb <= 16;

  return (
    <div className="rounded-2xl border border-gold/30 bg-gold/[0.04] p-5 shadow-[var(--shadow-border)] space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gold/15 text-gold">
            <Cpu className="size-5" />
          </span>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gold font-mono">
              Hardware Profile & Capabilities
            </div>
            <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              {isPotato ? "🥔 Potato Appliance" : isWorkhorse ? "⚡ Whisper Workhorse" : "🐉 Beast Mode"}
            </h3>
          </div>
        </div>
        <span className="self-start sm:self-auto rounded-full bg-gold/15 border border-gold/40 px-3 py-1 text-xs font-mono font-semibold text-gold">
          {isPotato ? "Original quality only" : isWorkhorse ? "Hardware conversion available" : "High-capacity playback"}
        </span>
      </div>

      <p className="text-xs text-muted leading-relaxed">
        {isPotato
          ? "Your machine runs whisper-quiet on low power with zero thermal stress. Video re-encoding is strictly locked: your TV and phone hardware decoders play 4K HDR smoothly without taxing the CPU."
          : isWorkhorse
          ? "Compatible Intel video hardware was detected. ReelOS enables conversion only after a playback check passes."
          : "Higher-capacity hardware was detected. Conversion and simultaneous playback remain limited by measured checks."}
      </p>

      <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono text-muted border-t border-border/40">
        <span className="text-foreground font-medium">{ramGb} GB RAM Visible</span>
        <span>·</span>
        <span>{hw?.cpus ? `${hw.cpus} CPU Cores` : "Quad-Core"}</span>
        <span>·</span>
        <span className="text-emerald-400">Zero Fan Noise Tuning</span>
      </div>
    </div>
  );
}

export function SettingsView() {
  const [lan, setLan] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [remoteModalOpen, setRemoteModalOpen] = useState(false);
  const [isHeadlessActive, setIsHeadlessActive] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(false);

  useEffect(() => {
    fetch("/api/system/remote-compute")
      .then((r) => r.json())
      .then((d) => {
        if (d?.remoteCompute) setIsHeadlessActive(true);
      })
      .catch(() => {});
  }, []);

  const handleConfirmRemote = async () => {
    setRemoteLoading(true);
    try {
      await fetch("/api/system/remote-compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });
      setRemoteModalOpen(false);
      setIsHeadlessActive(true);
      showToast("Entering Remote Computer Mode · Screen Blanked", "success");
    } catch {
      showToast("Error enabling remote compute mode", "error");
    } finally {
      setRemoteLoading(false);
    }
  };

  useEffect(() => {
    void fetch("/api/box", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ipv4?: string | null; answers?: Record<string, unknown> }>)
      .then((b) => {
        if (b.ipv4) setLan(b.ipv4);
        if (b.answers && typeof b.answers === "object") {
          useReelStore.getState().patchAnswers(b.answers);
        }
      })
      .catch(() => {});
  }, []);

  const answers = useReelStore((s) => s.answers);
  const residents = useReelStore((s) => s.residents);
  const activeResidentId = useReelStore((s) => s.activeResidentId);
  const activeResident = residents.find((r) => r.id === activeResidentId) ?? residents[0];
  const settings = useReelStore((s) => s.settings);
  const adapter = useReelStore((s) => s.adapter);
  const hideAdvanced = settings.hideAdvanced;
  const [panel, setPanel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"system" | "media" | "family" | "support">("system");

  const handleVersionTap = () => {
    const next = tapCount + 1;
    setTapCount(next);
    if (next === 7) {
      showToast("🔓 Developer Cockpit Unlocked", "success");
      setAdvanced(true);
    }
  };

  if (isHeadlessActive) {
    return <HeadlessScreen onWake={() => setIsHeadlessActive(false)} />;
  }

  return (
    <div className="w-full px-6 md:px-12 lg:px-16 max-w-7xl mx-auto py-6 md:py-8">
      <RemoteComputeModal
        open={remoteModalOpen}
        onClose={() => setRemoteModalOpen(false)}
        onConfirm={handleConfirmRemote}
        loading={remoteLoading}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Appliance identity, streaming provider, family access, and support.
          </p>
        </div>
        <button
          type="button"
          onClick={handleVersionTap}
          className="self-start sm:self-auto rounded-full border border-border/80 bg-card/60 px-3 py-1 text-xs font-mono text-muted hover:text-gold transition-colors cursor-pointer"
          title="Tap 7 times for Developer Cockpit"
        >
          v{APP_VERSION} · Core {advanced ? "· Dev Mode" : ""}
        </button>
      </div>

      {/* 4 Consumer Pillars Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-6 border-b border-border/60 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("system")}
          className={cn(
            "rounded-2xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer shrink-0",
            activeTab === "system"
              ? "bg-gold text-gold-fg shadow-sm"
              : "text-muted hover:text-foreground hover:bg-white/5",
          )}
        >
          Appliance & System
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("media")}
          className={cn(
            "rounded-2xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer shrink-0",
            activeTab === "media"
              ? "bg-gold text-gold-fg shadow-sm"
              : "text-muted hover:text-foreground hover:bg-white/5",
          )}
        >
          Media & Cloud Streaming
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("family")}
          className={cn(
            "rounded-2xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer shrink-0",
            activeTab === "family"
              ? "bg-gold text-gold-fg shadow-sm"
              : "text-muted hover:text-foreground hover:bg-white/5",
          )}
        >
          Family & Living Room TV
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("support")}
          className={cn(
            "rounded-2xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5",
            activeTab === "support"
              ? "bg-gold text-gold-fg shadow-sm"
              : "text-muted hover:text-foreground hover:bg-white/5",
          )}
        >
          <Shield className="size-3.5" />
          Support & Diagnostics
        </button>
      </div>

      {/* Pillar 1: Appliance & System */}
      {activeTab === "system" && (
        <div className="space-y-6">
          <CinemaIntelligenceCard />

          <Section title="Appliance Identity & Hardware" hint="This house, hardware tier, updates, and storage.">
            <SiliconTierCard />
            <HouseCard />

            <Link
              to="/guide"
              className="flex items-center justify-between rounded-2xl border border-border bg-card p-5 hover:bg-card-2 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-foreground group-hover:text-gold transition-colors">
                    Appliance Guide & Hardware Playbook
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    3 Silicon Tiers, streaming casting from laptop, and hardware tour.
                  </p>
                </div>
              </div>
              <ChevronRight className="size-4 text-muted group-hover:text-gold transition-colors" />
            </Link>

            <UpdatesRow
              open={panel === "updates"}
              onClick={() => setPanel(panel === "updates" ? null : "updates")}
            />
            <DisksRow
              open={panel === "disks"}
              onClick={() => setPanel(panel === "disks" ? null : "disks")}
            />
            <BatteryGuardianCard />
            <CabinModeCard />
            <ConsoleGamingSentinelCard />
          </Section>

          <Section title="Atmosphere & Display Theme" hint="Color theme and visual vibe dial.">
            <ThemeSelectorCard />
            <VibeDial />
          </Section>
        </div>
      )}

      {/* Pillar 2: Media & Cloud Streaming */}
      {activeTab === "media" && (
        <div className="space-y-6">
          <Section title="Streaming Provider & Cache" hint="Cloud streaming connection, playback quality floor, and hybrid storage.">
            <Row
              icon={KeyRound}
              title="Streaming Source & Cloud Provider"
              hint={`${sourceLabel[answers.source]} · ${adapter.status === "healthy" ? "connected" : "offline"}`}
              open={panel === "source"}
              onClick={() => setPanel(panel === "source" ? null : "source")}
            >
              <SourcePanel />
            </Row>
            <Row
              icon={SlidersHorizontal}
              title="Quality Floor"
              hint={qualityLabel[answers.quality]}
              open={panel === "quality"}
              onClick={() => setPanel(panel === "quality" ? null : "quality")}
            >
              <QualityPanel />
            </Row>
            <Row
              icon={Layers}
              title="Media Strategy & Storage"
              hint="Smart Hybrid · Instant Cloud vs Offline Download"
              open={panel === "strategy"}
              onClick={() => setPanel(panel === "strategy" ? null : "strategy")}
            >
              <MediaStrategyPanel />
            </Row>
            <Row
              icon={Cloud}
              title="Cloud Passport & Backup"
              hint="Media Server on a Thumb Stick · Google Drive Sync"
              open={panel === "passport"}
              onClick={() => setPanel(panel === "passport" ? null : "passport")}
            >
              <PassportBackupPanel />
            </Row>
          </Section>

          <Section title="Taste Radar & Cinema Taste" hint="Household affinities, movie vibes, and tailored curation.">
            <TasteRadarCard />
          </Section>
        </div>
      )}

      {/* Pillar 3: Family & TV */}
      {activeTab === "family" && (
        <div className="space-y-6">
          <Section title="Profiles & Living Room TV" hint="Household profiles, kids sandbox, and Android TV wireless sideloading.">
            <Row
              icon={Users}
              title="Residents & Family Profiles"
              hint={`${residents.length} resident(s) configured · active: ${activeResident.name}`}
              open={panel === "users"}
              onClick={() => setPanel(panel === "users" ? null : "users")}
            >
              <UsersPanel />
            </Row>
            <AndroidTvCard />
            <AuthorizedDevicesCard />
            <CuratorResetRow />
            <Row
              icon={Bell}
              title="Notifications"
              hint={settings.notifyAvailable ? "Available + failed" : "Off"}
              open={panel === "notes"}
              onClick={() => setPanel(panel === "notes" ? null : "notes")}
            >
              <NotesPanel />
            </Row>
            <Row
              icon={MessageSquare}
              title="Send Feedback & Feature Ideas"
              hint="Direct line to ReelOS Core · Share ideas or report bugs"
              open={panel === "feedback"}
              onClick={() => setPanel(panel === "feedback" ? null : "feedback")}
            >
              <FeedbackPanel />
            </Row>
          </Section>
        </div>
      )}

      {/* Pillar 4: Support & Diagnostics */}
      {activeTab === "support" && (
        <div className="space-y-6">
          <Section title="Customer Support & Appliance Health" hint="Live health matrix, 1-click diagnostics bundle, and technician passkey.">
            <SupportDiagnosticsView />
          </Section>

          <Section title="Reset & Maintenance" hint="Clean cache, tidy titles, or restore factory state.">
            <LibrarySanitizeRow />
            <LibraryResetRow />
            <FactoryResetRow />
          </Section>
        </div>
      )}

      {/* Advanced / Developer Diagnostics Toggle */}
      <div className="mt-8">
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="flex items-center justify-between w-full rounded-2xl border border-border/80 bg-card/60 px-5 py-3.5 text-left shadow-sm hover:bg-card/80 transition-colors"
        >
          <div>
            <p className="font-display text-sm font-medium text-foreground">{advanced ? "Hide Advanced" : "Show Advanced"}</p>
            <p className="text-xs text-muted mt-0.5">Named Fix scripts, doctor recovery, and low-level diagnostics.</p>
          </div>
          <ChevronRight className={cn("size-4 text-muted transition-transform", advanced ? "rotate-90" : "")} />
        </button>
      </div>

      {/* Hidden Developer Cockpit */}
      {advanced && (
        <div className="mt-10 pt-8 border-t border-gold/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="size-2 rounded-full bg-gold animate-ping" />
            <h2 className="font-display text-lg font-bold text-gold">Developer Cockpit & Shadow Lab</h2>
          </div>
          <p className="text-xs text-muted mb-6">
            Low-level hardware benchmarking, micro-engine inspectors, raw system logs, and live terminal shell.
          </p>

          <Section title="Subsystem Diagnostics & Benchmarking" hint="Doctor recovery, performance load, and hardware detection.">
            <FixSection />
            <div className="rounded-2xl border border-gold/30 bg-card/80 p-5 shadow-sm backdrop-blur-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-gold/10 text-gold shrink-0 mt-0.5 border border-gold/20">
                    <Server className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-medium text-foreground">Use This Machine as a Remote Computer</h3>
                    <p className="mt-1 text-xs text-muted leading-relaxed max-w-xl">
                      Blank the physical display and quietly lend this machine&apos;s CPU and memory to your household mesh.
                      Tap the spacebar 5 times at any time on the physical keyboard to immediately restore the screen.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setRemoteModalOpen(true)}
                  className="bg-gold text-gold-fg hover:bg-gold/90 font-medium text-xs shrink-0 self-start sm:self-auto"
                >
                  Configure Remote Compute
                </Button>
              </div>
            </div>
            <DedicatedMachineCard />
            <HardwareDetectedCard />
            <SiliconBenchmarkCard />
            <PerformanceRow />
            <LogsRow
              open={panel === "logs"}
              onClick={() => setPanel(panel === "logs" ? null : "logs")}
            />
            <TerminalRow open={panel === "term"} onClick={() => setPanel(panel === "term" ? null : "term")} />
            
            <Link
              to="/engine/$id"
              params={{ id: "reelflow" }}
              className="flex items-center justify-between rounded-2xl border border-border/80 bg-card/80 px-5 py-4 shadow-sm backdrop-blur-md hover:bg-white/[0.02] transition-colors"
            >
              <div>
                <p className="font-display font-medium text-foreground">ReelFlow Micro-Engine Pipeline</p>
                <p className="mt-1 text-xs text-muted">
                  Inspect source lookup, provider verification, and library linking.
                </p>
              </div>
              <ChevronRight className="size-4 text-gold" />
            </Link>

            <ShadowLabPanel />
          </Section>
        </div>
      )}
    </div>
  );
}
