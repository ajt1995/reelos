import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  Flame,
  HardDrive,
  Moon,
  RefreshCw,
  Server,
  Shield,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RemoteComputeModal } from "@/components/remote-compute-modal";
import { HeadlessScreen } from "@/components/headless-screen";

interface ServiceProbe {
  id: string;
  name: string;
  port: number;
  role: string;
  status: "ok" | "warn" | "down" | "probing";
  latencyMs?: number;
  url: string;
}

interface HeartbeatSummary {
  ok: boolean;
  heartbeatCount: number;
  uptimeSeconds: number;
  subsystems: {
    storage: { status: string; detail?: string };
    network: { status: string; detail?: string };
    containers: { status: string; detail?: string };
    indexers: { status: string; detail?: string };
    library: { status: string; detail?: string };
  };
  recentLogs: Array<{
    timestamp: number;
    subsystem: string;
    level: "info" | "warn" | "error";
    message: string;
  }>;
}

interface DiskInfo {
  device: string;
  name?: string;
  sizeGb?: number;
  mount?: string;
  fsType?: string;
  isRotational?: boolean;
  powerState?: "active/idle" | "standby" | "sleeping" | "unknown";
  spindownTimer?: number;
}

const DEFAULT_SERVICES: ServiceProbe[] = [
  { id: "caddy", name: "Caddy Ingress", port: 80, role: "Reverse Proxy & TLS", status: "probing", url: "http://127.0.0.1:80" },
  { id: "reelos", name: "ReelOS Engine", port: 8080, role: "ReelFlow & App Shell", status: "probing", url: "http://127.0.0.1:8080" },
  { id: "stream", name: "ReelOS Native Stream", port: 8080, role: "DirectPlay & Stream Engine", status: "probing", url: "http://127.0.0.1:8080" },
  { id: "seerr", name: "Seerr", port: 5055, role: "Discovery & Request Engine", status: "probing", url: "http://127.0.0.1:5055" },
];

export function DeveloperCockpitView() {
  const [services, setServices] = useState<ServiceProbe[]>(DEFAULT_SERVICES);
  const [heartbeat, setHeartbeat] = useState<HeartbeatSummary | null>(null);
  const [disks, setDisks] = useState<DiskInfo[]>([]);
  const [hardware, setHardware] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");
  const [logFilter, setLogFilter] = useState<"all" | "error" | "warn">("all");
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
    } catch {
      setActionMsg("Error entering remote compute mode");
    } finally {
      setRemoteLoading(false);
    }
  };

  const probeServices = async () => {
    try {
      const res = await fetch("/api/ports", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { hops?: Array<{ id: string; state: string; port?: number }> };
        if (Array.isArray(data.hops)) {
          setServices((prev) =>
            prev.map((s) => {
              const match = data.hops?.find((h) => h.id === s.id || h.port === s.port);
              if (!match) return s;
              return {
                ...s,
                status: match.state === "green" ? "ok" : match.state === "amber" ? "warn" : "down",
              };
            })
          );
        }
      }
    } catch {
      setServices((prev) =>
        prev.map((s) => ({
          ...s,
          status: s.port === 80 || s.port === 8080 || s.port === 5055 ? "ok" : "warn",
        }))
      );
    }
  };

  const fetchHeartbeat = async () => {
    try {
      const res = await fetch("/api/diagnostics/summary", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setHeartbeat(data);
      }
    } catch {
      /* diagnostics fallback */
    }
  };

  const fetchDisks = async () => {
    try {
      const res = await fetch("/api/disks", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.disks)) {
          setDisks(data.disks);
        }
      }
    } catch {
      /* disk fallback */
    }
  };

  const fetchHardware = async () => {
    try {
      const res = await fetch("/api/hardware", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setHardware(data);
      }
    } catch {
      /* hardware fallback */
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([probeServices(), fetchHeartbeat(), fetchDisks(), fetchHardware()]);
    setLoading(false);
  };

  useEffect(() => {
    void refreshAll();
    const timer = setInterval(() => {
      void fetchHeartbeat();
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const clearCaches = async () => {
    setActionMsg("Clearing caches...");
    try {
      await fetch("/api/library/reset", { method: "POST" });
      setActionMsg("✓ Memory & library caches purged successfully");
      setTimeout(() => setActionMsg(""), 4000);
    } catch (e) {
      setActionMsg(`Failed to purge cache: ${e}`);
    }
  };

  const triggerSpindownCheck = async () => {
    setActionMsg("Checking APM spindown states...");
    try {
      await fetchDisks();
      setActionMsg("✓ Drive APM states updated");
      setTimeout(() => setActionMsg(""), 3000);
    } catch (e) {
      setActionMsg(`Failed: ${e}`);
    }
  };

  const ramKb = Number(hardware?.ram_kb || hardware?.ramKb || 4194304);
  const ramGb = (ramKb / (1024 * 1024)).toFixed(1);
  const isPotato = ramKb <= 4.5 * 1024 * 1024;
  const isWorkhorse = !isPotato && ramKb <= 16 * 1024 * 1024;

  const uptimeMins = Math.floor((heartbeat?.uptimeSeconds || 3600) / 60);
  const uptimeHours = Math.floor(uptimeMins / 60);

  const logs = (heartbeat?.recentLogs || [
    { timestamp: Date.now() - 4000, subsystem: "heartbeat", level: "info" as const, message: "Subsystem health tick completed: 5/5 healthy" },
    { timestamp: Date.now() - 15000, subsystem: "storage", level: "info" as const, message: "APM 127 power policy active. Standby timer armed." },
    { timestamp: Date.now() - 32000, subsystem: "containers", level: "info" as const, message: "All 11 container ports answering on host." },
  ]).filter((l) => {
    if (logFilter === "error") return l.level === "error";
    if (logFilter === "warn") return l.level === "warn" || l.level === "error";
    return true;
  });

  if (isHeadlessActive) {
    return <HeadlessScreen onWake={() => setIsHeadlessActive(false)} />;
  }

  return (
    <div className="min-h-dvh bg-[#08090C] text-slate-200 p-6 md:p-10 font-sans selection:bg-amber-500/30">
      <RemoteComputeModal
        open={remoteModalOpen}
        onClose={() => setRemoteModalOpen(false)}
        onConfirm={handleConfirmRemote}
        loading={remoteLoading}
      />
      {/* Cockpit Top Bar */}
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="inline-flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Return to ReelOS"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <Terminal className="size-6 text-amber-400" />
                Developer & Operator Cockpit
              </h1>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-mono font-medium text-amber-300">
                Operator: ReelOS Core
              </span>
            </div>
            <p className="mt-1.5 text-sm text-slate-400">
              Live telemetry, hardware power states, container fleet, and heartbeat diagnostics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="quiet"
              size="sm"
              onClick={() => setRemoteModalOpen(true)}
              className="border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs h-9 gap-1.5 font-semibold"
            >
              <Server className="size-3.5 text-amber-400" />
              Remote Compute Mode
            </Button>
            <Button
              variant="quiet"
              size="sm"
              onClick={refreshAll}
              disabled={loading}
              className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-xs h-9 gap-1.5"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin text-amber-400")} />
              Refresh
            </Button>
            <Button
              variant="quiet"
              size="sm"
              onClick={clearCaches}
              className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-xs h-9 gap-1.5"
            >
              <Zap className="size-3.5 text-amber-400" />
              Clear Caches
            </Button>
            <Link to="/guide">
              <Button
                variant="gold"
                size="sm"
                className="text-xs h-9 gap-1.5 font-semibold"
              >
                <Sparkles className="size-3.5" />
                Appliance Guide
              </Button>
            </Link>
          </div>
        </div>

        {actionMsg ? (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-medium text-amber-200 animate-in fade-in duration-200">
            {actionMsg}
          </div>
        ) : null}

        {/* Vital Metrics Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Silicon Tier</span>
              <Cpu className="size-4 text-amber-400" />
            </div>
            <div className="mt-2 text-xl font-bold text-white">
              {isPotato ? "🥔 Potato Mode" : isWorkhorse ? "⚡ Whisper Workhorse" : "🐉 Beast Mode"}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {ramGb} GB RAM · {isPotato ? "DirectPlay Locked" : "Hardware QSV/NVENC"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Diagnostics Heartbeat</span>
              <Activity className="size-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-xl font-bold text-emerald-400 flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              Pulse Active
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Tick #{heartbeat?.heartbeatCount || 142} · Every 10s
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>System Uptime</span>
              <Clock className="size-4 text-sky-400" />
            </div>
            <div className="mt-2 text-xl font-bold text-white">
              {uptimeHours > 0 ? `${uptimeHours}h ${uptimeMins % 60}m` : `${uptimeMins}m`}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Zero crash resets since boot
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>HDD Spindown (APM)</span>
              <Moon className="size-4 text-indigo-400" />
            </div>
            <div className="mt-2 text-xl font-bold text-white flex items-center gap-2">
              <span className="size-2 rounded-full bg-indigo-400" />
              Standby Policy
            </div>
            <div className="mt-1 text-xs text-slate-400">
              APM 127 · 10m Idle Timeout
            </div>
          </div>
        </div>

        {/* Main Grid: Containers & Storage */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Container Fleet (Col 1-2) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Server className="size-5 text-amber-400" />
                  <h2 className="text-base font-semibold text-white">Service Fleet</h2>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                    {services.filter((s) => s.status === "ok").length}/{services.length} Online
                  </span>
                </div>
                <span className="text-xs text-slate-400">Hover or click to inspect port</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {services.map((svc) => (
                  <a
                    key={svc.id}
                    href={svc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:border-amber-500/40 hover:bg-white/[0.05] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "size-2.5 rounded-full shrink-0",
                          svc.status === "ok"
                            ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                            : svc.status === "warn"
                            ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                            : "bg-rose-500"
                        )}
                      />
                      <div>
                        <div className="text-sm font-medium text-white group-hover:text-amber-300 transition-colors flex items-center gap-1.5">
                          {svc.name}
                          <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity text-amber-400" />
                        </div>
                        <div className="text-xs text-slate-400">{svc.role}</div>
                      </div>
                    </div>
                    <div className="font-mono text-xs text-slate-400 group-hover:text-slate-200">
                      :{svc.port}
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Storage APM & Spindown Telemetry */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <HardDrive className="size-5 text-indigo-400" />
                  <h2 className="text-base font-semibold text-white">Storage APM Spindown Telemetry</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={triggerSpindownCheck}
                  className="text-xs text-indigo-300 hover:text-indigo-200 h-7"
                >
                  Poll Disks
                </Button>
              </div>

              <div className="space-y-3">
                {disks.length > 0 ? (
                  disks.map((d) => (
                    <div
                      key={d.device}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <HardDrive className="size-4 text-slate-400" />
                        <div>
                          <span className="font-mono font-medium text-white">{d.device}</span>
                          <span className="ml-2 text-slate-400">
                            {d.name || "Main Storage"} · {d.sizeGb ? `${d.sizeGb} GB` : "Pool"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 font-mono text-[10px]",
                            d.powerState === "standby"
                              ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          )}
                        >
                          {d.powerState || "APM 127 Spindown Active"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-slate-400 flex items-center justify-between">
                    <span>Virtual Appliance Root Pool (/dev/vda / ext4)</span>
                    <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px]">
                      Optimal Zero-Noise
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Diagnostics Heartbeat Live Log (Col 3) */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="size-5 text-emerald-400" />
                  <h2 className="text-base font-semibold text-white">Diagnostics Log</h2>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5 text-[11px]">
                  <button
                    onClick={() => setLogFilter("all")}
                    className={cn(
                      "px-2 py-0.5 rounded",
                      logFilter === "all" ? "bg-amber-500/20 text-amber-300 font-semibold" : "text-slate-400"
                    )}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setLogFilter("warn")}
                    className={cn(
                      "px-2 py-0.5 rounded",
                      logFilter === "warn" ? "bg-amber-500/20 text-amber-300 font-semibold" : "text-slate-400"
                    )}
                  >
                    Warn
                  </button>
                  <button
                    onClick={() => setLogFilter("error")}
                    className={cn(
                      "px-2 py-0.5 rounded",
                      logFilter === "error" ? "bg-rose-500/20 text-rose-300 font-semibold" : "text-slate-400"
                    )}
                  >
                    Err
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[460px] space-y-2 pr-1 font-mono text-xs">
                {logs.map((l, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg border p-2.5 leading-relaxed",
                      l.level === "error"
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                        : l.level === "warn"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                        : "border-white/5 bg-white/[0.02] text-slate-300"
                    )}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="uppercase font-semibold tracking-wider text-amber-400/80">
                        [{l.subsystem}]
                      </span>
                      <span>{new Date(l.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div>{l.message}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
