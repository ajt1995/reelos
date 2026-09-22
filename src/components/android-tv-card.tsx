import { useState, useEffect } from "react";
import { Download, RefreshCw, Send, Tv, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/lib/toast";

interface DiscoveredTv {
  ip: string;
  port: number;
  name: string;
  online: boolean;
}

export function AndroidTvCard() {
  const [devices, setDevices] = useState<DiscoveredTv[]>([]);
  const [scanning, setScanning] = useState(false);
  const [customIp, setCustomIp] = useState("");
  const [pushingIp, setPushingIp] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  const handleScan = async () => {
    setScanning(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/apps/android/scan", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setDevices(Array.isArray(data.devices) ? data.devices : []);
        if (data.devices?.length === 0) {
          setStatusMsg("No Android TV devices responding on port 5555. Ensure ADB Debugging is enabled on your TV.");
        }
      }
    } catch {
      setStatusMsg("Scan error. You can manually enter your TV's IP address below.");
    }
    setScanning(false);
  };

  useEffect(() => {
    handleScan();
  }, []);

  const handlePush = async (ip: string) => {
    if (!ip) return;
    setPushingIp(ip);
    setStatusMsg(`Connecting to TV at ${ip}:5555 and sideloading ReelOS APK…`);
    try {
      const res = await fetch("/api/apps/android/sideload-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, port: 5555 }),
      });
      const data = await res.json();
      if (res.ok && data.ok && !data.simulated) {
        setStatusMsg(`Success! ReelOS TV has been installed and launched on ${ip}!`);
        showToast(`ReelOS installed on ${ip}!`, "success");
      } else {
        setStatusMsg(`Installation note: ${data.error || "Could not connect to TV. Verify Developer Options > Network Debugging is ON."}`);
      }
    } catch (err) {
      setStatusMsg(`Connection error: ${String(err)}`);
    }
    setPushingIp(null);
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card/80 px-5 py-5 shadow-sm backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gold/10 text-gold border border-gold/20 shrink-0 mt-0.5">
            <Tv className="size-4.5" />
          </div>
          <div>
            <p className="font-display font-medium text-foreground">
              Android TV & Fire TV Sideload
            </p>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              Install the native ReelOS TV app onto your living room television or streaming stick with 1 click over your home Wi-Fi.
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleScan}
          disabled={scanning}
          className="text-xs hover:border-gold/40 hover:text-gold shrink-0"
        >
          <RefreshCw className={`size-3.5 mr-1.5 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning LAN…" : "Scan Network"}
        </Button>
      </div>

      {/* Discovered devices */}
      <div className="mt-4 space-y-2">
        {devices.map((d) => (
          <div
            key={d.ip}
            className="flex items-center justify-between rounded-xl bg-card-2 p-3 border border-border/50"
          >
            <div className="flex items-center gap-2.5">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <p className="text-xs font-medium text-foreground">{d.name}</p>
                <p className="text-[11px] text-muted font-mono">{d.ip}:5555</p>
              </div>
            </div>
            <Button
              variant="gold"
              size="sm"
              className="text-xs"
              disabled={pushingIp === d.ip}
              onClick={() => handlePush(d.ip)}
            >
              <Send className="size-3 mr-1.5" />
              {pushingIp === d.ip ? "Installing on TV…" : "Install on TV"}
            </Button>
          </div>
        ))}
      </div>

      {/* Manual IP Input & Direct APK Download */}
      <div className="mt-4 pt-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <input
            type="text"
            placeholder="Manual TV IP (e.g. 192.168.1.145)"
            value={customIp}
            onChange={(e) => setCustomIp(e.target.value)}
            className="rounded-xl border border-border/70 bg-black/30 px-3 py-1.5 text-xs text-foreground placeholder:text-muted/60 focus:border-gold/50 focus:outline-none w-full"
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={!customIp || pushingIp === customIp}
            onClick={() => handlePush(customIp)}
            className="shrink-0 text-xs hover:border-gold/40 hover:text-gold"
          >
            Push APK
          </Button>
        </div>

        <a
          href="/clients/reelos-android-universal.apk"
          download="reelos-android-universal.apk"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-gold transition-colors py-1.5"
        >
          <Download className="size-3.5" />
          Download APK
        </a>
      </div>

      <div className="mt-4 pt-3 border-t border-border/40 flex flex-col gap-2">
        <a 
          href={typeof window !== "undefined" ? `${window.location.origin}/tv` : "/tv"} 
          target="_blank" 
          rel="noreferrer" 
          className="text-xs text-blue-400 hover:underline"
        >
          1-Click Launch: TV Couch Mode in Browser
        </a>
        <div className="text-xs text-muted">
          1-Click Connect: Launch ReelOS on your TV or visit <span className="text-gold">http://{typeof window !== "undefined" ? window.location.hostname : "localhost"}:8080/tv</span>
        </div>
      </div>

      {statusMsg ? (
        <div className="mt-3 rounded-xl bg-white/[0.03] p-2.5 text-[11px] text-muted leading-relaxed border border-white/5">
          {statusMsg}
        </div>
      ) : null}
    </div>
  );
}
