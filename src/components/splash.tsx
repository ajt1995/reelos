import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useReelStore } from "@/lib/store";

export function Splash({ compact = false }: { compact?: boolean }) {
  const begin = () => {
    useReelStore.getState().setPhase("wizard");
    useReelStore.getState().setWizardStep(1);
  };

  return (
    <div className="tron-grid relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[28%] size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan/15 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[12%] left-[20%] size-[18rem] rounded-full bg-magenta/10 blur-[90px]"
      />
      <div className="rise relative">
        <Wordmark className="flex-col gap-5" markClassName="size-20" />
      </div>
      <p className="rise rise-2 mt-8 font-display text-sm tracking-[0.34em] text-cyan uppercase">
        Install. Point. Stream.
      </p>
      {compact ? null : (
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
