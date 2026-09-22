import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Copy,
  Download,
  HardDrive,
  KeyRound,
  LifeBuoy,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Wifi,
  Wrench,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/lib/toast";

interface HealthPillar {
  key: string;
  title: string;
  status: "healthy" | "warning" | "offline" | "degraded";
  latencyMs?: number;
  detail: string;
  freeGb?: number;
  totalGb?: number;
  freePct?: number;
  fuseActive?: boolean;
}

interface HealthMatrixResponse {
  ok: boolean;
  overall: "healthy" | "attention";
  timestamp: number;
  pillars: HealthPillar[];
}

interface RemoteTunnelStatus {
  ok: boolean;
  active: boolean;
  pin?: string;
  expiresAt?: number;
  minutesRemaining?: number;
  connectionTarget?: string;
}

export function SupportDiagnosticsView() {
  const [health, setHealth] = useState<HealthMatrixResponse | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [tunnel, setTunnel] = useState<RemoteTunnelStatus | null>(null);
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<{
    ok: boolean;
    message: string;
    steps?: any[];
  } | null>(null);
  const [downloadingBundle, setDownloadingBundle] = useState(false);
  const [supportCode, setSupportCode] = useState<string>("R-8492-X1");

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch("/api/support/health", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch {
      setHealth({
        ok: false,
        overall: "attention",
        timestamp: Date.now(),
        pillars: [
          {
            key: "wan",
            title: "Internet & WAN Gateway",
            status: "degraded",
            detail: "Could not probe gateway",
          },
          {
            key: "debrid",
            title: "Cloud Streaming Connection",
            status: "degraded",
            detail: "Backend unreachable",
          },
          {
            key: "storage",
            title: "Storage & Virtual Drive",
            status: "degraded",
            detail: "Drive status unknown",
          },
          {
            key: "server",
            title: "Local playback",
            status: "degraded",
            detail: "Could not reach local service",
          },
        ],
      });
    }
    setLoadingHealth(false);
  };

  const fetchTunnel = async () => {
    try {
      const res = await fetch("/api/support/tunnel", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setTunnel(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchHealth();
    fetchTunnel();
  }, []);

  const handleToggleTunnel = async (enable: boolean) => {
    setTunnelLoading(true);
    try {
      const res = await fetch("/api/support/tunnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable }),
      });
      if (res.ok) {
        const data = await res.json();
        setTunnel(data);
        showToast(
          enable
            ? "🔓 Remote Assistance Passkey active"
            : "Remote Assistance closed",
          "success",
        );
      }
    } catch {
      showToast("Could not update remote assistance tunnel", "error");
    }
    setTunnelLoading(false);
  };

  const handleRunRepair = async () => {
    setRepairing(true);
    setRepairResult(null);
    try {
      const res = await fetch("/api/support/repair", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setRepairResult(data);
        showToast("Self-repair completed", "success");
        fetchHealth();
      } else {
        setRepairResult({ ok: false, message: "Repair encountered errors." });
      }
    } catch (e) {
      setRepairResult({ ok: false, message: String(e) });
    }
    setRepairing(false);
  };

  const handleDownloadBundle = async () => {
    setDownloadingBundle(true);
    try {
      const res = await fetch("/api/support/bundle", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.supportCode) setSupportCode(data.supportCode);
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `reelos-support-${data.supportCode || "bundle"}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Sanitized support bundle downloaded", "success");
      }
    } catch {
      showToast("Failed to download support bundle", "error");
    }
    setDownloadingBundle(false);
  };

  const handleCopyCode = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(supportCode);
      showToast(`Support code ${supportCode} copied to clipboard`, "success");
    }
  };

  const pillarIcon = (key: string) => {
    switch (key) {
      case "wan":
        return <Wifi className="size-4" />;
      case "debrid":
        return <KeyRound className="size-4" />;
      case "storage":
        return <HardDrive className="size-4" />;
      case "server":
        return <Activity className="size-4" />;
      default:
        return <LifeBuoy className="size-4" />;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Healthy
          </span>
        );
      case "warning":
      case "degraded":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-500/20">
            <span className="size-1.5 rounded-full bg-amber-400" />
            Attention
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-400 border border-rose-500/20">
            <span className="size-1.5 rounded-full bg-rose-400" />
            Offline
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Live Appliance Health Matrix */}
      <div className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-gold/10 text-gold border border-gold/20">
              <Activity className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">
                Live Appliance Health Matrix
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Real-time sub-system diagnostics and hardware connectivity.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchHealth}
            disabled={loadingHealth}
            className="text-xs hover:border-gold/40 hover:text-gold"
          >
            <RefreshCw
              className={`size-3.5 mr-1.5 ${loadingHealth ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(health?.pillars || []).map((pillar) => (
            <div
              key={pillar.key}
              className="flex items-start justify-between rounded-2xl bg-card-2 p-4 border border-border/50 hover:border-border transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-muted">
                  {pillarIcon(pillar.key)}
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    {pillar.title}
                  </p>
                  <p className="mt-1 text-[11px] text-muted leading-relaxed">
                    {pillar.detail}
                  </p>
                </div>
              </div>
              <div>{statusBadge(pillar.status)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. One-Click Support Bundle & Verification Code */}
      <div className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-sm backdrop-blur-md">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 mt-0.5">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">
                1-Click Support Bundle & Verification
              </h2>
              <p className="text-xs text-muted mt-1 leading-relaxed max-w-xl">
                Generate an encrypted, sanitized diagnostic report for support
                technicians. All API tokens, private passwords, and household IP
                addresses are strictly redacted.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  variant="gold"
                  size="sm"
                  onClick={handleDownloadBundle}
                  disabled={downloadingBundle}
                  className="text-xs"
                >
                  <Download className="size-3.5 mr-1.5" />
                  {downloadingBundle
                    ? "Sanitizing & Exporting…"
                    : "Download Support Bundle (.json)"}
                </Button>

                <div className="flex items-center gap-2 rounded-xl bg-card-2 px-3 py-1.5 border border-border/60">
                  <span className="text-[11px] text-muted font-mono">
                    Code:
                  </span>
                  <span className="font-mono text-xs font-bold text-gold tracking-wider">
                    {supportCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="text-muted hover:text-gold transition-colors p-1 cursor-pointer"
                    title="Copy Support Code"
                  >
                    <Copy className="size-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Remote Assistance Passkey (Tailscale Tunnel) */}
      <div className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-sm backdrop-blur-md">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0 mt-0.5">
              <Lock className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">
                Remote Assistance Passkey
              </h2>
              <p className="text-xs text-muted mt-1 leading-relaxed max-w-xl">
                Allow a certified ReelOS engineer to securely access your
                appliance via an ephemeral SSH tunnel. Sessions automatically
                expire after 60 minutes.
              </p>

              {tunnel?.active ? (
                <div className="mt-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-indigo-300">
                      Remote Session Active
                    </span>
                    <span className="text-[11px] text-indigo-400 font-mono">
                      {tunnel.minutesRemaining}m remaining
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted">Technician PIN:</span>
                    <span className="font-mono text-xl font-bold tracking-widest text-foreground bg-black/40 px-3 py-1 rounded-lg border border-white/10">
                      {tunnel.pin}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">
                    Read this 6-digit PIN to your support agent. They cannot
                    access your box without it.
                  </p>
                  <Button
                    variant="danger"
                    size="sm"
                    className="mt-2 text-xs"
                    disabled={tunnelLoading}
                    onClick={() => handleToggleTunnel(false)}
                  >
                    Close Session Now
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 text-xs hover:border-gold/40 hover:text-gold"
                  disabled={tunnelLoading}
                  onClick={() => handleToggleTunnel(true)}
                >
                  Enable Remote Assistance
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. 1-Click Self-Repair & Maintenance */}
      <div className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-sm backdrop-blur-md">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 mt-0.5">
              <Wrench className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-semibold text-foreground">
                1-Click Appliance Self-Repair
              </h2>
              <p className="text-xs text-muted mt-1 leading-relaxed max-w-xl">
                Runs a bounded recovery check for playback buffers, interrupted
                updates, library links, and background services. It reports what
                changed and does not restart this device.
              </p>

              <div className="mt-4 flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRunRepair}
                  disabled={repairing}
                  className="text-xs hover:border-amber-400/40 hover:text-amber-400"
                >
                  <Wrench
                    className={`size-3.5 mr-1.5 ${repairing ? "animate-spin" : ""}`}
                  />
                  {repairing ? "Repairing Subsystems…" : "Run Self-Repair"}
                </Button>
              </div>

              {repairResult ? (
                <div className="mt-4 rounded-xl bg-card-2 p-3 border border-border/60 text-xs">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    {repairResult.ok ? (
                      <CheckCircle2 className="size-4 text-emerald-400" />
                    ) : (
                      <XCircle className="size-4 text-rose-400" />
                    )}
                    {repairResult.message}
                  </div>
                  {repairResult.steps ? (
                    <ul className="mt-2 space-y-1 text-muted text-[11px]">
                      {repairResult.steps.map((s, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <span
                            className={
                              s.ok ? "text-emerald-400" : "text-rose-400"
                            }
                          >
                            •
                          </span>
                          <span>
                            {s.step}: {s.detail || s.error}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
