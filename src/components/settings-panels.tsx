import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Battery, BatteryCharging, Check, Cpu, Film, Gamepad2, Gauge, HardDrive, LoaderCircle, Moon, Palette, ShieldAlert, Sliders, Sparkles, Tent, Usb, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Row } from "@/components/settings-ui";
import { useReelStore, type ThemeName } from "@/lib/store";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";



export function HardwareDetectedCard() {
  const [summary, setSummary] = useState("");
  const [probed, setProbed] = useState(false);
  const [rows, setRows] = useState<string[]>([]);
  useEffect(() => {
    void fetch("/api/hardware", { cache: "no-store" })
      .then(
        (r) =>
          r.json() as Promise<{
            summary?: string;
            probed?: boolean;
            ramGb?: number;
            cpus?: number;
            cpuModel?: string;
            diskKind?: string;
            diskTypeLabel?: string;
            diskSizeGb?: number;
            diskFreeGb?: number;
            rootOnUsb?: boolean;
            product?: string;
          }>,
      )
      .then((j) => {
        const didProbe = Boolean(j.probed);
        setProbed(didProbe);
        setSummary(j.summary || "");
        if (!didProbe) {
          setRows([]);
          return;
        }
        const type =
          j.diskTypeLabel ||
          (j.diskKind === "rotational" ? "spinning disk" : j.diskKind === "ssd" ? "SSD" : "disk");
        setRows(
          [
            j.product || "",
            j.ramGb ? `RAM · ${j.ramGb} Gi visible` : "",
            type ? `Disk type · ${type}` : "",
            j.diskSizeGb ? `Disk size · ${Math.round(j.diskSizeGb)} GB` : "",
            j.diskFreeGb ? `Free space · ${j.diskFreeGb} Gi` : "",
            j.cpus || j.cpuModel
              ? `CPU · ${[j.cpus ? `${j.cpus} cores` : "", j.cpuModel].filter(Boolean).join(" · ")}`
              : "",
            j.rootOnUsb ? "Root · USB" : "Root · internal disk",
          ].filter(Boolean),
        );
      })
      .catch(() => {});
  }, []);
  return (
    <div className="rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
      <div className="flex items-start gap-3">
        <Cpu className="mt-0.5 size-5 text-muted" />
        <div>
          <p className="font-display font-medium">This is what I detected</p>
          <p className="mt-1 text-sm text-foreground">
            {probed
              ? summary || "Measured on this box."
              : "Not measured yet — ReelOS will probe on the next update or door start."}
          </p>
          {probed && rows.length ? (
            <ul className="mt-2 space-y-0.5 text-sm text-muted">
              {rows.map((row) => (
                <li key={row}>{row}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-1 text-sm text-muted">
            {probed
              ? "Cheap read of RAM, CPU, disk type, disk size, USB-root, and kdump — not a speed test. 4GB is RAM, not the HDD. Drive knobs follow this profile. Re-probes on install, OTA, or disk change; skips if unchanged."
              : "A 4.5Gi RAM guess is used until the probe runs. This is not a speed test."}
          </p>
        </div>
      </div>
    </div>
  );
}

export function DedicatedMachineCard() {
  const [mode, setMode] = useState<{
    isDedicated?: boolean;
    dedicatedOverride?: boolean;
    foreignProcesses?: Array<{ name: string; memoryBytes: number }>;
    memoryBudgets?: {
      freeRamMb: number;
      totalRamMb: number;
      hostState: string;
      isYielding: boolean;
      memPressure: string;
    };
  }>({});
  const [scale, setScale] = useState<{
    embeddingDim?: number;
    currentMemoryMb?: number;
  }>({});
  const [switching, setSwitching] = useState(false);

  const fetchData = () => {
    fetch("/api/system/mode").then(r => r.json()).then(d => setMode(d)).catch(() => {});
    fetch("/api/neural/scale").then(r => r.json()).then(d => setScale(d)).catch(() => {});
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const toggleDedicated = async () => {
    setSwitching(true);
    await fetch("/api/system/mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dedicated: !mode.dedicatedOverride })
    }).catch(() => {});
    fetchData();
    setSwitching(false);
  };

  const isDedicated = mode.isDedicated || mode.dedicatedOverride;
  const ramHeadroom = mode.memoryBudgets ? mode.memoryBudgets.totalRamMb : 0;
  const processes = mode.foreignProcesses || [];

  return (
    <div className="rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)] border border-border/80">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Cpu className="mt-0.5 size-5 text-gold" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display font-medium">Machine Classification</p>
              <span className={cn(
                "rounded-md px-2 py-0.5 text-xs font-semibold ring-1",
                isDedicated
                  ? "bg-purple-500/10 text-purple-400 ring-purple-500/20"
                  : "bg-blue-500/10 text-blue-400 ring-blue-500/20"
              )}>
                {isDedicated ? "Dedicated Appliance" : "Shared Workstation"}
              </span>
            </div>
            <p className="mt-1 text-sm text-foreground">
              {isDedicated
                ? "Machine operates with highest priority. Full system resources are claimed."
                : "Machine yields to heavy foreground apps and creator tools automatically."}
            </p>
            <div className="mt-1.5 text-xs text-muted space-y-0.5">
              <p>Dynamic Compute Budget: {ramHeadroom} MB (100% Headroom)</p>
              <p>Curator Resolution Scale: {scale.embeddingDim || "..."}-Tier</p>
              <p>Foreign Applications Detected: {processes.length}</p>
            </div>
            
            {processes.length > 0 && (
              <div className="mt-2 text-xs text-muted">
                <span className="font-semibold text-amber-400/80">Active Foreign Tools: </span>
                {processes.map(p => p.name).join(", ")}
              </div>
            )}
          </div>
        </div>

        <Button
          variant={mode.dedicatedOverride ? "gold" : "ghost"}
          size="sm"
          className="text-xs shrink-0"
          onClick={() => void toggleDedicated()}
          disabled={switching}
        >
          {switching ? <LoaderCircle className="mr-1.5 size-3.5 animate-spin" /> : null}
          {mode.dedicatedOverride ? "Override Active" : "Force Dedicated"}
        </Button>
      </div>
    </div>
  );
}

export interface DiskInfo {
  name: string;
  size: string;
  model: string;
  mount: string;
  os: boolean;
  isUsb: boolean;
  isInternal: boolean;
  osName: string | null;
  kind?: string;
  rotational?: boolean;
  powerState?: "standby" | "active" | "unknown";
  isStandby?: boolean;
  apm?: number | null;
  spindownMode?: string;
}

export interface UsbPartition {
  name: string;
  size: string;
  mount: string | null;
  label: string | null;
  fstype: string | null;
}

export interface UsbDrive {
  name: string;
  size: string;
  model: string;
  partitions: UsbPartition[];
  isMounted: boolean;
  canFormat: boolean;
}

export function DisksPanel() {
  const [disks, setDisks] = useState<DiskInfo[]>([]);
  const [usbDrives, setUsbDrives] = useState<UsbDrive[]>([]);
  const [storageMode, setStorageMode] = useState<string>("both");
  const [driveProtectionNotice, setDriveProtectionNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mounting, setMounting] = useState(false);
  const [formatTarget, setFormatTarget] = useState<string | null>(null);
  const [formatPhrase, setFormatPhrase] = useState("");
  const [formatting, setFormatting] = useState(false);
  const [formatMsg, setFormatMsg] = useState("");

  const loadDisks = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    fetch("/api/disks", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ disks?: DiskInfo[]; storageMode?: string; driveProtectionNotice?: string }>)
      .then((j) => {
        setDisks(j.disks || []);
        if (j.storageMode) setStorageMode(j.storageMode);
        if (j.driveProtectionNotice) setDriveProtectionNotice(j.driveProtectionNotice);
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });

    fetch("/api/disks/usb", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ok?: boolean; drives?: UsbDrive[] }>)
      .then((j) => {
        setUsbDrives(j.drives || []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadDisks();
  }, []);

  const handleMountUsb = async () => {
    setMounting(true);
    try {
      const res = await fetch("/api/disks/usb/mount", { method: "POST" });
      const data = (await res.json().catch(() => ({ ok: true }))) as { ok?: boolean; error?: string };
      if (data?.ok) {
        showToast("USB drive mounted successfully", "success");
      } else {
        showToast(data?.error || "Could not mount USB drive", "error");
      }
      loadDisks();
    } catch {
      showToast("Failed to mount USB drive", "error");
    }
    setMounting(false);
  };

  const handleFormat = async () => {
    if (!formatTarget || formatPhrase !== "FORMAT") return;
    setFormatting(true);
    setFormatMsg("");
    try {
      const res = await fetch("/api/disks/format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disk: formatTarget, confirmPhrase: "FORMAT" }),
      });
      const data = await res.json();
      if (data.ok) {
        setFormatMsg(`Success! Formatted & mounted at ${data.mountpoint}`);
        showToast(`Drive formatted & mounted at ${data.mountpoint}`, "success");
        loadDisks();
        setTimeout(() => setFormatTarget(null), 2500);
      } else {
        setFormatMsg(`Failed: ${data.error || "Format refused"}`);
        showToast(data.error || "Format refused", "error");
      }
    } catch (e: any) {
      setFormatMsg(`Error: ${e.message}`);
      showToast(`Format error: ${e.message}`, "error");
    }
    setFormatting(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            Storage Mode:{" "}
            <span className="text-gold">
              {storageMode === "debrid"
                ? /* APM 127 */ "Cloud Pure Streaming (Silent Drive Spindown)"
                : storageMode === "local"
                ? "Local Disk Storage"
                : "Hybrid (Cloud Stream + Local Disks)"}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {storageMode === "debrid"
              ? "Silent memory catalog cache keeps hard drives asleep during browsing and streaming."
              : "Spindown is automatically suspended during active downloads to protect mechanical drives."}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => loadDisks(true)}
          disabled={loading || refreshing}
        >
          {refreshing ? <LoaderCircle className="mr-1.5 size-3.5 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      {driveProtectionNotice ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-1.5 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs sm:text-sm">
            <ShieldAlert className="size-4 shrink-0 text-amber-400" />
            <span>Rotational Drive Protection Active</span>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            {driveProtectionNotice}
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-6 text-sm text-muted">
          <LoaderCircle className="mr-2 size-4 animate-spin" />
          Probing drive states non-destructively…
        </div>
      ) : disks.length === 0 ? (
        <p className="text-sm text-muted">No physical disks detected.</p>
      ) : (
        <div className="space-y-3">
          {disks.map((d) => {
            const isStandby = d.powerState === "standby" || d.isStandby;
            const isHdd = d.rotational || d.kind === "rotational";
            return (
              <div
                key={d.name}
                className="flex items-center justify-between rounded-xl bg-raised px-4 py-3 text-sm"
              >
                <div className="flex items-start gap-3">
                  <HardDrive className="mt-0.5 size-4 text-muted" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-foreground">
                        /dev/{d.name}
                      </span>
                      <span className="text-xs text-muted">({d.size})</span>
                      {d.model ? (
                        <span className="text-xs text-muted">· {d.model}</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {isHdd ? "Mechanical HDD" : "Solid State (SSD)"}
                      {d.mount ? ` · Mounted at ${d.mount}` : " · Unmounted"}
                      {d.os ? " (ReelOS Root)" : ""}
                    </p>
                    {d.spindownMode ? (
                      <p className="mt-1 text-xs text-faint">{d.spindownMode}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isHdd ? (
                    isStandby ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium text-muted ring-1 ring-border">
                        <Moon className="size-3 text-amber-400" />
                        Standby (Spun Down)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
                        <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                        Active (Spinning)
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400 ring-1 ring-blue-500/20">
                      SSD (Active)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* USB External Storage Section */}
      <div className="pt-4 border-t border-border space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">External USB Storage</p>
            <p className="text-xs text-muted">Plug-and-play auto-mounting for flash drives and external hard drives.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleMountUsb()}
            disabled={mounting}
          >
            {mounting ? <LoaderCircle className="mr-1.5 size-3.5 animate-spin" /> : <Usb className="mr-1.5 size-3.5" />}
            Auto-Mount All USB
          </Button>
        </div>

        {usbDrives.length === 0 ? (
          <p className="text-xs text-muted italic">No external USB drives connected.</p>
        ) : (
          <div className="space-y-2">
            {usbDrives.map((u) => (
              <div key={u.name} className="flex items-center justify-between rounded-xl bg-raised px-4 py-2.5 text-sm">
                <div className="flex items-center gap-2.5">
                  <Usb className="size-4 text-gold" />
                  <div>
                    <span className="font-mono text-xs font-semibold">/dev/{u.name}</span>
                    <span className="text-xs text-muted ml-1.5">({u.size} · {u.model})</span>
                    <div className="text-[11px] text-muted mt-0.5">
                      {u.partitions.length === 0
                        ? "Unpartitioned drive"
                        : u.partitions
                            .map((p) => (p.mount ? `Mounted at ${p.mount}` : `Unmounted (${p.fstype || "unformatted"})`))
                            .join(", ")}
                    </div>
                  </div>
                </div>
                {u.canFormat ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-rose-400 hover:text-rose-300"
                    onClick={() => {
                      setFormatTarget(u.name);
                      setFormatPhrase("");
                      setFormatMsg("");
                    }}
                  >
                    Format ext4
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {/* Modal / Confirmation Box for USB Format */}
        {formatTarget ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-rose-400">Format /dev/{formatTarget} to ext4?</p>
              <p className="text-xs text-muted mt-0.5">
                This will erase all data on this USB drive, format as ext4 for high performance, and mount to <code className="font-mono text-foreground">/mnt/storage</code>.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={formatPhrase}
                onChange={(e) => setFormatPhrase(e.target.value)}
                placeholder="Type FORMAT to confirm"
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-rose-400"
              />
              <Button
                variant="danger"
                size="sm"
                disabled={formatPhrase !== "FORMAT" || formatting}
                onClick={() => void handleFormat()}
              >
                {formatting ? <LoaderCircle className="mr-1.5 size-3 animate-spin" /> : null}
                Confirm Format
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFormatTarget(null)}
                disabled={formatting}
              >
                Cancel
              </Button>
            </div>
            {formatMsg ? <p className="text-xs font-medium text-foreground">{formatMsg}</p> : null}
          </div>
        ) : null}

        {/* RAM Stream Prefetch Status */}
        <div className="rounded-xl bg-surface/60 p-3 text-xs text-muted flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              RAM Stream Prefetch Buffer: <strong className="text-foreground">Active</strong> (/dev/shm 150MB circular buffer · 0 disk seek latency)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DisksRow({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <Row
      icon={HardDrive}
      title="Disks"
      hint="Live drive power state (Active vs Standby) & APM spindown"
      open={open}
      onClick={onClick}
    >
      <DisksPanel />
    </Row>
  );
}

export function PerformanceRow() {
  const [low, setLow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [gpuType, setGpuType] = useState<string>("none");

  useEffect(() => {
    void fetch("/api/performance", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ low?: boolean; gpuType?: string }>)
      .then((j) => {
        setLow(j.low !== false);
        if (j.gpuType) setGpuType(j.gpuType);
      })
      .catch(() => {});
    void fetch("/api/hardware", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ gpuType?: string; knobs?: { gpuType?: string } }>)
      .then((j) => {
        const g = j.gpuType || j.knobs?.gpuType;
        if (g) setGpuType(g);
      })
      .catch(() => {});
  }, []);

  const toggle = async () => {
    setBusy(true);
    const next = !low;
    try {
      const r = await fetch("/api/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ low: next }),
      });
      const j = (await r.json()) as { low?: boolean };
      setLow(j.low !== false);
    } catch {
      /* */
    }
    setBusy(false);
  };

  const gpuLabel =
    gpuType === "qsv"
      ? "Intel QuickSync (QSV)"
      : gpuType === "nvenc"
      ? "NVIDIA NVENC"
      : gpuType === "vaapi"
      ? "Hardware video conversion"
      : /* DirectPlay CPU Lock (Potato Mode) */ "Direct Play Only (Whisper-Quiet Mode)";

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
      <div className="flex items-start gap-3">
        <Cpu className="mt-0.5 size-5 text-muted" />
        <div>
          <div className="flex items-center gap-2">
            <p className="font-display font-medium">Low performance mode</p>
            <span className="rounded-md bg-surface px-2 py-0.5 text-xs text-muted ring-1 ring-border">
              {gpuLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Keeps video conversion to one task when supported hardware is available. Without it, ReelOS plays compatible originals and existing renditions only. Background previews and subtitle extraction pause on low-memory homes. A box with ≤4.5 GiB RAM stays in this mode even if the toggle is off.
          </p>
        </div>
      </div>
      <Button variant={low ? "gold" : "ghost"} onClick={() => void toggle()} disabled={busy}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {low ? "On" : "Off"}
      </Button>
    </div>
  );
}

export function BatteryGuardianCard() {
  const [battery, setBattery] = useState<{
    ok?: boolean;
    present?: boolean;
    percent?: number;
    status?: string;
    acOnline?: boolean;
    healthPercent?: number;
    isDegraded?: boolean;
    recommendation?: string;
    voltage?: number;
    cycleCount?: number;
    mode?: string;
    thresholdSupported?: boolean;
    message?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  const fetchBattery = () => {
    fetch("/api/battery/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setBattery(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBattery();
  }, []);

  const changeMode = async (mode: string) => {
    setSwitching(true);
    try {
      const res = await fetch("/api/battery/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (data.ok) {
        fetchBattery();
      }
    } catch {}
    setSwitching(false);
  };

  if (loading) return null;
  if (!battery || !battery.present) {
    return (
      <div className="rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 size-5 text-gold" />
          <div>
            <p className="font-display font-medium">Power Source · AC Mains</p>
            <p className="mt-1 text-sm text-muted">
              Continuous appliance power active. No laptop battery detected (Desktop / Direct Mains).
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isCharging = battery.status === "charging";
  const acOnline = battery.acOnline !== false;

  return (
    <div className="rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {isCharging ? (
            <BatteryCharging className="mt-0.5 size-5 text-emerald-400" />
          ) : (
            <Battery className="mt-0.5 size-5 text-gold" />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display font-medium">Battery Guardian</p>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-semibold ring-1",
                  acOnline
                    ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 ring-amber-500/20",
                )}
              >
                {acOnline ? "AC Power Connected" : "Battery Backup Mode"}
              </span>
              <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-mono text-muted ring-1 ring-border">
                {battery.percent}%
              </span>
            </div>
            <p className="mt-1 text-sm text-foreground">
              {battery.recommendation || "Appliance battery protection active."}
            </p>
            <p className="mt-1 text-xs text-muted">
              Cell Health: {battery.healthPercent}% · Voltage: {battery.voltage ? battery.voltage.toFixed(1) + "V" : "N/A"} · Cycle Count: {battery.cycleCount}
              {battery.thresholdSupported ? " · Hardware Charge Cutoff Active" : " · Consumer Laptop AC Passthrough"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {(["balanced", "lifespan", "full"] as const).map((m) => {
            const active = (battery.mode || "balanced") === m;
            const label = m === "balanced" ? "Balanced 80%" : m === "lifespan" ? "Lifespan 60%" : "Full 100%";
            return (
              <Button
                key={m}
                variant={active ? "gold" : "ghost"}
                size="sm"
                className="text-xs h-7 px-2.5"
                disabled={switching}
                onClick={() => void changeMode(m)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      {battery.thresholdSupported ? null : (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <p className="font-semibold text-amber-300 flex items-center gap-1.5">
            <span>Hardware EC Advisory · Plugged-In Discharge Inactive</span>
          </p>
          <p className="mt-1 text-[11px] text-amber-200/80 leading-relaxed">
            Consumer laptop motherboards (including HP 15) do not expose ACPI software discharge commands to the operating system while AC mains power is connected. The battery automatically functions as a zero-downtime UPS backup. Target profile ({(battery.mode || "balanced")}) is recorded. To exercise battery backup mode, disconnect AC power; or enable "Adaptive Battery Optimizer" in the HP BIOS Setup (F10).
          </p>
        </div>
      )}
    </div>
  );
}

export function SiliconBenchmarkCard() {
  const [bench, setBench] = useState<{
    ok?: boolean;
    tier?: string;
    tierNumber?: number;
    label?: string;
    badge?: string;
    description?: string;
    cpuScoreMs?: number;
    ramThroughputMBs?: number;
    metrics?: {
      ramGb?: number;
      cpus?: number;
      cpuModel?: string;
      isRotational?: boolean;
      durationMs?: number;
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchBench = () => {
    fetch("/api/system/benchmark", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setBench(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBench();
  }, []);

  const runBenchmark = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/system/benchmark", { method: "POST" });
      const data = await res.json();
      if (data.ok) setBench(data);
    } catch {}
    setRunning(false);
  };

  if (loading) return null;

  const tier = bench?.tier || "potato";
  const tierLabel = bench?.label || "Tier 1 · Potato Appliance";
  const badge = bench?.badge || "DirectPlay CPU Lock";

  return (
    <div className="rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Gauge className="mt-0.5 size-5 text-gold" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display font-medium">Silicon Tier Benchmark</p>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-semibold ring-1",
                  tier === "powerhouse"
                    ? "bg-purple-500/10 text-purple-400 ring-purple-500/20"
                    : tier === "balanced"
                    ? "bg-blue-500/10 text-blue-400 ring-blue-500/20"
                    : "bg-amber-500/10 text-amber-400 ring-amber-500/20",
                )}
              >
                {tierLabel}
              </span>
              <span className="rounded-md bg-surface px-2 py-0.5 text-xs text-muted ring-1 ring-border">
                {badge}
              </span>
            </div>
            <p className="mt-1 text-sm text-foreground">
              {bench?.description || "Automatic hardware tuning applied."}
            </p>
            {bench?.metrics ? (
              <p className="mt-1 text-xs text-muted">
                CPU Latency: {bench.cpuScoreMs}ms · Memory Bandwidth: {bench.ramThroughputMBs} MB/s · Visible RAM: {bench.metrics.ramGb} GiB · Cores: {bench.metrics.cpus}
              </p>
            ) : null}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-xs shrink-0"
          onClick={() => void runBenchmark()}
          disabled={running}
        >
          {running ? <LoaderCircle className="mr-1.5 size-3.5 animate-spin" /> : null}
          {running ? "Benchmarking…" : "Run 3s Benchmark"}
        </Button>
      </div>
    </div>
  );
}

export function CabinModeCard() {
  const [status, setStatus] = useState<{
    active?: boolean;
    itemCount?: number;
    totalMb?: number;
    label?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = () => {
    fetch("/api/cabin/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => {});
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const toggleCabin = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cabin/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !status?.active }),
      });
      const data = await res.json();
      if (data.ok) {
        fetchStatus();
      }
    } catch {}
    setLoading(false);
  };

  const isActive = Boolean(status?.active);

  return (
    <div className="rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Tent className={cn("mt-0.5 size-5", isActive ? "text-gold" : "text-muted")} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display font-medium">Road Trip / Cabin Offline Mode</p>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-semibold ring-1",
                  isActive
                    ? "bg-gold/10 text-gold ring-gold/20"
                    : "bg-surface text-muted ring-border",
                )}
              >
                {isActive ? "Active (Hotspot & Vault Only)" : "Connected Living Room"}
              </span>
            </div>
            <p className="mt-1 text-sm text-foreground">
              {isActive
                ? "ReelOS Wi-Fi hotspot is broadcasting. Outbound WAN calls are suspended, serving media exclusively from the offline vault."
                : "Standard living room mode. ReelOS downloads and streams over the home Wi-Fi/Ethernet network."}
            </p>
            <p className="mt-1 text-xs text-muted">
              Offline Vault: {status?.itemCount ?? 0} titles · {status?.totalMb ?? 0} MB stored in /srv/media/offline_vault
            </p>
          </div>
        </div>

        <Button
          variant={isActive ? "gold" : "ghost"}
          size="sm"
          className="text-xs shrink-0"
          onClick={() => void toggleCabin()}
          disabled={loading}
        >
          {loading ? <LoaderCircle className="mr-1.5 size-3.5 animate-spin" /> : null}
          {isActive ? "Disable Cabin Mode" : "Enable Cabin Mode"}
        </Button>
      </div>
    </div>
  );
}

export function ThemeSelectorCard() {
  const currentTheme = useReelStore((s) => s.theme);
  const setTheme = useReelStore((s) => s.setTheme);

  const themes: {
    id: ThemeName;
    name: string;
    subtitle: string;
    badge: string;
    palette: { bg: string; card: string; accent: string };
  }[] = [
    {
      id: "gold-hashed",
      name: "Gold Hashed",
      subtitle: "The signature ReelOS aesthetic with warm brushed metallic gold.",
      badge: "Signature",
      palette: { bg: "#0b0d10", card: "#181c24", accent: "#d4a017" },
    },
    {
      id: "oled-obsidian",
      name: "OLED Obsidian",
      subtitle: "Pure pitch black with high-contrast cyber highlights for OLED panels.",
      badge: "Ultra-Black",
      palette: { bg: "#000000", card: "#0f1012", accent: "#00f0ff" },
    },
    {
      id: "cinematic-velvet",
      name: "Cinematic Velvet",
      subtitle: "Opulent burgundy and rich velvet tones inspired by premiere cinema palaces.",
      badge: "Film Noir",
      palette: { bg: "#0c060a", card: "#1c101a", accent: "#e11d48" },
    },
    {
      id: "midnight-slate",
      name: "Midnight Slate",
      subtitle: "Deep midnight navy with cool celestial sky accents.",
      badge: "Cupertino",
      palette: { bg: "#080c14", card: "#141c2d", accent: "#3b82f6" },
    },
  ];

  return (
    <div className="rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)]">
      <div className="flex items-start gap-3">
        <Palette className="mt-0.5 size-5 text-gold" />
        <div className="w-full">
          <div className="flex items-center justify-between">
            <p className="font-display font-medium">Atmosphere & Visual Themes</p>
            <span className="rounded-md bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold ring-1 ring-gold/20">
              4 Bespoke Themes
            </span>
          </div>
          <p className="mt-1 text-sm text-foreground">
            Select a custom color palette. Changes apply instantly across the entire interface.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {themes.map((t) => {
              const selected = currentTheme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    "group relative rounded-xl p-3.5 text-left transition-all duration-200 cursor-pointer",
                    selected
                      ? "bg-gold/10 ring-2 ring-gold shadow-[var(--shadow-gold)] scale-[1.01]"
                      : "bg-card-2 hover:bg-surface border border-border/60 hover:border-border",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-xs font-semibold text-foreground">
                      {t.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex gap-1">
                        <span className="size-2.5 rounded-full border border-white/20" style={{ backgroundColor: t.palette.bg }} />
                        <span className="size-2.5 rounded-full border border-white/20" style={{ backgroundColor: t.palette.card }} />
                        <span className="size-2.5 rounded-full border border-white/20" style={{ backgroundColor: t.palette.accent }} />
                      </div>
                      {selected ? (
                        <Check className="size-3.5 text-gold stroke-[3]" />
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-muted line-clamp-2">
                    {t.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TasteRadarCard() {
  const residents = useReelStore((s) => s.residents);
  const activeResidentId = useReelStore((s) => s.activeResidentId);
  const patchResident = useReelStore((s) => s.patchResident);
  const activeResident =
    residents.find((r) => r.id === activeResidentId) || residents[0];

  const defaultWeights = {
    "80s_bias": 0.5,
    mind_bender: 0.5,
    adrenaline: 0.5,
    whimsical: 0.5,
    spectacle: 0.5,
  };

  const currentWeights: Record<string, number> = {
    ...defaultWeights,
    ...(activeResident?.curationWeights || {}),
  };

  const handleWeightChange = (key: string, val: number) => {
    if (!activeResident?.id) return;
    const nextWeights = { ...currentWeights, [key]: Math.round(val * 100) / 100 };
    patchResident(activeResident.id, { curationWeights: nextWeights });

    fetch("/api/curator/taste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        residentId: activeResident.id,
        tasteVibe: activeResident.tasteVibe || "balanced",
        curationWeights: nextWeights,
      }),
    }).catch(() => {});
  };

  const DIMENSIONS = [
    { key: "spectacle", label: "70mm IMAX Spectacle", desc: "4K reference contrast & visceral soundscapes" },
    { key: "mind_bender", label: "Mind Benders & Mystery", desc: "Psychological tension & razor twists" },
    { key: "80s_bias", label: "80s & 90s Nostalgia", desc: "Vintage synth scores & practical effects" },
    { key: "adrenaline", label: "Kinetic Adrenaline", desc: "Raw speed, combat stunts & high velocity" },
    { key: "whimsical", label: "Pure Cozy & Ghibli", desc: "Warmth, storybook charm & comfort pacing" },
  ];

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2 text-gold">
            <Sliders className="size-4" />
            <span className="font-display text-xs font-bold uppercase tracking-wider">
              Taste Radar & Curator
            </span>
          </div>
          <h3 className="font-display text-base font-semibold text-foreground mt-0.5">
            Cinema Affinities for {activeResident?.name || "Resident"}
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Real-time taste radar synthesized from your watching habits and calibration games.
          </p>
        </div>

        <Link
          to="/calibrate"
          className="inline-flex items-center gap-1.5 rounded-xl border border-gold/40 bg-gold/10 px-3.5 py-2 text-xs font-semibold text-gold hover:bg-gold/20 transition-all shadow-sm"
        >
          <Sparkles className="size-3.5" />
          <span>Showdown Matchup</span>
        </Link>
      </div>

      <div className="space-y-4 pt-1">
        {DIMENSIONS.map((dim) => {
          const val = Number(currentWeights[dim.key] ?? 0.5);
          return (
            <div key={dim.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-foreground">{dim.label}</span>
                  <span className="text-muted ml-2 text-[11px] hidden sm:inline">{dim.desc}</span>
                </div>
                <span className="font-mono text-gold font-bold">{Math.round(val * 100)}%</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={val}
                  onChange={(e) => handleWeightChange(dim.key, parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none bg-card-2 cursor-pointer accent-gold"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ConsoleGamingSentinelCard() {
  const [status, setStatus] = useState<{
    yieldActive?: boolean;
    consolesCount?: number;
    activeConsoles?: Array<{ ip: string; vendor: string }>;
    thresholdMs?: number;
    baselineRtt?: number;
  }>({});

  useEffect(() => {
    const fetchStatus = () => {
      fetch("/api/network/console-sentinel")
        .then((r) => r.json())
        .then((data) => {
          if (data && data.ok) setStatus(data);
        })
        .catch(() => {});
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const isYielding = Boolean(status.yieldActive);
  const consolesCount = status.consolesCount || 0;
  const vendor = status.activeConsoles?.[0]?.vendor || "Console";

  return (
    <div className={cn(
      "rounded-2xl p-5 border transition-all duration-300",
      isYielding
        ? "bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-500/5"
        : "bg-card border-border/80"
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            isYielding ? "bg-amber-500/20 text-amber-400 animate-pulse" : "bg-card-2 text-muted"
          )}>
            <Gamepad2 className="size-5" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
              Console Gaming Sentinel
              {isYielding && (
                <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                  Active Gaming Priority
                </span>
              )}
            </h3>
            <p className="text-xs text-muted mt-0.5">
              {isYielding
                ? `🎮 Yielding background downloads for ${vendor.toUpperCase()} online session`
                : consolesCount > 0
                ? `Monitoring ${consolesCount} console(s) on home LAN (zero bufferbloat)`
                : "No active gaming consoles detected on home subnet"}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            isYielding ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
          )}>
            <span className={cn("size-2 rounded-full", isYielding ? "bg-amber-400 animate-ping" : "bg-emerald-400")} />
            {isYielding ? "Bufferbloat Yield" : "Low Latency"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CapabilityScaleBadgeCard() {
  const [scale, setScale] = useState<{
    state?: string;
    label?: string;
    currentMemoryMb?: number;
    embeddingDim?: number;
    concurrencyThreads?: number;
  }>({});

  useEffect(() => {
    const fetchScale = () => {
      fetch("/api/neural/scale")
        .then((r) => r.json())
        .then((data) => {
          if (data && data.ok) setScale(data);
        })
        .catch(() => {});
    };
    fetchScale();
    const interval = setInterval(fetchScale, 4000);
    return () => clearInterval(interval);
  }, []);

  const isContracted = scale.state === "CONTRACTED";

  return (
    <div className="rounded-2xl bg-card p-5 border border-border/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            isContracted ? "bg-sky-500/20 text-sky-400" : "bg-gold/20 text-gold"
          )}>
            <Cpu className="size-5" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground text-sm">
              {String(scale.label || "Hardware Resource Allocation").replace(/^[🧠🤖✨\s]+/, "")}
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Active Headroom: {scale.currentMemoryMb || (isContracted ? 48 : 128)} MB · {isContracted ? "Stealth Mode" : "Cinema Mode"}
            </p>
          </div>
        </div>

        <span className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border",
          isContracted
            ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
            : "bg-gold/15 text-gold border-gold/30"
        )}>
          {isContracted ? "Eco-Contracted" : "Full Fidelity"}
        </span>
      </div>
    </div>
  );
}
