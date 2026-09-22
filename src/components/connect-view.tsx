import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Key,
  LoaderCircle,
  Play,
  QrCode,
  Send,
  Smartphone,
  Sparkles,
  Tv,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QrCodeSvg } from "@/components/ui/qr-code-svg";
import { useReelStore } from "@/lib/store";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Box = {
  provisioned: boolean;
  ipv4: string;
  watch: string;
  seerr?: string;
  jellyfin: { state: "green" | "amber" | "red" | "unknown"; detail: string };
  frontend: string;
  access: string;
  adminName: string;
  adminPassword: string;
  tailscaleAuth: string | null;
  tailscaleInstalled: boolean;
  tailscaleUp: boolean;
  tailscaleIp?: string | null;
  tailscaleDns?: string | null;
  tailnet: string | null;
};

type JellyfinSession = {
  id: string;
  name: string;
  client: string;
  deviceId?: string;
  user?: string;
  supportsRemoteControl: boolean;
  nowPlaying?: { id: string; name: string; type: string; seriesName?: string } | null;
  isPaused?: boolean;
};

const empty: Box = {
  provisioned: false,
  ipv4: "",
  watch: "",
  seerr: "",
  jellyfin: { state: "amber", detail: "Still starting" },
  frontend: "jellyfin",
  access: "lan",
  adminName: "",
  adminPassword: "",
  tailscaleAuth: null,
  tailscaleInstalled: false,
  tailscaleUp: false,
  tailnet: null,
};

export function ConnectView({ onDone }: { onDone?: () => void }) {
  const navigate = useNavigate();
  const patchSettings = useReelStore((s) => s.patchSettings);
  const openReelOS = useReelStore((s) => s.openReelOS);
  const [box, setBox] = useState<Box>(empty);
  const [sessions, setSessions] = useState<JellyfinSession[]>([]);
  const [away, setAway] = useState<"house" | "out" | null>(null);
  const [deviceTab, setDeviceTab] = useState<"tv" | "vlc" | "ios" | "android">("tv");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [idxName, setIdxName] = useState("Custom source");
  const [idxUrl, setIdxUrl] = useState("");
  const [idxKey, setIdxKey] = useState("");
  const [idxMsg, setIdxMsg] = useState("");
  const [tsBusy, setTsBusy] = useState(false);
  const [tsMsg, setTsMsg] = useState("");

  // Wireless ADB Sideload state
  const [adbIp, setAdbIp] = useState("");
  const [adbLoading, setAdbLoading] = useState(false);
  const [adbMsg, setAdbMsg] = useState("");

  const handleAdbPush = async () => {
    if (!adbIp.trim()) return;
    setAdbLoading(true);
    setAdbMsg("");
    try {
      const res = await fetch("/api/apps/android/sideload-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: adbIp.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok && !data.simulated) {
        setAdbMsg("✓ " + (data.message || "Installed and launched on TV!"));
      } else {
        setAdbMsg("Failed: " + (data.error || "Could not push to TV"));
      }
    } catch (e) {
      setAdbMsg("Network error: " + String(e));
    } finally {
      setAdbLoading(false);
    }
  };

  // Quick Connect state
  const [qcCode, setQcCode] = useState("");
  const [qcLoading, setQcLoading] = useState(false);
  const [qcMsg, setQcMsg] = useState("");
  const [qcSuccess, setQcSuccess] = useState(false);

  // Ping & Screen Verification state
  const [pingingSessionId, setPingingSessionId] = useState<string | null>(null);
  const [pingMsg, setPingMsg] = useState("");

  const refreshSessions = async () => {
    try {
      const res = await fetch("/api/cast/sessions", { cache: "no-store" });
      const c = await res.json();
      if (c.ok && Array.isArray(c.sessions)) {
        setSessions(c.sessions);
      }
    } catch {}
  };

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const [boxRes, castRes] = await Promise.all([
          fetch("/api/box", { cache: "no-store" }),
          fetch("/api/cast/sessions", { cache: "no-store" }),
        ]);
        const b = (await boxRes.json()) as Box;
        if (!stop) setBox({ ...empty, ...b });
        const c = await castRes.json();
        if (!stop && c.ok && Array.isArray(c.sessions)) {
          setSessions(c.sessions);
        }
      } catch {
        if (!stop) setBox((b) => ({ ...b, jellyfin: { state: "red", detail: "Can't start" } }));
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 4000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  const finish = (target: string = "/") => {
    patchSettings({ connectDone: true });
    openReelOS();
    onDone?.();
    void navigate({ to: target });
  };

  const jfLock = box.jellyfin.state === "red";
  const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const advertisedOrigin = box.tailscaleDns
    ? `https://${box.tailscaleDns}`
    : box.tailscaleIp
      ? `http://${box.tailscaleIp}:8080`
      : box.ipv4
        ? `http://${box.ipv4}:8080`
        : browserOrigin;
  const tvShortlink = advertisedOrigin ? `${advertisedOrigin}/tv` : "";
  const apkDownloadUrl = advertisedOrigin ? `${advertisedOrigin}/downloads/reelos-app.apk` : "";
  const watch = box.watch || (advertisedOrigin ? `${advertisedOrigin}/api/stream` : "");

  const handleCopyUrl = (urlToCopy: string) => {
    if (navigator.clipboard && urlToCopy) {
      void navigator.clipboard.writeText(urlToCopy);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleCodeChange = (val: string) => {
    const raw = val.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
    if (raw.length <= 3) {
      setQcCode(raw);
    } else {
      setQcCode(`${raw.slice(0, 3)}-${raw.slice(3, 6)}`);
    }
  };

  const handleQuickConnect = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = qcCode.replace(/[\s-]+/g, "").trim();
    if (!code) return;
    setQcLoading(true);
    setQcMsg("");
    setQcSuccess(false);
    try {
      const res = await fetch("/api/quickconnect/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.ok) {
        setQcSuccess(true);
        setQcMsg("✓ Device authorized! Screen linking in progress...");
        setQcCode("");
        void refreshSessions();
        setTimeout(() => void refreshSessions(), 1500);
        setTimeout(() => void refreshSessions(), 3500);
      } else {
        setQcMsg(data.error || "Could not authorize Quick Connect code.");
      }
    } catch (err) {
      setQcMsg("Network error: " + String(err));
    } finally {
      setQcLoading(false);
    }
  };

  const handleSendPing = async (sessionId: string, sessionName: string) => {
    setPingingSessionId(sessionId);
    setPingMsg("");
    try {
      const res = await fetch("/api/cast/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          header: "ReelOS Linked",
          text: "Your screen is connected and ready for 4K DirectPlay!",
          timeoutMs: 5000,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setPingMsg(`✓ Ping sent to ${sessionName}! Look for the alert on your screen.`);
        setTimeout(() => setPingMsg(""), 5000);
      } else {
        setPingMsg(j.error || "Could not send alert to screen");
      }
    } catch (err) {
      setPingMsg("Ping failed: " + String(err));
    } finally {
      setPingingSessionId(null);
    }
  };

  const addCustomSource = async () => {
    setIdxMsg("");
    const r = await fetch("/api/indexer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: idxName, url: idxUrl, key: idxKey }),
    });
    const j = (await r.json()) as { ok?: boolean; error?: string };
    setIdxMsg(j.ok ? "Added." : j.error || "Could not add");
    if (j.ok) {
      setIdxUrl("");
      setIdxKey("");
    }
  };

  return (
    <div className="px-5 py-8 md:px-10 max-w-4xl mx-auto space-y-6">
      <div>
        <p className="font-display text-xs tracking-[0.22em] text-gold uppercase">Connect</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Connect Your Devices
        </h1>
        <p className="mt-2 text-sm text-muted max-w-2xl leading-relaxed">
          ReelOS is your complete cinema operating system. Watch natively in your browser, in Couch TV mode (/tv), or link third-party players like Swiftfin and Findroid via the ReelOS TV Bridge.
          ReelOS checks each title and device before choosing original playback or a compatible prepared copy.
        </p>
      </div>

      {/* ReelOS TV Bridge Service State Banner */}
      <Card>
        <Dot state={box.jellyfin.state} />
        <div className="flex-1">
          <p className="font-display font-medium text-foreground">ReelOS TV Bridge</p>
          <p className="mt-0.5 text-xs text-muted">{box.jellyfin.detail}</p>
        </div>
        {watch ? (
          <a
            href={watch}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-gold inline-flex items-center gap-1 hover:underline"
          >
            <span>Open in Browser</span>
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </Card>

      {/* Quick Connect Fast-Pass */}
      <Card locked={jfLock} className="border border-gold/30 bg-gold/5">
        <div className="w-full space-y-3">
          <div className="flex items-center gap-2 text-gold">
            <Key className="size-4" />
            <p className="font-display text-sm font-semibold uppercase tracking-wider">
              Quick Connect (Recommended for TV)
            </p>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Open Swiftfin, Findroid, or your TV player app, select "Quick Connect", and enter the 6-digit code below to link your screen instantly without typing passwords.
          </p>
          <form onSubmit={handleQuickConnect} className="flex flex-wrap gap-2 items-center pt-1">
            <div className="relative">
              <input
                type="text"
                maxLength={8}
                value={qcCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="123-456"
                className="h-11 w-44 rounded-xl bg-card px-3 text-center font-mono text-lg font-bold tracking-widest text-foreground placeholder:text-faint shadow-[var(--shadow-border)] focus:shadow-[var(--shadow-gold)] uppercase"
              />
              {qcCode ? (
                <button
                  type="button"
                  onClick={() => setQcCode("")}
                  className="absolute right-2.5 top-3 text-muted hover:text-foreground cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <Button
              type="submit"
              disabled={qcLoading || qcCode.replace(/[\s-]+/g, "").length < 4}
              className="h-11 rounded-xl px-5 cursor-pointer"
            >
              {qcLoading ? <LoaderCircle className="size-4 animate-spin mr-1.5" /> : null}
              Authorize Screen
            </Button>
          </form>
          {qcMsg ? (
            <p className={cn("text-xs font-medium pt-1", qcSuccess ? "text-success" : "text-danger")}>
              {qcMsg}
            </p>
          ) : null}
          <div className="pt-2 border-t border-border/40 text-xs text-muted">
            <span className="font-semibold text-foreground">Default Login Credentials:</span> For mobile apps or direct sign-in, use username "reelos" and password "reelos".
          </div>
        </div>
      </Card>

      {/* Active Screens Linked Tray */}
      {sessions.length > 0 ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
              </span>
              <p className="font-display text-xs font-semibold uppercase tracking-wider">
                Active Screens Linked ({sessions.length})
              </p>
            </div>
            <span className="text-[11px] font-medium text-emerald-400/90 hidden sm:inline">
              Ready for 4K DirectPlay & "Play on TV"
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl bg-card p-3 border border-border/80 shadow-sm transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold">
                    {s.client.toLowerCase().includes("tv") ? (
                      <Tv className="size-4" />
                    ) : (
                      <Smartphone className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{s.name}</p>
                    <p className="truncate text-[10px] text-muted">
                      {s.client}
                      {s.user ? ` · ${s.user}` : ""}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pingingSessionId === s.id}
                  onClick={() => void handleSendPing(s.id, s.name)}
                  className="h-7 shrink-0 rounded-lg px-2 text-[11px] hover:text-gold cursor-pointer"
                  title="Send test on-screen notification"
                >
                  {pingingSessionId === s.id ? (
                    <LoaderCircle className="size-3 animate-spin mr-1" />
                  ) : (
                    <Send className="size-3 mr-1" />
                  )}
                  Ping Screen
                </Button>
              </div>
            ))}
          </div>

          {pingMsg ? (
            <p className="text-xs text-emerald-400 font-medium">{pingMsg}</p>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 px-4 py-2.5 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-muted/60" />
            <span>No active screens linked yet</span>
          </div>
          <span className="text-[11px] text-faint">Optional: Open ReelOS TV Mode (/tv) or Swiftfin on your TV to enable "Play on TV"</span>
        </div>
      )}

      {/* Instant In-Browser Playback Banner */}
      <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gold/15 text-gold shrink-0 border border-gold/25">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Instant In-Browser Playback</h4>
            <p className="text-xs text-muted">Zero apps required. Stream smoothly right in your mobile, tablet, or desktop web browser.</p>
          </div>
        </div>
        <span className="hidden sm:inline-flex rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-gold border border-gold/30">
          Built-in
        </span>
      </div>

      {/* Platform Onboarding Tabs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDeviceTab("tv")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                deviceTab === "tv"
                  ? "bg-gold text-gold-fg shadow-sm"
                  : "bg-card text-muted hover:text-foreground border border-border/60",
              )}
            >
              <Tv className="size-4" />
              <span>Living Room TV</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceTab("vlc")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                deviceTab === "vlc"
                  ? "bg-gold text-gold-fg shadow-sm"
                  : "bg-card text-muted hover:text-foreground border border-border/60",
              )}
            >
              <Play className="size-4 fill-current" />
              <span>VLC (Optional 4K)</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceTab("ios")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                deviceTab === "ios"
                  ? "bg-gold text-gold-fg shadow-sm"
                  : "bg-card text-muted hover:text-foreground border border-border/60",
              )}
            >
              <Smartphone className="size-4" />
              <span>Apple iOS (iPhone/iPad)</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceTab("android")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                deviceTab === "android"
                  ? "bg-gold text-gold-fg shadow-sm"
                  : "bg-card text-muted hover:text-foreground border border-border/60",
              )}
            >
              <Smartphone className="size-4" />
              <span>Android</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Living Room TV */}
        {deviceTab === "tv" ? (
          <div className="space-y-4">
            {/* Primary: Native ReelOS TV App via Downloader */}
            <Card locked={jfLock} className="flex-col gap-4 sm:flex-row items-center sm:items-start p-6 border border-gold/40 bg-gold/5">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <Tv className="size-4 text-gold" />
                  <h3 className="font-display text-base font-semibold text-foreground">
                    Watch on the TV: ReelOS Native App for Fire TV & Google TV
                  </h3>
                  <span className="rounded-full bg-gold/20 border border-gold/40 px-2 py-0.5 text-[10px] font-mono text-gold font-semibold">
                    Compatibility checked per title
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Open the <strong>Downloader</strong> app on your Fire TV or Google TV and enter the shortcode below to download and install ReelOS instantly:
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
                  <span className="rounded-lg bg-card-2 border border-border px-3.5 py-1.5 font-bold text-gold break-all text-sm">
                    {tvShortlink}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopyUrl(tvShortlink)}
                    className="h-8 rounded-lg border border-border bg-card/60 px-3 text-xs hover:text-gold"
                  >
                    {copiedUrl ? <Check className="size-3.5 text-success mr-1" /> : <Copy className="size-3.5 mr-1" />}
                    {copiedUrl ? "Copied" : "Copy URL"}
                  </Button>
                </div>
                <div className="rounded-xl border border-border bg-card-2 p-3 space-y-1.5 text-xs text-muted">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-gold" />
                    Automatic Setup:
                  </p>
                  <p className="leading-relaxed">
                    The TV app automatically discovers your ReelOS box on your home Wi-Fi. It hardware-decodes 4K HDR10 and Dolby Vision directly on the TV, with <strong>0% CPU load</strong> on your appliance.
                  </p>
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-center space-y-2">
                <div className="rounded-2xl bg-white p-3 shadow-md border border-border/50">
                  <QrCodeSvg value={tvShortlink} size={140} />
                </div>
                <span className="text-[10px] text-muted font-mono uppercase tracking-wider">
                  Scan for TV Downloader
                </span>
              </div>
            </Card>

            {/* Secondary: 1-Click Wireless ADB Push */}
            <Card locked={jfLock} className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-gold" />
                  <h4 className="font-display text-sm font-semibold text-foreground">
                    1-Click Wireless Push to TV (ADB Sideload)
                  </h4>
                </div>
                <span className="text-[11px] text-muted font-mono">Developer Mode</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Push the ReelOS app directly over your home Wi-Fi to your TV without typing URLs or using a USB drive:
              </p>
              <div className="rounded-xl border border-gold/30 bg-gold/5 p-3.5 space-y-2 text-xs text-muted text-left">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Zap className="size-3.5 text-gold" />
                  How to enable Wireless Install on your TV:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                  <li>On your TV remote, open <strong>Settings → System / About (or Device Preferences)</strong>.</li>
                  <li>Scroll to <strong>Build</strong> and click it <strong>7 times</strong> until it says <em>"You are now a developer!"</em></li>
                  <li>Go to <strong>Developer Options</strong> and turn ON <strong>"Network / Wireless Debugging"</strong> (and USB Debugging).</li>
                  <li>Enter your TV's IP address below and click <strong>"Push ReelOS to TV"</strong>.</li>
                </ol>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleAdbPush();
                }}
                className="flex flex-col sm:flex-row items-center gap-2 pt-1"
              >
                <div className="relative flex-1 w-full">
                  <input
                    type="text"
                    placeholder="TV IP address (e.g. 192.168.1.50)"
                    value={adbIp}
                    onChange={(e) => setAdbIp(e.target.value)}
                    className="h-10 w-full rounded-xl bg-card px-4 pr-9 text-xs font-mono border border-border shadow-[var(--shadow-border)] placeholder:text-faint"
                  />
                  {adbIp ? (
                    <button
                      type="button"
                      onClick={() => setAdbIp("")}
                      className="absolute right-2.5 top-3 text-muted hover:text-foreground cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  type="submit"
                  disabled={adbLoading || !adbIp.trim()}
                  className="h-10 rounded-xl px-4 text-xs font-semibold w-full sm:w-auto"
                >
                  {adbLoading ? <LoaderCircle className="size-3.5 animate-spin mr-1.5" /> : <Send className="size-3.5 mr-1.5" />}
                  {adbLoading ? "Pushing APK..." : "Push ReelOS to TV"}
                </Button>
              </form>
              {adbMsg && (
                <p className={cn("text-xs font-medium pt-1", adbMsg.startsWith("✓") ? "text-success" : "text-danger")}>
                  {adbMsg}
                </p>
              )}
            </Card>

            {/* TV Quick Connect PIN Bridge */}
            <Card locked={jfLock} className="p-6 space-y-4">
              <div className="flex items-center gap-2.5 text-gold">
                <Sparkles className="size-4" />
                <h4 className="font-display text-sm font-semibold text-foreground">
                  QuickConnect TV Screen Link
                </h4>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                When you open ReelOS on your TV, it displays a 6-digit PIN on the screen. Enter it below to link your living room screen instantly:
              </p>
              <form
                onSubmit={handleQuickConnect}
                className="flex flex-col sm:flex-row items-center gap-2.5"
              >
                <div className="relative w-full sm:w-48">
                  <input
                    type="text"
                    maxLength={8}
                    placeholder="e.g. 842-190"
                    value={qcCode}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    className="h-12 w-full text-center rounded-xl bg-card font-mono text-lg font-bold tracking-widest border border-border shadow-[var(--shadow-border)] text-gold placeholder:text-faint uppercase"
                  />
                  {qcCode ? (
                    <button
                      type="button"
                      onClick={() => setQcCode("")}
                      className="absolute right-2.5 top-3.5 text-muted hover:text-foreground cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
                <Button
                  type="submit"
                  disabled={qcLoading || qcCode.replace(/[\s-]+/g, "").length < 4}
                  className="h-12 rounded-xl px-5 text-xs font-semibold w-full sm:w-auto cursor-pointer"
                >
                  {qcLoading ? <LoaderCircle className="size-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="size-3.5 mr-1.5" />}
                  Link TV Screen
                </Button>
              </form>
              {qcMsg && (
                <p className={cn("text-xs font-medium", qcSuccess ? "text-success" : "text-danger")}>
                  {qcMsg}
                </p>
              )}
            </Card>
          </div>
        ) : null}

        {/* Tab: VLC (Instant Zero-Config Playback) */}
        {deviceTab === "vlc" ? (
          <Card locked={jfLock} className="flex-col gap-4 sm:flex-row items-center sm:items-start p-6 border border-gold/30 bg-gold/5">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2 text-gold">
                <Play className="size-4 fill-current" />
                <h3 className="font-display text-base font-semibold text-foreground">
                  Instant Playback with VLC (Direct Play)
                </h3>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                VLC can open many common video and audio formats on phones, tablets, TVs, and laptops. Actual format support depends on the device and the selected media.
              </p>
              <div className="flex flex-wrap gap-2.5 pt-1">
                <a
                  href="https://apps.apple.com/app/vlc-media-player/id650377962"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-semibold text-gold-fg shadow-sm hover:opacity-90"
                >
                  <span>VLC for iOS / Apple TV</span>
                  <ExternalLink className="size-3.5" />
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=org.videolan.vlc"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card-2 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-card"
                >
                  <span>VLC for Android / Google TV</span>
                  <ExternalLink className="size-3.5" />
                </a>
                <a
                  href="https://www.videolan.org/vlc/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card-2 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-card"
                >
                  <span>VLC for Windows & Mac</span>
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
              <div className="rounded-xl border border-gold/20 bg-gold/10 p-3 text-xs text-foreground space-y-1">
                <p className="font-semibold text-gold flex items-center gap-1.5">
                  <Sparkles className="size-3.5" />
                  How to stream in ReelOS:
                </p>
                <p className="leading-relaxed text-muted">
                  When browsing movies in ReelOS, just tap <strong>Watch</strong> and pick <strong>"Play in VLC"</strong>. The movie streams immediately with full hardware acceleration, leaving the potato box CPU at 0%.
                </p>
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-center space-y-2">
              <div className="rounded-2xl bg-white p-3 shadow-md border border-border/50">
                <QrCodeSvg value="https://www.videolan.org/vlc/" size={140} />
              </div>
              <span className="text-[10px] text-muted font-mono uppercase tracking-wider">
                Scan for VLC
              </span>
            </div>
          </Card>
        ) : null}

        {/* Tab 2: Apple iOS */}
        {deviceTab === "ios" ? (
          <Card locked={jfLock} className="flex-col gap-4 sm:flex-row items-center sm:items-start p-6">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone className="size-4 text-gold" />
                <h3 className="font-display text-base font-semibold text-foreground">
                  Apple iPhone & iPad Setup
                </h3>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Safari does not support playing <code>.mkv</code> files directly. For seamless native DirectPlay, install <strong>Swiftfin</strong> (the official open-source native iOS app) or <strong>Infuse</strong>:
              </p>
              <div className="flex flex-wrap gap-2.5 pt-1">
                <a
                  href="https://apps.apple.com/app/swiftfin/id1527040564"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-semibold text-gold-fg shadow-sm hover:opacity-90"
                >
                  <span>Get Swiftfin on App Store</span>
                  <ExternalLink className="size-3.5" />
                </a>
                <a
                  href="https://firecore.com/infuse"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card-2 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-card"
                >
                  <span>Get Infuse</span>
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
              <div className="rounded-xl border border-border bg-raised p-3 text-xs text-muted space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Zap className="size-3.5 text-gold" />
                  Crucial Setting for Potato Mode:
                </p>
                <p className="leading-relaxed">
                  In Swiftfin Settings, start with <strong>Playback Quality → Maximum</strong>. If the device cannot play the original format, ReelOS will report that a compatible rendition is needed.
                </p>
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-center space-y-2">
              <div className="rounded-2xl bg-white p-3 shadow-md border border-border/50">
                <QrCodeSvg value="https://apps.apple.com/app/swiftfin/id1527040564" size={140} />
              </div>
              <span className="text-[10px] text-muted font-mono uppercase tracking-wider">
                Scan for Swiftfin
              </span>
            </div>
          </Card>
        ) : null}

        {/* Tab 3: Android */}
        {deviceTab === "android" ? (
          <Card locked={jfLock} className="flex-col gap-4 sm:flex-row items-center sm:items-start p-6 border border-gold/40 bg-gold/5">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone className="size-4 text-gold" />
                <h3 className="font-display text-base font-semibold text-foreground">
                  Native ReelOS App for Android & Foldables
                </h3>
                <span className="rounded-full bg-gold/20 border border-gold/40 px-2 py-0.5 text-[10px] font-mono text-gold font-semibold">
                  Universal APK
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Use the Android client for supported original-quality playback and offline downloads. Codec and HDR support vary by device.
              </p>
              <div className="flex flex-wrap gap-2.5 pt-1">
                <a
                  href={apkDownloadUrl}
                  download="reelos-app.apk"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-gold-fg shadow-sm hover:opacity-90 transition-opacity"
                >
                  <Smartphone className="size-3.5" />
                  <span>Download ReelOS APK (v1.0.0)</span>
                </a>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopyUrl(apkDownloadUrl)}
                  className="h-8 rounded-xl border border-border bg-card/60 px-3 text-xs hover:text-gold"
                >
                  {copiedUrl ? <Check className="size-3.5 text-success mr-1" /> : <Copy className="size-3.5 mr-1" />}
                  {copiedUrl ? "Copied" : "Copy APK Link"}
                </Button>
              </div>
              <div className="rounded-xl border border-border bg-card-2 p-3 text-xs text-muted space-y-1.5">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-gold" />
                  Native Mobile Superpowers:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <Check className="size-3 text-success" />
                    <span>Hardware 10-bit HDR10/Dolby Vision</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Check className="size-3 text-success" />
                    <span>Foldable 90° Tabletop Flex Mode</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Check className="size-3 text-success" />
                    <span>In-App Offline Trip Downloads</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Check className="size-3 text-success" />
                    <span>Couch Remote Bar for Living Room TV</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-center space-y-2">
              <div className="rounded-2xl bg-white p-3 shadow-md border border-border/50">
                <QrCodeSvg value={apkDownloadUrl} size={140} />
              </div>
              <span className="text-[10px] text-muted font-mono uppercase tracking-wider">
                Scan for Android APK
              </span>
            </div>
          </Card>
        ) : null}
      </div>

      {/* Low-memory playback guidance */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 to-card/40 p-5 shadow-lg space-y-2">
        <div className="flex items-center gap-2 text-gold">
          <Zap className="size-4" />
          <p className="font-display text-xs font-semibold tracking-wider uppercase">
            Low-memory playback guidance
          </p>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          On a low-memory ReelOS home, live video conversion stays off to protect playback. Try <strong>Maximum / Original</strong> quality in the client. If that format is unsupported, prepare a compatible copy before watching.
        </p>
      </div>

      {/* Potato Mode Readiness Checklist */}
      <div className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-gold">
          <CheckCircle2 className="size-4 text-gold" />
          <h3 className="font-display text-xs font-semibold uppercase tracking-wider">
            Potato Mode Readiness Checklist
          </h3>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          ReelOS limits background work so playback and normal device use remain responsive.
        </p>
        <div className="grid gap-2.5 sm:grid-cols-3 pt-1">
          <div className="rounded-xl border border-border bg-card-2 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
              <Check className="size-3.5" />
              <span>1. Conversion limit</span>
            </div>
            <p className="text-[11px] text-muted leading-tight">
              Live CPU video conversion is disabled on this hardware profile.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card-2 p-3 space-y-1">
            <div
              className={cn(
                "flex items-center gap-1.5 text-xs font-semibold",
                sessions.length > 0 ? "text-emerald-400" : "text-gold",
              )}
            >
              {sessions.length > 0 ? (
                <Check className="size-3.5" />
              ) : (
                <LoaderCircle className="size-3.5 animate-spin" />
              )}
              <span>2. Screen Linked</span>
            </div>
            <p className="text-[11px] text-muted leading-tight">
              {sessions.length > 0
                ? `${sessions.length} screen(s) detected online.`
                : "Sign in via Quick Connect PIN above."}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card-2 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
              <Check className="size-3.5" />
              <span>3. Quality = Maximum</span>
            </div>
            <p className="text-[11px] text-muted leading-tight">
              Set Playback Quality to Maximum in client app settings.
            </p>
          </div>
        </div>
      </div>

      {/* Away From Home (Tailscale) */}
      <Card>
        <div className="w-full">
          <p className="font-display font-medium">Away from home (Stream on 5G)</p>
          <p className="mt-1 text-xs text-muted">
            Use Tailscale so your phone can stream media anywhere without port forwarding.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant={away === "house" ? "gold" : "ghost"} onClick={() => setAway("house")}>
              Only this house
            </Button>
            <Button variant={away === "out" ? "gold" : "ghost"} onClick={() => setAway("out")}>
              Also my phone when I'm out
            </Button>
          </div>
          {away === "out" ? (
            <div className="mt-4 text-sm text-muted">
              {box.tailscaleUp && box.tailscaleIp ? (
                <div className="text-foreground">
                  <p className="font-display text-2xl tracking-tight">{box.tailscaleIp}</p>
                  {box.tailscaleDns ? (
                    <div className="mt-2">
                      <p className="text-xs text-muted">MagicDNS HTTPS Domain:</p>
                      <a
                        href={`https://${box.tailscaleDns}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-sm text-gold underline break-all"
                      >
                        https://{box.tailscaleDns}
                      </a>
                    </div>
                  ) : null}
                  {box.tailnet ? <p className="mt-1">Tailnet {box.tailnet}. Survives reboot.</p> : null}
                  <p className="mt-3">
                    Phone: Tailscale app, same account, then{" "}
                    <span className="text-gold font-mono">http://{box.tailscaleIp}:8080/api/stream</span>
                  </p>
                </div>
              ) : (
                <>
                  <p>Install the Tailscale app on your phone with the same account. First, sign this box in.</p>
                  <Button
                    className="mt-3"
                    disabled={tsBusy}
                    onClick={() => {
                      setTsBusy(true);
                      setTsMsg("Getting a login link…");
                      void fetch("/api/tailscale/login", { method: "POST" })
                        .then((r) => r.json())
                        .then((j: { ok?: boolean; error?: string; auth?: string; up?: boolean }) => {
                          if (j.up) setTsMsg("Already logged in.");
                          else setTsMsg(j.ok ? "Open the link or scan the QR." : j.error || "Could not start login");
                        })
                        .finally(() => setTsBusy(false));
                    }}
                  >
                    Get Tailscale login
                  </Button>
                  {tsMsg ? <p className="mt-2">{tsMsg}</p> : null}
                  {box.tailscaleAuth ? (
                    <>
                      <a className="mt-4 block break-all font-display text-2xl text-gold" href={box.tailscaleAuth}>
                        {box.tailscaleAuth}
                      </a>
                      <div className="mt-3 w-fit rounded-2xl bg-white p-3 shadow-md">
                        <QrCodeSvg value={box.tailscaleAuth} size={200} />
                      </div>
                      <Button
                        className="mt-3"
                        variant="ghost"
                        disabled={tsBusy}
                        onClick={async () => {
                          setTsBusy(true);
                          setTsMsg("Checking login state…");
                          try {
                            const r = await fetch("/api/tailscale/check", { method: "POST" });
                            const j = (await r.json()) as { ok?: boolean; up?: boolean; error?: string };
                            if (j.up) {
                              setTsMsg("Connected! Refreshing network status…");
                              showToast("Tailscale connected successfully!", "success");
                            } else {
                              setTsMsg(j.error || "Not signed in yet. Please complete sign-in on Tailscale.");
                              showToast(j.error || "Not signed in yet", "info");
                            }
                          } catch (e) {
                            setTsMsg("Check failed: " + String(e));
                            showToast("Tailscale check failed", "error");
                          } finally {
                            setTsBusy(false);
                          }
                        }}
                      >
                        {tsBusy ? "Checking…" : "I've signed in"}
                      </Button>
                    </>
                  ) : box.tailscaleInstalled ? (
                    <p className="mt-2">Installed. Not logged in — tap Get Tailscale login.</p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </Card>

      {/* Custom source endpoint (Optional) */}
      <Card>
        <div className="w-full">
          <p className="font-display font-medium">Custom source endpoint</p>
          <p className="mt-1 text-sm text-muted">
            Optional advanced source lookup. Leave this empty unless your household already has a compatible endpoint and access key.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void addCustomSource();
            }}
          >
            <input
              className="mt-3 h-11 w-full rounded-xl bg-raised px-3 text-sm"
              value={idxName}
              onChange={(e) => setIdxName(e.target.value)}
              placeholder="Name"
            />
            <input
              className="mt-2 h-11 w-full rounded-xl bg-raised px-3 text-sm"
              value={idxUrl}
              onChange={(e) => setIdxUrl(e.target.value)}
              placeholder="https://…"
            />
            <input
              className="mt-2 h-11 w-full rounded-xl bg-raised px-3 text-sm"
              value={idxKey}
              onChange={(e) => setIdxKey(e.target.value)}
              placeholder="API key"
            />
            <div className="mt-3 flex gap-2">
              <Button type="submit">Add</Button>
              <Button type="button" variant="ghost" onClick={() => setIdxMsg("Skipped")}>
                Skip
              </Button>
            </div>
          </form>
          {idxMsg ? <p className="mt-2 text-xs text-muted">{idxMsg}</p> : null}
        </div>
      </Card>

      {/* First Stream Jumpstart Bridge */}
      <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 via-card/80 to-card p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2.5 text-gold">
          <Sparkles className="size-5" />
          <h3 className="font-display text-lg font-bold text-foreground">
            Ready for Your First Stream
          </h3>
        </div>
        <p className="text-xs text-muted max-w-xl leading-relaxed">
          Your provider connection is configured. Browse <strong>Discover</strong> to find a title; ReelOS will show whether a playable copy is available before offering playback.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            size="lg"
            onClick={() => finish("/discover")}
            className="h-12 rounded-xl px-6 font-display font-semibold shadow-[var(--shadow-gold)] gap-2 cursor-pointer"
          >
            <Sparkles className="size-4" />
            <span>Explore Discover & Add First Title</span>
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => finish("/")}
            className="h-12 rounded-xl px-5 border border-border bg-card/60 text-muted hover:text-foreground cursor-pointer"
          >
            Open Home Screen
          </Button>
          <Button
            variant="ghost"
            onClick={() => finish("/")}
            className="text-xs text-faint hover:text-muted cursor-pointer"
          >
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}

function Card({
  children,
  locked,
  className,
}: {
  children: React.ReactNode;
  locked?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl bg-card px-5 py-4 shadow-[var(--shadow-border)] transition-all",
        locked && "opacity-50",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Dot({ state }: { state: "green" | "amber" | "red" | "unknown" }) {
  const color = state === "green" ? "bg-live" : state === "red" ? "bg-danger" : "bg-gold";
  return <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", color)} />;
}
