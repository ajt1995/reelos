import { useState } from "react";
import { Check, Copy, Share2, Tv, Users, X, Sparkles, Film } from "lucide-react";
import { QrCodeSvg } from "@/components/ui/qr-code-svg";
import { useReelStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface WatchWithFriendModalProps {
  open: boolean;
  onClose: () => void;
  titleId: string;
  titleName: string;
  posterUrl?: string;
  year?: string | number;
}

export function WatchWithFriendModal({
  open,
  onClose,
  titleId,
  titleName,
  posterUrl,
  year,
}: WatchWithFriendModalProps) {
  const ipv4 = useReelStore((s) => s.ipv4);
  const tailscaleIp = useReelStore((s) => s.tailscaleIp);
  const houseName = useReelStore((s) => s.houseName);

  const [copied, setCopied] = useState(false);
  const [roomCode] = useState(() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  });

  if (!open) return null;

  const hostIp = tailscaleIp || ipv4 || (typeof window !== "undefined" ? window.location.hostname : "127.0.0.1");
  const port = typeof window !== "undefined" && window.location.port ? `:${window.location.port}` : ":8080";
  const shareUrl = `http://${hostIp}${port}/watch?titleId=${encodeURIComponent(titleId)}&room=${roomCode}&friend=1`;

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl border border-gold/40 bg-raised p-6 shadow-2xl space-y-5">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-card hover:bg-card-2 text-muted hover:text-foreground transition-all"
        >
          <X className="size-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-gold/15 text-gold border border-gold/30">
            <Users className="size-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold text-foreground">
              Watch with a Friend
            </h3>
            <p className="text-xs text-muted">
              Zero-friction instant synchronized watch room
            </p>
          </div>
        </div>

        {/* Selected Movie / Show Card */}
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3">
          {posterUrl ? (
            <img src={posterUrl} alt="" className="h-14 w-10 rounded-lg object-cover shadow-sm" />
          ) : (
            <div className="flex h-14 w-10 items-center justify-center rounded-lg bg-card-2 text-muted">
              <Film className="size-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold text-foreground">{titleName}</p>
            <p className="text-[11px] text-muted">{year ? `${year} · ` : ""}Room: {roomCode}</p>
            <span className="inline-flex items-center gap-1 rounded-md bg-gold/15 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-gold mt-1">
              <Sparkles className="size-2.5" /> No Account Required
            </span>
          </div>
        </div>

        {/* QR Code and Share Link */}
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card/60 p-4 text-center">
          <div className="rounded-xl bg-white p-2.5 shadow-md">
            <QrCodeSvg value={shareUrl} size={130} />
          </div>
          <p className="text-xs text-muted max-w-xs">
            Have your friend scan this QR code with their phone, or copy the link below.
          </p>
        </div>

        {/* Copy Link Input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="h-10 flex-1 truncate rounded-xl bg-card px-3 font-mono text-xs text-muted shadow-inner border border-border"
          />
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "flex h-10 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold transition-all shadow-sm shrink-0",
              copied
                ? "bg-success text-success-fg"
                : "bg-gold text-gold-fg hover:brightness-110"
            )}
          >
            {copied ? (
              <>
                <Check className="size-3.5 stroke-[3]" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                Copy Link
              </>
            )}
          </button>
        </div>

        <p className="text-[11px] text-faint text-center">
          Playback status and pause/play commands stay synchronized in real time.
        </p>
      </div>
    </div>
  );
}
