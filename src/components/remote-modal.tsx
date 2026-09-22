import { useEffect, useState } from "react";
import {
  ChevronDown,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Subtitles,
  Tv,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReelStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface JellyfinSession {
  id: string;
  name: string;
  client: string;
  nowPlaying?: {
    id: string;
    name: string;
    type: string;
    seriesName?: string;
  } | null;
  isPaused: boolean;
  positionTicks: number;
}

export function VirtualRemote() {
  const activeRemote = useReelStore((s) => s.activeRemote);
  const setActiveRemote = useReelStore((s) => s.setActiveRemote);

  const [sessions, setSessions] = useState<JellyfinSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [volume, setVolume] = useState<number>(80);
  const [muted, setMuted] = useState<boolean>(false);
  const [subtitlesOn, setSubtitlesOn] = useState<boolean>(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Poll sessions when remote is open
  useEffect(() => {
    if (!activeRemote.open) return;
    const loadSessions = async () => {
      try {
        const res = await fetch("/api/cast/sessions");
        const data = await res.json();
        if (data.ok && Array.isArray(data.sessions)) {
          setSessions(data.sessions);
          if (!selectedSessionId && data.sessions.length > 0) {
            setSelectedSessionId(data.sessions[0].id);
          }
        }
      } catch {
        /* ignore */
      }
    };
    loadSessions();
    const interval = setInterval(loadSessions, 3000);
    return () => clearInterval(interval);
  }, [activeRemote.open, selectedSessionId]);

  if (!activeRemote.open) return null;

  const currentSession = sessions.find((s) => s.id === selectedSessionId) ?? sessions[0];
  const nowPlaying = currentSession?.nowPlaying;
  const isPaused = currentSession?.isPaused ?? !activeRemote.playing;

  const sendCommand = async (command: string, params: Record<string, any> = {}) => {
    try {
      await fetch("/api/cast/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSessionId || currentSession?.id,
          command,
          params,
        }),
      });
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:bottom-6 sm:left-auto sm:right-6 sm:w-96 rise">
      <div className="rounded-3xl border border-border bg-card/95 p-5 shadow-2xl backdrop-blur-2xl">
        {/* Top Bar: Target Session & Close */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-gold/15 text-gold border border-gold/30">
              <Tv className="size-4" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                Controlling
              </p>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  className="flex items-center gap-1 font-display text-xs font-bold text-foreground hover:text-gold transition-colors focus:outline-none"
                >
                  <span className="truncate max-w-[170px]">
                    {currentSession ? `${currentSession.name} (${currentSession.client})` : "Living Room TV"}
                  </span>
                  <ChevronDown className="size-3 text-muted" />
                </button>
                {pickerOpen && (
                  <div className="absolute left-0 top-full mt-2 z-50 min-w-[220px] rounded-2xl border border-border/80 bg-card/95 p-1.5 shadow-2xl backdrop-blur-3xl">
                    {sessions.length > 0 ? (
                      sessions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedSessionId(s.id);
                            setPickerOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-left transition-colors",
                            s.id === (selectedSessionId || currentSession?.id)
                              ? "bg-gold/20 text-gold font-semibold"
                              : "text-foreground hover:bg-white/5"
                          )}
                        >
                          <span className="truncate">{s.name}</span>
                          <span className="text-[10px] text-muted ml-2 shrink-0">{s.client}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-muted">
                        Living Room TV (Default)
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveRemote({ open: false })}
            className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Now Playing Title */}
        <div className="mt-3 text-center">
          <p className="font-display text-sm font-bold text-foreground truncate">
            {nowPlaying?.name || activeRemote.title || "Nothing Playing"}
          </p>
          {nowPlaying?.seriesName && (
            <p className="text-xs text-muted truncate">{nowPlaying.seriesName}</p>
          )}
        </div>

        {/* Main Controls: 15s Back, Play/Pause, 15s Forward */}
        <div className="mt-4 flex items-center justify-center gap-5">
          <button
            type="button"
            onClick={() => sendCommand("Seek", { SeekPositionTicks: -150000000 })}
            className="flex size-12 items-center justify-center rounded-2xl border border-border bg-raised text-foreground hover:bg-card-2 hover:border-gold/40 transition-all active:scale-95"
            title="15 seconds back"
          >
            <RotateCcw className="size-5" />
          </button>

          <button
            type="button"
            onClick={() => sendCommand("PlayPause")}
            className="flex size-16 items-center justify-center rounded-3xl border border-gold bg-gold text-gold-fg shadow-[var(--shadow-gold)] hover:scale-105 transition-all active:scale-95"
            title="Play / Pause"
          >
            {isPaused ? (
              <Play className="size-7 fill-current ml-0.5" />
            ) : (
              <Pause className="size-7 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={() => sendCommand("Seek", { SeekPositionTicks: 150000000 })}
            className="flex size-12 items-center justify-center rounded-2xl border border-border bg-raised text-foreground hover:bg-card-2 hover:border-gold/40 transition-all active:scale-95"
            title="15 seconds forward"
          >
            <RotateCw className="size-5" />
          </button>
        </div>

        {/* Bottom Utility Controls: Volume & Subtitles */}
        <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
          {/* Subtitle Toggle */}
          <button
            type="button"
            onClick={() => {
              setSubtitlesOn(!subtitlesOn);
              sendCommand("SetSubtitleStreamIndex", { SubtitleStreamIndex: subtitlesOn ? -1 : 0 });
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors",
              subtitlesOn
                ? "border-gold/30 bg-gold/15 text-gold"
                : "border-border bg-raised text-muted hover:text-foreground"
            )}
          >
            <Subtitles className="size-3.5" />
            <span>Subs {subtitlesOn ? "ON" : "OFF"}</span>
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const nextMute = !muted;
                setMuted(nextMute);
                sendCommand("SetVolume", { Volume: nextMute ? 0 : volume });
              }}
              className="text-muted hover:text-foreground transition-colors"
            >
              {muted || volume === 0 ? (
                <VolumeX className="size-4 text-danger" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                setMuted(false);
                sendCommand("SetVolume", { Volume: v });
              }}
              className="h-1.5 w-20 accent-gold cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
