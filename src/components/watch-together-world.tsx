import { ArrowLeft, Check, Copy, RefreshCw, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  EXPERIENCE_CATALOG,
  type ExperienceTitle,
} from "@/experience/experience-catalog";
import type { ExperienceProfile } from "@/experience/experience-state";
import {
  householdConsensus,
  inviteCodeFromLocation,
  normalizeInviteCode,
  parsePartyRoom,
  type PartyRoom,
} from "@/experience/watch-together-client";

type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "unavailable";

export function WatchTogetherWorld({
  profiles,
  activeProfileId,
  onBack,
  onOpen,
}: {
  profiles: ExperienceProfile[];
  activeProfileId: string;
  onBack(): void;
  onOpen(title: ExperienceTitle): void;
}) {
  const [mode, setMode] = useState<"home" | "remote">(() =>
    typeof window !== "undefined" && inviteCodeFromLocation(window.location.search) ? "remote" : "home",
  );
  const [joined, setJoined] = useState(() => profiles.slice(0, 2).map((profile) => profile.id));
  const participating = profiles.filter((profile) => joined.includes(profile.id));
  const matches = useMemo(
    () => participating.length
      ? householdConsensus(EXPERIENCE_CATALOG.filter((title) => title.kind !== "book"), participating).slice(0, 8)
      : [],
    [participating],
  );
  const [selectedTitleId, setSelectedTitleId] = useState(matches[0]?.id || "");
  const selectedTitle = EXPERIENCE_CATALOG.find((title) => title.id === selectedTitleId) || matches[0];
  const [roomCode, setRoomCode] = useState(() =>
    typeof window === "undefined" ? "" : inviteCodeFromLocation(window.location.search),
  );
  const [room, setRoom] = useState<PartyRoom | null>(null);
  const [participantId, setParticipantId] = useState("");
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);
  const shouldReconnect = useRef(true);
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || profiles[0];
  const displayName = activeProfile?.name || "Viewer";

  const openSocket = (code: string, stableId: string, reconnecting = false) => {
    socketRef.current?.close();
    shouldReconnect.current = true;
    if (!reconnecting) reconnectAttempts.current = 0;
    setConnection(reconnecting ? "reconnecting" : "connecting");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/watchparty?room=${encodeURIComponent(code)}&name=${encodeURIComponent(displayName)}&id=${encodeURIComponent(stableId)}`;
    const socket = new WebSocket(url, "reelos-watchparty-v1");
    socketRef.current = socket;
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message.type === "error") {
          shouldReconnect.current = false;
          setError(message.error || "That invite is no longer available.");
          setConnection("unavailable");
          socket.close();
          return;
        }
        const nextRoom = parsePartyRoom(message.room);
        if (message.type === "init" && nextRoom) {
          const confirmedId = String(message.participantId || stableId);
          setParticipantId(confirmedId);
          sessionStorage.setItem(`reelos-party:${code}`, confirmedId);
          setRoom(nextRoom);
          setConnection("connected");
          reconnectAttempts.current = 0;
          setError("");
        } else if (nextRoom) {
          setRoom(nextRoom);
        }
      } catch {
        setError("The party sent a response ReelOS could not read.");
      }
    };
    socket.onerror = () => {
      setError("The live party connection is unavailable right now.");
    };
    socket.onclose = () => {
      if (socketRef.current !== socket || !shouldReconnect.current) return;
      if (reconnectAttempts.current >= 3) {
        setConnection("unavailable");
        setError("The party could not reconnect. Your invite is still shown so you can retry.");
        return;
      }
      reconnectAttempts.current += 1;
      setConnection("reconnecting");
      reconnectRef.current = window.setTimeout(() => openSocket(code, stableId, true), 1600);
    };
  };

  useEffect(() => () => {
    if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
    shouldReconnect.current = false;
    const socket = socketRef.current;
    socketRef.current = null;
    socket?.close();
  }, []);

  const createRoom = async () => {
    if (!selectedTitle) {
      setError("Choose something before creating an invite.");
      return;
    }
    setError("");
    setConnection("connecting");
    try {
      const response = await fetch("/api/watchparty/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostName: displayName, titleId: selectedTitle.id, title: selectedTitle.title }),
      });
      const payload = await response.json();
      const confirmed = parsePartyRoom(payload.room);
      if (!response.ok || !payload.ok || !confirmed) throw new Error("ReelOS could not create a confirmed room.");
      setRoomCode(confirmed.code);
      setRoom(confirmed);
      setParticipantId(confirmed.hostId);
      openSocket(confirmed.code, confirmed.hostId);
    } catch (reason) {
      setConnection("unavailable");
      setError(reason instanceof Error ? reason.message : "Watch Together is unavailable.");
    }
  };

  const joinRoom = async () => {
    const code = normalizeInviteCode(roomCode);
    if (code.length !== 6) {
      setError("Enter the six-character invite code.");
      return;
    }
    setError("");
    setConnection("connecting");
    try {
      const remembered = sessionStorage.getItem(`reelos-party:${code}`) || undefined;
      const response = await fetch("/api/watchparty/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name: displayName, participantId: remembered }),
      });
      const payload = await response.json();
      const confirmed = parsePartyRoom(payload.room);
      if (!response.ok || !payload.ok || !confirmed || !payload.participantId) {
        throw new Error(payload.error || "That invite is no longer available.");
      }
      setRoom(confirmed);
      setParticipantId(String(payload.participantId));
      openSocket(code, String(payload.participantId));
    } catch (reason) {
      setConnection("unavailable");
      setError(reason instanceof Error ? reason.message : "That invite is unavailable.");
    }
  };

  const copyInvite = async () => {
    if (!room) return;
    const invite = `${window.location.origin}/party?code=${room.code}`;
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError(`Share this code: ${room.code}`);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-5 pb-28 pt-10 md:px-10 lg:pb-16">
      <button onClick={onBack} className="inline-flex min-h-12 items-center gap-2 text-sm text-white/55">
        <ArrowLeft className="size-4" /> Family
      </button>
      <h1 className="mt-6 font-display text-[clamp(3.3rem,7vw,6.6rem)] font-semibold leading-none tracking-[-.075em]">Find the overlap.</h1>
      <p className="mt-5 max-w-xl leading-7 text-white/52">Choose together at Home without exposing anyone’s history, or open a live invite for people somewhere else.</p>
      <div className="mt-8 flex gap-2">
        <button onClick={() => setMode("home")} className={`min-h-12 rounded-full px-5 text-sm ${mode === "home" ? "bg-white text-black" : "bg-white/7"}`}>Together at Home</button>
        <button onClick={() => setMode("remote")} className={`min-h-12 rounded-full px-5 text-sm ${mode === "remote" ? "bg-white text-black" : "bg-white/7"}`}>Watch from apart</button>
      </div>

      {mode === "home" ? (
        <>
          <section className="mt-10">
            <p className="text-sm text-white/42">Who is choosing?</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {profiles.map((profile) => <button key={profile.id} onClick={() => setJoined((items) => items.includes(profile.id) ? items.filter((id) => id !== profile.id) : [...items, profile.id])} className={`min-h-12 rounded-full px-5 text-sm ${joined.includes(profile.id) ? "text-black" : "bg-white/7"}`} style={joined.includes(profile.id) ? { backgroundColor: profile.color } : undefined}>{profile.name}</button>)}
            </div>
          </section>
          <section className="mt-12">
            <p className="text-sm text-white/42">Strongest shared matches</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {matches.map((title) => <button key={title.id} onClick={() => onOpen(title)} className="group relative aspect-[2/3] overflow-hidden rounded-[1.4rem] bg-white/5 text-left"><img src={title.poster} alt="" className="size-full object-cover transition duration-500 group-hover:scale-105" /><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-4 pb-4 pt-14 text-sm font-semibold">{title.title}</span></button>)}
            </div>
            {!participating.length && <p className="mt-4 text-sm text-amber-200/70">Choose at least one person to make a shared match.</p>}
          </section>
        </>
      ) : (
        <section className="mt-10 grid gap-7 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-[1.8rem] bg-white/[.035] p-7">
            <div className="grid size-14 place-items-center rounded-full bg-white/8"><Users /></div>
            <h2 className="mt-6 font-display text-3xl tracking-[-.05em]">A real shared session.</h2>
            {!room ? <>
              <p className="mt-3 max-w-lg leading-7 text-white/48">Pick the title you intend to watch, create an invite, or enter the code somebody sent you. ReelOS won’t claim you joined until the Home confirms it.</p>
              <label className="mt-7 block text-xs text-white/38">Title for a new invite</label>
              <select value={selectedTitle?.id || ""} onChange={(event) => setSelectedTitleId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl bg-white/7 px-4 text-white outline-none">
                {matches.map((title) => <option key={title.id} value={title.id} className="bg-neutral-950">{title.title}</option>)}
              </select>
              <button onClick={createRoom} disabled={connection === "connecting"} className="mt-3 min-h-12 w-full rounded-full bg-white px-6 text-sm font-bold text-black disabled:opacity-40">Create invite</button>
              <div className="my-6 h-px bg-white/8" />
              <div className="flex gap-3">
                <input value={roomCode} onChange={(event) => setRoomCode(normalizeInviteCode(event.target.value))} placeholder="Six-character code" inputMode="text" autoCapitalize="characters" className="min-h-12 min-w-0 flex-1 rounded-xl bg-white/7 px-4 font-mono tracking-[.15em] outline-none" />
                <button onClick={joinRoom} disabled={connection === "connecting"} className="min-h-12 rounded-full border border-white/14 px-6 text-sm disabled:opacity-40">Join</button>
              </div>
            </> : <>
              <p className="mt-6 text-xs uppercase tracking-[.18em] text-white/36">{connection === "connected" ? "Connected" : connection === "reconnecting" ? "Reconnecting" : "Connecting"}</p>
              <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl bg-white/[.045] p-5">
                <div><b className="block text-lg">{room.title}</b><span className="mt-1 block font-mono text-sm tracking-[.22em] text-white/50">{room.code}</span></div>
                <button onClick={copyInvite} className="grid min-h-12 min-w-12 place-items-center rounded-full bg-white/8" aria-label="Copy invite">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</button>
              </div>
              {EXPERIENCE_CATALOG.find((title) => title.id === room.titleId) && <button onClick={() => onOpen(EXPERIENCE_CATALOG.find((title) => title.id === room.titleId)!)} className="mt-3 min-h-12 rounded-full bg-white px-6 text-sm font-bold text-black">Open title</button>}
              <p className="mt-4 text-xs leading-5 text-white/34">The invite and participant connection are live. Playback synchronization begins only from a compatible ReelOS player; this screen does not pretend playback started.</p>
            </>}
            {error && <div role="alert" className="mt-4 rounded-xl bg-red-400/10 p-4 text-sm text-red-100">{error}{connection === "unavailable" && roomCode.length === 6 && <button onClick={joinRoom} className="ml-3 inline-flex items-center gap-1 underline"><RefreshCw className="size-3" />Retry</button>}</div>}
          </div>
          <div className="rounded-[1.8rem] bg-white/[.025] p-7">
            <p className="text-xs uppercase tracking-[.18em] text-white/34">People here</p>
            {!room ? <p className="mt-5 text-sm leading-6 text-white/42">Participants appear only after a Home confirms the invite.</p> : <><div className="mt-5 space-y-3">{room.participants.map((person) => <div key={person.id} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-white/[.045] px-4"><div><b className="text-sm">{person.name}{person.id === participantId ? " · You" : ""}</b><span className="mt-1 block text-xs text-white/35">{person.connected ? "Connected" : "Away"}{person.isHost ? " · Host" : ""}</span></div></div>)}</div><p className="mt-5 text-xs leading-5 text-white/30">Direct host handoff is not available yet. A disconnected host stays reserved while ReelOS attempts to reconnect rather than silently moving control.</p></>}
          </div>
        </section>
      )}
    </main>
  );
}
