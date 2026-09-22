import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Cast,
  Clapperboard,
  Compass,
  ExternalLink,
  Info,
  LoaderCircle,
  Play,
  QrCode,
  RefreshCw,
  Smartphone,
  Tv,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/lib/toast";
import { jellyfinStreamUrl, jellyfinWatchHref } from "@/lib/jellyfin-watch";
import { useReelStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface WatchLauncherProps {
  open: boolean;
  onClose: () => void;
  title: {
    id: string;
    title: string;
    year?: number | string;
    poster?: string;
    kind?: string;
    jellyfinId?: string;
    episodeTitle?: string;
    season?: number;
    episode?: number;
  };
}

interface CastSession {
  id: string;
  name: string;
  client: string;
  user?: string;
  supportsRemoteControl?: boolean;
}

export function WatchLauncherModal({ open, onClose, title }: WatchLauncherProps) {
  const ipv4 = useReelStore((s) => s.ipv4);
  const tailscaleIp = useReelStore((s) => s.tailscaleIp);
  const watchDoor = useReelStore((s) => s.watch);
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";

  const [castSessions, setCastSessions] = useState<CastSession[]>([]);
  const [castLoading, setCastLoading] = useState(false);
  const [activeCastSession, setActiveCastSession] = useState<{ id: string; name: string } | null>(null);
  const [quickConnectCode, setQuickConnectCode] = useState<string | null>(null);
  const [showPairing, setShowPairing] = useState(false);

  const [resolvedEpisode, setResolvedEpisode] = useState<{
    jellyfinId?: string;
    season?: number;
    episode?: number;
    title?: string;
  } | null>(null);

  const [sourcesData, setSourcesData] = useState<{
    sources: any[];
    recommendedForBrowser?: any;
    recommendedForTv?: any;
  } | null>(null);

  const [rememberAndroidPref, setRememberAndroidPref] = useState(false);
  const [androidPref, setAndroidPref] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAndroidPref(localStorage.getItem("reelos_android_player_pref"));
    }
  }, []);

  const isSeries = title.kind === "tv" || title.kind === "series" || title.id.startsWith("tvdb-") || title.id.startsWith("tmdb-tv-");

  useEffect(() => {
    if (!open || !isSeries || title.episode) return;
    let active = true;
    const sNum = title.season || 1;
    fetch(`/api/episodes?id=${encodeURIComponent(title.id)}&season=${sNum}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !Array.isArray(data?.episodes) || !data.episodes.length) return;
        const playable = data.episodes.find((e: any) => e.status === "in-library" && e.jellyfinId) || data.episodes[0];
        if (playable) {
          setResolvedEpisode({
            jellyfinId: playable.jellyfinId,
            season: sNum,
            episode: playable.episodeNumber,
            title: playable.title,
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open, isSeries, title.id, title.season, title.episode]);

  const activeSeason = title.season ?? resolvedEpisode?.season;
  const activeEpisode = title.episode ?? resolvedEpisode?.episode;
  const activeEpTitle = title.episodeTitle ?? resolvedEpisode?.title;
  const activeJfId = (title.episode && title.jellyfinId) ? title.jellyfinId : (resolvedEpisode?.jellyfinId || title.jellyfinId);
  const jfItemId = activeJfId || title.id;

  useEffect(() => {
    if (!open || !jfItemId) return;
    let active = true;
    fetch(`/api/media/${encodeURIComponent(jfItemId)}/sources`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.ok) {
          setSourcesData(data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open, jfItemId]);

  const streamUrl = jellyfinStreamUrl({
    ipv4,
    tailscaleIp,
    watch: watchDoor,
    hostname,
    jellyfinId: activeJfId,
  });

  const jfWebHref = jellyfinWatchHref({
    ipv4,
    tailscaleIp,
    watch: watchDoor,
    hostname,
    jellyfinId: activeJfId,
  });

  // 4K stream preferred for external VLC and Living Room TV
  const vlcSourceId = sourcesData?.recommendedForTv?.id;
  const vlcStreamUrl = jellyfinStreamUrl({
    ipv4,
    tailscaleIp,
    watch: watchDoor,
    hostname,
    jellyfinId: activeJfId,
    mediaSourceId: vlcSourceId,
  });

  const browserSourceId = sourcesData?.recommendedForBrowser?.id || activeJfId;

  // Android & iOS detection
  const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
  const isIOS = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isMobile = isAndroid || isIOS;

  // VLC deep links
  const targetVlcStream = vlcStreamUrl || streamUrl;
  const vlcUrl = targetVlcStream ? `vlc://${targetVlcStream}` : "";
  const androidVlcIntent = targetVlcStream
    ? `intent:${targetVlcStream}#Intent;package=org.videolan.vlc;type=video/*;action=android.intent.action.VIEW;end`
    : "";

  const refreshSessions = async () => {
    setCastLoading(true);
    try {
      const res = await fetch("/api/cast/sessions", { cache: "no-store" });
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
    if (open) {
      void refreshSessions();
    }
  }, [open]);

  if (!open) return null;

  const handleCastPlay = async (session: CastSession) => {
    const targetPlayId = vlcSourceId || jfItemId;
    if (!targetPlayId) return;
    try {
      showToast(`Casting to ${session.name}…`);
      const res = await fetch("/api/cast/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          itemId: targetPlayId,
          playCommand: "PlayNow",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setActiveCastSession({ id: session.id, name: session.name });
        showToast(`Playing on ${session.name}`, "success");
        onClose();
      } else {
        showToast(data.error || "Failed to start playback on TV", "error");
      }
    } catch (err) {
      showToast("Cast error: " + String(err), "error");
    }
  };

  const launchVlc = () => {
    if (!targetVlcStream) return;
    if (rememberAndroidPref && typeof window !== "undefined") {
      localStorage.setItem("reelos_android_player_pref", "vlc");
      setAndroidPref("vlc");
    }
    showToast("Launching in VLC…", "success");
    if (isAndroid && androidVlcIntent) {
      window.location.href = androidVlcIntent;
    } else if (vlcUrl) {
      window.location.href = vlcUrl;
    }
  };

  const handleSelectBrowser = () => {
    if (rememberAndroidPref && typeof window !== "undefined") {
      localStorage.setItem("reelos_android_player_pref", "browser");
      setAndroidPref("browser");
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-white/10 bg-card/95 p-6 shadow-2xl backdrop-blur-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-gold/15 text-gold border border-gold/30">
              <Tv className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">Where do you want to watch?</h2>
              <p className="text-xs text-muted truncate max-w-[280px]">
                {title.title}
                {activeSeason && activeEpisode ? ` · S${activeSeason}E${activeEpisode}` : ""}
                {activeEpTitle ? ` (${activeEpTitle})` : title.year ? ` (${title.year})` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Section 1: Cast to Living Room TV */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-gold font-mono flex items-center gap-1.5">
              <Cast className="size-3.5" />
              <span>Cast to TV</span>
            </p>
            <button
              type="button"
              disabled={castLoading}
              onClick={() => void refreshSessions()}
              className="text-xs text-muted hover:text-gold flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={cn("size-3", castLoading && "animate-spin")} />
              <span>Refresh</span>
            </button>
          </div>

          {castSessions.length > 0 ? (
            <div className="space-y-2">
              {castSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => handleCastPlay(session)}
                  className="w-full flex items-center justify-between rounded-2xl border border-gold/30 bg-gold/10 p-4 text-left hover:bg-gold/20 hover:border-gold/50 transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-gold/20 text-gold shrink-0">
                      <Tv className="size-5" />
                    </div>
                    <div>
                      <p className="font-display text-sm font-bold text-foreground group-hover:text-gold transition-colors">
                        Play on {session.name}
                      </p>
                      <p className="text-xs text-muted">
                        {session.client} {session.user ? `· ${session.user}` : ""} · Instant 1-tap beam
                      </p>
                    </div>
                  </div>
                  <Play className="size-4 text-gold group-hover:scale-110 transition-transform fill-current" />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 text-left space-y-2.5">
              <div className="flex items-start gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-muted/20 text-muted shrink-0 mt-0.5">
                  <Tv className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold text-foreground">No active TV detected</p>
                  <p className="text-xs text-muted mt-0.5 leading-relaxed">
                    Open the <strong className="text-foreground">Jellyfin</strong> or <strong className="text-foreground">Swiftfin</strong> app on your Apple TV, Roku, Fire TV, or Smart TV, then tap Refresh above.
                  </p>
                </div>
              </div>

              {!showPairing ? (
                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[11px] text-muted">Have a 6-digit QuickConnect TV code?</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-gold hover:bg-gold/10"
                    onClick={() => setShowPairing(true)}
                  >
                    Enter TV Code
                  </Button>
                </div>
              ) : (
                <div className="pt-2 border-t border-white/5 space-y-2">
                  <p className="text-xs text-muted">
                    Enter the QuickConnect code shown on your TV screen to pair instantly:
                  </p>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const clean = (quickConnectCode || "").replace(/[\s-]+/g, "");
                      if (clean.length < 4) return;
                      try {
                        const res = await fetch("/api/quickconnect/authorize", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ code: clean }),
                        });
                        const j = await res.json();
                        if (j.ok) {
                          showToast("TV Paired Successfully!", "success");
                          setShowPairing(false);
                          void refreshSessions();
                        } else {
                          showToast(j.error || "Invalid code", "error");
                        }
                      } catch (err) {
                        showToast(String(err), "error");
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={8}
                        placeholder="000-000"
                        value={quickConnectCode || ""}
                        onChange={(e) => setQuickConnectCode(e.target.value.toUpperCase())}
                        className="h-9 w-32 rounded-xl border border-white/10 bg-black/40 px-3 text-center font-mono text-sm font-bold tracking-widest text-gold uppercase focus:outline-none focus:border-gold"
                      />
                      {quickConnectCode ? (
                        <button
                          type="button"
                          onClick={() => setQuickConnectCode("")}
                          className="absolute right-1.5 top-2 text-muted hover:text-foreground cursor-pointer"
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!quickConnectCode || quickConnectCode.replace(/[\s-]+/g, "").length < 4}
                    >
                      Authorize TV
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowPairing(false)}>
                      Cancel
                    </Button>
                  </form>
                </div>
              )}

              {/* Bad TV / Older TV Reassurance: Chromecast & AirPlay */}
              <div className="pt-2.5 border-t border-white/5 space-y-2 text-xs">
                <p className="font-semibold text-foreground flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gold">
                  <span>📺 Older or Budget TV? (Chromecast &amp; AirPlay)</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted text-[11px]">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 space-y-1">
                    <p className="font-bold text-foreground">Google Cast / Chromecast</p>
                    <p className="leading-relaxed">In Chrome, Edge, or Android, use the browser menu &rarr; <em>Cast&hellip;</em> to beam directly to any HDMI Chromecast dongle or Google TV.</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 space-y-1">
                    <p className="font-bold text-foreground">Apple AirPlay</p>
                    <p className="leading-relaxed">In Safari on iPhone, iPad, or Mac, tap the <strong>AirPlay icon</strong> in the player to beam directly to Apple TV, Roku, or AirPlay 2 TVs.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Play on This Device */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted font-mono flex items-center gap-1.5">
              <Smartphone className="size-3.5" />
              <span>Play on this Device</span>
            </p>
            {isAndroid && (
              <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-mono text-gold border border-gold/20">
                Android Detected
              </span>
            )}
          </div>

          {isAndroid && androidPref ? (
            <div className="flex items-center justify-between rounded-xl border border-gold/30 bg-gold/5 px-3 py-1.5 text-xs text-muted">
              <span>Default: <strong className="text-gold capitalize">{androidPref === "vlc" ? "VLC Player" : "Web Browser"}</strong></span>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("reelos_android_player_pref");
                  setAndroidPref(null);
                }}
                className="text-[11px] text-gold underline hover:opacity-80 cursor-pointer"
              >
                Reset choice
              </button>
            </div>
          ) : isAndroid ? (
            <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs">
              <input
                type="checkbox"
                id="rememberAndroid"
                checked={rememberAndroidPref}
                onChange={(e) => setRememberAndroidPref(e.target.checked)}
                className="size-4 rounded accent-gold"
              />
              <label htmlFor="rememberAndroid" className="text-muted cursor-pointer select-none">
                Don't ask again on this device (always use this player)
              </label>
            </div>
          ) : null}

          {/* Browser Player Option - Primary & Instant */}
          <Link
            to="/play/$id"
            params={{ id: title.id }}
            search={{
              season: activeSeason,
              episode: activeEpisode,
              mediaId: browserSourceId,
            }}
            onClick={handleSelectBrowser}
            className="w-full flex items-center justify-between rounded-2xl border border-gold/40 bg-gold/15 p-4 text-left hover:bg-gold/25 transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gold text-black font-bold shrink-0 shadow-sm">
                <Play className="size-5 fill-current" />
              </div>
              <div>
                <div className="font-display text-sm font-bold text-gold flex items-center gap-2">
                  <span>Watch in Browser</span>
                  <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-mono text-gold border border-gold/30">
                    Instant Start · No App Needed
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  Plays smoothly right now in your web browser with zero buffering
                </p>
              </div>
            </div>
            <Play className="size-4 text-gold group-hover:scale-110 transition-transform fill-current shrink-0" />
          </Link>

          {/* VLC Player Option - Optional 4K */}
          <button
            type="button"
            onClick={launchVlc}
            className="w-full flex items-center justify-between rounded-2xl border border-border/80 bg-card/80 p-3.5 text-left hover:bg-card-2 hover:border-white/20 transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-white/5 text-foreground shrink-0 border border-white/5">
                <Play className="size-4 fill-current" />
              </div>
              <div>
                <div className="font-display text-xs font-semibold text-foreground group-hover:text-gold transition-colors flex items-center gap-1.5">
                  <span>Play in VLC App</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.2 text-[9px] font-mono text-muted">
                    Optional · 4K HDR
                  </span>
                </div>
                <p className="text-[11px] text-muted">
                  External hardware decode for maximum bitrates
                </p>
              </div>
            </div>
            <Play className="size-3.5 text-muted group-hover:text-gold transition-colors fill-current" />
          </button>

          {/* Jellyfin App Option */}
          {jfWebHref ? (
            <a
              href={jfWebHref}
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
              className="w-full flex items-center justify-between rounded-2xl border border-border/80 bg-card/80 p-3.5 text-left hover:bg-card-2 hover:border-white/20 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-white/5 text-foreground shrink-0 border border-white/5">
                  <Clapperboard className="size-4" />
                </div>
                <div>
                  <p className="font-display text-xs font-semibold text-foreground group-hover:text-gold transition-colors">
                    Open in Jellyfin App
                  </p>
                  <p className="text-[11px] text-muted">
                    Native mobile app for Android / iOS
                  </p>
                </div>
              </div>
              <ExternalLink className="size-3.5 text-muted group-hover:text-foreground transition-colors" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
