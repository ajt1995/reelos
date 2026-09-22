import React, { useState, useEffect } from "react";
import { LoaderCircle, Wifi, Lock, CheckCircle, RefreshCw, AlertCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WifiPicker({ onConnected }: { onConnected: () => void }) {
  const [networks, setNetworks] = useState<Array<{ ssid: string; security: string; signal: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSsid, setSelectedSsid] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const scan = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/wifi/scan");
      const data = await res.json();
      if (data.ok) {
        setNetworks(data.networks || []);
      } else {
        setError(data.error || "Failed to scan networks");
      }
    } catch {
      setError("Network error while scanning");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    scan();
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSsid) return;
    setConnecting(true);
    setError("");
    try {
      const res = await fetch("/api/wifi/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssid: selectedSsid, password })
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(true);
        // The hotspot might disconnect here, so we show a success message
      } else {
        setError(data.error || "Failed to connect");
        setConnecting(false);
      }
    } catch {
      // If we get a network error here, it might actually mean the hotspot dropped successfully!
      setSuccess(true);
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        onConnected();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [success, onConnected]);

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center text-center space-y-4 p-8 animate-in fade-in zoom-in-95">
        <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mb-2 shadow-[0_0_20px_rgba(52,211,153,0.3)]">
          <CheckCircle className="size-8" />
        </div>
        <h2 className="font-display text-2xl font-semibold text-foreground">Appliance Connected!</h2>
        <p className="text-sm text-muted max-w-sm leading-relaxed">
          The ReelOS appliance is now joining your home network. This Setup Hotspot will now disconnect.
        </p>
        <div className="rounded-xl border border-gold/30 bg-gold/10 p-4 mt-4 w-full max-w-sm">
          <p className="text-sm font-medium text-gold mb-1">Next Steps:</p>
          <p className="text-xs text-gold/80">1. Reconnect this phone to your Home Wi-Fi</p>
          <p className="text-xs text-gold/80">2. Navigate to <strong className="font-mono text-gold">http://reelos.local</strong> in your browser to continue the wizard.</p>
        </div>
        <Button
          onClick={onConnected}
          className="w-full max-w-sm mt-4 rounded-xl bg-gold text-background font-semibold hover:bg-gold-bright transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)]"
        >
          Continue to Setup <ChevronRight className="ml-1.5 size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-250 w-full max-w-md mx-auto">
      <div className="space-y-2 text-center sm:text-left">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
          <Wifi className="size-3.5" /> Appliance Setup Hotspot
        </span>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          Connect to Wi-Fi
        </h2>
        <p className="text-sm text-muted">
          Your appliance needs an internet connection to verify services and download meta-assets.
        </p>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card/80 p-5 backdrop-blur-md space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted">
            <LoaderCircle className="size-6 animate-spin mb-3" />
            <p className="text-xs font-medium">Scanning for networks...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted font-mono">Available Networks</label>
              <button onClick={scan} className="text-xs flex items-center text-blue-400 hover:text-blue-300 transition-colors">
                <RefreshCw className="size-3 mr-1" /> Rescan
              </button>
            </div>
            
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
              {networks.length === 0 ? (
                <p className="text-xs text-muted py-2 text-center">No networks found.</p>
              ) : (
                networks.map((net, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedSsid(net.ssid)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedSsid === net.ssid 
                        ? "border-blue-500 bg-blue-500/15 shadow-[0_0_10px_rgba(59,130,246,0.15)]" 
                        : "border-border/50 bg-card-2 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Wifi className={`size-4 ${selectedSsid === net.ssid ? "text-blue-400" : "text-muted"}`} />
                      <span className="text-sm font-medium text-foreground">{net.ssid}</span>
                    </div>
                    {net.security && net.security !== "none" && <Lock className="size-3.5 text-muted/60" />}
                  </div>
                ))
              )}
            </div>
            
            {selectedSsid && (
              <form onSubmit={handleConnect} className="pt-3 animate-in slide-in-from-top-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted">Password for {selectedSsid}</label>
                  <input
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-background px-4 py-3 text-sm text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    placeholder="Enter Wi-Fi Password"
                  />
                </div>
                
                {error && (
                  <div className="mt-3 flex items-start gap-1.5 text-danger text-xs font-medium">
                    <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                )}
                
                <Button
                  type="submit"
                  disabled={connecting}
                  className="w-full h-11 mt-4 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:opacity-50"
                >
                  {connecting ? (
                    <LoaderCircle className="size-4 animate-spin mr-2" />
                  ) : null}
                  {connecting ? "Connecting..." : "Connect Appliance"}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
