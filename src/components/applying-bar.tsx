import { LoaderCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useReelStore } from "@/lib/store";

export function ApplyingBar() {
  const update = useReelStore((s) => s.update);
  if (update.status !== "applying") return null;
  const log = update.steps.find((s) => s.log)?.log || update.steps[0]?.log || "";
  const name = update.target || "this update";
  return (
    <div className="relative z-20 border-b border-circuit/35 bg-circuit/12 px-3 py-2">
      <p className="flex items-center gap-2 text-sm text-circuit-bright">
        <LoaderCircle className="size-3.5 shrink-0 animate-spin" />
        Applying {name}. Home can open — engines are still configuring.
      </p>
      {log ? <p className="mt-0.5 font-mono text-[11px] text-muted">{log}</p> : null}
      <Link to="/settings" className="mt-1 inline-block text-[12px] text-circuit">
        Updates
      </Link>
    </div>
  );
}
