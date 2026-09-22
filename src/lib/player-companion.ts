export type PlayerCompanionSession = {
  sessionId: string;
  titleId: string;
  titleName: string;
  seriesName?: string | null;
  seasonNumber?: number;
  episodeNumber?: number;
  positionTicks: number;
  durationTicks: number;
  isPaused: boolean;
};

export type PlayerCompanionCommand = {
  id: string;
  action: "play" | "pause" | "seek";
  payload: { deltaTicks?: number; positionTicks?: number };
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const TICKS = 10_000_000;

async function jsonRequest(url: string, init: RequestInit, fetcher: FetchLike) {
  const response = await fetcher(url, init);
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || payload.ok === false) throw new Error(typeof payload.error === "string" ? payload.error : "Companion is unavailable.");
  return payload;
}

export function publishPlayerCompanionSession(session: PlayerCompanionSession, fetcher: FetchLike = fetch) {
  return jsonRequest("/api/companion/session", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(session),
  }, fetcher);
}

export function stopPlayerCompanionSession(sessionId: string, fetcher: FetchLike = fetch) {
  return jsonRequest("/api/companion/stop", {
    method: "POST", credentials: "same-origin", keepalive: true,
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }),
  }, fetcher);
}

export async function pollPlayerCompanionCommands(sessionId: string, signal?: AbortSignal, fetcher: FetchLike = fetch) {
  const payload = await jsonRequest(`/api/companion/remote/poll?sessionId=${encodeURIComponent(sessionId)}`, {
    cache: "no-store", credentials: "same-origin", signal,
  }, fetcher);
  if (!Array.isArray(payload.commands)) return [];
  return payload.commands.flatMap((raw): PlayerCompanionCommand[] => {
    if (!raw || typeof raw !== "object") return [];
    const value = raw as Record<string, unknown>;
    if (typeof value.id !== "string" || !["play", "pause", "seek"].includes(String(value.action))) return [];
    const source = value.payload && typeof value.payload === "object" ? value.payload as Record<string, unknown> : {};
    const cleanNumber = (candidate: unknown) => Number.isSafeInteger(candidate) ? Number(candidate) : undefined;
    return [{ id: value.id, action: value.action as PlayerCompanionCommand["action"], payload: {
      deltaTicks: cleanNumber(source.deltaTicks), positionTicks: cleanNumber(source.positionTicks),
    } }];
  });
}

export async function consumePlayerCompanionCommand(video: Pick<HTMLVideoElement, "play" | "pause" | "currentTime" | "duration">, command: PlayerCompanionCommand) {
  if (command.action === "play") { await video.play(); return; }
  if (command.action === "pause") { video.pause(); return; }
  const target = command.payload.positionTicks !== undefined
    ? command.payload.positionTicks / TICKS
    : video.currentTime + (command.payload.deltaTicks ?? 0) / TICKS;
  if (!Number.isFinite(target)) return;
  video.currentTime = Math.max(0, Math.min(Number.isFinite(video.duration) ? video.duration : target, target));
}

export function playerCompanionTiming(video: Pick<HTMLVideoElement, "currentTime" | "duration" | "paused">) {
  return {
    positionTicks: Math.floor(Math.max(0, Number.isFinite(video.currentTime) ? video.currentTime : 0) * TICKS),
    durationTicks: Math.floor(Math.max(0, Number.isFinite(video.duration) ? video.duration : 0) * TICKS),
    isPaused: video.paused,
  };
}
