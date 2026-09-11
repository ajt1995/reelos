import { cn } from "@/lib/utils";
import { inFlightRequests } from "@/lib/sync-requests";
import { useReelStore } from "@/lib/store";

/** Circuit lanes + one packet while splash/search/grab/Check is working. */
export function CircuitFloor({ className }: { className?: string }) {
  const busy = useArenaBusy();
  return (
    <svg
      className={cn("arena-circuit pointer-events-none absolute inset-0 h-full w-full text-circuit", className)}
      viewBox="0 0 390 844"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.15" opacity="0.55">
        <path d="M12 72h48l18 18h40" />
        <path d="M12 110h28l12 12" />
        <path d="M378 72h-52l-16 16h-36" />
        <path d="M378 118h-24l-10 10" />
        <path d="M12 760h40l16-16h36" />
        <path d="M378 760h-44l-14-14h-28" />
        <path d="M28 200v80l12 12v90" />
        <path d="M362 210v70l-10 10v100" />
      </g>
      <g fill="currentColor" opacity="0.8">
        <circle cx="12" cy="72" r="2.2" />
        <circle cx="78" cy="90" r="2.2" />
        <circle cx="378" cy="72" r="2.2" />
        <circle cx="310" cy="88" r="2.2" />
        <circle cx="12" cy="760" r="2.2" />
        <circle cx="104" cy="744" r="2.2" />
        <circle cx="378" cy="760" r="2.2" />
      </g>
      {busy ? (
        <circle r="2.6" fill="currentColor" className="arena-packet">
          <animateMotion dur="3.6s" repeatCount="indefinite" path="M12 72h48l18 18h40" />
        </circle>
      ) : null}
    </svg>
  );
}

export function useArenaBusy() {
  const phase = useReelStore((s) => s.phase);
  const boot = useReelStore((s) => s.bootSteps);
  const update = useReelStore((s) => s.update);
  const requests = useReelStore((s) => s.requests);
  const shelf = useReelStore((s) => s.shelf);
  if (update.status === "checking") return true;
  if (phase === "splash" || phase === "wizard") {
    return Object.values(boot).some((st) => st === "running");
  }
  const inflight = inFlightRequests(requests, { titles: shelf });
  return inflight.some(
    (r) => r.status === "downloading" || /search/i.test(String(r.reason || "")),
  );
}
