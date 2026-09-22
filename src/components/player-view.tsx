import { useState, useRef, useEffect, useMemo, type SyntheticEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, ExternalLink, LoaderCircle, Play, QrCode, Sliders, Smartphone, Subtitles, Tv, Volume2, X } from "lucide-react";
import { getTitle } from "@/lib/catalog";
import { useReelStore } from "@/lib/store";
import { titleMatchesId } from "@/lib/sync-requests";
import { jellyfinStreamUrl, jellyfinWatchOrigin } from "@/lib/jellyfin-watch";
import { Button } from "@/components/ui/button";
import { WatchLauncherModal } from "@/components/watch-launcher";
import { QrCodeSvg } from "@/components/ui/qr-code-svg";
import { attachAudioBooster, type AudioPreset, PRESET_LABELS, type AudioController } from "@/lib/audio-booster";
import { synchronizePlaybackSubtitles } from "@/lib/playback-subtitles";
import { useMediaRetention } from "@/lib/media-retention-client";
import { useExperienceStore } from "@/experience/experience-state";
import {
  playbackSessionFailureMessage,
  playbackSessionNeedsRestart,
  postPlaybackSession,
  playbackPosition,
  savePrivatePlaybackProgress,
  savePrivateTitleReaction,
  type PlaybackSessionBody,
} from "@/lib/playback-session-client";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { familyTreatmentFrame, type FamilyTreatmentFrame, type FamilyTreatmentManifest } from "@/lib/family-treatment";
import { consumePlayerCompanionCommand, playerCompanionTiming, pollPlayerCompanionCommands, publishPlayerCompanionSession, stopPlayerCompanionSession } from "@/lib/player-companion";

/** Opens the working ReelOS stream door (LAN/Tailscale IP:8080/api/stream). */

type PlaybackScope = {
  body: PlaybackSessionBody;
  controller: AbortController;
  cancelled: boolean;
  registered: boolean;
  starting?: Promise<boolean>;
  presenceKey?: string;
  lastPosition?: ReturnType<typeof playbackPosition>;
  familyTreatment?: FamilyTreatmentManifest;
};

export function PlayerView({
  id,
  season: propSeason,
  episode: propEpisode,
  mediaId: propMediaId,
}: {
  id: string;
  season?: number;
  episode?: number;
  mediaId?: string;
}) {
  const navigate = useNavigate();
  const activeProfileId = useExperienceStore((state) => state.activeProfileId);
  const catalog = getTitle(id);
  const shelf = useReelStore((s) => s.shelf.find((t) => titleMatchesId(t, id)));
  const remote = useReelStore((s) => s.remoteTitles.find((t) => titleMatchesId(t, id) || t.id === id));
  const [fetchedTitle, setFetchedTitle] = useState<any>(null);
  const verifiedTitleLoaded = useRef(false);
  const title = useMemo(() => {
    const record = fetchedTitle ?? shelf ?? catalog ?? remote;
    return record ? { ...record, id: record.id || id, title: record.title || "Personal media" } : null;
  }, [catalog, shelf, remote, fetchedTitle, id]);

  useEffect(() => {
    if (catalog || shelf || remote || !id) return;
    let active = true;
    fetch(`/api/lookup?id=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || verifiedTitleLoaded.current) return;
        const hit = d?.titles?.[0];
        if (hit && typeof hit.id === "string" && titleMatchesId(hit, id)) setFetchedTitle(hit);
        else {
          setFetchedTitle({
            id,
            title: id.replace(/^(tmdb-|tvdb-|jf-)/, "Feature "),
            year: new Date().getFullYear(),
          });
        }
      })
      .catch(() => {
        if (!active || verifiedTitleLoaded.current) return;
        setFetchedTitle({
          id,
          title: "Feature Presentation",
          year: new Date().getFullYear(),
        });
      });
    return () => {
      active = false;
    };
  }, [id, catalog, shelf, remote]);

  // End-of-Stream Retention state ("Stream First, Keep When Loved")
  const [showRetentionCard, setShowRetentionCard] = useState(false);
  const [retentionDecisionMade, setRetentionDecisionMade] = useState(false);
  const [showLibraryKeeping, setShowLibraryKeeping] = useState(false);

  const isSeries = (title?.kind as string) === "tv" || (title?.kind as string) === "series" || id.startsWith("tvdb-") || id.startsWith("tmdb-tv-");

  const [resolvedEpisode, setResolvedEpisode] = useState<{
    jellyfinId?: string;
    season?: number;
    episode?: number;
    title?: string;
  } | null>(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState<any[]>([]);
  const [resolvedMediaId, setResolvedMediaId] = useState<string | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sourceAttempt, setSourceAttempt] = useState(0);
  const [showCompanionQr, setShowCompanionQr] = useState(false);

  useEffect(() => {
    if (!isSeries) return;
    let active = true;
    const sNum = propSeason || 1;
    fetch(`/api/episodes?id=${encodeURIComponent(id)}&season=${sNum}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return;
        const eps = Array.isArray(data?.episodes) ? data.episodes : [];
        setSeasonEpisodes(eps);
        if (propMediaId) return;
        const target = propEpisode
          ? eps.find((e: any) => e.episodeNumber === propEpisode && e.jellyfinId) ||
            eps.find((e: any) => e.episodeNumber === propEpisode)
          : eps.find((e: any) => e.status === "in-library" && e.jellyfinId) || eps[0];
        if (target) {
          setResolvedEpisode({
            jellyfinId: target.jellyfinId,
            season: sNum,
            episode: target.episodeNumber,
            title: target.title,
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, isSeries, propSeason, propEpisode, propMediaId]);

  const activeSeason = propSeason ?? resolvedEpisode?.season;
  const activeEpisode = propEpisode ?? resolvedEpisode?.episode;
  const activeEpisodeTitle = resolvedEpisode?.title;

  const jfId =
    propMediaId ||
    resolvedEpisode?.jellyfinId ||
    shelf?.jellyfinId ||
    resolvedMediaId ||
    (id.startsWith("jf-") ? id.replace(/^jf-/, "") : id);

  const ipv4 = useReelStore((s) => s.ipv4);
  const tailscaleIp = useReelStore((s) => s.tailscaleIp);
  const watch = useReelStore((s) => s.watch);
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";

  const [mediaSourcesData, setMediaSourcesData] = useState<{
    sources: any[];
    recommendedForBrowser?: any;
    recommendedForTv?: any;
    hasMultipleVersions?: boolean;
    hardwareTier?: string;
    jellyfinId?: string;
    resumeProgress?: number;
    activeProfileId?: string;
    progressTitleId?: string;
    retentionTitleId?: string;
    retentionSourceId?: string;
  } | null>(null);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

  const retentionSourceVerified = !sourcesLoading && !sourceError &&
    mediaSourcesData?.retentionSourceId === jfId && mediaSourcesData?.activeProfileId === activeProfileId;
  const retentionTitleId = retentionSourceVerified
    ? mediaSourcesData?.retentionTitleId || (isSeries ? jfId : mediaSourcesData?.progressTitleId || jfId)
    : null;
  const retentionProfileId = retentionSourceVerified ? mediaSourcesData?.activeProfileId || null : null;
  const retentionScope = JSON.stringify([id, jfId, activeSeason, activeEpisode, activeProfileId]);
  const retention = useMediaRetention(retentionTitleId, retentionProfileId, retentionScope,
    () => useExperienceStore.getState().activeProfileId === retentionProfileId);
  const savedToLibrary = retention.snapshot?.kept === true;
  const savingToLibrary = retention.saving;
  useEffect(() => {
    setShowRetentionCard(false);
    setRetentionDecisionMade(false);
    setShowLibraryKeeping(false);
  }, [retentionScope]);

  const currentSource =
    mediaSourcesData?.sources?.find((s) => s.id === activeSourceId) ||
    mediaSourcesData?.recommendedForBrowser;

  const streamUrl = jellyfinStreamUrl({
    ipv4,
    tailscaleIp,
    watch,
    hostname,
    jellyfinId: jfId,
  });
  // Each actual byte source gets its own session; recommendation metadata must
  // not restart an unchanged video or race a stop against the next start.
  const playSessionId = useMemo(() =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `sess${Date.now()}${Math.random().toString(36).slice(2)}`, [streamUrl]);

  const [audioPreset, setAudioPreset] = useState<AudioPreset>("off");
  const [audioError, setAudioError] = useState<string | null>(null);
  const [showSound, setShowSound] = useState(false);
  const [playbackError, setPlaybackError] = useState<"unsupported" | null>(null);
  const [playbackSessionError, setPlaybackSessionError] = useState<string | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const restoredSource = useRef<string | null>(null);
  const lastPrivateSave = useRef(0);
  const privateSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playbackScopeRef = useRef<PlaybackScope | null>(null);
  const boosterRef = useRef<AudioController | null>(null);
  const unsubscribeAudio = useRef<(() => void) | null>(null);
  const audioRevision = useRef(0);
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showStallPrompt, setShowStallPrompt] = useState(false);
  const [familyFrame, setFamilyFrame] = useState<FamilyTreatmentFrame>(() => familyTreatmentFrame(null, 0));
  const familyMuteRestore = useRef<boolean | null>(null);

  const savePrivatePosition = (force = false) => {
    const video = videoRef.current;
    if (!video || video.seeking || !Number.isFinite(video.duration) || video.duration <= 0 ||
        !mediaSourcesData?.activeProfileId || !mediaSourcesData.progressTitleId ||
        restoredSource.current !== streamUrl) return;
    if (!force && Date.now() - lastPrivateSave.current < 5000) return;
    lastPrivateSave.current = Date.now();
    const body = {
      expectedProfileId: mediaSourcesData.activeProfileId,
      titleId: mediaSourcesData.progressTitleId,
      progress: Math.max(0, Math.min(1, video.currentTime / video.duration)),
    };
    privateSaveQueue.current = privateSaveQueue.current.catch(() => {}).then(() =>
      savePrivatePlaybackProgress(body),
    ).then(() => setProgressError(null)).catch(() =>
      setProgressError("Your playback position has not been saved. Pause to retry."),
    );
  };

  const restorePrivatePosition = () => {
    const video = videoRef.current;
    if (!video || !mediaSourcesData || !Number.isFinite(video.duration) || video.duration <= 0 || restoredSource.current === streamUrl) return;
    restoredSource.current = streamUrl;
    const fraction = mediaSourcesData.resumeProgress ?? 0;
    if (fraction > 0 && fraction < 0.99) video.currentTime = fraction * video.duration;
  };
  useEffect(() => { restorePrivatePosition(); }, [mediaSourcesData, streamUrl]);

  // Subtitle state
  const jfOrigin = jellyfinWatchOrigin({ ipv4, tailscaleIp, watch, hostname });
  const [selectedSubIndex, setSelectedSubIndex] = useState<number | -1>(-1);
  const [subSyncOffsetMs, setSubSyncOffsetMs] = useState<number>(0);
  const availableSubtitles: any[] = Array.isArray(currentSource?.subtitles) ? currentSource.subtitles : [];

  const cycleSubtitles = () => {
    if (!availableSubtitles.length) return;
    if (selectedSubIndex === -1) {
      const first = availableSubtitles[0];
      setSelectedSubIndex(first?.index ?? 0);
      showToast(`Subtitles: ${first?.label || "On"}`, "info");
    } else {
      const currentIdx = availableSubtitles.findIndex((s) => s.index === selectedSubIndex);
      if (currentIdx >= availableSubtitles.length - 1) {
        setSelectedSubIndex(-1);
        showToast("Subtitles: Off", "info");
      } else {
        const next = availableSubtitles[currentIdx + 1];
        setSelectedSubIndex(next?.index ?? -1);
        showToast(`Subtitles: ${next?.label || "On"}`, "info");
      }
    }
  };

  const activeSubLabel =
    selectedSubIndex === -1
      ? "Subs Off"
      : availableSubtitles.find((s) => s.index === selectedSubIndex)?.label || "Subs On";

  useEffect(() => {
    if (!videoRef.current) return;
    synchronizePlaybackSubtitles(videoRef.current, familyFrame.hideSubtitles || selectedSubIndex < 0 ? null : selectedSubIndex, subSyncOffsetMs);
  }, [selectedSubIndex, availableSubtitles, subSyncOffsetMs, familyFrame.hideSubtitles]);

  const handleKeepInLibrary = async (keep = true) => {
    const saved = await retention.save(keep);
    if (!saved) return;
    setRetentionDecisionMade(true);
    setShowRetentionCard(false);
    showToast(keep ? "Kept in your library." : "Library pin removed. The file was not deleted.", "success");
  };

  // Retention: Just browsing casual stream
  const handleJustBrowsing = () => {
    setRetentionDecisionMade(true);
    setShowRetentionCard(false);
    showToast("Keep watching. No files were deleted.", "info");
  };

  // Intro skipper state
  const [introData, setIntroData] = useState<{ hasIntro: boolean; introStart: number; introEnd: number } | null>(null);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const introFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const introShownRef = useRef(false);

  // Up next state
  const [showRatingPill, setShowRatingPill] = useState(false);
  const [ratingDismissed, setRatingDismissed] = useState(false);
  const prewarmedRef = useRef(false);

  const [ratingSaving, setRatingSaving] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [savedReaction, setSavedReaction] = useState<string | null>(null);
  const handleRate = async (rating: "like" | "love" | "cozy" | "less" | null) => {
    if (ratingSaving) return;
    setRatingSaving(true);
    try {
      if (!mediaSourcesData?.activeProfileId || !mediaSourcesData.progressTitleId) throw new Error("Profile unavailable");
      await savePrivateTitleReaction({
        expectedProfileId: mediaSourcesData.activeProfileId,
        titleId: mediaSourcesData.progressTitleId,
        reaction: rating,
      });
      setSavedReaction(rating);
      setRatingError(null);
      showToast(rating ? "Saved to your taste." : "Reaction cleared.", "success");
    } catch {
      setRatingError("Your reaction was not saved. Please try again.");
    } finally {
      setRatingSaving(false);
    }
  };

  const [showSubSyncPanel, setShowSubSyncPanel] = useState<boolean>(false);
  const [showRecapModal, setShowRecapModal] = useState<boolean>(false);
  const [recapData, setRecapData] = useState<{ storySoFar: string[]; whyAreTheyHere?: string } | null>(null);

  const applySubtitleOffset = (offsetMs: number) => {
    setSubSyncOffsetMs(Number.isFinite(offsetMs) ? Math.max(-2000, Math.min(2000, offsetMs)) : 0);
  };

  const handleAutoSyncSubtitles = async () => {
    showToast("Automatic timing needs a measured dialogue track for this edition. You can adjust timing manually.", "info");
  };

  const markPriorEpisodesWatched = async (targetEpisodeNumber: number) => {
    const priorEpisodes = seasonEpisodes.filter((e) => (e.episodeNumber || 0) < targetEpisodeNumber);
    if (!priorEpisodes.length) {
      showToast("No prior episodes in this season", "info");
      return;
    }
    try {
      for (const ep of priorEpisodes) {
        if (ep.jellyfinId) {
          fetch(`/api/library/progress`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: ep.jellyfinId,
              played: true,
              playedPercentage: 100,
            }),
          }).catch(() => {});
        }
      }
      showToast(`Marked ${priorEpisodes.length} prior episodes watched`, "success");
    } catch {
      showToast("Failed to update progress", "error");
    }
  };

  const openRecap = async () => {
    setRecapData({
      storySoFar: [],
      whyAreTheyHere: "A recap limited to your current position is not available for this edition yet. No later plot details are shown.",
    });
    setShowRecapModal(true);
  };

  const [upNextPrompt, setUpNextPrompt] = useState(false);
  const [upNextCount, setUpNextCount] = useState(5);
  const upNextTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Playback-target launcher state
  const [showLauncher, setShowLauncher] = useState(false);

  const currentEpIndex = activeEpisode
    ? seasonEpisodes.findIndex((e) => e.episodeNumber === activeEpisode)
    : -1;
  const prevEpisode = currentEpIndex > 0 ? seasonEpisodes[currentEpIndex - 1] : null;
  const nextEpisode =
    currentEpIndex >= 0 && currentEpIndex < seasonEpisodes.length - 1
      ? seasonEpisodes[currentEpIndex + 1]
      : null;

  const goToEpisode = (ep: any) => {
    if (!ep) return;
    prewarmedRef.current = false;
    setUpNextPrompt(false);
    if (upNextTimerRef.current) clearInterval(upNextTimerRef.current);
    setPlaybackError(null);
    setSourcesLoading(true);
    setMediaSourcesData(null);
    setActiveSourceId(null);
    void navigate({
      to: "/play/$id",
      params: { id },
      search: {
        season: activeSeason,
        episode: ep.episodeNumber,
        mediaId: ep.jellyfinId,
      },
    });
  };

  const handleWaiting = () => {
    if (!bufferTimerRef.current) {
      bufferTimerRef.current = setTimeout(() => {
        setShowStallPrompt(true);
      }, 3500);
    }
  };

  const handlePlaying = (event: SyntheticEvent<HTMLVideoElement>) => {
    setShowStallPrompt(false);
    if (bufferTimerRef.current) {
      clearTimeout(bufferTimerRef.current);
      bufferTimerRef.current = null;
    }
    const scope = playbackScopeRef.current;
    if (scope && !scope.cancelled && event.currentTarget === videoRef.current) {
      void startPlaybackSession(scope);
    }
  };

  function handleVideoEnded() {
    if (!shelf && !retentionDecisionMade) {
      setShowRetentionCard(true);
    }
    if (!ratingDismissed) {
      setShowRatingPill(true);
    }
    if (nextEpisode) {
      setUpNextPrompt(true);
      setUpNextCount(5);
      if (upNextTimerRef.current) clearInterval(upNextTimerRef.current);
      upNextTimerRef.current = setInterval(() => {
        setUpNextCount((prev) => {
          if (prev <= 1) {
            if (upNextTimerRef.current) clearInterval(upNextTimerRef.current);
            goToEpisode(nextEpisode);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }

  // Ambient inactivity state
  const [idle, setIdle] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleActivity = () => {
      setIdle(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setIdle(true), 3500);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      handleActivity();
      if (e.key === "Escape") {
        setShowSound(false);
        setShowRatingPill(false);
        setShowSubSyncPanel(false);
        setShowRecapModal(false);
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target && (target.closest("button, a, input, textarea, select, video, [role=dialog]") || target.isContentEditable)) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (videoRef.current) {
          if (videoRef.current.paused) {
            void videoRef.current.play().catch((error: unknown) => {
              // A subsequent pause/source change may cancel an in-flight play.
              if (!(error instanceof DOMException && error.name === "AbortError")) setPlaybackError("unsupported");
            });
          } else {
            videoRef.current.pause();
            showToast("Paused", "info");
          }
        }
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
          showToast("-10s", "info");
        }
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.currentTime = Math.min(videoRef.current.duration || Infinity, videoRef.current.currentTime + 10);
          showToast("+10s", "info");
        }
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        if (!document.fullscreenElement) {
          if (videoRef.current?.requestFullscreen) {
            void videoRef.current.requestFullscreen();
          } else if (document.documentElement.requestFullscreen) {
            void document.documentElement.requestFullscreen();
          }
        } else {
          void document.exitFullscreen?.();
        }
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.muted = !videoRef.current.muted;
          showToast(videoRef.current.muted ? "Muted" : "Unmuted", "info");
        }
      }
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    window.addEventListener("keydown", handleKeyDown);
    idleTimerRef.current = setTimeout(() => setIdle(true), 3500);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      window.removeEventListener("keydown", handleKeyDown);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  const targetMediaId = jfId || title?.id || id;

  useEffect(() => {
    if (!targetMediaId) {
      setSourcesLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setSourcesLoading(true);
    setMediaSourcesData(null);
    setSourceError(null);

    const timeoutTimer = setTimeout(() => controller.abort(), 10000);

    fetch(`/api/media/${encodeURIComponent(targetMediaId)}/intro-timestamps`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.hasIntro && data.introEnd > data.introStart) {
          setIntroData({
            hasIntro: true,
            introStart: data.introStart,
            introEnd: data.introEnd,
          });
        }
      })
      .catch(() => {
        /* ignore intro lookup failure */
      });

    fetch(`/api/media/${encodeURIComponent(targetMediaId)}/sources`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Source details unavailable");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setSourcesLoading(false);
        if (!data?.ok || !data.activeProfileId || data.activeProfileId !== activeProfileId || !data.progressTitleId) {
          setSourceError("This home could not verify your source and playback position. Please try again.");
          return;
        }
        setMediaSourcesData({ ...data, retentionSourceId: targetMediaId });
        setSavedReaction(["like", "love", "cozy", "less"].includes(data.reaction) ? data.reaction : null);
        if (data.title && typeof data.title.id === "string" && typeof data.title.title === "string") {
          verifiedTitleLoaded.current = true;
          setFetchedTitle(data.title);
        }
        if (data.jellyfinId) {
          setResolvedMediaId(data.jellyfinId);
        }
        if (data.recommendedForBrowser) {
          setActiveSourceId(data.recommendedForBrowser.id);
        }
      })
      .catch(() => {
        if (active) {
          setSourcesLoading(false);
          setSourceError("This home could not verify your source and playback position. Please try again.");
        }
      }).finally(() => clearTimeout(timeoutTimer));

    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeoutTimer);
    };
  }, [targetMediaId, sourceAttempt, activeProfileId]);

  // Registration is requested before the first audible/rendered frame. A family
  // session therefore cannot begin until the server returns an exact-edition
  // verified treatment manifest (or confirms no child treatment is required).
  useEffect(() => {
    if (!targetMediaId) return;
    const currentJfId = jfId || targetMediaId;
    const currentMsId = currentJfId;
    const scope: PlaybackScope = {
      body: { itemId: currentJfId, mediaSourceId: currentMsId, playSessionId },
      controller: new AbortController(),
      cancelled: false,
      registered: false,
    };
    playbackScopeRef.current = scope;
    setPlaybackSessionError(null);

    const sendHeartbeat = () => {
      void sendPlaybackProgress(scope);
    };
    const interval = window.setInterval(sendHeartbeat, 10000);

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      scope.cancelled = true;
      // A start already accepted by the server still needs a matching stop.
      // Let its acknowledgement settle; aborting cannot undo that server write.
      if (scope.starting) void scope.starting.finally(() => scope.controller.abort());
      else scope.controller.abort();
      clearInterval(interval);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      if (playbackScopeRef.current === scope) playbackScopeRef.current = null;
      if (scope.registered) void postPlaybackSession("stop", { ...scope.body, ...scope.lastPosition }).catch(() => undefined);
    };
  }, [targetMediaId, jfId, playSessionId]);

  function scopeIsCurrent(scope: PlaybackScope) {
    return playbackScopeRef.current === scope && !scope.cancelled;
  }

  async function startPlaybackSession(scope: PlaybackScope): Promise<boolean> {
    if (!scopeIsCurrent(scope)) return false;
    if (scope.registered) return true;
    if (scope.starting) return scope.starting;
    const starting = (async () => {
      try {
        const result = await postPlaybackSession("start", scope.body, scope.controller.signal);
        if (!scopeIsCurrent(scope)) {
          if (result.ok) void postPlaybackSession("stop", { ...scope.body, ...scope.lastPosition }).catch(() => undefined);
          return false;
        }
        if (!result.ok) {
          setPlaybackSessionError(playbackSessionFailureMessage(result));
          return false;
        }
        scope.registered = true;
        scope.presenceKey = result.presenceKey;
        scope.familyTreatment = result.familyTreatment;
        setPlaybackSessionError(null);
        const video = videoRef.current;
        if (video) {
          void publishPlayerCompanionSession({
            sessionId: playSessionId,
            titleId: id,
            titleName: title?.title || "Personal media",
            seriesName: isSeries ? title?.title || null : null,
            seasonNumber: activeSeason,
            episodeNumber: activeEpisode,
            ...playerCompanionTiming(video),
          }).catch(() => undefined);
        }
        return true;
      } catch (error) {
        if (scopeIsCurrent(scope) && !(error instanceof DOMException && error.name === "AbortError")) {
          setPlaybackSessionError("Playback controls could not connect to this home. Please try again.");
        }
        return false;
      } finally {
        if (scopeIsCurrent(scope)) scope.starting = undefined;
      }
    })();
    scope.starting = starting;
    return starting;
  }

  async function sendPlaybackProgress(scope: PlaybackScope, retried = false): Promise<void> {
    if (!scopeIsCurrent(scope) || !scope.registered || !videoRef.current) return;
    const video = videoRef.current;
    const body: PlaybackSessionBody = {
      ...scope.body,
      ...playbackPosition(video),
    };
    try {
      const result = await postPlaybackSession("progress", body, scope.controller.signal);
      if (!scopeIsCurrent(scope)) return;
      if (result.ok) return;
      if (!retried && playbackSessionNeedsRestart(result)) {
        scope.registered = false;
        if (await startPlaybackSession(scope)) await sendPlaybackProgress(scope, true);
        return;
      }
      setPlaybackSessionError(playbackSessionFailureMessage(result));
    } catch (error) {
      if (scopeIsCurrent(scope) && !(error instanceof DOMException && error.name === "AbortError")) {
        setPlaybackSessionError("Playback controls could not connect to this home. Please try again.");
      }
    }
  }

  useEffect(() => {
    setAudioPreset("off");
    setAudioError(null);
    return () => {
      audioRevision.current += 1;
      unsubscribeAudio.current?.();
      unsubscribeAudio.current = null;
      boosterRef.current?.destroy();
      boosterRef.current = null;
    };
  }, [streamUrl, sourcesLoading]);

  useEffect(() => {
    return () => {
      if (introFadeTimerRef.current) {
        clearTimeout(introFadeTimerRef.current);
      }
    };
  }, []);

  async function changeAudioPreset(next: AudioPreset) {
    const video = videoRef.current;
    if (!video) return;
    if (!boosterRef.current) {
      const controller = attachAudioBooster(video);
      boosterRef.current = controller;
      unsubscribeAudio.current = controller.subscribe((status) => {
        setAudioPreset(status.preset);
        setAudioError(status.error);
      });
    }
    const controller = boosterRef.current;
    const revision = ++audioRevision.current;
    const applied = await controller.setPreset(next);
    if (revision !== audioRevision.current) return;
    if (!applied) setAudioError(controller.getStatus().error || "Audio processing is unavailable in this browser. Original audio remains selected.");
  }

  function handleTimeUpdate() {
    if (!videoRef.current) return;
    if (playbackScopeRef.current) playbackScopeRef.current.lastPosition = playbackPosition(videoRef.current);
    savePrivatePosition();
    const current = videoRef.current.currentTime;
    const duration = videoRef.current.duration;
    const treatment = familyTreatmentFrame(playbackScopeRef.current?.familyTreatment ?? null, current);
    if (treatment.skipToSeconds !== null && treatment.skipToSeconds > current) {
      videoRef.current.currentTime = treatment.skipToSeconds;
    }
    if (treatment.muteAudio && familyMuteRestore.current === null) {
      familyMuteRestore.current = videoRef.current.muted;
      videoRef.current.muted = true;
    } else if (treatment.muteAudio && !videoRef.current.muted) {
      videoRef.current.muted = true;
    } else if (!treatment.muteAudio && familyMuteRestore.current !== null) {
      videoRef.current.muted = familyMuteRestore.current;
      familyMuteRestore.current = null;
    }
    setFamilyFrame(treatment);

    if (duration > 0 && current / duration >= 0.8 && !shelf && !retentionDecisionMade && !showRetentionCard) {
      setShowRetentionCard(true);
    }

    if (duration > 0 && current / duration > 0.9 && !ratingDismissed && !showRatingPill) {
      setShowRatingPill(true);
    }

    // Zero-Latency Mind-Reading Pre-Fetch: pre-warm next episode when progress > 85% or remaining < 120s
    if (nextEpisode && !prewarmedRef.current && duration > 0) {
      const remainingSec = duration - current;
      if (current / duration > 0.85 || remainingSec < 120) {
        prewarmedRef.current = true;
        fetch("/api/playback/prewarm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            showId: id,
            nextEpisodeNumber: nextEpisode.episodeNumber,
            nextMediaId: nextEpisode.jellyfinId,
            currentMediaId: targetMediaId,
          }),
        }).catch(() => {});
      }
    }
    
    if (!introData?.hasIntro) return;
    const inRange = current >= introData.introStart && current < introData.introEnd;

    if (inRange) {
      if (!introShownRef.current) {
        introShownRef.current = true;
        setShowSkipIntro(true);
        if (introFadeTimerRef.current) clearTimeout(introFadeTimerRef.current);
        introFadeTimerRef.current = setTimeout(() => {
          setShowSkipIntro(false);
        }, 10000);
      }
    } else {
      if (current < introData.introStart) {
        introShownRef.current = false;
      }
      if (showSkipIntro) {
        setShowSkipIntro(false);
        if (introFadeTimerRef.current) clearTimeout(introFadeTimerRef.current);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const publish = async () => {
      const video = videoRef.current;
      const scope = playbackScopeRef.current;
      if (!video || !scope?.registered) return;
      await publishPlayerCompanionSession({
        sessionId: playSessionId,
        titleId: id,
        titleName: title?.title || "Personal media",
        seriesName: isSeries ? title?.title || null : null,
        seasonNumber: activeSeason,
        episodeNumber: activeEpisode,
        ...playerCompanionTiming(video),
      });
    };
    const poll = async () => {
      const video = videoRef.current;
      const scope = playbackScopeRef.current;
      if (!video || !scope?.registered) return;
      try {
        const commands = await pollPlayerCompanionCommands(playSessionId, controller.signal);
        for (const command of commands) await consumePlayerCompanionCommand(video, command);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          // A temporarily disconnected remote must not interrupt local playback.
        }
      }
    };
    const publishTimer = window.setInterval(() => void publish().catch(() => undefined), 5_000);
    const pollTimer = window.setInterval(() => void poll(), 1_500);
    return () => {
      controller.abort();
      clearInterval(publishTimer);
      clearInterval(pollTimer);
      if (playbackScopeRef.current?.registered) void stopPlayerCompanionSession(playSessionId).catch(() => undefined);
      const video = videoRef.current;
      if (video && familyMuteRestore.current !== null) video.muted = familyMuteRestore.current;
      familyMuteRestore.current = null;
    };
  }, [playSessionId, id, title?.title, isSeries, activeSeason, activeEpisode]);

  function handleSkipIntro() {
    if (videoRef.current && introData) {
      videoRef.current.currentTime = introData.introEnd;
      setShowSkipIntro(false);
      if (introFadeTimerRef.current) clearTimeout(introFadeTimerRef.current);
    }
  }

  if (!title) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6">
        <p className="text-muted">Not in the library.</p>
        <Link to="/" className="mt-4 text-gold">
          Home
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("relative flex h-dvh max-h-dvh w-full flex-col bg-black text-foreground overflow-hidden select-none", idle && !showSound && !showRatingPill && !showLibraryKeeping && "cursor-none")}>
      <header
        className={cn(
          "absolute top-0 inset-x-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-black/70 px-3 sm:px-4 backdrop-blur-md transition-all duration-300",
          idle && !showSound && !showRatingPill && !showLibraryKeeping ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 mr-2">
          <Link
            to="/title/$id"
            params={{ id: title.id }}
            onClick={() => savePrivatePosition(true)}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs text-muted hover:bg-white/10 hover:text-foreground shrink-0"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Details</span>
          </Link>
          <div className="min-w-0 flex-1 truncate">
            <h1 className="truncate text-xs sm:text-sm font-semibold text-foreground">
              {title.title}
              {activeSeason && activeEpisode ? ` · S${activeSeason}E${activeEpisode}` : ""}
              {activeEpisodeTitle ? ` — ${activeEpisodeTitle}` : ""}
            </h1>
            {title.year ? <span className="text-[10px] sm:text-xs text-muted">{title.year}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {prevEpisode ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 sm:h-9 px-2 text-xs text-muted hover:text-gold transition-colors"
              onClick={() => goToEpisode(prevEpisode)}
              title={`Previous: E${prevEpisode.episodeNumber} ${prevEpisode.title}`}
            >
              <ChevronLeft className="size-3.5" />
              <span className="hidden md:inline ml-0.5">Prev</span>
            </Button>
          ) : null}
          {nextEpisode ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 sm:h-9 px-2 text-xs text-muted hover:text-gold transition-colors"
              onClick={() => goToEpisode(nextEpisode)}
              title={`Next: E${nextEpisode.episodeNumber} ${nextEpisode.title}`}
            >
              <span className="hidden md:inline mr-0.5">Next</span>
              <ChevronRight className="size-3.5" />
            </Button>
          ) : null}

          <Button
              size="sm"
              variant="quiet"
              className={cn(
                "min-h-12 min-w-12 gap-1 text-xs border transition-colors px-2 sm:px-3",
                audioPreset !== "off"
                  ? "border-amber-400/80 bg-amber-400/15 text-amber-300 font-medium"
                  : "border-border/60 text-muted hover:text-foreground"
              )}
              onClick={() => setShowSound((open) => !open)}
              aria-label="Sound"
              aria-expanded={showSound}
              disabled={sourcesLoading || !!sourceError}
            >
              <Volume2 className={cn("size-3.5", audioPreset === "nightMode" ? "text-amber-300" : "text-muted")} />
              <span className="hidden sm:inline">Sound</span>
            </Button>
          <Button variant="quiet" className="min-h-12 px-3 text-xs" aria-label="Rate this title" onClick={() => setShowRatingPill((open) => !open)} disabled={sourcesLoading || !!sourceError}>Your taste</Button>
          <Button variant="quiet" className="min-h-12 min-w-12 px-3 text-xs" aria-label="Library keeping" aria-expanded={showLibraryKeeping} onClick={() => setShowLibraryKeeping((open) => !open)}>Library</Button>
          {availableSubtitles.length > 0 ? (
            <Button
              size="sm"
              variant="quiet"
              className={cn(
                "h-8 sm:h-9 gap-1 text-xs border transition-colors px-2 sm:px-3",
                subSyncOffsetMs !== 0 || showSubSyncPanel
                  ? "border-gold bg-gold/15 text-gold font-medium"
                  : "border-border/60 text-muted hover:text-foreground"
              )}
              onClick={() => setShowSubSyncPanel((prev) => !prev)}
              title="Subtitle Sync Tuning"
            >
              <Sliders className="size-3.5" />
              <span className="hidden sm:inline">
                Sync {subSyncOffsetMs !== 0 ? `(${subSyncOffsetMs > 0 ? "+" : ""}${subSyncOffsetMs}ms)` : ""}
              </span>
            </Button>
          ) : null}
          {availableSubtitles.length > 0 ? (
            <Button
              size="sm"
              variant="quiet"
              className={cn(
                "h-8 sm:h-9 gap-1 text-xs border transition-colors px-2 sm:px-3",
                selectedSubIndex !== -1
                  ? "border-gold bg-gold/15 text-gold font-medium"
                  : "border-border/60 text-muted hover:text-foreground"
              )}
              onClick={cycleSubtitles}
              title={`Subtitles: ${activeSubLabel} (Click to cycle)`}
            >
              <Subtitles className={cn("size-3.5", selectedSubIndex !== -1 ? "text-gold" : "text-muted")} />
              <span className="hidden sm:inline">{activeSubLabel}</span>
            </Button>
          ) : null}
          {isSeries && activeEpisode && activeEpisode > 1 ? (
            <Button
              size="sm"
              variant="quiet"
              className="h-8 sm:h-9 gap-1 text-xs border border-white/10 text-muted hover:text-foreground transition-colors px-2 sm:px-3"
              onClick={() => markPriorEpisodesWatched(activeEpisode)}
              title="Mark prior episodes watched"
            >
              <Check className="size-3 text-gold" />
              <span className="hidden sm:inline">Mark Prior Watched</span>
            </Button>
          ) : null}
          {isSeries ? (
            <Button
              size="sm"
              variant="quiet"
              className="h-8 sm:h-9 gap-1 text-xs border border-white/10 text-muted hover:text-gold transition-colors px-2 sm:px-3"
              onClick={openRecap}
              title="The Story So Far (Catch-up recap)"
            >
              <Clock className="size-3.5 text-gold" />
              <span className="hidden sm:inline">Recap</span>
            </Button>
          ) : null}
          {mediaSourcesData?.hasMultipleVersions ? (
            <span
              className="hidden sm:inline-flex h-8 items-center rounded-lg border border-white/10 bg-white/5 px-2 text-[11px] font-mono text-muted"
              title="Your home selects the verified playable version."
            >
              Verified source
            </span>
          ) : currentSource?.quality === "4k" || currentSource?.quality === "1080p" ? (
            <span className="hidden sm:inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-muted">
              {currentSource.quality === "4k" ? "4K source" : "1080p source"}
            </span>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 sm:h-9 gap-1 text-xs text-gold border border-gold/30 bg-gold/10 hover:bg-gold/20 transition-colors px-2 sm:px-3"
            onClick={() => setShowLauncher(true)}
            title="Cast to Living Room TV or switch player"
          >
            <Tv className="size-3.5" />
            <span className="hidden sm:inline">Cast</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 sm:h-9 gap-1 text-xs text-foreground border border-white/15 bg-white/5 hover:bg-white/10 transition-colors px-2 sm:px-3"
            onClick={() => setShowCompanionQr(true)}
            title="Living Room Companion Screen (Phone Second Screen)"
          >
            <Smartphone className="size-3.5 text-gold" />
            <span className="hidden sm:inline">Companion</span>
          </Button>

        </div>
      </header>

      {showLibraryKeeping ? (
        <section aria-label="Library keeping" className="absolute top-16 right-3 left-3 sm:left-auto sm:w-80 z-50 space-y-3 rounded-2xl border border-white/20 bg-zinc-950/95 p-4 text-sm shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Keep this local file</h2>
            <button type="button" aria-label="Close library keeping" className="min-h-12 min-w-12 rounded-xl hover:bg-white/10 focus-visible:outline focus-visible:outline-2" onClick={() => setShowLibraryKeeping(false)}><X className="mx-auto size-4" /></button>
          </div>
          <p className="text-xs text-muted">Only a verified local original can be kept. Removing your pin does not delete the file.</p>
          <p role="status">{retention.loading ? "Checking your library…" : retention.saving ? "Saving your library choice…" : savedToLibrary ? "Kept in your library" : retention.snapshot ? "Not kept in your library" : "Local file not verified"}</p>
          {retention.error ? <p role="alert" className="text-amber-200">{retention.error}</p> : null}
          <Button className="min-h-12 w-full" disabled={!retention.snapshot || retention.loading || retention.saving} onClick={() => void handleKeepInLibrary(!savedToLibrary)}>{savedToLibrary ? "Stop keeping in your library" : "Keep in your library"}</Button>
          {retention.error ? <Button variant="quiet" className="min-h-12 w-full" disabled={!retention.canCheck || retention.loading || retention.saving} onClick={retention.retry}>Retry library status</Button> : null}
        </section>
      ) : null}

      <main tabIndex={-1} aria-label="Playback" className="relative flex-1 w-full h-full min-h-0 flex items-center justify-center bg-black overflow-hidden">
        {sourceError ? (
          <div role="alert" className="max-w-md space-y-4 px-6 text-center">
            <p>{sourceError}</p>
            <Button className="min-h-12" onClick={() => setSourceAttempt((attempt) => attempt + 1)}>Retry source</Button>
            <Link to="/" className="block min-h-12 py-3">Back to Home</Link>
          </div>
        ) : sourcesLoading && !mediaSourcesData ? (
          <div className="flex size-full min-h-[50vh] flex-col items-center justify-center gap-3 text-muted">
            <div className="size-8 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
            <p className="text-xs font-mono tracking-wide text-foreground/80">Selecting stream...</p>
          </div>
        ) : streamUrl ? (
          <>
            <video
              key={streamUrl}
              ref={videoRef}
              src={streamUrl}
              controls
              autoPlay
              playsInline
              {...({ "x-webkit-airplay": "allow" } as any)}
              crossOrigin="anonymous"
              onWaiting={handleWaiting}
              onPlay={(event) => {
                const scope = playbackScopeRef.current;
                if (!scope || scope.registered || scope.starting) return;
                event.currentTarget.pause();
                void startPlaybackSession(scope).then((ready) => {
                  if (ready && videoRef.current === event.currentTarget) void event.currentTarget.play().catch(() => setPlaybackError("unsupported"));
                });
              }}
              onPlaying={handlePlaying}
              onLoadedMetadata={restorePrivatePosition}
              onPause={() => {
                savePrivatePosition(true);
                const scope = playbackScopeRef.current;
                if (scope) void sendPlaybackProgress(scope);
              }}
              onSeeked={() => savePrivatePosition(true)}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
              onError={(e) => {
                console.warn("Direct stream playback error:", e);
                setPlaybackError("unsupported");
              }}
              className="max-h-full max-w-full w-full h-full object-contain mx-auto my-auto"
            >
              {availableSubtitles.map((sub: any) => (
                <track
                  key={`${sub.index}-${sub.vttUrl}`}
                  kind="subtitles"
                  src={`${jfOrigin}${sub.vttUrl}`}
                  srcLang={sub.language || "en"}
                  label={sub.label || "English"}
                  data-subtitle-index={sub.index}
                  onLoad={() => {
                    if (videoRef.current) synchronizePlaybackSubtitles(videoRef.current, selectedSubIndex < 0 ? null : selectedSubIndex, subSyncOffsetMs);
                  }}
                  default={sub.isDefault && selectedSubIndex === sub.index}
                />
              ))}
            </video>
            {familyFrame.hideVisual ? <div aria-label="Family visual treatment" className="absolute inset-0 z-20 bg-black" /> : null}
            {familyFrame.subtitleReplacement ? (
              <div aria-live="polite" className="pointer-events-none absolute bottom-20 left-1/2 z-30 max-w-[80%] -translate-x-1/2 rounded-lg bg-black/85 px-4 py-2 text-center text-lg text-white">
                {familyFrame.subtitleReplacement}
              </div>
            ) : null}
            {playbackSessionError || progressError || audioError ? (
              <div
                role="alert"
                className="absolute top-16 left-1/2 z-40 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl border border-rose-400/40 bg-black/90 px-4 py-2 text-center text-xs text-rose-100 shadow-2xl backdrop-blur-md"
              >
                {progressError || playbackSessionError || audioError}
              </div>
            ) : null}
            {showStallPrompt ? (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl bg-black/85 border border-gold/40 px-4 py-2 text-xs text-gold shadow-2xl backdrop-blur-md animate-in fade-in duration-200 pointer-events-none">
                <LoaderCircle className="size-3.5 animate-spin text-gold" />
                <span>Stream buffering... Your home is keeping this playback on its verified source.</span>
              </div>
            ) : null}
            {playbackError ? (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 p-6 text-center backdrop-blur-md animate-in fade-in duration-200">
                <div className="max-w-md space-y-4 rounded-3xl border border-white/10 bg-card/95 p-6 shadow-2xl">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-gold/15 text-gold border border-gold/30">
                    <Play className="size-6 fill-current" />
                  </div>
                  <h2 className="font-display text-base font-bold text-foreground">
                    This browser could not play this source
                  </h2>
                  <p className="text-xs text-muted leading-relaxed">
                    The file may be unavailable or use an unsupported format. Retry this source or return to browsing.
                  </p>
                  <div className="flex flex-col gap-2 pt-2">
                    <Button
                      variant="ghost"
                      className="w-full border border-gold/30 bg-gold/10 text-xs text-gold hover:bg-gold/20"
                      onClick={() => {
                        setPlaybackError(null);
                        restoredSource.current = null;
                        videoRef.current?.load();
                      }}
                    >
                      Retry playback
                    </Button>
                    <Link to="/" className="min-h-12 py-3">Back to Home</Link>
                  </div>
                </div>
              </div>
            ) : null}

            {/* End-of-Stream Retention Card ("Stream First, Keep When Loved") */}
            {showRetentionCard ? (
              <div className="absolute bottom-28 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-6 duration-300">
                <div className="flex flex-col sm:flex-row items-center gap-4 rounded-3xl border border-gold/40 bg-zinc-950/95 p-5 shadow-2xl backdrop-blur-xl">
                  <div className="text-center sm:text-left">
                    <p className="text-sm font-semibold text-white">Enjoyed this stream?</p>
                    <p className="text-xs text-muted">Keep this local file in your library?</p>
                    {retention.error ? <p role="alert" className="mt-2 text-xs text-amber-200">{retention.error}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {savedToLibrary ? (
                      <span className="inline-flex h-9 items-center gap-1.5 rounded-2xl bg-emerald-500/20 px-4 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                        <Check className="size-3.5" />
                        Kept in your library
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        disabled={savingToLibrary || retention.loading || !retention.snapshot}
                        onClick={() => void handleKeepInLibrary(true)}
                        className="min-h-12 rounded-2xl bg-gold text-black hover:bg-gold/90 font-bold px-4 cursor-pointer"
                      >
                        {savingToLibrary ? <LoaderCircle className="size-3.5 animate-spin mr-1" /> : null}
                        Keep in your library
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleJustBrowsing}
                      className="min-h-12 rounded-2xl text-xs text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
                    >
                      Just Browsing
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {showRatingPill ? (
              <div className="absolute top-20 right-6 sm:top-24 sm:right-8 z-50 flex flex-col gap-3 rounded-2xl border border-white/20 bg-black/75 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-300">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-white">How was {title?.title}?</p>
                  <button
                    onClick={() => {
                      setRatingDismissed(true);
                      setShowRatingPill(false);
                    }}
                    className="text-white/60 hover:text-white transition-colors text-xs px-1.5 py-0.5 rounded-lg hover:bg-white/10"
                    aria-label="Close taste controls"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="flex max-w-[min(28rem,80vw)] flex-wrap items-center gap-2">
                  {([['like', 'Like'], ['love', 'Love'], ['cozy', 'Cozy'], ['less', 'Less like this']] as const).map(([reaction, label]) => (
                    <Button key={reaction} variant="ghost" className="min-h-12 rounded-xl bg-white/10 px-3 text-xs" disabled={ratingSaving} aria-pressed={savedReaction === reaction} onClick={() => void handleRate(savedReaction === reaction ? null : reaction)}>{label}</Button>
                  ))}
                  <Button variant="ghost" className="min-h-12 px-3 text-xs" disabled={ratingSaving} onClick={() => void handleRate(null)}>Clear reaction</Button>
                </div>
                {ratingError ? <p role="alert" className="text-xs text-rose-200">{ratingError}</p> : null}
              </div>
            ) : null}
            {showSound ? (
              <section aria-label="Sound settings" className="absolute right-4 top-16 z-50 w-80 max-w-[calc(100%-2rem)] space-y-3 rounded-2xl border border-white/10 bg-black/95 p-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Sound</span>
                  <button type="button" aria-label="Close sound settings" className="flex min-h-12 min-w-12 items-center justify-center" onClick={() => setShowSound(false)}><X className="size-4" /></button>
                </div>
                {([['off', 'Original'], ['volumeLeveling', 'Volume leveling'], ['dialogueBoost', 'Dialogue focus'], ['nightMode', 'Night listening']] as const).map(([preset, label]) => (
                  <button key={preset} type="button" aria-pressed={audioPreset === preset} onClick={() => void changeAudioPreset(preset)} className={cn("min-h-12 w-full rounded-xl px-4 text-left text-sm", audioPreset === preset ? "bg-white/15" : "hover:bg-white/10")}>{label}</button>
                ))}
                <p className="text-xs leading-relaxed text-white/55">These modes process this browser&apos;s current audio only. If processing cannot start, ReelOS keeps the original audio and says so.{!availableSubtitles.length ? " No subtitle tracks are available for this source." : " Subtitles and timing controls are available above."}</p>
              </section>
            ) : null}
            {showSkipIntro ? (
              <button
                type="button"
                onClick={handleSkipIntro}
                className="absolute bottom-20 right-6 sm:bottom-16 sm:right-8 z-30 flex min-h-[44px] items-center gap-2.5 rounded-full border border-gold/50 bg-card/95 px-5 py-2.5 text-xs sm:text-sm font-bold text-foreground shadow-[var(--shadow-gold)] backdrop-blur-xl transition-all hover:scale-105 hover:bg-card hover:text-gold active:scale-95 focus:outline-none focus:ring-2 focus:ring-gold cursor-pointer"
              >
                <span>Skip Intro</span>
                <span aria-hidden="true" className="text-gold font-bold">→</span>
              </button>
            ) : null}
            {upNextPrompt && nextEpisode ? (
              <div className="absolute bottom-20 right-6 sm:bottom-16 sm:right-8 z-30 flex flex-col gap-2 rounded-2xl border border-gold/40 bg-card/95 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-300">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gold font-mono">
                  Up Next in {upNextCount}s
                </p>
                <p className="text-xs font-semibold text-foreground truncate max-w-[240px]">
                  S{activeSeason}E{nextEpisode.episodeNumber} · {nextEpisode.title}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    className="h-8 text-xs font-bold gap-1 px-3"
                    onClick={() => goToEpisode(nextEpisode)}
                  >
                    <Play className="size-3 fill-current" />
                    <span>Play Now</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-muted"
                    onClick={() => {
                      if (upNextTimerRef.current) clearInterval(upNextTimerRef.current);
                      setUpNextPrompt(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
            {showSubSyncPanel ? (
              <div className="absolute bottom-20 left-6 sm:bottom-16 sm:left-8 z-40 w-72 rounded-2xl border border-gold/40 bg-black/90 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="text-xs font-mono font-bold text-gold uppercase">Subtitle Timing Sync</span>
                  <button
                    type="button"
                    onClick={() => setShowSubSyncPanel(false)}
                    className="text-white/60 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
                <div className="py-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Offset Shift:</span>
                    <span className="font-mono font-bold text-white">
                      {subSyncOffsetMs > 0 ? `+${subSyncOffsetMs}` : subSyncOffsetMs} ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-2000"
                    max="2000"
                    step="50"
                    value={subSyncOffsetMs}
                    onChange={(e) => applySubtitleOffset(parseInt(e.target.value, 10))}
                    className="w-full accent-gold cursor-pointer"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <Button
                      size="sm"
                      variant="quiet"
                      className="h-7 text-[10px] px-2 border border-white/10 text-muted"
                      onClick={() => applySubtitleOffset(subSyncOffsetMs - 100)}
                    >
                      -100ms
                    </Button>
                    <Button
                      size="sm"
                      variant="quiet"
                      className="h-7 text-[10px] px-2 border border-gold/40 text-gold"
                      onClick={() => applySubtitleOffset(0)}
                    >
                      Reset (0ms)
                    </Button>
                    <Button
                      size="sm"
                      variant="quiet"
                      className="h-7 text-[10px] px-2 border border-white/10 text-muted"
                      onClick={() => applySubtitleOffset(subSyncOffsetMs + 100)}
                    >
                      +100ms
                    </Button>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="quiet"
                  className="w-full h-8 gap-1.5 text-xs border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20"
                  onClick={handleAutoSyncSubtitles}
                >
                  <Subtitles className="size-3.5" />
                  <span>Auto-Align with Dialogue</span>
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex size-full flex-col items-center justify-center p-6 text-center">
            <p className="text-sm text-muted">Connecting to media server…</p>
          </div>
        )}
      </main>

      <WatchLauncherModal
        open={showLauncher}
        onClose={() => setShowLauncher(false)}
        title={{
          id: title.id,
          title: title.title,
          year: title.year,
          poster: title.poster,
          kind: title.kind,
          jellyfinId: jfId,
          season: activeSeason,
          episode: activeEpisode,
          episodeTitle: activeEpisodeTitle,
        }}
      />

      {showRecapModal && recapData ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowRecapModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-gold/40 bg-card/95 p-6 shadow-2xl backdrop-blur-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/50 pb-3 text-left">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-gold/15 text-gold border border-gold/30">
                  <Clock className="size-4" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-foreground">The Story So Far</h3>
                  <p className="text-[11px] text-muted font-mono">
                    {title.title} {activeSeason ? `· Season ${activeSeason}` : ""} {activeEpisode ? `· Episode ${activeEpisode}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRecapModal(false)}
                className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {recapData.storySoFar.length > 0 ? <p className="text-xs text-muted">Catch-up</p> : null}
              <ul className="space-y-2 text-xs text-muted leading-relaxed list-disc list-inside">
                {recapData.storySoFar.map((bullet, idx) => (
                  <li key={idx} className="pl-1">
                    <span className="text-foreground/90">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>

            {recapData.whyAreTheyHere ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/90 leading-relaxed">
                {recapData.whyAreTheyHere}
              </div>
            ) : null}

            <Button
              className="w-full h-10 rounded-2xl bg-gold text-black font-bold hover:brightness-110"
              onClick={() => setShowRecapModal(false)}
            >
              Resume Cinema
            </Button>
          </div>
        </div>
      ) : null}

      {showCompanionQr ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowCompanionQr(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-card/95 p-6 shadow-2xl backdrop-blur-2xl text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/50 pb-3 text-left">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-gold/15 text-gold border border-gold/30">
                  <Smartphone className="size-4" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-foreground">Companion Screen</h3>
                  <p className="text-[11px] text-muted">Living room second screen</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCompanionQr(false)}
                className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed text-left">
              Keep your phone on your coffee table. Scan this QR code to view spoiler-free character recaps, &ldquo;Who&rsquo;s Who?&rdquo;, and scene context while watching on TV.
            </p>

            <div className="flex justify-center py-2">
              <div className="rounded-2xl border border-white/10 bg-white p-3 shadow-lg">
                <QrCodeSvg
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/companion?id=${encodeURIComponent(id)}${activeSeason ? `&season=${activeSeason}` : ""}${activeEpisode ? `&episode=${activeEpisode}` : ""}`}
                  size={160}
                  darkColor="#0b0d10"
                  lightColor="#ffffff"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Link
                to="/companion"
                search={{
                  id,
                  season: activeSeason,
                  episode: activeEpisode,
                }}
                target="_blank"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-xs font-bold text-black hover:brightness-110 transition-all"
              >
                <span>Open Companion Screen</span>
                <ExternalLink className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
