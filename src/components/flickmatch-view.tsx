import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Clapperboard,
  Copy,
  Flame,
  Heart,
  PartyPopper,
  Play,
  QrCode,
  Sparkles,
  Tv,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QrCodeSvg } from "@/components/ui/qr-code-svg";
import { ResidentAvatar } from "@/components/profile-switcher";
import { useReelStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface DeckCard {
  id: string;
  jellyfinId?: string;
  title: string;
  year?: number | null;
  poster?: string | null;
  overview?: string;
  genres?: string[];
  duration?: number | null;
}

interface Player {
  name: string;
  avatar: string;
  joinedAt: number;
  votedCount: number;
}

interface MatchResult {
  titleId: string;
  jellyfinId?: string;
  title: string;
  poster?: string | null;
  matchedAt: number;
}

export function FlickMatchView() {
  const navigate = useNavigate();
  const residents = useReelStore((s) => s.residents);
  const activeResidentId = useReelStore((s) => s.activeResidentId);
  const activeResident =
    residents.find((r) => r.id === activeResidentId) ??
    residents[0] ?? { name: "Host", avatar: "clapperboard" };

  const [roomCode, setRoomCode] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [deck, setDeck] = useState<DeckCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [casting, setCasting] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Parse room from URL query if present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const r = p.get("room");
      if (r) {
        setRoomCode(r.toUpperCase());
        joinRoom(r.toUpperCase());
      }
    }
  }, []);

  // Poll room status while in room
  useEffect(() => {
    if (!inRoom || !roomCode || match) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/flickmatch/status?room=${encodeURIComponent(roomCode)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.players) setPlayers(data.players);
          if (data.match) setMatch(data.match);
        }
      } catch {
        /* ignore network blips */
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [inRoom, roomCode, match]);

  const joinRoom = async (codeToJoin?: string) => {
    try {
      const code = codeToJoin || roomCode;
      const res = await fetch("/api/flickmatch/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: code,
          residentName: activeResident.name,
          residentAvatar: activeResident.avatar,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setRoomCode(data.roomCode);
        setPlayers(data.players || []);
        setDeck(data.deck || []);
        if (data.match) setMatch(data.match);
        setInRoom(true);
      }
    } catch {
      /* ignore */
    }
  };

  const handleVote = async (vote: "yes" | "no") => {
    const card = deck[currentIndex];
    if (!card) return;

    try {
      const res = await fetch("/api/flickmatch/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode,
          residentName: activeResident.name,
          titleId: card.id,
          vote,
        }),
      });
      const data = await res.json();
      if (data.matched && data.match) {
        setMatch(data.match);
      } else {
        setCurrentIndex((i) => i + 1);
      }
    } catch {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleCastPlay = async () => {
    if (!match) return;
    setCasting(true);
    try {
      // Fetch available sessions first
      const sessRes = await fetch("/api/cast/sessions");
      const sessData = await sessRes.json();
      const firstSession = sessData.sessions?.[0]?.id;

      await fetch("/api/cast/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: firstSession,
          itemId: match.jellyfinId || match.titleId,
        }),
      });
    } catch {
      /* ignore */
    }
    setCasting(false);
  };

  const currentOrigin =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : "";

  const hostUrl = `${currentOrigin}/flickmatch?room=${roomCode}`;
  const joinUrl =
    roomCode.trim().length === 4
      ? `${currentOrigin}/flickmatch?room=${roomCode.trim().toUpperCase()}`
      : `${currentOrigin}/flickmatch`;

  const copyLink = (url: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 1. MATCH CELEBRATION VIEW
  if (match) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/25 blur-[140px] animate-pulse"
        />
        <div className="relative z-10 max-w-md space-y-6 rise">
          <div className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-gold/20 text-gold border border-gold/40 shadow-2xl">
            <PartyPopper className="size-10 text-gold-bright animate-bounce" />
          </div>

          <div>
            <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-gold border border-gold/30">
              Unanimous Match!
            </span>
            <h1 className="mt-3 font-display text-3xl font-extrabold text-foreground md:text-4xl">
              {match.title}
            </h1>
            <p className="mt-2 text-sm text-muted">
              Everyone in Room <span className="font-mono font-semibold text-gold">{roomCode}</span> agreed on this title!
            </p>
          </div>

          {match.poster && (
            <div className="mx-auto size-52 overflow-hidden rounded-2xl shadow-2xl border-2 border-gold/40">
              <img
                src={match.poster}
                alt={match.title}
                className="size-full object-cover"
              />
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <Button
              size="lg"
              variant="gold"
              onClick={handleCastPlay}
              disabled={casting}
              className="gap-2 rounded-2xl font-display text-base font-bold shadow-xl"
            >
              <Tv className="size-5" />
              {casting ? "Sending to TV..." : "Play on Living Room TV"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                navigate({
                  to: "/play/$id",
                  params: { id: match.jellyfinId || match.titleId },
                });
              }}
              className="gap-2 rounded-2xl border-border bg-card/60 text-foreground"
            >
              <Play className="size-4" />
              Watch on This Device
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 2. CARD SWIPING VIEW
  if (inRoom && currentIndex < deck.length) {
    const card = deck[currentIndex];
    return (
      <div className="relative flex min-h-dvh flex-col justify-between bg-background px-4 py-6 md:px-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setInRoom(false)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-1.5 text-xs text-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Leave Room
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-1.5 font-mono text-xs font-bold text-gold uppercase tracking-wider bg-gold/10 hover:bg-gold/20 px-2.5 py-1 rounded-lg border border-gold/25 transition-colors cursor-pointer shadow-sm"
              title="Show QR code for couch guests to scan and join"
            >
              <QrCode className="size-3.5" />
              Room {roomCode}
            </button>
            <span className="font-mono text-xs text-muted">
              {currentIndex + 1} / {deck.length}
            </span>
          </div>
        </header>

        {/* Swipe Card */}
        <main className="mx-auto my-auto w-full max-w-sm rise">
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="relative aspect-[2/3] w-full bg-raised">
              {card.poster ? (
                <img
                  src={card.poster}
                  alt={card.title}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted">
                  <Clapperboard className="size-16 opacity-30" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-5 pt-16 text-white">
                <div className="flex flex-wrap gap-1.5">
                  {(card.genres || []).slice(0, 3).map((g) => (
                    <span
                      key={g}
                      className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md"
                    >
                      {g}
                    </span>
                  ))}
                </div>
                <h2 className="mt-2 font-display text-2xl font-bold leading-tight">
                  {card.title}
                </h2>
                {card.year && (
                  <p className="text-xs text-white/70">Released {card.year}</p>
                )}
                {card.overview && (
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-white/80">
                    {card.overview}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={() => handleVote("no")}
              className="flex size-16 items-center justify-center rounded-full border-2 border-danger/40 bg-card text-danger shadow-xl transition-all duration-150 hover:scale-110 active:scale-95 hover:bg-danger/10"
              title="Pass"
            >
              <X className="size-8" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => handleVote("yes")}
              className="flex size-20 items-center justify-center rounded-full border-2 border-gold bg-gold text-gold-fg shadow-2xl transition-all duration-150 hover:scale-110 active:scale-95 hover:bg-gold-bright"
              title="Watch!"
            >
              <Heart className="size-10 fill-current" />
            </button>
          </div>
        </main>

        {/* Footer Players Row */}
        <footer className="flex items-center justify-center gap-2">
          <Users className="size-4 text-muted" />
          <div className="flex -space-x-1.5 overflow-hidden">
            {players.map((p) => (
              <ResidentAvatar
                key={p.name}
                avatar={p.avatar}
                className="size-7 ring-2 ring-background text-xs"
              />
            ))}
          </div>
        </footer>

        {/* Guest Invite QR Modal during swiping */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md px-4">
            <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 text-center rise">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="size-5 text-gold" />
                  <h3 className="font-display text-base font-semibold text-foreground">
                    Join Room {roomCode}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="text-muted hover:text-foreground cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              <p className="text-xs text-muted">
                Scan with phone camera to jump straight into this live FlickMatch session.
              </p>

              <div className="mx-auto flex flex-col items-center justify-center rounded-2xl bg-white p-3.5 shadow-2xl ring-4 ring-gold/25">
                <QrCodeSvg value={hostUrl} size={180} />
              </div>

              <div className="rounded-xl border border-border bg-raised p-2.5 flex items-center justify-between gap-2 text-xs font-mono">
                <span className="truncate text-muted">{hostUrl}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyLink(hostUrl)}
                  className="h-7 gap-1 px-2 text-[11px]"
                >
                  {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>

              <Button
                size="lg"
                variant="gold"
                onClick={() => setShowInviteModal(false)}
                className="w-full rounded-2xl font-semibold shadow-lg"
              >
                Resume Swiping
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. END OF DECK VIEW
  if (inRoom && currentIndex >= deck.length) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center bg-background">
        <div className="max-w-sm space-y-4 rise">
          <Clapperboard className="mx-auto size-14 text-gold opacity-80" />
          <h2 className="font-display text-2xl font-bold text-foreground">
            End of the Deck!
          </h2>
          <p className="text-xs text-muted">
            You've swiped through all 15 candidates. Waiting for other players to finish their votes in Room{" "}
            <span className="font-mono font-semibold text-gold">{roomCode}</span>.
          </p>
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-lg">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Scan to Join Room {roomCode}
            </p>
            <div className="mx-auto flex flex-col items-center justify-center rounded-xl bg-white p-2.5 shadow-md ring-2 ring-gold/20">
              <QrCodeSvg value={hostUrl} size={140} />
            </div>
            <p className="font-mono text-xs text-gold font-bold">{hostUrl}</p>
          </div>

          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setCurrentIndex(0);
              }}
              className="rounded-xl border-border text-xs"
            >
              Swipe Again
            </Button>
            <Button
              variant="ghost"
              onClick={() => setInRoom(false)}
              className="rounded-xl text-xs text-muted"
            >
              Leave Room
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 4. LOBBY VIEW
  return (
    <div className="relative min-h-dvh bg-background px-6 py-10 md:px-12">
      <div className="mx-auto max-w-4xl space-y-8 rise">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to ReelOS
          </Link>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-gold/15 text-gold border border-gold/30 shadow-md">
                <Sparkles className="size-5" />
              </span>
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  FlickMatch
                </h1>
                <p className="text-xs text-muted">
                  Group movie picker for your living room couch.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Create / Join & Couch QR Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Card 1: Host / Enter Code */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-xl space-y-6 flex flex-col justify-between">
            <div className="space-y-2">
              <h3 className="font-display text-base font-semibold text-foreground">
                Host a Match Night
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Start a new room. Pass the room code to friends on the couch so everyone can swipe from their own phone.
              </p>
              <Button
                size="lg"
                variant="gold"
                onClick={() => joinRoom()}
                className="w-full gap-2 rounded-2xl font-display font-semibold shadow-[var(--shadow-gold)] mt-2"
              >
                <Zap className="size-4" />
                Create New Room
              </Button>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <span className="relative bg-card px-3 text-xs uppercase tracking-wider text-faint">
                Or Join Existing
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const code = roomCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                if (code.length === 4) joinRoom(code);
              }}
              className="space-y-3"
            >
              <div className="relative">
                <input
                  type="text"
                  maxLength={4}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
                  placeholder="ENTER 4-LETTER CODE"
                  className="h-14 w-full rounded-2xl bg-raised text-center font-mono text-xl font-bold tracking-widest text-foreground placeholder:text-faint shadow-[var(--shadow-border)] focus:shadow-[var(--shadow-gold)] uppercase"
                />
                {roomCode ? (
                  <button
                    type="button"
                    onClick={() => setRoomCode("")}
                    className="absolute right-3.5 top-5 text-muted hover:text-foreground cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
              <Button
                type="submit"
                size="lg"
                variant="ghost"
                disabled={roomCode.replace(/[^a-zA-Z0-9]/g, "").length !== 4}
                className="w-full rounded-2xl border-border font-medium cursor-pointer"
              >
                Join Room
              </Button>
            </form>
          </div>

          {/* Card 2: Couch QR Code for Guests */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-xl flex flex-col items-center justify-between text-center space-y-5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2 text-gold">
                <QrCode className="size-5" />
                <h3 className="font-display text-base font-semibold text-foreground">
                  Scan to Join from Phone
                </h3>
              </div>
              <p className="text-xs text-muted max-w-xs mx-auto leading-relaxed">
                Point your phone camera here to jump straight into FlickMatch without typing the IP.
              </p>
            </div>

            {/* High-Contrast Scannable QR Container */}
            <div className="relative flex flex-col items-center justify-center rounded-2xl bg-white p-3.5 shadow-2xl ring-4 ring-gold/20">
              <QrCodeSvg value={joinUrl} size={176} />
            </div>

            <div className="w-full space-y-2">
              <div className="flex items-center justify-center">
                <span className="rounded-full bg-gold/15 px-3 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-gold border border-gold/30">
                  {roomCode.trim().length === 4
                    ? `Room ${roomCode.trim().toUpperCase()} Included`
                    : "Direct Couch Join"}
                </span>
              </div>

              <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-raised px-3 py-2 text-xs font-mono">
                <span className="truncate text-muted">{joinUrl}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyLink(joinUrl)}
                  className="h-7 gap-1 px-2.5 text-[11px] font-sans text-foreground"
                >
                  {copied ? (
                    <Check className="size-3 text-emerald-400" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  {copied ? "Copied" : "Copy Link"}
                </Button>
              </div>

              <p className="text-[10px] text-faint">
                Works with native camera on iOS & Android
              </p>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl border border-border bg-card/40 p-3">
            <p className="font-display text-lg font-bold text-gold">100%</p>
            <p className="mt-0.5 text-[10px] text-muted">100% Private</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/40 p-3">
            <p className="font-display text-lg font-bold text-gold">15 Cards</p>
            <p className="mt-0.5 text-[10px] text-muted">Curated Deck</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/40 p-3">
            <p className="font-display text-lg font-bold text-gold">Instant</p>
            <p className="mt-0.5 text-[10px] text-muted">Auto-Play on TV</p>
          </div>
        </div>
      </div>
    </div>
  );
}
