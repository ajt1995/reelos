/**
 * ReelOS Ambient Playback & Dynamic Curator Channels Service
 *
 * Implements Austin's directives for Background TV:
 * 1. Watch History Isolation: Ambient playback never pollutes or advances
 *    the canonical user episode progress or Up Next anchors.
 * 2. Instant Channel Flipping (<200ms): Cycles through curated ambient
 *    channels using locally pre-cached lightweight streams.
 * 3. TorBox & Hardware Courtesy: Prefers downscaled 720p/1080p streams in RAM/storage
 *    so background viewing never consumes unnecessary WAN bandwidth.
 */

import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";

export const DEFAULT_AMBIENT_CHANNELS = [
  {
    id: "comfort-sitcoms",
    name: "Comfort Sitcoms",
    tagline: "Endless laughter, zero plot commitment",
    genres: ["Comedy"],
    mood: "comfort",
    minRating: 7.0,
  },
  {
    id: "nature-slow-cinema",
    name: "Nature & Slow Cinema",
    tagline: "Atmospheric landscapes, calm soundscapes",
    genres: ["Documentary"],
    mood: "ambient",
    minRating: 7.5,
  },
  {
    id: "late-night-noir",
    name: "Late Night Noir",
    tagline: "Moody lighting, low dialogue focus",
    genres: ["Crime", "Mystery", "Film-Noir"],
    mood: "nocturnal",
    minRating: 7.0,
  },
  {
    id: "weekend-animation",
    name: "Weekend Animation",
    tagline: "Vibrant visuals, family-safe comfort",
    genres: ["Animation", "Family"],
    mood: "playful",
    minRating: 7.0,
  },
  {
    id: "resident-cinema-radio",
    name: "Resident Cinema Radio",
    tagline: "Eclectic library highlights from the curator",
    genres: [],
    mood: "curated",
    minRating: 6.5,
  },
];

export class AmbientPlaybackService extends EventEmitter {
  constructor({ stateDir = ".reelos-state", storageAuthority = null, gridService = null } = {}) {
    super();
    this.stateDir = stateDir;
    this.stateFile = path.join(this.stateDir, "ambient-sessions.json");
    this.storageAuthority = storageAuthority;
    this.gridService = gridService;
    this.channels = [...DEFAULT_AMBIENT_CHANNELS];
    this.currentChannelIndex = 0;
    this.activeSession = null;
    this.presenceState = {
      isAmbient: false,
      idleSinceMs: Date.now(),
      lowAttentionDetected: false,
      lastInteractionAt: Date.now(),
    };

    this.ensureStateDir();
  }

  ensureStateDir() {
    try {
      if (!fs.existsSync(this.stateDir)) {
        fs.mkdirSync(this.stateDir, { recursive: true });
      }
    } catch {}
  }

  getChannels() {
    return this.channels.map((ch, idx) => ({
      ...ch,
      isCurrent: idx === this.currentChannelIndex,
      number: idx + 1,
    }));
  }

  getCurrentChannel() {
    return this.getChannels()[this.currentChannelIndex] || this.channels[0];
  }

  /**
   * Instantly flips to the next or previous channel.
   * @param {"next" | "prev"} [direction="next"]
   */
  flipChannel(direction = "next") {
    if (direction === "next") {
      this.currentChannelIndex = (this.currentChannelIndex + 1) % this.channels.length;
    } else {
      this.currentChannelIndex = (this.currentChannelIndex - 1 + this.channels.length) % this.channels.length;
    }
    const current = this.getCurrentChannel();
    this.emit("channelChange", current);
    return current;
  }

  /**
   * Tunes directly to a specific channel ID.
   * @param {string} channelId
   */
  tuneToChannel(channelId) {
    const idx = this.channels.findIndex((c) => c.id === channelId);
    if (idx !== -1) {
      this.currentChannelIndex = idx;
    }
    return this.getCurrentChannel();
  }

  /**
   * Starts an ambient Background TV playback session.
   * STRICT INVARIANT: Playback progress in this session is isolated
   * and MUST NOT mutate the primary watch history or advance Up Next anchors.
   * @param {object} params
   */
  startAmbientSession({ titleId, titleName, channelId = null, startPositionMs = 0 }) {
    const channel = channelId ? this.tuneToChannel(channelId) : this.getCurrentChannel();
    this.activeSession = {
      sessionId: `ambient-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      titleId,
      titleName,
      channelId: channel.id,
      channelName: channel.name,
      startedAt: Date.now(),
      positionMs: startPositionMs,
      ambient: true,
      isolatedWatchHistory: true,
      lastHeartbeatAt: Date.now(),
    };

    this.presenceState.isAmbient = true;
    this.presenceState.lastInteractionAt = Date.now();
    this.presenceState.lowAttentionDetected = false;

    this.persistSession();
    this.emit("ambientSessionStarted", this.activeSession);
    return this.activeSession;
  }

  /**
   * Updates ambient playback position.
   * Kept strictly in ambient-sessions.json — never written to canonical profile progress.
   */
  heartbeatAmbientSession(positionMs) {
    if (!this.activeSession) return null;
    this.activeSession.positionMs = positionMs;
    this.activeSession.lastHeartbeatAt = Date.now();
    this.persistSession();
    return this.activeSession;
  }

  /**
   * Stops the active ambient session.
   */
  stopAmbientSession() {
    if (!this.activeSession) return null;
    const ended = { ...this.activeSession, endedAt: Date.now() };
    this.activeSession = null;
    this.presenceState.isAmbient = false;
    this.persistSession();
    this.emit("ambientSessionEnded", ended);
    return ended;
  }

  /**
   * Promotes the ambient session to primary viewing if user decides to 'Tune In'.
   * Only then is watch progress committed to the profile's canonical history.
   */
  promoteToPrimarySession() {
    if (!this.activeSession) return null;
    const session = { ...this.activeSession, isolatedWatchHistory: false };
    this.stopAmbientSession();
    return session;
  }

  /**
   * Records user interaction to reset idle counters.
   */
  recordInteraction() {
    this.presenceState.lastInteractionAt = Date.now();
    this.presenceState.lowAttentionDetected = false;
  }

  /**
   * Evaluates presence engagement based on elapsed time without interaction.
   * @param {number} [ambientThresholdMs=45 * 60 * 1000] 45 minutes default
   */
  evaluatePresence(ambientThresholdMs = 45 * 60 * 1000) {
    const elapsed = Date.now() - this.presenceState.lastInteractionAt;
    const isLowAttention = elapsed >= ambientThresholdMs;
    this.presenceState.lowAttentionDetected = isLowAttention;

    return {
      isAmbient: this.presenceState.isAmbient || isLowAttention,
      lowAttentionDetected: isLowAttention,
      idleMs: elapsed,
      recommendedProfile: isLowAttention || this.presenceState.isAmbient ? "720p-low-bitrate" : "source-max",
      watchHistoryPolicy: (isLowAttention || this.presenceState.isAmbient) ? "isolated" : "canonical",
    };
  }

  persistSession() {
    try {
      const data = {
        activeSession: this.activeSession,
        presenceState: this.presenceState,
        currentChannelId: this.getCurrentChannel().id,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(this.stateFile, JSON.stringify(data, null, 2), "utf8");
    } catch {}
  }
}

export function handleAmbientRoutes(req, res, ambientService) {
  const url = new URL(req.url, "http://127.0.0.1");

  if (url.pathname === "/api/ambient/channels" && (req.method || "GET") === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, channels: ambientService.getChannels() }));
    return true;
  }

  if (url.pathname === "/api/ambient/flip" && (req.method || "GET") === "POST") {
    const dir = url.searchParams.get("dir") === "prev" ? "prev" : "next";
    const channel = ambientService.flipChannel(dir);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, channel }));
    return true;
  }

  if (url.pathname === "/api/ambient/status" && (req.method || "GET") === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      ok: true,
      presence: ambientService.evaluatePresence(),
      activeSession: ambientService.activeSession,
      currentChannel: ambientService.getCurrentChannel(),
    }));
    return true;
  }

  return false;
}
