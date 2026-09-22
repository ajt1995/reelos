import { useEffect, useRef, useState } from "react";
import { Check, Copy, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QrCodeSvg } from "@/components/ui/qr-code-svg";
import { useReelStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function GuestQrPopover({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const houseName = useReelStore((s) => s.houseName);
  const ipv4 = useReelStore((s) => s.ipv4);

  const rawHostname =
    typeof window !== "undefined"
      ? window.location.hostname
      : "reelos.local";
  const isLocalOrMdns =
    rawHostname === "localhost" ||
    rawHostname === "127.0.0.1" ||
    rawHostname.endsWith(".local");
  const hostname = isLocalOrMdns && ipv4 ? ipv4 : (rawHostname || ipv4 || "reelos.local");
  const port =
    typeof window !== "undefined" && window.location.port
      ? ":" + window.location.port
      : ":8080";
  const lanUrl = "http://" + hostname + port;

  useEffect(() => {
    if (!ipv4) {
      void fetch("/api/box", { cache: "no-store" })
        .then((r) => r.json())
        .then((b) => {
          if (b?.ipv4) useReelStore.setState({ ipv4: String(b.ipv4) });
        })
        .catch(() => {});
    }
  }, [ipv4]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const copyUrl = () => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(lanUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded-xl border font-semibold transition-all",
          compact
            ? "size-8 justify-center rounded-lg border-border bg-card text-muted hover:text-gold"
            : "h-9 border-border bg-card/60 px-3 text-xs text-muted hover:border-gold/40 hover:text-gold",
          open && "border-gold/40 bg-gold/15 text-gold",
        )}
        title="Guest Join QR Code"
        aria-expanded={open}
      >
        <QrCode className={cn(compact ? "size-4" : "size-3.5", "text-gold")} />
        {!compact && <span>Join</span>}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 sm:hidden bg-black/40 backdrop-blur-xs"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-4 top-16 z-50 mx-auto max-w-sm sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 origin-top-right animate-in fade-in zoom-in-95 rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-border pb-2.5">
            <span className="flex size-6 items-center justify-center rounded-lg bg-gold/15 text-gold">
              <QrCode className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xs font-bold text-foreground truncate">
                {houseName || "ReelOS"}
              </p>
              <p className="text-[10px] text-muted">Guest & Phone Join</p>
            </div>
          </div>

          <div className="my-3 flex flex-col items-center">
            <div className="rounded-xl bg-white p-2.5 shadow-md">
              <QrCodeSvg value={lanUrl} size={150} />
            </div>
            <p className="mt-2 text-center text-[11px] text-muted leading-relaxed">
              Scan with your phone camera to connect directly on the local network.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-raised border border-border p-2 text-xs">
            <span className="font-mono text-[11px] text-gold truncate max-w-[160px]">
              {lanUrl}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={copyUrl}
              className="h-7 rounded-lg px-2 text-[10px] text-foreground hover:text-gold"
            >
              {copied ? (
                <Check className="size-3 text-success mr-1" />
              ) : (
                <Copy className="size-3 mr-1" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      </>
    )}
    </div>
  );
}
