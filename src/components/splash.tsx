import { Wordmark } from "@/components/logo";
import { CircuitFloor } from "@/components/circuit-floor";
import { Button } from "@/components/ui/button";
import { useReelStore, type BootStepId, type BootStepStatus } from "@/lib/store";
import { cn } from "@/lib/utils";

const STEPS: { id: BootStepId; label: string }[] = [
  { id: "local", label: "Local state" },
  { id: "house", label: "This house" },
  { id: "library", label: "Library" },
  { id: "requests", label: "Requests" },
];

function stepLabel(status: BootStepStatus) {
  if (status === "ok") return "Ready";
  if (status === "fail") return "Still filling";
  if (status === "running") return "Working";
  return "Waiting";
}

export function Splash({ compact = false, warming = false }: { compact?: boolean; warming?: boolean }) {
  const provisioned = useReelStore((s) => s.provisioned);
  const bootSteps = useReelStore((s) => s.bootSteps);
  const showWarming = warming || provisioned;
  const working = Object.values(bootSteps).some((st) => st === "running");
  const begin = () => {
    useReelStore.getState().setPhase("wizard");
    useReelStore.getState().setWizardStep(1);
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
      <CircuitFloor className="opacity-90" />
      <div className="rise relative z-10">
        <Wordmark className="flex-col gap-5" markClassName="size-20" spinRing={showWarming && working} />
      </div>
      <p className="rise rise-2 relative z-10 mt-6 font-display text-sm tracking-[0.34em] text-circuit uppercase">
        Install. Point. Stream.
      </p>
      {showWarming ? (
        <ol
          className="rise rise-3 relative z-10 mx-auto mt-8 w-full max-w-xs space-y-2.5 text-left"
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
                      status === "ok" && "bg-circuit",
                      status === "fail" && "bg-muted",
                      status === "running" && "bg-circuit arena-pip-work",
                      status === "pending" && "bg-faint/50",
                    )}
                  />
                  {step.label}
                </span>
                <span className="text-xs text-muted">{stepLabel(status)}</span>
              </li>
            );
          })}
        </ol>
      ) : compact ? null : (
        <>
          <p className="rise rise-3 relative z-10 mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted">
            This machine is advertising as <span className="text-foreground">reelos.local</span>.
            Seven questions. Then a working media house.
          </p>
          <div className="rise rise-4 relative z-10 mt-8 flex flex-col items-center gap-3">
            <Button size="lg" variant="gold" onClick={begin}>
              Begin
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
