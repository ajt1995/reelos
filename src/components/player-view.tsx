import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pause, Play } from "lucide-react";
import { getTitle } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import { formatRuntime } from "@/lib/utils";

export function PlayerView({ id }: { id: string }) {
  const title = getTitle(id);
  const navigate = useNavigate();
  const frontend = useReelStore((s) => s.answers.frontend);
  const inLibrary = useReelStore((s) => s.library.includes(id));
  const available = useReelStore((s) =>
    s.requests.some((r) => r.titleId === id && r.status === "available"),
  );
  const stored = useReelStore((s) => s.watchProgress[id] ?? 0);
  const setWatch = useReelStore((s) => s.setWatchProgress);
  const [choice, setChoice] = useState<"jellyfin" | "plex" | null>(
    frontend === "both" ? null : frontend === "plex" ? "plex" : "jellyfin",
  );
  const [playing, setPlaying] = useState(true);
  const pos = useRef(stored);
  const [ui, setUi] = useState(stored);

  useEffect(() => {
    if (!playing || !choice) return;
    const t = window.setInterval(() => {
      pos.current = Math.min(0.995, pos.current + 0.0022);
      setUi(pos.current);
      setWatch(id, pos.current);
    }, 400);
    return () => window.clearInterval(t);
  }, [playing, choice, id, setWatch]);

  if (!title) return null;
  if (!inLibrary && !available) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
        <p className="text-muted">Play is enabled only when the title is in the library.</p>
        <Link to="/title/$id" params={{ id }} className="mt-4 text-gold">
          Back to title
        </Link>
      </div>
    );
  }

  if (!choice) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
        <p className="font-display text-xl">Watch in</p>
        <div className="mt-6 grid w-full max-w-sm gap-3">
          <button
            type="button"
            onClick={() => setChoice("jellyfin")}
            className="h-14 rounded-2xl bg-gold text-gold-fg"
          >
            Jellyfin
          </button>
          <button
            type="button"
            onClick={() => setChoice("plex")}
            className="h-14 rounded-2xl bg-card shadow-[var(--shadow-border)]"
          >
            Plex
          </button>
        </div>
      </div>
    );
  }

  const runtime = (title.runtime ?? 100) * 60;
  const seconds = Math.floor(ui * runtime);
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-black">
      <img
        src={title.poster}
        alt=""
        className="absolute inset-0 size-full object-cover opacity-50 kenburns"
      />
      <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-black/30" />
      <button
        type="button"
        onClick={() => void navigate({ to: "/title/$id", params: { id } })}
        className="absolute left-4 top-4 z-10 flex size-11 items-center justify-center rounded-full bg-black/40 text-foreground"
        aria-label="Back"
      >
        <ArrowLeft className="size-5" />
      </button>
      <p className="absolute right-4 top-5 z-10 text-xs tracking-[0.18em] text-gold uppercase">
        {choice === "plex" ? "Plex" : "Jellyfin"}
      </p>
      <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-10">
        <p className="font-display text-2xl">{title.title}</p>
        <p className="mt-1 text-sm text-muted">{formatRuntime(title.runtime)}</p>
        <div className="mt-5 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="flex size-12 items-center justify-center rounded-full bg-gold text-gold-fg"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <Pause className="size-5" fill="currentColor" />
            ) : (
              <Play className="size-5" fill="currentColor" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="h-1 overflow-hidden rounded-full bg-white/15">
              <div className="h-full bg-gold" style={{ width: `${ui * 100}%` }} />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[11px] text-muted tabular-nums">
              <span>{fmt(seconds)}</span>
              <span>{fmt(runtime)}</span>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-faint">
          Watching happens in official apps. This is the on-box preview.
        </p>
      </div>
    </div>
  );
}
