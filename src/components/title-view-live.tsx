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
import {
  showHashAdapter,
  showRequestQueueControls,
  requestShowsRetry,
  requestMediaTypeForPage,
  requestTitleIdForPage,
  titleMatchesId,
  titlePresenceKeys,
} from "@/lib/sync-requests";
import { useEngineRequest } from "@/lib/use-engine-request";
import { jellyfinWatchHref } from "@/lib/jellyfin-watch";
import { RemoveFromBox } from "@/components/remove-from-box";

function looksLikeHashTitle(name?: string) {
  return /^[0-9a-f]{32,64}$/i.test(String(name || "").trim());
}

function seasonNumbersOf(title?: Title | null, extra: number[] = []) {
  const listed = title?.seasonList?.filter((n) => n > 0) ?? [];
  if (listed.length) return listed;
  if (extra.length) return extra;
  if (title?.seasons && title.seasons > 0) {
    return Array.from({ length: title.seasons }, (_, i) => i + 1);
  }
  return [];
}

export function TitleView({ id }: { id: string }) {
  const catalog = getTitle(id);
  const remote = useReelStore((s) => s.remoteTitles.find((t) => titleMatchesId(t, id) || t.id === id));
  const shelf = useReelStore((s) => s.shelf.find((t) => titleMatchesId(t, id) || t.id === id));
  const rememberTitles = useReelStore((s) => s.rememberTitles);
  const title = catalog ?? remote ?? shelf;
  const [detail, setDetail] = useState<Title | null>(null);
  const [seasonErr, setSeasonErr] = useState<string | null>(null);
  const [seasonsLoading, setSeasonsLoading] = useState(true);
  const [lookupKey, setLookupKey] = useState(0);
  const raw = detail ?? title;
  const hashName = looksLikeHashTitle(raw?.title);
  const resolved = hashName
    ? detail && !looksLikeHashTitle(detail.title)
      ? detail
      : seasonsLoading && !detail
        ? null
        : raw
          ? { ...raw, title: "Unknown on this box" }
          : null
    : raw;
  const extraIds = titlePresenceKeys(id, resolved?.ids || []);
  const [season, setSeason] = useState(1);
  const [hash, setHash] = useState("");
  const [hashErr, setHashErr] = useState(false);
  const [reqErr, setReqErr] = useState<string | null>(null);
  const request = useReelStore((s) => {
    const keys = new Set(extraIds);
    const moviePage = resolved?.kind === "movie" || (id.startsWith("tmdb-") && !id.startsWith("tmdb-tv-") && !id.startsWith("tvdb-"));
    return s.requests.find((r) => {
      if (r.status === "failed") return false;
      if (moviePage && String(r.titleId).startsWith("tmdb-tv-")) return false;
      if (!titlePresenceKeys(r.titleId).some((k) => keys.has(k))) return false;
      return r.season == null || r.season === season;
    });
  });
  const failed = useReelStore((s) => {
    const keys = new Set(extraIds);
    return s.requests.find((r) => r.status === "failed" && titlePresenceKeys(r.titleId).some((k) => keys.has(k)));
  });
  const inLibrary = useReelStore((s) => {
    if (s.library.includes(id)) return true;
    return [...s.shelf, ...s.remoteTitles].some((t) => titleMatchesId(t, id) && s.library.some((lib) => titleMatchesId(t, lib)));
  });
  const intent = useReelStore((s) => s.answers.intent);
  const source = useReelStore((s) => s.answers.source);
  const requestTitle = useReelStore((s) => s.requestTitle);
  const retryRequest = useReelStore((s) => s.retryRequest);
  const pasteRelease = useReelStore((s) => s.pasteRelease);
  const ipv4 = useReelStore((s) => s.ipv4);
  const tailscaleIp = useReelStore((s) => s.tailscaleIp);
  const watchDoor = useReelStore((s) => s.watch);
  const { inJellyfin, engineStatus, seasonList, onDiskSeasons } = useEngineRequest(id, season);
  const seasonNumbers = seasonNumbersOf(resolved, seasonList);

  useEffect(() => {
    let stop = false;
    const ac = new AbortController();
    const timer = window.setTimeout(() => ac.abort(), 20000);
    setSeasonErr(null);
    setSeasonsLoading(true);
    void fetch(`/api/lookup?id=${encodeURIComponent(id)}`, { cache: "no-store", signal: ac.signal })
      .then((r) => r.json() as Promise<{ titles?: Title[]; error?: string }>)
      .then((j) => {
        const t = j.titles?.[0];
        if (stop) return;
        if (!t) {
          setSeasonErr(j.error || "Seerr did not return seasons.");
          setSeasonsLoading(false);
          return;
        }
        rememberCatalogTitles([t]);
        rememberTitles?.([t]);
        setDetail(t);
        const nums = seasonNumbersOf(t);
        if (nums.length) setSeason((cur) => (nums.includes(cur) ? cur : (nums[0] ?? 1)));
        setSeasonsLoading(false);
      })
      .catch((e) => {
        if (stop) return;
        const aborted = String(e?.name || "") === "AbortError";
        setSeasonErr(aborted ? "Seerr lookup timed out. Try again." : String(e?.message || e));
        setSeasonsLoading(false);
      });
    return () => {
      stop = true;
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [id, rememberTitles, lookupKey]);

  const sendRequest = (payload: { titleId: string; season?: number; hash?: string }) => {
    setReqErr(null);
    const titleId = payload.titleId;
    const mediaType = requestMediaTypeForPage(id, resolved?.kind);
    const tmdb =
      mediaType === "tv"
        ? titleId.startsWith("tmdb-tv-")
          ? titleId.slice(8)
          : extraIds.find((k) => k.startsWith("tmdb-tv-"))?.slice(8) || extraIds.find((k) => /^tmdb-\d/.test(k))?.slice(5)
        : titleId.startsWith("tmdb-") && !titleId.startsWith("tmdb-tv-")
          ? titleId.slice(5)
          : extraIds.find((k) => /^tmdb-\d/.test(k) && !k.startsWith("tmdb-tv-"))?.slice(5);
    void fetch("/api/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleId,
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

  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const jellyfin = jellyfinWatchHref({
    ipv4,
    tailscaleIp,
    watch: watchDoor,
    hostname,
    jellyfinId: resolved.jellyfinId,
  });
  const series = resolved.kind === "tv" || resolved.kind === "anime";
  const diskSeasons = [...new Set([...(onDiskSeasons || []), ...(resolved.onDiskSeasons || [])])];
  const thisSeasonOnBox =
    !series ||
    diskSeasons.includes(season) ||
    request?.status === "available" ||
    engineStatus === "downloaded" ||
    engineStatus === "available";
  // Series-in-Jellyfin is not this season. Expanse S06 on the box must not Watch S01.
  const onBox = series ? thisSeasonOnBox : inJellyfin || inLibrary;
  const available = onBox;
  const requestTitleId = requestTitleIdForPage(id, resolved.kind, extraIds);
  const hashPaste = showHashAdapter({ pageId: id, title: resolved.title });
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
            {resolved.year || null}
            {resolved.runtime ? ` · ${formatRuntime(resolved.runtime)}` : null}
            {seasonNumbers.length ? ` · ${seasonNumbers.length} seasons` : null}
            {resolved.tracks ? ` · ${resolved.tracks} tracks` : null}
            {resolved.rating != null && Number.isFinite(Number(resolved.rating)) ? ` · ${Number(resolved.rating).toFixed(1)}` : null}
            {resolved.director ? ` · ${resolved.director}` : null}
          </p>
          <p className="mt-2 text-xs text-faint">{(resolved.genres ?? []).join(" · ")}</p>
          {resolved.kind === "movie" && resolved.collection?.id && resolved.collection.name ? (
            <Link
              to="/collection/$id"
              params={{ id: String(resolved.collection.id) }}
              className="mt-3 inline-flex text-sm text-gold"
            >
              Collection · {resolved.collection.name}
            </Link>
          ) : null}
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">{resolved.overview}</p>
          {!available && !blocked && !request ? (
            <p className="mt-4 text-sm text-gold">{cacheCopy(resolved, source)}</p>
          ) : null}

          {series && !onBox ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {seasonNumbers.length === 0 && seasonsLoading ? (
                <p className="text-sm text-muted">Loading seasons from Seerr…</p>
              ) : seasonNumbers.length === 0 ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-danger">{seasonErr || "Could not load seasons from Seerr."}</p>
                  <Button variant="ghost" size="lg" onClick={() => setLookupKey((n) => n + 1)}>
                    Retry
                  </Button>
                </div>
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
                    {diskSeasons.includes(n) ? " · in" : ""}
                  </button>
                ))
              )}
            </div>
          ) : series && seasonNumbers.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {seasonNumbers.map((n) => (
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
                  {diskSeasons.includes(n) ? " · in" : ""}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            {available && jellyfin ? (
              <a href={jellyfin} target="_blank" rel="noreferrer">
                <Button size="lg">
                  <Play className="size-4" fill="currentColor" />
                  Watch
                </Button>
              </a>
            ) : available ? (
              <Button size="lg" disabled>
                <Play className="size-4" fill="currentColor" />
                Watch
              </Button>
            ) : request?.status === "downloading" || request?.status === "waiting" ? null : (
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
                available: series ? thisSeasonOnBox : available,
                requestStatus: thisSeasonOnBox && series ? "available" : request?.status,
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
                  disabled={series && seasonNumbers.length === 0 && !available}
                  onClick={() => {
                    requestTitle(
                      requestTitleId,
                      series ? season : undefined,
                    );
                    sendRequest({
                      titleId: requestTitleId,
                      season: series ? season : undefined,
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

          {!available && !blocked && hashPaste ? (
            <form
              className="mt-6 max-w-md"
              onSubmit={(e) => {
                e.preventDefault();
                const ok = pasteRelease(resolved.id, hash);
                setHashErr(!ok);
                if (ok) {
                  setHash("");
                  sendRequest({
                    titleId: requestTitleId,
                    hash,
                    season: series ? season : undefined,
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
