import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Play, Plus } from "lucide-react";
import { Poster } from "@/components/poster";
import { Button } from "@/components/ui/button";
import { cacheCopy } from "@/lib/adapter";
import { getTitle, kindLabel, rememberCatalogTitles } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import type { Title } from "@/lib/types";
import { formatRuntime } from "@/lib/utils";
import { showRequestQueueControls, requestShowsRetry } from "@/lib/sync-requests";
import { useEngineRequest } from "@/lib/use-engine-request";
import { RemoveFromBox } from "@/components/remove-from-box";

export function TitleView({ id }: { id: string }) {
  const catalog = getTitle(id);
  const remote = useReelStore((s) => s.remoteTitles.find((t) => t.id === id));
  const rememberTitles = useReelStore((s) => s.rememberTitles);
  const title = catalog ?? remote;
  const [detail, setDetail] = useState<Title | null>(null);
  const resolved = detail ?? title;
  const seasonNumbers =
    resolved?.seasonList?.filter((n) => n > 0) ??
    (resolved?.seasons && resolved.seasons > 0
      ? Array.from({ length: resolved.seasons }, (_, i) => i + 1)
      : []);
  const [season, setSeason] = useState(seasonNumbers[0] ?? 1);
  const [hash, setHash] = useState("");
  const [hashErr, setHashErr] = useState(false);
  const [reqErr, setReqErr] = useState<string | null>(null);
  const request = useReelStore((s) =>
    s.requests.find(
      (r) =>
        r.titleId === id &&
        r.status !== "failed" &&
        (r.season == null || r.season === season),
    ),
  );
  const failed = useReelStore((s) =>
    s.requests.find((r) => r.titleId === id && r.status === "failed"),
  );
  const inLibrary = useReelStore((s) => s.library.includes(id));
  const intent = useReelStore((s) => s.answers.intent);
  const source = useReelStore((s) => s.answers.source);
  const requestTitle = useReelStore((s) => s.requestTitle);
  const retryRequest = useReelStore((s) => s.retryRequest);
  const pasteRelease = useReelStore((s) => s.pasteRelease);
  const { inJellyfin, engineStatus } = useEngineRequest(id, season);

  useEffect(() => {
    let stop = false;
    void fetch(`/api/lookup?id=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ titles?: Title[] }>)
      .then((j) => {
        const t = j.titles?.[0];
        if (stop || !t) return;
        rememberCatalogTitles([t]);
        rememberTitles?.([t]);
        setDetail(t);
        const nums =
          t.seasonList?.filter((n) => n > 0) ??
          (t.seasons && t.seasons > 0 ? Array.from({ length: t.seasons }, (_, i) => i + 1) : []);
        if (nums.length) setSeason((cur) => (nums.includes(cur) ? cur : (nums[0] ?? 1)));
      })
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [id, rememberTitles]);

  const sendRequest = (payload: { titleId: string; season?: number; hash?: string }) => {
    setReqErr(null);
    const mediaType = payload.titleId.startsWith("tmdb-tv-") ? "tv" : "movie";
    const tmdb = payload.titleId.startsWith("tmdb-tv-")
      ? payload.titleId.slice(8)
      : payload.titleId.startsWith("tmdb-")
        ? payload.titleId.slice(5)
        : undefined;
    void fetch("/api/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleId: payload.titleId,
        title: resolved?.title,
        mediaType,
        tmdb,
        season: payload.season,
        hash: payload.hash,
      }),
    })
      .then((r) => r.json())
      .then((j: { ok?: boolean; error?: string }) => {
        if (!j.ok) setReqErr(j.error || "Engine did not add the title");
      })
      .catch((e) => setReqErr(String(e)));
  };

  if (!resolved) {
    return (
      <div className="px-6 py-16">
        <p className="text-muted">Looking up that title…</p>
        <Link to="/" className="mt-4 inline-block text-gold">
          Home
        </Link>
      </div>
    );
  }

  const jellyfin = typeof window !== "undefined" ? `http://${window.location.hostname}:8096` : "";
  const series = resolved.kind === "tv" || resolved.kind === "anime";
  const seasonReady = request?.status === "available" || engineStatus === "downloaded";
  const available = series
    ? seasonReady
    : inJellyfin || inLibrary || seasonReady;
  const blocked =
    (resolved.kind === "music" && !intent.music) ||
    (resolved.kind === "anime" && !intent.anime) ||
    (resolved.kind === "kids" && !intent.kids) ||
    (resolved.kind === "movie" && !intent.movies) ||
    (resolved.kind === "tv" && !intent.tv);

  return (
    <div className="pb-16">
      <div className="relative min-h-[280px] overflow-hidden md:min-h-[360px]">
        <img
          src={resolved.poster}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-40 kenburns"
        />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/70 to-background/20" />
      </div>
      <div className="relative z-10 mx-auto -mt-40 grid max-w-5xl gap-8 px-5 md:-mt-48 md:grid-cols-[200px_1fr] md:px-10">
        <Poster title={resolved} className="mx-auto w-[180px] rounded-2xl md:w-auto" />
        <div className="pt-2">
          <p className="text-xs tracking-[0.18em] text-gold uppercase">{kindLabel(resolved.kind)}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">{resolved.title}</h1>
          <p className="mt-2 text-sm text-muted">
            {resolved.year}
            {resolved.runtime ? ` · ${formatRuntime(resolved.runtime)}` : null}
            {seasonNumbers.length ? ` · ${seasonNumbers.length} seasons` : null}
            {resolved.tracks ? ` · ${resolved.tracks} tracks` : null}
            {resolved.rating != null && Number.isFinite(Number(resolved.rating)) ? ` · ${Number(resolved.rating).toFixed(1)}` : null}
            {resolved.director ? ` · ${resolved.director}` : null}
          </p>
          <p className="mt-2 text-xs text-faint">{(resolved.genres ?? []).join(" · ")}</p>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">{resolved.overview}</p>
          {!available && !blocked && !request ? (
            <p className="mt-4 text-sm text-gold">{cacheCopy(resolved, source)}</p>
          ) : null}

          {resolved.kind === "tv" || resolved.kind === "anime" ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {seasonNumbers.length === 0 ? (
                <p className="text-sm text-muted">Loading seasons from Seerr…</p>
              ) : (
                seasonNumbers.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSeason(n)}
                    className={
                      season === n
                        ? "h-9 rounded-full bg-gold px-3 text-xs text-gold-fg"
                        : "h-9 rounded-full bg-card px-3 text-xs text-muted shadow-[var(--shadow-border)]"
                    }
                  >
                    Season {n}
                  </button>
                ))
              )}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            {available ? (
              <a href={jellyfin} target="_blank" rel="noreferrer">
                <Button size="lg">
                  <Play className="size-4" fill="currentColor" />
                  Play in Jellyfin
                </Button>
              </a>
            ) : (
              <Button size="lg" disabled>
                <Play className="size-4" />
                Available after request
              </Button>
            )}
            {available ? (
              <span className="inline-flex h-12 items-center gap-2 rounded-2xl bg-success/10 px-4 text-sm text-success">
                <Check className="size-4" />
                In library
              </span>
            ) : null}
            {available ? <RemoveFromBox title={resolved} /> : null}
            {blocked ? (
              <p className="self-center text-sm text-muted">
                This collection is off. Enable it in Settings.
              </p>
            ) : showRequestQueueControls({
                kind: resolved.kind,
                available,
                requestStatus: request?.status,
              }) ? (
              request?.status === "downloading" ? (
                <span className="inline-flex h-12 items-center rounded-2xl bg-card px-4 text-sm text-gold">
                  {typeof request.progress === "number" && request.progress > 0
                    ? `Grabbing · ${Math.round(request.progress)}%`
                    : request.reason
                      ? request.reason
                      : request.via === "cache"
                        ? "Cache hit · importing"
                        : "Grabbing"}
                </span>
              ) : request?.status === "waiting" || engineStatus === "queued" ? (
                <span className="inline-flex h-12 items-center rounded-2xl bg-card px-4 text-sm text-muted">
                  {request?.reason
                    ? request.reason
                    : request?.via === "uncached"
                      ? "No cache · looking for a transfer"
                      : "Waiting for a release"}
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="lg"
                  disabled={
                    (resolved.kind === "tv" || resolved.kind === "anime") && seasonNumbers.length === 0
                  }
                  onClick={() => {
                    requestTitle(
                      resolved.id,
                      resolved.kind === "tv" || resolved.kind === "anime" ? season : undefined,
                    );
                    sendRequest({
                      titleId: resolved.id,
                      season: resolved.kind === "tv" || resolved.kind === "anime" ? season : undefined,
                    });
                  }}
                >
                  <Plus className="size-4" />
                  {resolved.kind === "tv" || resolved.kind === "anime"
                    ? `Request S${String(season).padStart(2, "0")}`
                    : "Request"}
                </Button>
              )
            ) : null}
            {request && requestShowsRetry(request) ? (
              <Button variant="ghost" size="lg" onClick={() => retryRequest(request.id)}>
                Retry
              </Button>
            ) : null}
          </div>
          {failed ? (
            <p className="mt-4 text-sm text-danger">{failed.reason}</p>
          ) : null}
          {reqErr ? <p className="mt-4 text-sm text-danger">{reqErr}</p> : null}

          {(!available || resolved.kind === "tv" || resolved.kind === "anime") && !blocked ? (
            <form
              className="mt-6 max-w-md"
              onSubmit={(e) => {
                e.preventDefault();
                const ok = pasteRelease(resolved.id, hash);
                setHashErr(!ok);
                if (ok) {
                  setHash("");
                  sendRequest({
                    titleId: resolved.id,
                    hash,
                    season: resolved.kind === "tv" || resolved.kind === "anime" ? season : undefined,
                  });
                }
              }}
            >
              <p className="text-xs tracking-[0.16em] text-faint uppercase">Hand a hash to the adapter</p>
              <p className="mt-1 text-sm text-muted">
                Request asks the provider first. Paste only a hash you already have. Nothing is seeded.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  value={hash}
                  onChange={(e) => {
                    setHash(e.target.value);
                    setHashErr(false);
                  }}
                  placeholder="Magnet or 40-character infohash"
                  className="h-11 flex-1 rounded-2xl bg-card px-4 text-sm shadow-[var(--shadow-border)] outline-none"
                />
                <Button type="submit" variant="ghost" size="lg">
                  Send
                </Button>
              </div>
              {hashErr ? <p className="mt-2 text-sm text-danger">That is not a hash or magnet.</p> : null}
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
