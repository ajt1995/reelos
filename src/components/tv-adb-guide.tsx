import React, { useState } from "react";
import { X, Tv, Zap, CheckCircle2, ChevronRight, ChevronLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TvAdbGuideProps {
  open: boolean;
  onClose: () => void;
  onScanAgain?: () => void;
}

export function TvAdbGuide({ open, onClose, onScanAgain }: TvAdbGuideProps) {
  const [activeStep, setActiveStep] = useState<number>(1);

  if (!open) return null;

  const STEPS = [
    {
      step: 1,
      title: "Open TV About Settings",
      instruction: "Grab your TV remote and navigate to Settings.",
      details: "Select 'System' or 'Device Preferences', then click 'About'.",
      tip: "On Google TV / Chromecast, click your profile icon in top right → Settings → System → About.",
    },
    {
      step: 2,
      title: "Click 'Build' 7 Times",
      instruction: "Scroll all the way down to 'Android TV OS build' (or 'Build number').",
      details: "Press the center OK button on your remote 7 times in a row.",
      tip: "You'll see a countdown popup: 'You are now a developer!'",
    },
    {
      step: 3,
      title: "Enable Network Debugging",
      instruction: "Press Back once and click the new 'Developer Options' menu.",
      details: "Scroll down and toggle ON 'USB debugging' and 'Network / Wireless debugging'.",
      tip: "If prompted with 'Allow network debugging?', select 'Always allow from this network'.",
    },
    {
      step: 4,
      title: "1-Click Beam to TV",
      instruction: "You're all set! ReelOS can now communicate with your TV over Wi-Fi.",
      details: "Click 'Scan Again' below to automatically detect your TV and install the ReelOS 10-Foot Cinema app.",
      tip: "Zero cables or USB drives needed. Everything beams directly over your home Wi-Fi.",
    },
  ];

  const current = STEPS[activeStep - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl border border-gold/40 bg-card p-6 shadow-2xl space-y-5 text-left relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gold/20 text-gold">
              <Tv className="size-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-foreground">
                How to Enable 1-Click TV Install
              </h3>
              <p className="text-[11px] text-muted">
                Quick 30-second setup on your Android TV or Chromecast remote
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted hover:text-foreground rounded-full hover:bg-card-2 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Step indicator pills */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((s) => (
            <button
              key={s.step}
              type="button"
              onClick={() => setActiveStep(s.step)}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-200",
                s.step === activeStep
                  ? "bg-gold shadow-sm shadow-gold/30"
                  : s.step < activeStep
                  ? "bg-gold/40"
                  : "bg-card-2 border border-border/60"
              )}
            />
          ))}
        </div>

        {/* Card Body */}
        <div className="rounded-2xl border border-border/80 bg-card-2/60 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-gold/20 text-gold px-2.5 py-0.5 text-xs font-mono font-bold">
              STEP {current.step} OF 4
            </span>
            <span className="text-xs text-muted font-medium">Remote Guide</span>
          </div>

          <h4 className="font-display text-lg font-bold text-foreground">
            {current.title}
          </h4>
          <p className="text-sm text-foreground/90 font-medium">
            {current.instruction}
          </p>
          <p className="text-xs text-muted leading-relaxed">
            {current.details}
          </p>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-start gap-2">
            <Zap className="size-4 shrink-0 mt-0.5 text-amber-400" />
            <span>{current.tip}</span>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-1 gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={activeStep === 1}
            onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
            className="h-10 text-xs text-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4 mr-1" /> Back
          </Button>

          {activeStep < 4 ? (
            <Button
              type="button"
              variant="gold"
              onClick={() => setActiveStep((prev) => Math.min(4, prev + 1))}
              className="h-10 px-5 text-xs font-semibold"
            >
              Next Step <ChevronRight className="size-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="gold"
              onClick={() => {
                if (onScanAgain) onScanAgain();
                onClose();
              }}
              className="h-10 px-5 text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className="size-3.5" /> Scan for TV Now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
