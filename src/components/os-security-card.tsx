import { useEffect, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Terminal,
  Power,
  AlertTriangle,
  Check,
  LoaderCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OsUpgradeData {
  ok?: boolean;
  status: "idle" | "running" | "completed" | "error";
  lastChecked: string | null;
  updatesAvailable: number;
  securityUpdates: number;
  rebootRequired: boolean;
  rebootPackages: string[];
  osName: string;
  logTail: string;
  error?: string;
}

export function OsSecurityCard() {
  const [data, setData] = useState<OsUpgradeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [confirmReboot, setConfirmReboot] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/system/os-upgrade/status", { cache: "no-store" });
      const json = (await res.json()) as OsUpgradeData;
      setData(json);
      if (json.status === "running") {
        setApplying(true);
      } else {
        setApplying(false);
      }
    } catch {
      /* ignore fetch errors */
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchStatus().finally(() => setLoading(false));
  }, []);

  // Poll while upgrade is running
  useEffect(() => {
    if (!applying && data?.status !== "running") return;
    const interval = setInterval(() => {
      fetchStatus();
    }, 2500);
    return () => clearInterval(interval);
  }, [applying, data?.status]);

  const handleCheck = async () => {
    setChecking(true);
    setMsg(null);
    try {
      const res = await fetch("/api/system/os-upgrade/check", { method: "POST" });
      const json = (await res.json()) as OsUpgradeData;
      setData(json);
      setMsg(
        json.securityUpdates > 0
          ? `Found ${json.securityUpdates} security patch${json.securityUpdates > 1 ? "es" : ""} (${json.updatesAvailable} updates total).`
          : "OS packages are fully up to date."
      );
    } catch (e) {
      setMsg(`Check failed: ${String(e)}`);
    } finally {
      setChecking(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    setShowTerminal(true);
    setMsg(null);
    try {
      const res = await fetch("/api/system/os-upgrade/apply", { method: "POST" });
      const json = await res.json();
      if (!json.ok) {
        setMsg(`Upgrade refused: ${json.error || "Unknown error"}`);
        setApplying(false);
      } else {
        setMsg("OS security upgrade started in background. Media streaming continues uninterrupted.");
        fetchStatus();
      }
    } catch (e) {
      setMsg(`Failed to start: ${String(e)}`);
      setApplying(false);
    }
  };

  const handleReboot = async () => {
    setRebooting(true);
    try {
      const res = await fetch("/api/system/reboot", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setMsg("Reboot sequence initiated. Appliance will restart in ~30 seconds.");
      } else {
        setMsg(`Reboot failed: ${json.error || "Unknown error"}`);
        setRebooting(false);
      }
    } catch (e) {
      setMsg(`Reboot command failed: ${String(e)}`);
      setRebooting(false);
    }
  };

  const isRunning = applying || data?.status === "running";
  const isRebootRequired = Boolean(data?.rebootRequired);
  const securityCount = data?.securityUpdates ?? 0;
  const updatesCount = data?.updatesAvailable ?? 0;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card/60 p-4 sm:p-5 shadow-[var(--shadow-border)] space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl border",
              isRebootRequired
                ? "border-gold/40 bg-gold/10 text-gold-bright"
                : securityCount > 0
                ? "border-live/40 bg-live/10 text-live"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            )}
          >
            {isRebootRequired ? (
              <AlertTriangle className="size-4" />
            ) : securityCount > 0 ? (
              <ShieldAlert className="size-4" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-medium text-foreground text-sm sm:text-base">
                Underlying OS Security & Package Patches
              </h3>
              <span className="rounded-full bg-border/40 px-2 py-0.5 font-mono text-[11px] text-muted">
                {data?.osName || "Ubuntu Linux"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              Ubuntu apt security bridge. Patches kernel, OpenSSL, and system libraries without opening an SSH terminal.
              Docker media containers stay running.
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-2.5 py-1 text-xs font-medium text-gold-bright">
              <LoaderCircle className="size-3 animate-spin" />
              Upgrading OS...
            </span>
          ) : isRebootRequired ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-400">
              <AlertTriangle className="size-3" />
              Reboot Required
            </span>
          ) : securityCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2.5 py-1 text-xs font-medium text-rose-400">
              {securityCount} Security Patch{securityCount > 1 ? "es" : ""} Available
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400">
              <Check className="size-3" />
              OS Up to Date
            </span>
          )}
        </div>
      </div>

      {/* Reboot Required Banner */}
      {isRebootRequired && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" />
              Appliance Kernel Restart Required
            </p>
            <p className="text-[11px] text-amber-200/80">
              A recent security patch (
              {data?.rebootPackages?.length
                ? data.rebootPackages.slice(0, 3).join(", ")
                : "kernel / system glibc"}
              ) requires a clean reboot to take effect.
            </p>
          </div>
          {!confirmReboot ? (
            <Button
              variant="quiet"
              size="sm"
              onClick={() => setConfirmReboot(true)}
              className="border border-amber-400/50 text-amber-300 hover:bg-amber-400/10 text-xs shrink-0 gap-1.5"
            >
              <Power className="size-3.5" />
              Reboot Appliance
            </Button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="danger"
                size="sm"
                disabled={rebooting}
                onClick={handleReboot}
                className="text-xs gap-1.5"
              >
                {rebooting ? <LoaderCircle className="size-3 animate-spin" /> : <Power className="size-3" />}
                Confirm Reboot
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={rebooting}
                onClick={() => setConfirmReboot(false)}
                className="text-xs text-muted"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={checking || isRunning || loading}
          onClick={handleCheck}
          className="border border-border text-xs gap-1.5"
        >
          {checking ? <LoaderCircle className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Check for OS Patches
        </Button>

        <Button
          variant={securityCount > 0 ? "gold" : "quiet"}
          size="sm"
          disabled={isRunning || checking || loading}
          onClick={handleApply}
          className={cn(
            "text-xs gap-1.5",
            securityCount === 0 && "border border-border text-muted hover:text-foreground"
          )}
        >
          {isRunning ? <LoaderCircle className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
          Check & Apply System Security Patches
        </Button>

        {data?.logTail && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTerminal((v) => !v)}
            className="text-xs text-muted hover:text-foreground gap-1.5 ml-auto"
          >
            <Terminal className="size-3.5" />
            {showTerminal ? "Hide Upgrade Log" : "View Upgrade Log"}
            {showTerminal ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </Button>
        )}
      </div>

      {msg && <p className="text-xs text-gold-bright font-medium">{msg}</p>}

      {/* Live Terminal Drawer */}
      {showTerminal && data?.logTail && (
        <div className="mt-3 rounded-xl border border-border/80 bg-black/80 p-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-white/10 text-[11px] font-mono text-faint">
            <span>/var/lib/reelos/os-upgrade.log</span>
            <span>{isRunning ? "Live Stream (Active)" : "Last Run Output"}</span>
          </div>
          <pre className="mt-2.5 max-h-48 overflow-y-auto font-mono text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed">
            {data.logTail}
          </pre>
        </div>
      )}
    </div>
  );
}
