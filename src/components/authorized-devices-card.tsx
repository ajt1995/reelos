import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Globe,
  HardDrive,
  KeyRound,
  Laptop,
  Loader2,
  Mail,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  Send,
  Share2,
  Shield,
  Smartphone,
  Trash2,
  Tv,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QrCodeSvg } from "@/components/ui/qr-code-svg";
import { showToast } from "@/lib/toast";

interface Device {
  id: string;
  name: string;
  platform: string;
  userAgent: string;
  email: string;
  firstSeenIp: string;
  lastSeenIp: string;
  createdAt: number;
  lastSeenAt: number;
  revoked: boolean;
  storageQuotaGb?: number;
  storageUsedGb?: number;
  nightChargingCompute?: boolean;
  overnightChargingOnly?: boolean;
  overnightPreStage?: boolean;
}

interface SmtpConfig {
  provider?: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

const SMTP_PRESETS: Record<string, { host: string; port: number; secure: boolean }> = {
  gmail: { host: "smtp.gmail.com", port: 587, secure: false },
  outlook: { host: "smtp.office365.com", port: 587, secure: false },
  icloud: { host: "smtp.mail.me.com", port: 587, secure: false },
  yahoo: { host: "smtp.mail.yahoo.com", port: 587, secure: false },
  custom: { host: "", port: 587, secure: false },
};

export function AuthorizedDevicesCard() {
  const [funnelEnabled, setFunnelEnabled] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [householdEmail, setHouseholdEmail] = useState("");
  const [emailMode, setEmailMode] = useState<"managed" | "custom">("managed");
  const [smtp, setSmtp] = useState<SmtpConfig>({
    provider: "custom",
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    from: "",
  });

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [togglingFunnel, setTogglingFunnel] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load status and devices
  const loadData = async () => {
    try {
      const [statusRes, devRes] = await Promise.all([
        fetch("/api/gate/status", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/gate/devices", { cache: "no-store" }).then((r) => r.json()),
      ]);

      if (statusRes.ok) {
        setFunnelEnabled(Boolean(statusRes.funnelEnabled));
        setPublicUrl(statusRes.publicUrl || "");
        setHouseholdEmail(statusRes.householdEmail || "");
        setEmailMode(statusRes.emailMode || "managed");
        if (statusRes.smtp) {
          setSmtp((prev) => ({ ...prev, ...statusRes.smtp }));
        }
      }

      if (devRes.ok && Array.isArray(devRes.devices)) {
        setDevices(devRes.devices);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleToggleFunnel = async () => {
    const next = !funnelEnabled;
    setTogglingFunnel(true);
    try {
      const res = await fetch("/api/tailscale/funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setFunnelEnabled(next);
        showToast(next ? "🌐 Public Gateway Activated" : "🔒 Public Gateway Disabled", "success");
      } else {
        showToast(data.error || "Failed to toggle Public Gateway", "error");
      }
    } catch (e) {
      showToast("Gateway toggle network error", "error");
    } finally {
      setTogglingFunnel(false);
    }
  };

  const handleSaveEmailConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch("/api/gate/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdEmail: householdEmail.trim(),
          emailMode,
          smtp,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast("Email configuration saved", "success");
      } else {
        showToast(data.error || "Failed to save configuration", "error");
      }
    } catch {
      showToast("Failed to save configuration", "error");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestEmail = async () => {
    if (!householdEmail.trim()) {
      showToast("Please provide a household email first", "info");
      return;
    }
    setTestingEmail(true);
    try {
      const res = await fetch("/api/gate/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: householdEmail.trim(), emailMode, smtp }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast("✓ Test pairing email sent successfully!", "success");
      } else {
        showToast(`Test failed: ${data.error}`, "error");
      }
    } catch (e) {
      showToast("Failed to test email dispatch", "error");
    } finally {
      setTestingEmail(false);
    }
  };

  const handleRevokeDevice = async (id: string, name: string) => {
    try {
      const res = await fetch("/api/gate/revoke-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, revoked: true } : d)));
        showToast(`Revoked access for ${name}`, "info");
      }
    } catch {
      showToast("Failed to revoke device", "error");
    }
  };

  const handleUpdateDevicePolicy = async (id: string, patch: Partial<Device>) => {
    try {
      const res = await fetch("/api/gate/device-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
        showToast("Device policy updated", "success");
      } else {
        showToast(data.error || "Failed to update device policy", "error");
      }
    } catch {
      showToast("Network error updating device policy", "error");
    }
  };

  const handleShareInvite = async () => {
    const inviteUrl = publicUrl || window.location.origin;
    const shareData = {
      title: "Join ReelOS Household",
      text: "Stream movies and TV from our home ReelOS media appliance directly in your browser:",
      url: inviteUrl,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        showToast("Shared invite sheet", "success");
      } catch {
        /* user dismissed share dialog */
      }
    } else {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      showToast("Copied public invite link to clipboard", "success");
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePresetSelect = (presetKey: string) => {
    const p = SMTP_PRESETS[presetKey];
    if (p) {
      setSmtp((prev) => ({
        ...prev,
        provider: presetKey,
        host: p.host,
        port: p.port,
        secure: p.secure,
      }));
    }
  };

  const activeDevices = devices.filter((d) => !d.revoked);

  const renderPlatformIcon = (platform: string) => {
    switch (platform) {
      case "ios":
      case "android":
        return <Smartphone className="size-4 text-gold" />;
      case "macos":
      case "windows":
      case "linux":
        return <Laptop className="size-4 text-gold" />;
      case "tv":
        return <Tv className="size-4 text-gold" />;
      default:
        return <Globe className="size-4 text-gold" />;
    }
  };

  const formatTimeAgo = (ts: number) => {
    if (!ts) return "Never";
    const diffMs = Date.now() - ts;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 2) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-[var(--shadow-border)] space-y-6">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gold/15 text-gold border border-gold/20 shrink-0 mt-0.5">
            <Shield className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-semibold text-base text-foreground">
                Instant Remote Gateway & Household Gate
              </h3>
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold border border-gold/30">
                Ticket #27
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5 max-w-xl">
              Broadcast a public gateway with Tailscale Funnel. Family members pair remote devices via one-time email/SMS codes without installing apps.
            </p>
          </div>
        </div>

        {/* Funnel Toggle Button */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleToggleFunnel}
            disabled={togglingFunnel}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
              funnelEnabled
                ? "bg-success/15 text-success border-success/30 hover:bg-success/25"
                : "bg-muted/30 text-muted border-border hover:text-foreground"
            }`}
          >
            {togglingFunnel ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Globe className="size-3.5" />
            )}
            {funnelEnabled ? "Funnel Active" : "Funnel Off"}
          </button>
        </div>
      </div>

      {/* Public URL & Web Share Section */}
      {funnelEnabled && (
        <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-gold">
              <Globe className="size-3.5" />
              <span>Broadcast Public Gateway</span>
            </div>
            <p className="font-mono text-sm text-foreground break-all">{publicUrl || "https://reelos-appliance.ts.net"}</p>
            <p className="text-[11px] text-muted">
              Caddy isolates admin backends to LAN while serving the pairing gate on this URL.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShareInvite}
              className="gap-1.5 text-xs border-gold/30 hover:border-gold cursor-pointer"
            >
              {copied ? <Check className="size-3.5 text-emerald-400" /> : <Share2 className="size-3.5" />}
              {copied ? "Copied Link" : "Share Invite"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowQr(!showQr)}
              className="gap-1.5 text-xs border-border hover:border-gold cursor-pointer"
            >
              <QrCode className="size-3.5" />
              {showQr ? "Hide QR" : "Show QR"}
            </Button>
          </div>
        </div>
      )}

      {/* QR Code Dropdown */}
      {funnelEnabled && showQr && (
        <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/60 bg-card/60">
          <div className="bg-white p-3 rounded-xl shadow-lg mb-2">
            <QrCodeSvg value={publicUrl || "https://reelos-appliance.ts.net"} size={160} darkColor="#0B0D10" lightColor="#ffffff" />
          </div>
          <p className="text-xs text-muted">Scan with phone camera to open and pair instantly.</p>
        </div>
      )}

      {/* Email Dispatch Configuration */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-sm text-foreground">Email Dispatch Configuration</h4>
            <p className="text-xs text-muted">Choose how pairing codes and 1-tap Magic Links are delivered.</p>
          </div>
          <div className="flex items-center gap-1.5 bg-card-2 p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setEmailMode("managed")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                emailMode === "managed" ? "bg-gold text-card font-semibold" : "text-muted hover:text-foreground"
              }`}
            >
              Managed Relay
            </button>
            <button
              type="button"
              onClick={() => setEmailMode("custom")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                emailMode === "custom" ? "bg-gold text-card font-semibold" : "text-muted hover:text-foreground"
              }`}
            >
              Custom SMTP
            </button>
          </div>
        </div>

        {/* Household Email Input */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-muted mb-1">Household Account Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
              <input
                type="email"
                value={householdEmail}
                onChange={(e) => setHouseholdEmail(e.target.value)}
                placeholder="household@example.com"
                className="w-full rounded-xl border border-border bg-card/60 py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted/60 focus:border-gold focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={savingConfig}
              onClick={handleSaveEmailConfig}
              className="flex-1 text-xs cursor-pointer border-border hover:border-gold"
            >
              {savingConfig ? <Loader2 className="size-3.5 animate-spin" /> : "Save Email"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={testingEmail || !householdEmail}
              onClick={handleTestEmail}
              className="flex-1 text-xs cursor-pointer text-gold hover:bg-gold/10"
            >
              {testingEmail ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              Test
            </Button>
          </div>
        </div>

        {/* Custom SMTP Form */}
        {emailMode === "custom" && (
          <div className="rounded-xl border border-border/80 bg-card-2/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">SMTP Provider Presets</span>
              <div className="flex items-center gap-1">
                {["gmail", "outlook", "icloud", "yahoo", "custom"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handlePresetSelect(k)}
                    className={`px-2 py-0.5 rounded text-[11px] uppercase tracking-wider font-mono cursor-pointer border ${
                      smtp.provider === k
                        ? "bg-gold/15 text-gold border-gold/30 font-bold"
                        : "border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-muted mb-1">Host & Port</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={smtp.host}
                    onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                    placeholder="smtp.gmail.com"
                    className="flex-1 rounded-lg border border-border bg-card py-1.5 px-2.5 text-xs text-foreground focus:border-gold focus:outline-none"
                  />
                  <input
                    type="number"
                    value={smtp.port}
                    onChange={(e) => setSmtp({ ...smtp, port: parseInt(e.target.value, 10) || 587 })}
                    placeholder="587"
                    className="w-16 rounded-lg border border-border bg-card py-1.5 px-2 text-xs text-foreground focus:border-gold focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-muted mb-1">Sender Email / User</label>
                <input
                  type="text"
                  value={smtp.user}
                  onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                  placeholder="family@gmail.com"
                  className="w-full rounded-lg border border-border bg-card py-1.5 px-2.5 text-xs text-foreground focus:border-gold focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] text-muted mb-1">App Password / Secret Token</label>
                <input
                  type="password"
                  value={smtp.pass}
                  onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })}
                  placeholder="••••••••••••••••"
                  className="w-full rounded-lg border border-border bg-card py-1.5 px-2.5 text-xs text-foreground focus:border-gold focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Authorized Devices List */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm text-foreground">Active Paired Devices</h4>
            <span className="text-xs text-muted font-mono bg-muted/20 px-2 py-0.5 rounded-full">
              {activeDevices.length}
            </span>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="text-xs text-muted hover:text-gold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="size-3" />
            Refresh
          </button>
        </div>

        {activeDevices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 p-5 text-center text-muted text-xs">
            No remote devices paired yet. Remote users will pair here upon challenge.
          </div>
        ) : (
          <div className="divide-y divide-border/60 rounded-xl border border-border bg-card-2/40 overflow-hidden">
            {activeDevices.map((dev) => (
              <div key={dev.id} className="flex items-center justify-between p-3.5 hover:bg-card-2/80 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-card border border-border shrink-0">
                    {renderPlatformIcon(dev.platform)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs text-foreground truncate">{dev.name}</span>
                      <span className="text-[10px] text-muted bg-card px-1.5 py-0.2 rounded border border-border font-mono">
                        {dev.platform}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-faint mt-1">
                      <span>Seen {formatTimeAgo(dev.lastSeenAt)}</span>
                      <span>·</span>
                      <span className="font-mono">{dev.lastSeenIp}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 rounded bg-card px-1.5 py-0.5 text-[10px] font-mono text-muted border border-border">
                        <HardDrive className="size-2.5 text-gold" />
                        Quota: {dev.storageQuotaGb ?? 25} GB
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateDevicePolicy(dev.id, { nightChargingCompute: !(dev.nightChargingCompute !== false) })}
                        title="Toggle phone night-charging distributed compute"
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono cursor-pointer border transition-colors ${
                          dev.nightChargingCompute !== false
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                            : "bg-muted/10 text-muted border-border hover:bg-muted/20"
                        }`}
                      >
                        <Radio className="size-2.5" />
                        {dev.nightChargingCompute !== false ? "Night Compute: ON" : "Night Compute: OFF"}
                      </button>
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevokeDevice(dev.id, dev.name)}
                  className="text-danger hover:bg-danger/15 text-xs gap-1 cursor-pointer h-8 px-2.5"
                >
                  <Trash2 className="size-3" />
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
