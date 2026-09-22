/**
 * ReelOS Universal "Play on TV" Casting Engine
 * Remote playback control of Jellyfin sessions (Smart TV, Apple TV, Android TV, Chromecast).
 */

export function mapJellyfinSession(s) {
  if (!s || typeof s !== "object") return null;
  return {
    id: String(s.Id || ""),
    name: String(s.DeviceName || s.Client || "Unknown Device"),
    client: String(s.Client || ""),
    deviceId: String(s.DeviceId || ""),
    user: String(s.UserName || ""),
    supportsRemoteControl: Boolean(s.SupportsRemoteControl),
    nowPlaying: s.NowPlayingItem
      ? {
          id: String(s.NowPlayingItem.Id || ""),
          name: String(s.NowPlayingItem.Name || ""),
          type: String(s.NowPlayingItem.Type || ""),
          seriesName: s.NowPlayingItem.SeriesName ? String(s.NowPlayingItem.SeriesName) : undefined,
        }
      : null,
    isPaused: Boolean(s.PlayState?.IsPaused),
    positionTicks: Number(s.PlayState?.PositionTicks || 0),
  };
}

export function filterControllableSessions(sessions) {
  if (!Array.isArray(sessions)) return [];
  return sessions
    .map(mapJellyfinSession)
    .filter((s) => s && s.supportsRemoteControl && s.id);
}

import { jellyfinAuthedHeaders } from "./reelos-lookup-plugin.mjs";

export async function fetchJellyfinSessions({
  host = "127.0.0.1:8096",
  token = "",
  fetchFn = fetch,
  timeoutMs = 5000,
} = {}) {
  if (!token) return { ok: false, error: "No Jellyfin token", sessions: [] };
  const url = `http://${host}/Sessions`;
  const headers = {
    Accept: "application/json",
    ...jellyfinAuthedHeaders(token),
  };
  try {
    const r = await fetchFn(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return { ok: false, status: r.status, sessions: [] };
    const raw = await r.json();
    const sessions = filterControllableSessions(raw);
    return { ok: true, sessions };
  } catch (err) {
    return { ok: false, error: String(err?.message || err), sessions: [] };
  }
}

export async function castPlayToSession({
  sessionId,
  itemIds,
  playCommand = "PlayNow",
  startPositionTicks = 0,
  host = "127.0.0.1:8096",
  token = "",
  fetchFn = fetch,
  timeoutMs = 8000,
} = {}) {
  if (!sessionId) return { ok: false, error: "No target session ID" };
  const ids = Array.isArray(itemIds) ? itemIds.join(",") : String(itemIds || "").trim();
  if (!ids) return { ok: false, error: "No item ID to play" };

  const url = `http://${host}/Sessions/${encodeURIComponent(sessionId)}/Playing/Play?ItemIds=${encodeURIComponent(ids)}&PlayCommand=${encodeURIComponent(playCommand)}&StartPositionTicks=${encodeURIComponent(startPositionTicks)}`;
  const headers = jellyfinAuthedHeaders(token);

  try {
    const r = await fetchFn(url, { method: "POST", headers, signal: AbortSignal.timeout(timeoutMs) });
    return { ok: r.ok, status: r.status };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export async function castCommandToSession({
  sessionId,
  command = "PlayPause",
  params = {},
  host = "127.0.0.1:8096",
  token = "",
  fetchFn = fetch,
  timeoutMs = 5000,
} = {}) {
  if (!sessionId) return { ok: false, error: "No session ID" };

  const cmd = String(command || "").toLowerCase();
  let subPath = "Playing/PlayPause";

  if (cmd === "play" || cmd === "unpause") subPath = "Playing/Unpause";
  else if (cmd === "pause") subPath = "Playing/Pause";
  else if (cmd === "stop") subPath = "Playing/Stop";
  else if (cmd === "seek") subPath = `Playing/Seek?SeekPositionTicks=${encodeURIComponent(params.positionTicks || 0)}`;
  else if (cmd === "next") subPath = "Playing/Next";
  else if (cmd === "previous" || cmd === "prev") subPath = "Playing/Previous";
  else if (cmd === "volume" && params.volume != null) subPath = `Command/SetVolume?Volume=${encodeURIComponent(params.volume)}`;

  const url = `http://${host}/Sessions/${encodeURIComponent(sessionId)}/${subPath}`;
  const headers = jellyfinAuthedHeaders(token);

  try {
    const r = await fetchFn(url, { method: "POST", headers, signal: AbortSignal.timeout(timeoutMs) });
    return { ok: r.ok, status: r.status };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export async function sendSessionMessage({
  sessionId,
  header = "ReelOS",
  text = "Your screen is connected and ready to stream!",
  timeoutMs = 5000,
  host = "127.0.0.1:8096",
  token = "",
  fetchFn = fetch,
} = {}) {
  if (!sessionId) return { ok: false, error: "No session ID" };
  const query = new URLSearchParams({
    Header: header,
    Text: text,
    TimeoutMs: String(timeoutMs),
  });
  const url = `http://${host}/Sessions/${encodeURIComponent(sessionId)}/Message?${query.toString()}`;
  const headers = jellyfinAuthedHeaders(token);

  try {
    const r = await fetchFn(url, { method: "POST", headers, signal: AbortSignal.timeout(timeoutMs + 2000) });
    return { ok: r.ok, status: r.status };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

