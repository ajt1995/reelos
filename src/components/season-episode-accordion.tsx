import { useEffect, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EPISODE_STATUS_LABEL,
  IMPORTING_SEASON_COPY,
  UNRELEASED_SEASON_COPY,
  episodeRequestAction,
  seasonChipLabel,
  type EpisodeStatus,
  type SeasonEpisodeRow,
} from "@/lib/episode-status";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<EpisodeStatus, string> = {
  "in-library": "bg-success/15 text-success",
  importing: "bg-gold/15 text-gold",
  downloading: "bg-gold/15 text-gold",
  requested: "bg-card-2 text-muted",
  missing: "bg-danger/10 text-danger",
};

export function SeasonEpisodeAccordion({
  seasonNumbers,
  selectedSeason,
  onSelectSeason,
  diskSeasons,
  importingSeasons,
  unreleasedSeasons,
  titleId,
  seasonsLoading,
  seasonErr,
  onRetrySeasons,
  blocked,
  removedHere,
  onRequestSeason,
  onRequestEpisode,
}: {
  seasonNumbers: number[];
  selectedSeason: number;
  onSelectSeason: (n: number) => void;
  diskSeasons: number[];
  importingSeasons?: number[];
  unreleasedSeasons?: number[];
  titleId: string;
  seasonsLoading?: boolean;
  seasonErr?: string | null;
  onRetrySeasons?: () => void;
  blocked?: boolean;
  removedHere?: boolean;
  onRequestSeason: (season: number) => void;
  onRequestEpisode: (season: number, episode: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [episodes, setEpisodes] = useState<SeasonEpisodeRow[]>([]);
  const [unreleasedOpen, setUnreleasedOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let stop = false;
    const ac = new AbortController();
    setLoading(true);
    setErr(null);
    setUnreleasedOpen(false);
    const q = new URLSearchParams({ id: titleId, season: String(selectedSeason) });
    void fetch(`/api/episodes?${q}`, { cache: "no-store", signal: ac.signal })
      .then((r) => r.json() as Promise<{ episodes?: SeasonEpisodeRow[]; error?: string; unreleased?: boolean }>)
      .then((j) => {
        if (stop) return;
        setUnreleasedOpen(Boolean(j.unreleased));
        setEpisodes(Array.isArray(j.episodes) ? j.episodes : []);
        setErr(j.error || null);
        setLoading(false);
      })
      .catch((e) => {
        if (stop) return;
        setErr(String(e?.message || e));
        setLoading(false);
      });
    return () => {
      stop = true;
      ac.abort();
    };
  }, [open, titleId, selectedSeason]);

  useEffect(() => {
    if (!open || loading) return;
    const node = document.getElementById(`season-${selectedSeason}-episodes`);
    if (!node) return;
    const id = window.requestAnimationFrame(() => {
      node.scrollIntoView({ block: "end", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, selectedSeason, loading, episodes.length]);

  const tapSeason = (n: number) => {
    if (n === selectedSeason && open) {
      setOpen(false);
      return;
    }
    onSelectSeason(n);
    setOpen(true);
  };

  const missing = episodes.filter((e) => e.status === "missing" || (removedHere && e.status === "requested"));
  const thisUnreleased = Boolean(unreleasedSeasons?.includes(selectedSeason) || unreleasedOpen);
  const thisImporting =
    Boolean(importingSeasons?.includes(selectedSeason)) && !diskSeasons.includes(selectedSeason) && !thisUnreleased;
  const showSeasonRequest =
    !blocked &&
    !thisUnreleased &&
    !thisImporting &&
    (removedHere || missing.length > 0 || (open && !loading && episodes.length === 0));

  if (seasonNumbers.length === 0 && seasonsLoading) {
    return <p className="text-sm text-muted">Loading seasons from Seerr…</p>;
  }
  if (seasonNumbers.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-danger">{seasonErr || "Could not load seasons from Seerr."}</p>
        {onRetrySeasons ? (
          <Button variant="ghost" size="lg" onClick={onRetrySeasons}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="title-season-accordion relative z-20 w-full min-w-0">
      <div className="flex flex-wrap gap-2">
        {seasonNumbers.map((n) => {
          const selected = selectedSeason === n;
          const expanded = selected && open;
          const onDisk = diskSeasons.includes(n) && !removedHere;
          const importing = Boolean(importingSeasons?.includes(n)) && !onDisk;
          const unreleased = Boolean(unreleasedSeasons?.includes(n));
          const chip = seasonChipLabel({ onDisk, importing, unreleased, removedHere });
          return (
            <button
              key={n}
              type="button"
              aria-expanded={expanded}
              aria-controls={`season-${n}-episodes`}
              onClick={() => tapSeason(n)}
              className={cn(
                "inline-flex h-11 min-h-11 items-center gap-1 rounded-full px-3 text-sm",
                selected ? "bg-gold text-gold-fg" : "bg-card text-muted shadow-[var(--shadow-border)]",
              )}
            >
              Season {n}
              {` · ${chip}`}
              <ChevronDown className={cn("size-3.5 opacity-80 transition-transform", expanded ? "rotate-180" : "")} />
            </button>
          );
        })}
      </div>
      {open ? (
        <div
          id={`season-${selectedSeason}-episodes`}
          className="relative z-20 mt-3 min-w-0 scroll-mt-4 scroll-mb-24 rounded-2xl bg-card px-3 py-2 shadow-[var(--shadow-border)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <p className="text-sm text-muted">
              S{String(selectedSeason).padStart(2, "0")} episodes
              {episodes.length ? ` · ${episodes.length}` : ""}
            </p>
            {showSeasonRequest ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending === "season"}
                onClick={() => {
                  setPending("season");
                  onRequestSeason(selectedSeason);
                }}
              >
                <Plus className="size-4" />
                Request this season
              </Button>
            ) : null}
          </div>
          {loading ? <p className="py-3 text-sm text-muted">Loading episodes from Sonarr…</p> : null}
          {err && !episodes.length ? <p className="py-2 text-sm text-danger">{err}</p> : null}
          {!loading && thisUnreleased ? (
            <p className="py-3 text-sm text-muted">
              {UNRELEASED_SEASON_COPY}. Request cannot grab files that do not exist.
            </p>
          ) : null}
          {!loading && thisImporting ? (
            <p className="py-3 text-sm text-muted">{IMPORTING_SEASON_COPY} — Sonarr has not taken the files yet.</p>
          ) : null}
          {!loading && !episodes.length && !err && !thisUnreleased && !thisImporting ? (
            <p className="py-3 text-sm text-muted">
              Episode names land once Sonarr or Seerr has this season. Request this season without hunting.
            </p>
          ) : null}
          <ul className="divide-y divide-border">
            {episodes.map((ep) => {
              const action = episodeRequestAction(ep.status, Boolean(removedHere));
              const key = `e${ep.episodeNumber}`;
              return (
                <li key={ep.episodeNumber} className="flex min-h-11 items-center gap-2 py-2.5">
                  <span className="w-9 shrink-0 text-xs text-faint">
                    E{String(ep.episodeNumber).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{ep.title}</span>
                  <span
                    data-episode-status={ep.status}
                    className={cn("shrink-0 rounded-full px-2 py-1 text-[11px] leading-none", STATUS_CLASS[ep.status])}
                  >
                    {ep.label || EPISODE_STATUS_LABEL[ep.status]}
                  </span>
                  {action && !blocked ? (
                    <button
                      type="button"
                      className="shrink-0 text-xs text-gold"
                      disabled={pending === key}
                      onClick={() => {
                        setPending(key);
                        onRequestEpisode(selectedSeason, ep.episodeNumber);
                        setEpisodes((cur) =>
                          cur.map((row) =>
                            row.episodeNumber === ep.episodeNumber
                              ? { ...row, status: "requested", label: EPISODE_STATUS_LABEL.requested }
                              : row,
                          ),
                        );
                      }}
                    >
                      {action === "Request again" ? "Request again" : "Request"}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
