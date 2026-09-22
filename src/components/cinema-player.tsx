import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, ArrowLeft, Check, Subtitles, Settings, LoaderCircle } from "lucide-react";
import { useReelStore } from "@/lib/store";
import { showToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMediaRetention } from "@/lib/media-retention-client";
import { useExperienceStore } from "@/experience/experience-state";
import { attachAudioBooster, type AudioController, type AudioPreset } from "@/lib/audio-booster";
import { synchronizePlaybackSubtitles } from "@/lib/playback-subtitles";
import { consumePlayerCompanionCommand, playerCompanionTiming, pollPlayerCompanionCommands, publishPlayerCompanionSession, stopPlayerCompanionSession } from "@/lib/player-companion";

export interface SubtitleTrack {
  id?: string;
  label: string;
  language: string;
  src?: string;
  isDefault?: boolean;
}

export interface AudioTrackOption {
  id: string;
  label: string;
  language: string;
  isDefault?: boolean;
}

export interface CinemaPlayerProps {
  id: string;
  title: string;
  streamUrl: string;
  mediaType?: "movie" | "tv";
  season?: number;
  episode?: number;
  onClose?: () => void;
  subtitles?: SubtitleTrack[];
  audioTracks?: AudioTrackOption[];
}

export function CinemaPlayer({
  id,
  title,
  streamUrl,
  season,
  episode,
  onClose,
  subtitles = [],
  audioTracks = [],
}: CinemaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeProfileId = useExperienceStore((state) => state.activeProfileId);

  const residents = useReelStore((s) => s.residents);
  const activeResidentId = useReelStore((s) => s.activeResidentId);
  const activeResident = useMemo(() => {
    return residents.find((r) => r.id === activeResidentId) || residents[0];
  }, [residents, activeResidentId]);

  const residentPref = activeResident?.audioLanguagePreference || "sub";

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSound, setShowSound] = useState(false);
  const [audioPreset, setAudioPreset] = useState<AudioPreset>("off");
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioController = useRef<AudioController | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sub/Dub state
  const [activeAudioMode, setActiveAudioMode] = useState<"sub" | "dub" | "original">(residentPref);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>("");
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState<string>("");

  // End-of-Stream Retention state
  const [showRetentionCard, setShowRetentionCard] = useState(false);
  const [retentionDecisionMade, setRetentionDecisionMade] = useState(false);
  const [showLibraryKeeping, setShowLibraryKeeping] = useState(false);
  const retentionScope = JSON.stringify([id, streamUrl, season, episode, activeProfileId]);
  const retention = useMediaRetention(id || null, activeProfileId || null, retentionScope,
    () => useExperienceStore.getState().activeProfileId === activeProfileId);
  const savedToLibrary = retention.snapshot?.kept === true;
  const savingToLibrary = retention.saving;
  useEffect(() => {
    setShowRetentionCard(false);
    setRetentionDecisionMade(false);
    setShowLibraryKeeping(false);
  }, [retentionScope]);

  // Auto-select audio and subtitle tracks based on resident preference
  useEffect(() => {
    if (activeAudioMode === "dub") {
      // Dubbed mode: English audio, no subtitles
      const engAudio = audioTracks.find(
        (t) =>
          t.language.toLowerCase().startsWith("en") ||
          t.label.toLowerCase().includes("dub") ||
          t.label.toLowerCase().includes("english")
      );
      if (engAudio) {
        setSelectedAudioTrack(engAudio.id);
      }
      setSelectedSubtitleTrack("off");
    } else if (activeAudioMode === "sub") {
      // Subbed mode: Japanese/Original audio, English subtitles
      const subAudio = audioTracks.find(
        (t) =>
          t.language.toLowerCase().startsWith("ja") ||
          t.language.toLowerCase().startsWith("jp") ||
          t.label.toLowerCase().includes("japanese") ||
          t.label.toLowerCase().includes("original")
      );
      if (subAudio) {
        setSelectedAudioTrack(subAudio.id);
      } else if (audioTracks[0]) {
        setSelectedAudioTrack(audioTracks[0].id);
      }

      const engSub = subtitles.find(
        (s) =>
          s.language.toLowerCase().startsWith("en") ||
          s.label.toLowerCase().includes("english")
      );
      if (engSub) {
        setSelectedSubtitleTrack(engSub.id || String(subtitles.indexOf(engSub)));
      } else if (subtitles[0]) {
        setSelectedSubtitleTrack(subtitles[0].id || "0");
      }
    } else {
      // Original mode
      if (audioTracks[0]) setSelectedAudioTrack(audioTracks[0].id);
      setSelectedSubtitleTrack("off");
    }
  }, [activeAudioMode, audioTracks, subtitles]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    synchronizePlaybackSubtitles(video, selectedSubtitleTrack === "off" ? null : selectedSubtitleTrack);
  }, [selectedSubtitleTrack, subtitles]);

  useEffect(() => () => {
    audioController.current?.destroy();
    audioController.current = null;
  }, [streamUrl]);

  const changeAudioPreset = async (preset: AudioPreset) => {
    const video = videoRef.current;
    if (!video) return;
    audioController.current ??= attachAudioBooster(video);
    const applied = await audioController.current.setPreset(preset);
    const status = audioController.current.getStatus();
    setAudioPreset(status.preset);
    setAudioError(applied ? null : status.error || "Audio processing is unavailable here. Original audio remains selected.");
  };

  const companionSessionId = useMemo(() => `cinema-${id}-${Math.random().toString(36).slice(2)}`, [id, streamUrl]);
  useEffect(() => {
    const controller = new AbortController();
    const publish = async () => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      await publishPlayerCompanionSession({
        sessionId: companionSessionId, titleId: id, titleName: title,
        seasonNumber: season, episodeNumber: episode, ...playerCompanionTiming(video),
      });
    };
    const poll = async () => {
      if (!videoRef.current || videoRef.current.paused && videoRef.current.currentTime === 0) return;
      try {
        const commands = await pollPlayerCompanionCommands(companionSessionId, controller.signal);
        for (const command of commands) await consumePlayerCompanionCommand(videoRef.current, command);
      } catch { /* local playback continues if the remote disconnects */ }
    };
    const publishTimer = window.setInterval(() => void publish().catch(() => undefined), 5_000);
    const pollTimer = window.setInterval(() => void poll(), 1_500);
    return () => {
      controller.abort(); clearInterval(publishTimer); clearInterval(pollTimer);
      void stopPlayerCompanionSession(companionSessionId).catch(() => undefined);
    };
  }, [companionSessionId, id, title, season, episode]);

  // Handle video progress and End-of-Stream Retention (>80% completion)
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration;
    setCurrentTime(cur);
    if (dur > 0) {
      setDuration(dur);
      const completionRatio = cur / dur;
      if (completionRatio >= 0.8 && !retentionDecisionMade && !showRetentionCard) {
        setShowRetentionCard(true);
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (!retentionDecisionMade) {
      setShowRetentionCard(true);
    }
  };

  const handleTogglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      void videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
      setCurrentTime(target);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    const next = !isMuted;
    setIsMuted(next);
    videoRef.current.muted = next;
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      void containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3500);
  };

  const handleKeepInLibrary = async (keep = true) => {
    const saved = await retention.save(keep);
    if (!saved) return;
    setRetentionDecisionMade(true);
    setShowRetentionCard(false);
    showToast(keep ? "Kept in your library." : "Library pin removed. The file was not deleted.", "success");
  };

  // Dismissing the prompt never changes a pin or deletes any file.
  const handleJustBrowsing = () => {
    setRetentionDecisionMade(true);
    setShowRetentionCard(false);
    showToast("Keep watching. No files were deleted.", "info");
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onTouchStart={handleMouseMove}
      onFocusCapture={() => setShowControls(true)}
      className="relative flex h-screen w-screen flex-col justify-between overflow-hidden bg-black text-white select-none"
    >
      {/* Top Bar */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent p-6 transition-opacity duration-300",
          showControls || showLibraryKeeping ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div className="flex items-center gap-4">
          {onClose ? (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-white/10 hover:bg-white/20 text-white"
              onClick={onClose}
            >
              <ArrowLeft className="size-5" />
            </Button>
          ) : null}
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">{title}</h1>
            {season != null ? (
              <p className="text-xs text-gold font-medium">
                Season {season} {episode != null ? `· Episode ${episode}` : ""}
              </p>
            ) : null}
          </div>
        </div>

        {/* Sub/Dub Sovereignty Selector */}
        <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-black/60 p-1 backdrop-blur-md">
          <button type="button" className="min-h-12 min-w-12 rounded-xl px-3 text-xs font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2" aria-label="Library keeping" aria-expanded={showLibraryKeeping} onClick={() => setShowLibraryKeeping((open) => !open)}>Library</button>
          <button type="button" className="min-h-12 min-w-12 rounded-xl px-3 text-xs font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2" aria-label="Sound settings" aria-expanded={showSound} onClick={() => setShowSound((open) => !open)}>Sound</button>
          <button
            type="button"
            onClick={() => setActiveAudioMode("sub")}
            className={cn(
              "rounded-xl px-3 py-1 text-xs font-semibold transition-all",
              activeAudioMode === "sub"
                ? "bg-gold text-black shadow-sm"
                : "text-white/70 hover:text-white"
            )}
            title="Japanese/Original Audio + English Subtitles"
          >
            Sub
          </button>
          <button
            type="button"
            onClick={() => setActiveAudioMode("dub")}
            className={cn(
              "rounded-xl px-3 py-1 text-xs font-semibold transition-all",
              activeAudioMode === "dub"
                ? "bg-gold text-black shadow-sm"
                : "text-white/70 hover:text-white"
            )}
            title="English Dubbed Audio"
          >
            Dub
          </button>
        </div>
      </div>

      {showLibraryKeeping ? (
        <section aria-label="Library keeping" className="absolute top-24 right-3 left-3 sm:left-auto sm:w-80 z-50 space-y-3 rounded-2xl border border-white/20 bg-zinc-950/95 p-4 text-sm shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Keep this local file</h2>
            <button type="button" aria-label="Close library keeping" className="min-h-12 min-w-12 rounded-xl hover:bg-white/10 focus-visible:outline focus-visible:outline-2" onClick={() => setShowLibraryKeeping(false)}>Close</button>
          </div>
          <p className="text-xs text-white/60">Only a verified local original can be kept. Removing your pin does not delete the file.</p>
          <p role="status">{retention.loading ? "Checking your library…" : retention.saving ? "Saving your library choice…" : savedToLibrary ? "Kept in your library" : retention.snapshot ? "Not kept in your library" : "Local file not verified"}</p>
          {retention.error ? <p role="alert" className="text-amber-200">{retention.error}</p> : null}
          <Button className="min-h-12 w-full" disabled={!retention.snapshot || retention.loading || retention.saving} onClick={() => void handleKeepInLibrary(!savedToLibrary)}>{savedToLibrary ? "Stop keeping in your library" : "Keep in your library"}</Button>
          {retention.error ? <Button variant="quiet" className="min-h-12 w-full" disabled={!retention.canCheck || retention.loading || retention.saving} onClick={retention.retry}>Retry library status</Button> : null}
        </section>
      ) : null}
      {showSound ? (
        <section aria-label="Sound settings" className="absolute top-24 right-3 z-50 w-80 max-w-[calc(100%-1.5rem)] space-y-2 rounded-2xl border border-white/20 bg-zinc-950/95 p-4 text-sm shadow-2xl">
          <p className="font-semibold">Sound</p>
          {([['off', 'Original'], ['volumeLeveling', 'Volume leveling'], ['dialogueBoost', 'Dialogue focus'], ['nightMode', 'Night listening']] as const).map(([preset, label]) => (
            <button key={preset} type="button" aria-pressed={audioPreset === preset} onClick={() => void changeAudioPreset(preset)} className={cn("min-h-12 w-full rounded-xl px-4 text-left", audioPreset === preset ? "bg-white/15" : "hover:bg-white/10")}>{label}</button>
          ))}
          <p className="text-xs text-white/60">These modes process the current browser audio. Original audio remains selected if processing is unsupported.</p>
          {audioError ? <p role="alert" className="text-xs text-amber-200">{audioError}</p> : null}
        </section>
      ) : null}

      {/* Main Video Stream */}
      <div className="relative flex flex-1 items-center justify-center" onClick={handleTogglePlay}>
        <video
          ref={videoRef}
          src={streamUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onPlay={() => {
            setIsPlaying(true);
            const video = videoRef.current;
            if (video) void publishPlayerCompanionSession({ sessionId: companionSessionId, titleId: id, titleName: title, seasonNumber: season, episodeNumber: episode, ...playerCompanionTiming(video) }).catch(() => undefined);
          }}
          onPause={() => setIsPlaying(false)}
          className="h-full w-full object-contain cursor-pointer"
          playsInline
          autoPlay
        >
          {subtitles.map((sub, i) => (
            <track
              key={i}
              kind="subtitles"
              label={sub.label}
              srcLang={sub.language}
              src={sub.src}
              default={selectedSubtitleTrack === (sub.id || String(i))}
              data-subtitle-index={sub.id || String(i)}
              onLoad={() => {
                if (videoRef.current) synchronizePlaybackSubtitles(videoRef.current, selectedSubtitleTrack === "off" ? null : selectedSubtitleTrack);
              }}
            />
          ))}
        </video>
      </div>

      {/* End-of-Stream Retention Card ("Stream First, Keep When Loved") */}
      {showRetentionCard ? (
        <div className="absolute bottom-28 left-1/2 z-40 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-6 duration-300">
          <div className="flex flex-col sm:flex-row items-center gap-4 rounded-3xl border border-gold/40 bg-zinc-950/90 p-5 shadow-2xl backdrop-blur-xl">
            <div className="text-center sm:text-left">
              <p className="text-sm font-semibold text-white">Enjoyed this stream?</p>
              <p className="text-xs text-muted-foreground">Keep this local file in your library?</p>
              {retention.error ? <p role="alert" className="mt-2 text-xs text-amber-200">{retention.error}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              {savedToLibrary ? (
                <span className="inline-flex h-9 items-center gap-1.5 rounded-2xl bg-success/20 px-4 text-xs font-bold text-success border border-success/30">
                  <Check className="size-3.5" />
                  Kept in your library
                </span>
              ) : (
                <Button
                  size="sm"
                  disabled={savingToLibrary || retention.loading || !retention.snapshot}
                  onClick={() => void handleKeepInLibrary(true)}
                  className="min-h-12 rounded-2xl bg-gold text-black hover:bg-gold/90 font-bold px-4"
                >
                  {savingToLibrary ? <LoaderCircle className="size-3.5 animate-spin mr-1" /> : null}
                  Keep in your library
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleJustBrowsing}
                className="min-h-12 rounded-2xl text-xs text-white/70 hover:bg-white/10 hover:text-white"
              >
                Just Browsing
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Bottom Controls Bar */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 z-30 flex flex-col gap-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 transition-opacity duration-300",
          showControls ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-white/70">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 accent-gold h-1.5 rounded-lg bg-white/20 cursor-pointer"
          />
          <span className="text-xs font-mono text-white/70">{formatTime(duration)}</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              {isPlaying ? <Pause className="size-5" /> : <Play className="size-5 fill-current" />}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2 group">
              <button
                type="button"
                onClick={handleToggleMute}
                className="text-white/80 hover:text-white"
              >
                {isMuted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 accent-gold h-1 rounded-lg bg-white/20 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Audio Mode Indicator */}
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/10 text-gold uppercase tracking-wider">
              {activeAudioMode}
            </span>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="text-white/80 hover:text-white"
            >
              {isFullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
