import EventEmitter from "node:events";
import { consoleSentinel } from "./console-sentinel.mjs";
import { isDedicatedMachine } from "./machine-classifier.mjs";

export const ARBITER_STATES = {
  IDLE: "IDLE",
  PLAYBACK: "ACTIVE_PLAYBACK",
  BINGE_PREWARM: "LATE_STREAM_BINGE",
  GAMING_YIELD: "GAMING_YIELD",
  CREATOR_YIELD: "CREATOR_YIELD",
  NIGHTLY_MAINTENANCE: "IDLE_MAINTENANCE",
};

/**
 * ReelOS Sovereign Feature Collision Arbiter
 *
 * Prevents independent background features (video range streaming, audio speech
 * lift, subtitle VAD synchronization, binge pre-warming, gossip mesh sync, and
 * vector training) from contesting CPU, RAM, or bandwidth resources.
 *
 * Implements Austin's Priority Hierarchy:
 * 1. Play Integrity First: Active streaming takes absolute precedence.
 * 2. Gaming Safety Absolute: LAN ping spikes/gaming pause all background networking immediately.
 * 3. Machine Health Safeguard: Yields to 32MB–64MB floor on shared PCs without GC starvation.
 * 4. Nightly Whispering: Fleet learning & gossip sync run during quiet hours (1 AM - 6 AM).
 */
export class FeatureCollisionArbiter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.isDedicated = options.isDedicated ?? isDedicatedMachine();
    this.sentinel = options.consoleSentinel || consoleSentinel;
    this.scheduler = options.politeScheduler || null;

    this.activeState = ARBITER_STATES.IDLE;
    this.activePlaybackSession = null;
    this.streamCompletionPct = 0;
    this.streamBufferHealthy = true;
    this.isGamingActive = false;
    this.isCreatorAppActive = false;
    this.memoryPressure = "none"; // 'none' | 'soft' | 'hard' | 'critical'

    this.arbitrationDecisions = 0;
    this.suppressedActionsCount = 0;

    // Connect to console gaming sentinel
    if (this.sentinel && typeof this.sentinel.on === "function") {
      this.sentinel.on("CONSOLES_GAMING_YIELD", (info) => {
        this.isGamingActive = true;
        this.evaluateState("console_gaming_yield", info);
      });
      this.sentinel.on("CONSOLES_GAMING_RESUME", (info) => {
        this.isGamingActive = false;
        this.evaluateState("console_gaming_resume", info);
      });
    }

    // Connect to polite scheduler (workstation creator apps & memory pressure)
    if (this.scheduler && typeof this.scheduler.subscribe === "function") {
      this.scheduler.subscribe((hostState, isYielding, memPressure) => {
        this.isCreatorAppActive = (hostState === "stealth_yield" || isYielding);
        this.memoryPressure = memPressure || "none";
        this.evaluateState("scheduler_update", { hostState, memPressure });
      });
    }
  }

  notifyPlaybackStart(sessionId, { itemId, isSeries = false } = {}) {
    this.activePlaybackSession = { sessionId, itemId, isSeries, startedAt: Date.now() };
    this.streamCompletionPct = 0;
    this.streamBufferHealthy = true;
    this.evaluateState("playback_started");
  }

  notifyPlaybackProgress(sessionId, { positionMs, durationMs, bufferedMs } = {}) {
    if (!this.activePlaybackSession || this.activePlaybackSession.sessionId !== sessionId) {
      this.activePlaybackSession = { sessionId, startedAt: Date.now() };
    }
    if (durationMs > 0) {
      this.streamCompletionPct = Math.max(0, Math.min(1.0, positionMs / durationMs));
    }
    if (bufferedMs !== undefined) {
      this.streamBufferHealthy = bufferedMs >= 8000; // >= 8s buffer is healthy
    }
    this.evaluateState("playback_progress");
  }

  notifyPlaybackStop(sessionId) {
    if (this.activePlaybackSession && this.activePlaybackSession.sessionId === sessionId) {
      this.activePlaybackSession = null;
      this.streamCompletionPct = 0;
      this.evaluateState("playback_stopped");
    }
  }

  evaluateState(trigger = "manual", context = null) {
    const prevState = this.activeState;
    this.arbitrationDecisions++;

    // 1. Absolute Priority: Competitive Gaming on household LAN
    if (this.isGamingActive) {
      this.activeState = ARBITER_STATES.GAMING_YIELD;
    }
    // 2. Creator Workstation Yield (Photoshop, Lightroom, Blender)
    else if (this.isCreatorAppActive && !this.isDedicated) {
      this.activeState = ARBITER_STATES.CREATOR_YIELD;
    }
    // 3. Late-Stream Binge Pre-Warming (>85% completion on active series)
    else if (
      this.activePlaybackSession &&
      this.streamCompletionPct >= 0.85 &&
      this.streamBufferHealthy
    ) {
      this.activeState = ARBITER_STATES.BINGE_PREWARM;
    }
    // 4. Active Video Playback
    else if (this.activePlaybackSession) {
      this.activeState = ARBITER_STATES.PLAYBACK;
    }
    // 5. Nightly Maintenance Quiet Hours (1 AM to 6 AM)
    else {
      const hour = new Date().getHours();
      if (hour >= 1 && hour < 6) {
        this.activeState = ARBITER_STATES.NIGHTLY_MAINTENANCE;
      } else {
        this.activeState = ARBITER_STATES.IDLE;
      }
    }

    if (prevState !== this.activeState) {
      this.emit("STATE_CHANGED", {
        from: prevState,
        to: this.activeState,
        trigger,
        context,
        features: this.getFeaturePermissions(),
      });
    }
  }

  getFeaturePermissions() {
    const s = this.activeState;
    return {
      canStreamVideo: true,
      canUseAudioDsp: s === ARBITER_STATES.PLAYBACK || s === ARBITER_STATES.BINGE_PREWARM,
      canUseSubtitleSync: s === ARBITER_STATES.PLAYBACK,
      canPreWarmNextEpisode: s === ARBITER_STATES.BINGE_PREWARM && !this.isGamingActive,
      canRunGossipMesh: s === ARBITER_STATES.IDLE || s === ARBITER_STATES.NIGHTLY_MAINTENANCE,
      canRunModelTraining: s === ARBITER_STATES.NIGHTLY_MAINTENANCE || (this.isDedicated && s === ARBITER_STATES.IDLE),
      stealthMemoryFloorActive: s === ARBITER_STATES.GAMING_YIELD || s === ARBITER_STATES.CREATOR_YIELD,
      stealthMemoryMb: 48, // Safe 32MB–64MB machine health floor
    };
  }

  requestPermission(featureName) {
    const perms = this.getFeaturePermissions();
    const allowed = Boolean(perms[featureName]);
    if (!allowed) {
      this.suppressedActionsCount++;
    }
    return allowed;
  }
}

export const featureCollisionArbiter = new FeatureCollisionArbiter();
