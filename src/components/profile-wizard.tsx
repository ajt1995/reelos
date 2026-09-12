import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  AGE_BANDS,
  MEMBER_WIZARD_QUESTIONS,
  MEMBER_WIZARD_TOTAL,
  type AgeBandId,
} from "@/lib/household-profile";
import { useReelStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ProfileWizard({ onDone, onBack }: { onDone?: () => void; onBack?: () => void }) {
  const [step, setStep] = useState(1);
  const [band, setBand] = useState<AgeBandId | null>(null);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const hydrateProfiles = useReelStore((s) => s.hydrateProfiles);
  const q = MEMBER_WIZARD_QUESTIONS[step - 1];
  const can =
    step === 1
      ? Boolean(band)
      : username.trim().length >= 2 && pin.length >= 4;

  const finish = async () => {
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/profiles/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ageBand: band,
          ageYears: AGE_BANDS.find((b) => b.id === band)?.minAge,
          jellyfinUser: username.trim(),
          jellyfinPassword: pin,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string; session?: { id: string } };
      if (!j.ok) {
        setErr(j.error || "Could not create that profile");
        setBusy(false);
        return;
      }
      await hydrateProfiles();
      onDone?.();
    } catch (e) {
      setErr(String(e));
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-[-8rem] size-[28rem] rounded-full bg-gold/10 blur-[90px]"
      />
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <Wordmark markClassName="size-7" />
        <p className="font-display text-sm tracking-[0.22em] text-muted tabular-nums">
          {String(step).padStart(2, "0")} / {String(MEMBER_WIZARD_TOTAL).padStart(2, "0")}
        </p>
      </header>
      <div className="mx-auto w-full max-w-3xl px-6 pb-36 pt-4 md:px-8">
        <div className="mb-8 rise">
          <p className="mb-2 font-display text-xs tracking-[0.22em] text-gold uppercase">Your profile</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {q.title}
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">{q.sub}</p>
        </div>
        {step === 1 ? (
          <div className="grid gap-3">
            {AGE_BANDS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBand(b.id)}
                className={cn(
                  "relative w-full rounded-2xl p-5 text-left transition-[box-shadow,background-color] duration-150",
                  band === b.id
                    ? "bg-gold/8 shadow-[var(--shadow-gold)]"
                    : "bg-card shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
                )}
              >
                {band === b.id ? (
                  <span className="absolute right-4 top-4 flex size-6 items-center justify-center rounded-full bg-gold text-gold-fg">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                ) : null}
                <p className="font-display text-lg font-medium pr-8">{b.label}</p>
                <p className="mt-1 text-sm text-muted">
                  {b.parentalMax == null ? "No parental cap on this account." : `Jellyfin parental max ${b.parentalMax}.`}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            <label className="block">
              <span className="text-sm text-muted">Jellyfin username</span>
              <input
                className="mt-2 h-12 w-full rounded-xl bg-card px-4 shadow-[var(--shadow-border)] placeholder:text-faint"
                placeholder="Same login as the TV app"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm text-muted">Password or PIN</span>
              <input
                type="password"
                className="mt-2 h-12 w-full rounded-xl bg-card px-4 shadow-[var(--shadow-border)] placeholder:text-faint"
                placeholder="At least 4 characters"
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </label>
            <p className="text-sm text-faint">Existing Jellyfin users sign in. New names are created on this box.</p>
          </div>
        )}
        {err ? <p className="mt-4 text-sm text-danger">{err}</p> : null}
      </div>
      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/85 px-6 py-4 backdrop-blur-md md:px-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => {
              if (step === 1) onBack?.();
              else setStep(1);
            }}
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>
          <Button
            disabled={!can || busy}
            onClick={() => {
              if (step < MEMBER_WIZARD_TOTAL) setStep(2);
              else void finish();
            }}
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {step === MEMBER_WIZARD_TOTAL ? "Finish" : "Continue"}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
