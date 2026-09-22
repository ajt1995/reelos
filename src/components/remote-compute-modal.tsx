import React from "react";
import { Server, Power, Shield, Cpu, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RemoteComputeModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function RemoteComputeModal({ open, onClose, onConfirm, loading = false }: RemoteComputeModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-gold/40 bg-card p-6 md:p-8 shadow-2xl shadow-gold/10 text-foreground">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute right-5 top-5 rounded-full p-2 text-muted hover:text-foreground transition-colors"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-gold/15 text-gold border border-gold/30">
            <Server className="size-6" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Use as Remote Computer</h2>
            <p className="text-xs text-muted">Dedicated Household Compute & Streaming Appliance</p>
          </div>
        </div>

        <div className="space-y-3.5 my-6 text-sm leading-relaxed text-muted">
          <div className="rounded-2xl border border-border/80 bg-card/60 p-4 space-y-2">
            <div className="flex items-center gap-2 text-foreground font-semibold text-xs uppercase tracking-wider">
              <Power className="size-4 text-gold" />
              <span>Display & Power Conservation</span>
            </div>
            <p className="text-xs">
              This screen will blank and turn off to conserve energy and eliminate living room glare. All GPU rendering on this display will pause.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/60 p-4 space-y-2">
            <div className="flex items-center gap-2 text-foreground font-semibold text-xs uppercase tracking-wider">
              <Cpu className="size-4 text-emerald-400" />
              <span>Household resource sharing</span>
            </div>
            <p className="text-xs">
              ReelOS may use measured spare capacity for approved household work. Playback and activity on this machine keep priority, and other devices must already be paired.
            </p>
          </div>

          <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-gold font-bold text-xs uppercase tracking-wider">
              <Shield className="size-4" />
              <span>Physical Escape Hatch</span>
            </div>
            <p className="text-xs text-foreground font-medium">
              Press the <strong className="text-gold font-mono px-1.5 py-0.5 rounded bg-gold/20">Spacebar 5 times</strong> on this machine's keyboard at any time to instantly awaken the display and return to the cinema screen.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl px-5 text-sm text-muted hover:text-foreground"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-xl bg-gold hover:bg-gold-light text-black font-semibold px-6 text-sm shadow-md flex items-center gap-2"
          >
            {loading ? <RefreshCw className="size-4 animate-spin" /> : <Server className="size-4" />}
            <span>Enter Remote Computer Mode</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
