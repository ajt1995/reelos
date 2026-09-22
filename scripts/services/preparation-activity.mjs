import { signalResourcePlaybackPressure } from "./resource-workload-coordinator.mjs";

// Process-local playback priority, independent of the single-session UI arbiter.
// These are activity signals, never source grants or authorization decisions.
const streams = new Set();
const sessions = new Map();
const listeners = new Set();
let expiryTimer;
let lastBlocking = false;

function refresh() {
  clearTimeout(expiryTimer);
  expiryTimer = undefined;
  const now = Date.now();
  let nextExpiry = Infinity;
  for (const [key, expiresAt] of sessions) {
    if (expiresAt <= now) sessions.delete(key);
    else nextExpiry = Math.min(nextExpiry, expiresAt);
  }
  if (Number.isFinite(nextExpiry)) {
    expiryTimer = setTimeout(refresh, Math.min(2147483647, Math.max(1, nextExpiry - now)));
    expiryTimer.unref?.();
  }
  const blocking = streams.size > 0 || sessions.size > 0;
  if (blocking !== lastBlocking) {
    lastBlocking = blocking;
    signalResourcePlaybackPressure(blocking);
    for (const listener of [...listeners]) {
      try { listener(blocking); } catch { /* Observers cannot break playback. */ }
    }
  }
  return blocking;
}

export function beginPreparationBlockingStream() {
  const token = {};
  streams.add(token);
  refresh();
  return () => { if (streams.delete(token)) refresh(); };
}

export function hasPreparationBlockingPlayback() { return refresh(); }

export function subscribePreparationBlockingPlayback(listener) {
  if (typeof listener !== "function") throw new TypeError("Playback observer must be a function");
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Called only after the playback service validates/acknowledges a session.
export function updatePreparationBlockingSession(key, expiresAt) {
  if (typeof key !== "string" || !key || !Number.isSafeInteger(expiresAt)) throw new TypeError("Invalid playback activity");
  sessions.set(key, expiresAt);
  refresh();
}

export function endPreparationBlockingSession(key) {
  sessions.delete(key);
  refresh();
}
