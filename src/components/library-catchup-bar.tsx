import { LoaderCircle } from "lucide-react";
import { useReelStore } from "@/lib/store";

export function LibraryCatchupBar() {
  const catchup = useReelStore((s) => s.libraryCatchup);
  const applying = useReelStore((s) => s.update.status === "applying");
  if (applying) return null;
  if (!catchup || (catchup.status !== "running" && catchup.status !== "backoff")) return null;
  const text =
    catchup.message ||
    (catchup.status === "backoff"
      ? "Library catching up — backing off (ffprobe busy)"
      : "Library catching up");
  return (
    <div className="relative z-20 border-b border-border bg-raised px-3 py-2">
      <p className="flex items-center gap-2 text-sm text-foreground">
        <LoaderCircle className="size-3.5 shrink-0 animate-spin" />
        {text}
      </p>
      {catchup.folder && catchup.total ? (
        <p className="mt-0.5 font-mono text-[11px] text-muted">
          folder {catchup.folder} of {catchup.total}
          {catchup.skipped ? ` · ${catchup.skipped} skipped` : ""}
          {catchup.timeouts ? ` · ${catchup.timeouts} timeouts` : ""}
        </p>
      ) : null}
    </div>
  );
}
