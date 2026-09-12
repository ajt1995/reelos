/** Full-screen apply splash. Copy: Updating ReelOS. Fail splash: Update failed, still on previous.
 * Honest % is tarball/extract bytes — never a fake climbing percent. */
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { catchupLocksHome } from "@/lib/library-catchup";
import { useReelStore, type BootStepId, type BootStepStatus } from "@/lib/store";
import { cn } from "@/lib/utils";

const STEPS: { id: BootStepId; label: string }[] = [
  { id: "local", label: "Local state" },
  { id: "house", label: "This house" },
  { id: "library", label: "Library" },
  { id: "requests", label: "Requests" },
];

type ApplyProgress = {
  message?: string;
  percent?: number | null;
  stalled?: boolean;
  label?: string;
  stageIndex?: number;
  stageCount?: number;
  heartbeatAgo?: string;
};

function stepLabel(status: BootStepStatus) {
  if (status === "ok") return "Ready";
  if (status === "fail") return "Still filling";
  if (status === "running") return "Working";
  return "Waiting";
}

function UpdatingSplash() {
  const [tune, setTune] = useState("");
  const [progress, setProgress] = useState<ApplyProgress | null>(null);
  useEffect(() => {
    void fetch("/api/hardware", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ splashTune?: string; summary?: string }>)
      .then((j) => setTune(j.splashTune || j.summary || ""))
      .catch(() => {});
  }, []);
  useEffect(() => {
    let alive = true;
    const tick = () => {
      void fetch("/api/update/status", { cache: "no-store" })
        .then((r) => r.json() as Promise<{ progress?: ApplyProgress }>)
        .then((j) => {
          if (alive && j.progress) setProgress(j.progress);
        })
        .catch(() => {});
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);
  const pct = typeof progress?.percent === "number" ? progress.percent : null;
  const line = progress?.stalled
    ? "Download stalled — 0 bytes for 2+ minutes"
    : progress?.message || "Download, extract, clean leftover builds, restart the door.";
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[28%] size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/12 blur-[120px]"
      />
      <div className="rise relative">
        <Wordmark className="flex-col gap-5" markClassName="size-20" spinRing />
      </div>
      <p className="rise rise-2 mt-8 font-display text-sm tracking-[0.34em] text-gold-bright uppercase">
        Updating ReelOS…
      </p>
      <p className="rise rise-3 mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted" aria-live="polite">
        {line}
      </p>
      {pct != null ? (
        <div className="rise rise-4 mx-auto mt-4 w-full max-w-xs">
          <p className="font-display text-2xl tabular-nums text-gold-bright">{pct}%</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-faint">
            <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">Tarball / extract bytes — not a timer.</p>
        </div>
      ) : progress?.stageIndex ? (
        <p className="rise rise-4 mx-auto mt-3 max-w-md text-sm text-muted">
          {progress.label || "Working"} · {progress.stageIndex}/{progress.stageCount || 7}
          {progress.heartbeatAgo ? ` · ${progress.heartbeatAgo}` : ""}
        </p>
      ) : null}
      <p className="rise rise-4 mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">
        Browse and request come back when this page lifts.
      </p>
      {tune ? (
        <p className="rise rise-4 mx-auto mt-3 max-w-md text-sm text-gold-bright">{tune}</p>
      ) : null}
    </div>
  );
}

function FailedSplash() {
  const continueOnPrevious = () => {
    const cur = useReelStore.getState().update;
    useReelStore.setState({
      update: { ...cur, status: "current", target: null, notes: [] },
    });
  };
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[28%] size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/12 blur-[120px]"
      />
      <div className="rise relative">
        <Wordmark className="flex-col gap-5" markClassName="size-20" />
      </div>
      <p className="rise rise-2 mt-8 font-display text-sm tracking-[0.34em] text-gold-bright uppercase">
        Update failed, still on previous
      </p>
      <p className="rise rise-3 mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted">
        ReelOS did not stamp this update. This box is still the version that was already running.
        Browse and request still work.
      </p>
      <div className="rise rise-4 mt-8">
        <Button size="lg" onClick={continueOnPrevious}>
          Continue
        </Button>
      </div>
    </div>
  );
}

export function Splash({ compact = false, warming = false, updating = false, failed = false }: { compact?: boolean; warming?: boolean; updating?: boolean; failed?: boolean }) {
  const provisioned = useReelStore((s) => s.provisioned);
  const bootSteps = useReelStore((s) => s.bootSteps);
  const catchup = useReelStore((s) => s.libraryCatchup);
  const showWarming = warming || provisioned;
  const libraryLock = catchupLocksHome(catchup);
  const libraryWorking = libraryLock || bootSteps.library === "running";
  const begin = () => {
    useReelStore.getState().setPhase("wizard");
    useReelStore.getState().setWizardStep(1);
  };

  if (updating) {
    return <UpdatingSplash />;
  }
  if (failed) {
    return <FailedSplash />;
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[28%] size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/12 blur-[120px]"
      />
      <div className="rise relative">
        <Wordmark className="flex-col gap-5" markClassName="size-20" spinRing={showWarming && libraryWorking} />
      </div>
      <p className="rise rise-2 mt-8 font-display text-sm tracking-[0.34em] text-gold-bright uppercase">
        Install. Point. Stream.
      </p>
      {showWarming ? (
        <ol
          className="rise rise-3 mx-auto mt-10 w-full max-w-xs space-y-3 text-left"
          aria-busy="true"
          aria-live="polite"
        >
          {STEPS.map((step) => {
            const status = bootSteps[step.id];
            return (
              <li key={step.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2.5 text-foreground">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      status === "ok" && "bg-success",
                      status === "fail" && "bg-muted",
                      status === "running" && "bg-live animate-pulse",
                      status === "pending" && "bg-faint",
                    )}
                  />
                  {step.label}
                </span>
                <span className="text-xs text-muted">
                  {step.id === "library" && libraryLock
                    ? catchup.message || "Library catching up"
                    : stepLabel(status)}
                </span>
              </li>
            );
          })}
        </ol>
      ) : compact ? null : (
        <>
          <p className="rise rise-3 mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted">
            This machine is advertising as <span className="text-foreground">reelos.local</span>.
            Seven questions. Then a working media house.
          </p>
          <div className="rise rise-4 mt-10 flex flex-col items-center gap-3">
            <Button size="lg" onClick={begin}>
              Begin setup
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
