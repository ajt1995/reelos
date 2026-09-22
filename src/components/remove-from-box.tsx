import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useReelStore } from "@/lib/store";
import { showToast } from "@/lib/toast";
import type { Title } from "@/lib/types";
import { cn } from "@/lib/utils";

function idsFromTitle(title: Title): string[] {
  const extra = [...(title.ids || [])];
  if (title.jellyfinId) extra.push(title.jellyfinId, `jf-${title.jellyfinId}`);
  return extra;
}

function mediaFields(title: Title) {
  const id = String(title.id || "");
  const tv =
    title.kind === "tv" || title.kind === "anime" || id.startsWith("tmdb-tv-") || id.startsWith("tvdb-");
  const fromIds = (prefix: string) =>
    (title.ids || [])
      .map((x) => String(x))
      .find((x) => x.startsWith(prefix))
      ?.slice(prefix.length);
  const tmdb = id.startsWith("tmdb-tv-")
    ? id.slice(8)
    : id.startsWith("tmdb-")
      ? id.slice(5)
      : fromIds("tmdb-tv-") || fromIds("tmdb-");
  const tvdb = id.startsWith("tvdb-") ? id.slice(5) : fromIds("tvdb-");
  return {
    mediaType: tv ? "tv" : "movie",
    tmdb,
    tvdb,
  };
}

export function RemoveFromBox({
  title,
  compact = false,
  className,
  onRemoved,
}: {
  title: Title;
  compact?: boolean;
  className?: string;
  onRemoved?: () => void;
}) {
  const [step, setStep] = useState<"idle" | "confirm" | "working">("idle");
  const [err, setErr] = useState<string | null>(null);
  const dropLibraryTitle = useReelStore((s) => s.dropLibraryTitle);

  const run = () => {
    setErr(null);
    setStep("working");
    const media = mediaFields(title);
    const extra = idsFromTitle(title);
    void fetch("/api/library", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleId: title.id,
        jellyfinId: title.jellyfinId,
        ids: extra,
        confirm: true,
        ...media,
      }),
    })
      .then((r) => r.json() as Promise<{ ok?: boolean; error?: string; keys?: string[] }>)
      .then((j) => {
        if (!j.ok) {
          setErr(j.error || "Could not remove that title");
          setStep("confirm");
          return;
        }
        dropLibraryTitle(title.id, [...extra, ...(j.keys || [])]);
        const state = useReelStore.getState();
        state.cancelRequest(title.id);
        state.dismissRequest(title.id);
        for (const k of [...extra, ...(j.keys || [])]) {
          state.cancelRequest(k);
          state.dismissRequest(k);
        }
        state.hydrateShelf({ limit: 24, force: true });
        setStep("idle");
        showToast("Removed from box", "info");
        onRemoved?.();
      })
      .catch((e) => {
        setErr(String(e));
        setStep("confirm");
      });
  };

  if (compact) {
    return (
      <div className={cn("mt-1", className)}>
        {step === "idle" ? (
          <button type="button" className="text-xs text-danger" onClick={() => setStep("confirm")}>
            Remove
          </button>
        ) : null}
        {step === "confirm" ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="text-xs text-danger" onClick={run}>
              Confirm remove?
            </button>
            <button type="button" className="text-xs text-muted" onClick={() => setStep("idle")}>
              Keep
            </button>
          </div>
        ) : null}
        {step === "working" ? <p className="text-xs text-muted">Removing…</p> : null}
        {err ? <p className="mt-1 text-xs text-danger">{err}</p> : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {step === "idle" ? (
        <Button type="button" variant="ghost" size="lg" onClick={() => setStep("confirm")}>
          Remove from this box
        </Button>
      ) : null}
      {step === "confirm" ? (
        <>
          <p className="max-w-sm text-sm text-muted">
            Remove {title.title} from this box? ReelOS will stop tracking it. Your media files stay safe and cloud stream storage is preserved.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="danger" size="lg" onClick={run}>
              Remove
            </Button>
            <Button type="button" variant="ghost" size="lg" onClick={() => setStep("idle")}>
              Keep
            </Button>
          </div>
        </>
      ) : null}
      {step === "working" ? <p className="text-sm text-muted">Removing…</p> : null}
      {err ? <p className="text-sm text-danger">{err}</p> : null}
    </div>
  );
}
