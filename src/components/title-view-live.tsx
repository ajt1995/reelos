import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, Check, ChevronDown, LoaderCircle, Pause, Play, Plus, RotateCcw, RotateCw, Square, Tv, Users, X } from "lucide-react";
import { Poster } from "@/components/poster";
import { CuratorVoteBar, Row, TitleCard } from "@/components/title-card";
import { Button } from "@/components/ui/button";
import { WatchWithFriendModal } from "@/components/watch-with-friend-modal";
import { WatchLauncherModal } from "@/components/watch-launcher";
import { showToast } from "@/lib/toast";
import { getTitle, kindLabel, rememberCatalogTitles } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import type { Title } from "@/lib/types";
import { cn, formatRuntime } from "@/lib/utils";
import {
  showHashAdapter,
  showRequestQueueControls,
  requestShowsRetry,
  requestMediaTypeForPage,
  requestProgressLabel,
  requestTitleIdForPage,
  titleMatchesId,
  titlePresenceKeys,
  importingSeasonNumbersForTitle,
  isLinkedImportingRequest,
} from "@/lib/sync-requests";
import { useEngineRequest } from "@/lib/use-engine-request";
import { jellyfinWatchHref } from "@/lib/jellyfin-watch";
import { generatePersonalizedHook } from "@/lib/personalized-hooks";
import { RemoveFromBox } from "@/components/remove-from-box";
import { SeasonEpisodeAccordion } from "@/components/season-episode-accordion";
import { titleIsCuratorHidden, titleIsCuratorLiked } from "@/lib/discover-curator";
import { useCurator } from "@/lib/use-curator";
import { CuratorStatus } from "@/components/curator-status";
import { IMPORTING_SEASON_CHIP, IMPORTING_SEASON_COPY, UNRELEASED_SEASON_CHIP, UNRELEASED_SEASON_COPY } from "@/lib/episode-status";

function uniqSeasons(nums: number[]) {
  return [...new Set(nums.map(Number).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
}

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
  const navigate = useNavigate();
  const [streamResolving, setStreamResolving] = useState(false);
  const catalog = getTitle(id);
  const remote = useReelStore((s) => s.remoteTitles.find((t) => titleMatchesId(t, id) || t.id === id));
  const shelf = useReelStore((s) => s.shelf.find((t) => titleMatchesId(t, id) || t.id === id));
  const rememberTitles = useReelStore((s) => s.rememberTitles);
  const curator = useCurator();
  const { hiddenIds, likedIds, voteTitle } = curator;
  const title = catalog ?? remote ?? shelf;
  const [detail, setDetail] = useState<Title | null>(null);
  const [seasonErr, setSeasonErr] = useState<string | null>(null);
  const [seasonsLoading, setSeasonsLoading] = useState(true);
  const [similar, setSimilar] = useState<Title[]>([]);
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
  const [season, setSeason] = useState(1);
  const [hash, setHash] = useState("");
  const [hashErr, setHashErr] = useState(false);
  const [reqErr, setReqErr] = useState<string | null>(null);
  const [removedHere, setRemovedHere] = useState(false);
  const [lookupKey, setLookupKey] = useState(0);
  const [ambientColor, setAmbientColor] = useState<string | null>(null);

  useEffect(() => {
    const posterUrl = resolved?.poster;
    if (!posterUrl || typeof window === "undefined") {
      setAmbientColor(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = posterUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 128 && (data[i] > 25 || data[i + 1] > 25 || data[i + 2] > 25)) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }
        if (count > 0) {
          setAmbientColor(`rgba(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}, 0.28)`);
        }
      } catch {
        /* CORS fallback */
      }
    };
  }, [resolved?.poster]);
  const {
    inJellyfin,
    engineStatus,
    seasonList,
    onDiskSeasons,
    importingSeasons,
    unreleasedSeasons,
    extraIds: engineIds,
  } = useEngineRequest(id, season);
  const extraIds = [...new Set([...titlePresenceKeys(id, resolved?.ids || []), ...engineIds])];
  const request = useReelStore((s) => {
    const keys = new Set(extraIds);
    const moviePage = resolved?.kind === "movie" || (id.startsWith("tmdb-") && !id.startsWith("tmdb-tv-") && !id.startsWith("tvdb-"));
    return s.requests.find((r) => {
      if (r.status === "failed") return false;
      if (isLinkedImportingRequest(r) && r.season != null && r.season !== season) return false;
      if (moviePage && String(r.titleId).startsWith("tmdb-tv-")) return false;
      if (!titlePresenceKeys(r.titleId).some((k) => keys.has(k))) return false;
      return r.season == null || r.season === season;
    });
  });
  const failed = useReelStore((s) => {
    const keys = new Set(extraIds);
    return s.requests.find((r) => {
      if (r.status !== "failed") return false;
      if (isLinkedImportingRequest(r)) return false;
      if (!titlePresenceKeys(r.titleId).some((k) => keys.has(k))) return false;
      if (r.season != null && r.season !== season) return false;
      return true;
    });
  });
  const storeRequests = useReelStore((s) => s.requests);
  const requestImporting = useMemo(
    () => importingSeasonNumbersForTitle(id, storeRequests, extraIds),
    [id, storeRequests, extraIds],
  );
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
  const kidsTitleIds = useReelStore((s) => s.kidsTitleIds);
  const kidsGiftedTitles = useReelStore((s) => s.kidsGiftedTitles || {});
  const toggleKidsTitle = useReelStore((s) => s.toggleKidsTitle);
  const giftKidsTitle = useReelStore((s) => s.giftKidsTitle);
  const ungiftKidsTitle = useReelStore((s) => s.ungiftKidsTitle);
  const toggleWatchlist = useReelStore((s) => s.toggleWatchlist);
  const residents = useReelStore((s) => s.residents);
  const activeResidentId = useReelStore((s) => s.activeResidentId);
  const activeResident =
    residents.find((r) => r.id === activeResidentId) ??
    residents[0] ?? { name: "Living Room" };
  const inWatchlist = Boolean(
    resolved &&
      (activeResident.watchlist?.includes(resolved.id) ||
        (resolved.jellyfinId && activeResident.watchlist?.includes(resolved.jellyfinId)))
  );
  const isGifted = Boolean(
    resolved && (kidsGiftedTitles[resolved.id] || (resolved.jellyfinId && kidsGiftedTitles[resolved.jellyfinId]))
  );
  const giftedBy = resolved ? (kidsGiftedTitles[resolved.id]?.giftedBy || (resolved.jellyfinId ? kidsGiftedTitles[resolved.jellyfinId]?.giftedBy : undefined)) : undefined;
  const seasonNumbers = seasonNumbersOf(resolved, seasonList);
  const nextEpisodeNumber = useMemo(() => {
    const progressMap = activeResident?.watchProgress || {};
    for (const [key, prog] of Object.entries(progressMap)) {
      if (key.includes(id) || (resolved?.id && key.includes(resolved.id))) {
        const epMatch = key.match(/e(\d+)/i);
        if (epMatch) {
          const epNum = Number(epMatch[1]);
          if (prog < 0.9) return epNum;
          return epNum + 1;
        }
      }
    }
    return 1;
  }, [activeResident, id, resolved?.id]);

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
          setSeasonErr(j.error || "Could not load season details.");
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
        setSeasonErr(aborted ? "Lookup timed out. Please try again." : String(e?.message || e));
        setSeasonsLoading(false);
      });
    return () => {
      stop = true;
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [id, rememberTitles, lookupKey]);

  useEffect(() => {
    let stop = false;
    const ac = new AbortController();
    setSimilar([]);
    void fetch(`/api/similar?id=${encodeURIComponent(id)}`, { cache: "no-store", signal: ac.signal })
      .then((r) => r.json() as Promise<{ titles?: Title[] }>)
      .then((j) => {
        if (stop) return;
        const titles = Array.isArray(j.titles) ? j.titles : [];
        rememberCatalogTitles(titles);
        rememberTitles?.(titles);
        setSimilar(titles);
      })
      .catch(() => {
        if (!stop) setSimilar([]);
      });
    return () => {
      stop = true;
      ac.abort();
    };
  }, [id, rememberTitles]);

  const [showCastModal, setShowCastModal] = useState(false);
  const [activePlayEpisode, setActivePlayEpisode] = useState<{
    jellyfinId?: string;
    episodeTitle?: string;
    season?: number;
    episode?: number;
  } | null>(null);
  const [castSessions, setCastSessions] = useState<any[]>([]);
  const [castLoading, setCastLoading] = useState(false);
  const [activeCastSession, setActiveCastSession] = useState<{ id: string; name: string; isPaused: boolean } | null>(null);
  const [showWatchWithFriend, setShowWatchWithFriend] = useState(false);
  const [isResolvingStream, setIsResolvingStream] = useState(false);

  const handleUnifiedPlay = async (targetSeason?: number) => {
    setIsResolvingStream(true);
    try {
      const sNum = series ? (targetSeason || season || 1) : undefined;
      requestTitle(requestTitleId, sNum);
      sendRequest({
        titleId: requestTitleId,
        season: sNum,
      });
      await new Promise((r) => setTimeout(r, 1200));
      setShowCastModal(true);
      void refreshCastSessions();
    } catch {
      showToast("Could not resolve stream. Please try again.", "error");
    } finally {
      setIsResolvingStream(false);
    }
  };

  const refreshCastSessions = async () => {
    setCastLoading(true);
    try {
      const res = await fetch("/api/cast/sessions");
      const data = await res.json();
      if (data.ok && Array.isArray(data.sessions)) {
        setCastSessions(data.sessions);
      }
    } catch {
      /* ignore */
    } finally {
      setCastLoading(false);
    }
  };

  useEffect(() => {
    void refreshCastSessions();
  }, []);

  const handleCastPlay = async (session: any) => {
    if (!resolved) return;
    const jfItemId = resolved.jellyfinId || resolved.id;
    if (!jfItemId) return;
    try {
      showToast(`Casting to ${session.name}…`);
      const res = await fetch("/api/cast/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          itemId: jfItemId,
          playCommand: "PlayNow",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setActiveCastSession({ id: session.id, name: session.name, isPaused: false });
        setShowCastModal(false);
        showToast(`Playing on ${session.name}`);
      } else {
        showToast(data.error || "Failed to start playback on TV");
      }
    } catch (err) {
      showToast("Cast error: " + String(err));
    }
  };

  const handleCastControl = async (command: string, params: Record<string, unknown> = {}) => {
    if (!activeCastSession) return;
    try {
      await fetch("/api/cast/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeCastSession.id,
          command,
          params,
        }),
      });
      if (command.toLowerCase() === "pause") {
        setActiveCastSession((s) => (s ? { ...s, isPaused: true } : null));
      } else if (command.toLowerCase() === "play" || command.toLowerCase() === "unpause") {
        setActiveCastSession((s) => (s ? { ...s, isPaused: false } : null));
      } else if (command.toLowerCase() === "stop") {
        setActiveCastSession(null);
        showToast("Cast stopped");
      }
    } catch {
      /* ignore */
    }
  };

  const sendRequest = (payload: { titleId: string; season?: number; episode?: number; hash?: string }) => {
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
        episode: payload.episode,
        hash: payload.hash,
      }),
    })
      .then((r) => r.json())
      .then((j: { ok?: boolean; error?: string }) => {
        if (!j.ok) {
          setReqErr(j.error || "Engine did not add the title");
          showToast(j.error || "Could not add request", "error");
        } else {
          showToast(`Requested ${resolved?.title || "title"}`, "success");
        }
      })
      .catch((e) => {
        setReqErr(String(e));
        showToast("Request failed: " + String(e), "error");
      });
  };

  if (!resolved) {
    if (!seasonsLoading) {
      return (
        <div className="px-6 py-16">
          <CuratorStatus {...curator} />
          <p className="text-muted">{seasonErr || "Title information not found" /* seasonErr || "Seerr did not find that title" */}</p>
          <button
            type="button"
            className="mt-4 text-gold"
            onClick={() => setLookupKey((n) => n + 1)}
          >
            Retry
          </button>
          <Link to="/" className="mt-4 ml-4 inline-block text-gold">
            Home
          </Link>
        </div>
      );
    }
    return (
      <div className="px-6 py-16">
        <CuratorStatus {...curator} />
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
  const comingSeasons = uniqSeasons([
    ...(unreleasedSeasons || []),
    ...(resolved.unreleasedSeasons || []),
    ...((resolved.seasonFacts || []).filter((s) => s.unreleased).map((s) => s.season)),
  ]);
  const linkingSeasons = uniqSeasons([
    ...(importingSeasons || []),
    ...(resolved.importingSeasons || []),
    ...requestImporting,
  ]).filter((n) => !comingSeasons.includes(n));
  const diskSeasons = uniqSeasons([...(onDiskSeasons || []), ...(resolved.onDiskSeasons || [])]).filter(
    (n) => !linkingSeasons.includes(n) && !comingSeasons.includes(n),
  );
  const thisSeasonOnBox = !removedHere && (!series || diskSeasons.includes(season));
  const thisSeasonUnreleased = Boolean(series && comingSeasons.includes(season) && !thisSeasonOnBox);
  const thisSeasonImporting = Boolean(
    series && linkingSeasons.includes(season) && !thisSeasonOnBox && !thisSeasonUnreleased,
  );
  // Series-in-Jellyfin is not this season. Expanse S06 on the box must not Watch S01.
  // Seerr AVAILABLE / engine downloaded is not S05·in.
  // JF is truth — lookup overlay jellyfinId must Watch even if the limited Home shelf missed the id.
  const onBox = series
    ? thisSeasonOnBox
    : Boolean(resolved.jellyfinId) || inJellyfin || inLibrary;
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
    <div className="title-page pb-28 md:pb-16">
      <div className="title-hero" aria-hidden="true">
        {resolved.poster ? (
          <>
            <img
              src={resolved.poster}
              alt=""
              className="title-hero-ambient"
              onError={(e) => {
                e.currentTarget.style.opacity = "0";
              }}
            />
            <img
              src={resolved.backdrop || resolved.poster}
              alt=""
              className="title-hero-art kenburns"
              onError={(e) => {
                e.currentTarget.style.opacity = "0";
              }}
            />
          </>
        ) : null}
        {ambientColor ? (
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-700"
            style={{
              background: `radial-gradient(ellipse 95% 65% at 50% 5%, ${ambientColor} 0%, transparent 80%)`,
            }}
          />
        ) : null}
        <div className="title-hero-fade" />
      </div>
      <div className="title-body">
        <Poster title={resolved} className="title-poster rounded-2xl" />
        <div className="title-copy">
          <CuratorStatus {...curator} />
          <p className="text-xs tracking-[0.18em] text-gold uppercase">{kindLabel(resolved.kind)}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
            {resolved.title === "Unknown on this box" ? "Direct Stream Feature" : resolved.title}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/20 bg-card/80 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-foreground shadow-sm backdrop-blur-md">
              4K HDR
            </span>
            <span className="rounded-full border border-white/20 bg-card/80 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-foreground shadow-sm backdrop-blur-md">
              DOLBY VISION
            </span>
            {resolved.year ? <span className="text-xs text-muted font-medium">{resolved.year}</span> : null}
            {resolved.runtime ? <span className="text-xs text-muted">· {formatRuntime(resolved.runtime)}</span> : null}
            {series && seasonNumbers.length ? <span className="text-xs text-muted">· {seasonNumbers.length} seasons</span> : null}
            {resolved.tracks ? <span className="text-xs text-muted">· {resolved.tracks} tracks</span> : null}
            {resolved.rating != null && Number.isFinite(Number(resolved.rating)) ? (
              <span className="text-xs text-gold font-semibold">★ {Number(resolved.rating).toFixed(1)}</span>
            ) : null}
            {resolved.director ? <span className="text-xs text-muted">· {resolved.director}</span> : null}
          </div>
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
          <p className="mt-5 max-w-xl line-clamp-4 text-[15px] leading-relaxed text-muted md:line-clamp-none">{resolved.overview}</p>
          
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-sm font-semibold text-gold">Why You'll Love This</p>
            <p className="text-sm text-foreground italic">{generatePersonalizedHook(activeResident, resolved)}</p>
          </div>

          {series && activeResident?.watchProgress?.[resolved.jellyfinId || resolved.id] ? (
            <div className="mt-4 p-4 rounded-xl border border-gold/20 bg-gold/5">
              <p className="text-xs font-semibold text-gold uppercase tracking-wider mb-1">Where You Left Off</p>
              <p className="text-sm text-foreground">You were watching this series. Jump right back in!</p>
              <div className="mt-2 h-1.5 w-full bg-black/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gold" 
                  style={{ width: `${Math.min(100, Math.max(0, activeResident.watchProgress[resolved.jellyfinId || resolved.id] * 100))}%` }} 
                />
              </div>
            </div>
          ) : null}

          {(series && !onBox && !blocked && !request && !thisSeasonUnreleased) || (!series && !available && !blocked && !request) ? (
            <p className="mt-4 text-sm text-gold">
              ReelOS will check this home’s connected sources before offering Play or Save.
            </p>
          ) : null}
          {thisSeasonUnreleased ? (
            <p className="mt-4 text-sm text-muted">{UNRELEASED_SEASON_COPY}</p>
          ) : null}
          {thisSeasonImporting ? (
            <p className="mt-4 text-sm text-muted">{IMPORTING_SEASON_COPY}</p>
          ) : null}

          {series ? (
            <div className="mt-5">
              <SeasonEpisodeAccordion
                seasonNumbers={seasonNumbers}
                selectedSeason={season}
                onSelectSeason={setSeason}
                diskSeasons={diskSeasons}
                importingSeasons={linkingSeasons}
                unreleasedSeasons={comingSeasons}
                titleId={requestTitleId}
                seasonsLoading={seasonsLoading}
                seasonErr={seasonErr}
                onRetrySeasons={() => setLookupKey((n) => n + 1)}
                blocked={blocked}
                removedHere={removedHere}
                onRequestSeason={(n) => {
                  requestTitle(requestTitleId, n);
                  sendRequest({ titleId: requestTitleId, season: n });
                  showToast(`Requested Season ${n}`, "success");
                }}
                onRequestEpisode={(n, episode) => {
                  showToast("Requested");
                  sendRequest({ titleId: requestTitleId, season: n, episode });
                }}
                onPlayEpisode={(ep, seasonNum) => {
                  setActivePlayEpisode({
                    jellyfinId: ep.jellyfinId,
                    episodeTitle: ep.title,
                    season: seasonNum,
                    episode: ep.episodeNumber,
                  });
                  setShowCastModal(true);
                  void refreshCastSessions();
                }}
              />
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            {thisSeasonUnreleased ? (
              <span className="inline-flex h-12 items-center rounded-2xl bg-card px-4 text-sm text-muted">
                {UNRELEASED_SEASON_CHIP}
              </span>
            ) : thisSeasonImporting ? (
              <span className="inline-flex h-12 items-center rounded-2xl bg-card px-4 text-sm text-gold">
                {IMPORTING_SEASON_CHIP}
              </span>
            ) : streamResolving ? (
              <span className="inline-flex h-12 items-center gap-2.5 rounded-2xl border border-gold/50 bg-gold/20 px-6 text-sm font-semibold text-gold shadow-lg backdrop-blur-md animate-pulse">
                <LoaderCircle className="size-4 animate-spin text-gold" />
                Resolving 4K Stream…
              </span>
            ) : request?.status === "downloading" || request?.status === "waiting" ? (
              <span className="inline-flex h-12 items-center gap-2.5 rounded-2xl border border-gold/40 bg-gold/15 px-6 text-sm font-semibold text-gold shadow-sm backdrop-blur-md">
                <LoaderCircle className="size-4 animate-spin text-gold" />
                Caching 4K Stream · {request?.progress ? `${request.progress}%` : "Transferring…"}
              </span>
            ) : available ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="lg"
                  className="gap-2 bg-gold text-background hover:bg-gold/90 font-semibold px-6 shadow-md"
                  onClick={() => {
                    void navigate({
                      to: "/play/$id",
                      params: { id: resolved.id },
                      search: series ? { season: season || 1, episode: nextEpisodeNumber } : undefined,
                    });
                  }}
                >
                  <Play className="size-4" fill="currentColor" />
                  Play
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  className="gap-2 border-border bg-card hover:border-gold/40"
                  onClick={() => {
                    setShowCastModal(true);
                    void refreshCastSessions();
                  }}
                  title="Choose playback target (Web Player, TV, or VLC)"
                >
                  <Tv className="size-4 text-gold" />
                  <span>{castSessions.length > 0 ? `Play on ${castSessions[0].name}` : "Cast to TV"}</span>
                  <ChevronDown className="size-3.5 text-muted ml-0.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  className="gap-2 border-border bg-card hover:border-gold/40 text-gold"
                  onClick={() => setShowWatchWithFriend(true)}
                  title="Invite a friend to watch together with synchronized playback"
                >
                  <Users className="size-4" />
                  <span>Watch with Friend</span>
                </Button>
              </div>
            ) : (
              <Button
                size="lg"
                className="gap-2 bg-gold text-background hover:bg-gold/90 font-semibold px-6 shadow-md"
                onClick={() => {
                  setStreamResolving(true);
                  requestTitle(requestTitleId, series ? season : undefined);
                  sendRequest({
                    titleId: requestTitleId,
                    season: series ? season : undefined,
                  });
                  setTimeout(() => {
                    setStreamResolving(false);
                    void navigate({
                      to: "/play/$id",
                      params: { id: resolved.id },
                      search: series ? { season: season || 1, episode: nextEpisodeNumber } : undefined,
                    });
                  }, 1200);
                }}
              >
                <Play className="size-4" fill="currentColor" />
                Stream 4K
              </Button>
            )}

            {available ? (
              <span className="inline-flex h-12 items-center gap-2 rounded-2xl bg-success/10 px-4 text-sm text-success">
                <Check className="size-4" />
                In library
              </span>
            ) : null}

            {(available || Boolean(request) || Boolean(resolved.jellyfinId) || removedHere) ? (
              <RemoveFromBox title={resolved} onRemoved={() => setRemovedHere(true)} />
            ) : null}
            <Button
              variant="ghost"
              size="lg"
              onClick={() => toggleKidsTitle(resolved.id)}
              className={cn(
                "gap-1.5 rounded-2xl border-border bg-card",
                kidsTitleIds.includes(resolved.id) && "border-gold/50 bg-gold/15 text-gold"
              )}
            >
              <span>👶</span>
              {kidsTitleIds.includes(resolved.id) ? "Kids Approved" : "Send to Kids"}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                if (!resolved) return;
                if (isGifted) {
                  ungiftKidsTitle(resolved.id);
                  showToast("Removed gift ribbon from Kids shelf", "info");
                } else {
                  giftKidsTitle(resolved.id, activeResident.name ? `From ${activeResident.name}` : "Mom & Dad");
                  showToast("🎁 Gifted to Kids Shelf with ribbon!", "success");
                }
              }}
              className={cn(
                "gap-1.5 rounded-2xl border-border bg-card transition-all",
                isGifted && "border-amber-400/60 bg-amber-500/15 text-amber-300 font-semibold shadow-sm"
              )}
              title="Add gold gift ribbon for Kids profile"
            >
              <span>🎁</span>
              {isGifted ? `Gifted (${giftedBy || "Mom & Dad"})` : "Gift to Kids"}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                toggleWatchlist(resolved.id);
                showToast(
                  inWatchlist
                    ? `Removed from ${activeResident.name}'s Watchlist`
                    : `Saved to ${activeResident.name}'s Watchlist`,
                  "success"
                );
              }}
              className={cn(
                "gap-2 rounded-2xl border-border bg-card",
                inWatchlist && "border-gold/50 bg-gold/15 text-gold font-semibold"
              )}
            >
              {inWatchlist ? <BookmarkCheck className="size-4 text-gold" /> : <Bookmark className="size-4" />}
              <span>{inWatchlist ? "In Watchlist" : "Watchlist"}</span>
            </Button>
            {resolved ? (
              <CuratorVoteBar
                placement="inline"
                liked={titleIsCuratorLiked(resolved, likedIds)}
                hidden={titleIsCuratorHidden(resolved, hiddenIds)}
                onVote={(vote) => voteTitle(resolved, vote)}
              />
            ) : null}
            {blocked ? (
              <p className="self-center text-sm text-muted">
                This collection is off. Enable it in Settings.
              </p>
            ) : null}
            {request && requestShowsRetry(request) ? (
              <Button variant="ghost" size="lg" onClick={() => retryRequest(request.id)}>
                Retry
              </Button>
            ) : null}
          </div>

          {activeCastSession ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/30 bg-card p-4 shadow-[var(--shadow-border)]">
              <div className="flex items-center gap-3">
                <Tv className="size-5 text-gold animate-pulse" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gold">Now Casting</p>
                  <p className="font-display text-sm font-medium">{activeCastSession.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCastControl(activeCastSession.isPaused ? "Play" : "Pause")}
                  title={activeCastSession.isPaused ? "Play" : "Pause"}
                >
                  {activeCastSession.isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCastControl("Seek", { positionTicks: -150000000 })}
                  title="Rewind 15s"
                >
                  <RotateCcw className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCastControl("Seek", { positionTicks: 150000000 })}
                  title="Forward 15s"
                >
                  <RotateCw className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCastControl("Stop")}
                  title="Stop"
                  className="text-danger"
                >
                  <Square className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setActiveCastSession(null)}
                  title="Dismiss Controller"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}
          {failed ? (
            <p className="mt-4 text-sm text-danger">{failed.reason}</p>
          ) : null}
          {reqErr ? <p className="mt-4 text-sm text-danger">{reqErr}</p> : null}

          {!available && !blocked && !thisSeasonUnreleased && hashPaste ? (
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
      {similar.length ? (
        <div className="mx-auto max-w-5xl px-5 md:px-10">
          <Row label="More like this">
            {similar.map((t) => (
              <TitleCard
                key={t.id}
                title={t}
                onVote={voteTitle}
                liked={titleIsCuratorLiked(t, likedIds)}
                hidden={titleIsCuratorHidden(t, hiddenIds)}
              />
            ))}
          </Row>
        </div>
      ) : null}

      <WatchLauncherModal
        open={showCastModal}
        onClose={() => {
          setShowCastModal(false);
          setActivePlayEpisode(null);
        }}
        title={{
          id: resolved.id,
          title: resolved.title,
          year: resolved.year,
          poster: resolved.poster,
          kind: resolved.kind,
          jellyfinId: activePlayEpisode?.jellyfinId || resolved.jellyfinId,
          season: activePlayEpisode?.season ?? (series ? season : undefined),
          episode: activePlayEpisode?.episode,
          episodeTitle: activePlayEpisode?.episodeTitle,
        }}
      />

      <WatchWithFriendModal
        open={showWatchWithFriend}
        onClose={() => setShowWatchWithFriend(false)}
        titleId={resolved?.id || ""}
        titleName={resolved?.title || ""}
        posterUrl={resolved?.poster}
        year={resolved?.year}
      />
    </div>
  );
}
