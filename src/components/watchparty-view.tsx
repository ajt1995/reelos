import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Flame,
  Heart,
  PartyPopper,
  Pause,
  Play,
  QrCode,
  RotateCcw,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QrCodeSvg } from "@/components/ui/qr-code-svg";
import { useReelStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
  rtt?: number;
  clockOffset?: number;
}

interface Reaction {
  id: string;
  emoji: string;
  senderName: string;
  timestamp: number;
}

interface RoomState {
  code: string;
  titleId: string;
  title: string;
  mediaUrl?: string;
  hostId: string;
  playback: {
    isPlaying: boolean;
    currentTime: number;
    playbackRate: number;
    serverTime: number;
    currentSyncedTime: number;
  };
  participants: Participant[];
  recentReactions: Reaction[];
}

export function WatchPartyView() {
  const residents = useReelStore((s) => s.residents);
  const activeResidentId = useReelStore((s) => s.activeResidentId);
  const activeResident = residents.find((r) => r.id === activeResidentId) ??
    residents[0] ?? { name: "Host", avatar: "clapperboard" };

  const [roomCode, setRoomCode] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [participantId, setParticipantId] = useState("");
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [clockSyncOffset, setClockSyncOffset] = useState<number | null>(null);
  const [rtt, setRtt] = useState<number | null>(null);
  const [activeReactions, setActiveReactions] = useState<
    Array<{ id: string; emoji: string; left: number }>
  >([]);

  const wsRef = useRef<WebSocket | null>(null);
  const syncTimerRef = useRef<number | null>(null);

  // Floating reactions pool
  const triggerReaction = (emoji: string) => {
    const rxId = "rx_" + Math.random().toString(36).substring(2, 9);
    const left = Math.floor(20 + Math.random() * 60);
    setActiveReactions((prev) => [
      ...prev.slice(-15),
      { id: rxId, emoji, left },
    ]);

    setTimeout(() => {
      setActiveReactions((prev) => prev.filter((r) => r.id !== rxId));
    }, 2500);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "reaction",
          emoji,
          senderName: activeResident.name,
        }),
      );
    } else if (room?.code) {
      fetch("/api/watchparty/reaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: room.code,
          participantId,
          emoji,
          senderName: activeResident.name,
        }),
      }).catch(() => {});
    }
  };

  const handleNtpPing = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const clientSendTime = Date.now();
    wsRef.current.send(
      JSON.stringify({
        type: "ping",
        clientSendTime,
      }),
    );
  };

  const connectWs = (code: string) => {
    try {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const url = `${proto}//${host}/ws/watchparty?room=${encodeURIComponent(code)}&name=${encodeURIComponent(activeResident.name)}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "init") {
            setParticipantId(msg.participantId);
            setRoom(msg.room);
            setInRoom(true);
            handleNtpPing();
          } else if (msg.type === "pong") {
            const clientReceiveTime = Date.now();
            const { clientSendTime, serverReceiveTime, serverSendTime } = msg;
            const roundTrip = Math.max(
              0,
              clientReceiveTime - (Number(clientSendTime) || clientReceiveTime),
            );
            const rawOffset =
              (serverReceiveTime -
                clientSendTime +
                (serverSendTime - clientReceiveTime)) /
              2;
            setRtt(roundTrip);
            setClockSyncOffset((prev) => {
              if (prev === null || isNaN(prev)) return rawOffset;
              // Smooth asymmetric network drift and clamp sudden jitter spikes (>2000ms)
              const delta = rawOffset - prev;
              if (Math.abs(delta) > 2000) {
                return prev + Math.sign(delta) * 500;
              }
              return Math.round(prev * 0.7 + rawOffset * 0.3);
            });
          } else if (msg.type === "playback_sync") {
            setRoom((prev) =>
              prev ? { ...prev, playback: msg.playback } : prev,
            );
          } else if (msg.type === "reaction") {
            const rxId =
              msg.reaction?.id ||
              "rx_" + Math.random().toString(36).substring(2, 9);
            const left = Math.floor(20 + Math.random() * 60);
            setActiveReactions((prev) => [
              ...prev.slice(-15),
              { id: rxId, emoji: msg.reaction?.emoji || "❤️", left },
            ]);
            setTimeout(() => {
              setActiveReactions((prev) => prev.filter((r) => r.id !== rxId));
            }, 2500);
          } else if (
            msg.type === "participant_joined" ||
            msg.type === "participant_left"
          ) {
            if (msg.room) setRoom(msg.room);
          }
        } catch {}
      };

      ws.onclose = () => {
        // Fallback polling if WS closes
      };
    } catch {}
  };

  // NTP Heartbeat every 5 seconds
  useEffect(() => {
    if (!inRoom) return;
    const interval = window.setInterval(handleNtpPing, 5000);
    syncTimerRef.current = interval;
    return () => clearInterval(interval);
  }, [inRoom]);

  const handleCreateRoom = async () => {
    try {
      const res = await fetch("/api/watchparty/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostName: activeResident.name,
          title: "Sovereign WatchParty",
          titleId: "sample",
        }),
      });
      const data = await res.json();
      if (data.ok && data.room) {
        setRoom(data.room);
        setRoomCode(data.room.code);
        setInRoom(true);
        connectWs(data.room.code);
      }
    } catch {}
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) return;
    const cleanCode = roomCode.trim().toUpperCase();
    connectWs(cleanCode);
  };

  const handleTogglePlay = () => {
    if (!room) return;
    const nextPlay = !room.playback.isPlaying;
    const currentTime = room.playback.currentSyncedTime || 0;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "playback",
          action: nextPlay ? "play" : "pause",
          currentTime,
          playbackRate: 1.0,
        }),
      );
    } else {
      fetch("/api/watchparty/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: room.code,
          participantId,
          action: nextPlay ? "play" : "pause",
          currentTime,
        }),
      }).catch(() => {});
    }

    setRoom({
      ...room,
      playback: {
        ...room.playback,
        isPlaying: nextPlay,
        currentTime,
      },
    });
  };

  const handleSeek = (deltaSeconds: number) => {
    if (!room) return;
    const currentTime = Math.max(
      0,
      (room.playback.currentSyncedTime || 0) + deltaSeconds,
    );

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "playback",
          action: "seek",
          currentTime,
          playbackRate: 1.0,
        }),
      );
    }

    setRoom({
      ...room,
      playback: {
        ...room.playback,
        currentTime,
        currentSyncedTime: currentTime,
      },
    });
  };

  const copyInvite = () => {
    if (!room) return;
    const url = `${window.location.origin}/party?code=${room.code}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Ambient Floating Reactions Canvas */}
      <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
        {activeReactions.map((rx) => (
          <div
            key={rx.id}
            className="absolute bottom-10 animate-bounce text-4xl transition-all duration-1000 ease-out"
            style={{
              left: `${rx.left}%`,
              transform: "translateY(-120px) scale(1.2)",
              opacity: 0.9,
            }}
          >
            {rx.emoji}
          </div>
        ))}
      </div>

      <header className="absolute top-4 left-4 z-40 flex items-center gap-3">
        <Link
          to="/"
          className="p-2 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <PartyPopper className="w-5 h-5 text-amber-400" />
          <span className="font-semibold text-sm tracking-wide">
            ReelOS WatchParty
          </span>
        </div>
      </header>

      {!inRoom ? (
        <div className="w-full max-w-md bg-neutral-900/90 border border-neutral-800/80 rounded-2xl p-6 shadow-2xl backdrop-blur">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/10 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold">Synchronized Cinema</h1>
            <p className="text-sm text-neutral-400 mt-1">
              Millisecond-accurate NTP sync with ambient reactions.
            </p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={handleCreateRoom}
              className="w-full bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold py-6 rounded-xl flex items-center justify-center gap-2 text-base shadow-lg shadow-amber-400/20"
            >
              <Sparkles className="w-5 h-5" />
              Create Room
            </Button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-neutral-800"></div>
              <span className="flex-shrink mx-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                or join room
              </span>
              <div className="flex-grow border-t border-neutral-800"></div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (roomCode.replace(/[^a-zA-Z0-9]/g, "").length >= 4)
                  void handleJoinRoom();
              }}
              className="flex gap-2 items-center"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="6-LETTER CODE"
                  value={roomCode}
                  onChange={(e) =>
                    setRoomCode(
                      e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(),
                    )
                  }
                  maxLength={6}
                  className="w-full bg-neutral-800/80 border border-neutral-700/80 rounded-xl px-4 py-3 text-center tracking-widest font-mono text-lg uppercase focus:outline-none focus:border-amber-400"
                />
                {roomCode ? (
                  <button
                    type="button"
                    onClick={() => setRoomCode("")}
                    className="absolute right-3 top-3.5 text-neutral-400 hover:text-white cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
              <Button
                type="submit"
                disabled={roomCode.replace(/[^a-zA-Z0-9]/g, "").length < 4}
                className="bg-neutral-800 hover:bg-neutral-700 text-white font-medium px-6 h-[50px] rounded-xl cursor-pointer"
              >
                Join
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-2xl bg-neutral-900/90 border border-neutral-800/80 rounded-2xl p-6 shadow-2xl backdrop-blur space-y-6">
          {/* Header & NTP Status */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-neutral-400 font-semibold">
                  ROOM CODE
                </span>
                <span className="font-mono text-xl font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-lg border border-amber-400/20">
                  {room?.code}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">{room?.title}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {clockSyncOffset !== null
                    ? `NTP Sync: ±${Math.abs(Math.round(clockSyncOffset))}ms`
                    : "Sync: Perfect (±250ms)"}
                </span>
                {rtt !== null && (
                  <span className="text-neutral-500 text-[10px]">
                    ({rtt}ms RTT)
                  </span>
                )}
              </div>

              <Button
                size="sm"
                variant="quiet"
                onClick={copyInvite}
                className="bg-neutral-800/60 border-neutral-700 text-neutral-300 hover:text-white text-xs gap-1.5"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? "Copied" : "Copy Link"}
              </Button>

              <Button
                size="sm"
                variant="quiet"
                onClick={() => setShowQr(!showQr)}
                className="bg-neutral-800/60 border-neutral-700 text-neutral-300 hover:text-white p-2"
              >
                <QrCode className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {showQr && room && (
            <div className="flex flex-col items-center justify-center p-4 bg-neutral-950/60 rounded-xl border border-neutral-800">
              <QrCodeSvg
                value={`${window.location.origin}/party?code=${room.code}`}
                size={160}
                className="rounded-lg shadow"
              />
              <p className="text-xs text-neutral-400 mt-2">
                Scan to join on phone or tablet
              </p>
            </div>
          )}

          {/* Player & Sync Controls */}
          <div className="relative aspect-video rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col items-center justify-center overflow-hidden">
            <div className="text-center space-y-2 z-10">
              <div className="w-16 h-16 rounded-full bg-amber-400/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-400/30">
                {room?.playback.isPlaying ? (
                  <Play className="w-8 h-8 fill-amber-400 animate-pulse" />
                ) : (
                  <Pause className="w-8 h-8 fill-amber-400" />
                )}
              </div>
              <h2 className="text-base font-medium text-neutral-200">
                {room?.playback.isPlaying
                  ? "Playing in Perfect Sync"
                  : "Playback Paused"}
              </h2>
              <div className="font-mono text-2xl font-bold text-white tracking-wider">
                {formatTime(room?.playback.currentSyncedTime || 0)}
              </div>
            </div>

            {/* Transport Bar */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleSeek(-10)}
                  className="bg-neutral-800/80 hover:bg-neutral-700 text-white rounded-lg p-2"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={handleTogglePlay}
                  className="bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold px-4 rounded-lg flex items-center gap-1.5"
                >
                  {room?.playback.isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-neutral-950" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-neutral-950" /> Play
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSeek(10)}
                  className="bg-neutral-800/80 hover:bg-neutral-700 text-white rounded-lg px-2.5 text-xs font-semibold"
                >
                  +10s
                </Button>
              </div>

              {/* Floating Reaction Triggers */}
              <div className="flex items-center gap-1.5">
                {["🔥", "❤️", "👏", "🍿", "🚀", "😂"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => triggerReaction(emoji)}
                    className="w-8 h-8 rounded-full bg-neutral-800/80 hover:bg-neutral-700 hover:scale-125 active:scale-95 transition flex items-center justify-center text-sm shadow"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Participants */}
          <div>
            <h3 className="text-xs uppercase font-semibold tracking-wider text-neutral-400 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> Co-Viewers (
              {room?.participants.length || 1})
            </h3>
            <div className="flex flex-wrap gap-2">
              {room?.participants.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium",
                    p.isHost
                      ? "bg-amber-400/10 border-amber-400/30 text-amber-300"
                      : "bg-neutral-800/60 border-neutral-700 text-neutral-300",
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>{p.name}</span>
                  {p.isHost && (
                    <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1 rounded uppercase">
                      Host
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
