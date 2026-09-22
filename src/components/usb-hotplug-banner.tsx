import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { HardDrive, Usb, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HotplugDrive {
  device: string;
  name: string;
  sizeGb?: number;
  fsType?: string;
}

export function UsbHotplugBanner() {
  const [drives, setDrives] = useState<HotplugDrive[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const checkHotplug = async () => {
      if (dismissed) return;
      try {
        const res = await fetch("/api/disks/hotplug-detect", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.detected && Array.isArray(data.drives) && data.drives.length > 0) {
            setDrives(data.drives);
          }
        }
      } catch {
        /* no-op */
      }
    };

    void checkHotplug();
    const timer = setInterval(checkHotplug, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [dismissed]);

  const handleDismiss = async () => {
    setDismissed(true);
    setDrives([]);
    try {
      await fetch("/api/disks/hotplug-dismiss", { method: "POST" });
    } catch {
      /* no-op */
    }
  };

  if (dismissed || drives.length === 0) return null;

  const drive = drives[0];

  return (
    <div className="relative z-30 border-b border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-amber-600/15 to-transparent px-4 py-2.5 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300 shrink-0">
            <Usb className="size-4" />
          </div>
          <p className="text-xs text-amber-100 truncate">
            <span className="font-semibold text-white">New Storage Detected:</span>{" "}
            <span className="font-mono text-amber-300">{drive.name || drive.device}</span>{" "}
            {drive.sizeGb ? `(${drive.sizeGb} GB)` : ""} — Expand your library cache or enable Thumb Stick Mode.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link to="/settings">
            <Button
              size="sm"
              variant="gold"
              className="h-7 text-xs px-3 font-semibold gap-1 shadow-sm"
            >
              <span>Configure</span>
              <ArrowRight className="size-3" />
            </Button>
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex size-7 items-center justify-center rounded-lg text-amber-300 hover:bg-white/10 transition-colors"
            title="Dismiss notification"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
