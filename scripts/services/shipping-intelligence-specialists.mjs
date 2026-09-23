const SEARCH_LIMIT = 512;
const SMALL_TEXT_LIMIT = 128;
const SECRET_TEXT = /(?:bearer\s+[a-z0-9._~-]+|(?:api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|secret)\s*[:=]\s*[^\s&,;]+)/ig;
const URL_SECRET = /([?&](?:api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|secret)=)[^&\s]+/ig;

export const SHIPPING_COORDINATOR_CAPABILITIES = Object.freeze([
  "taste-ranking", "semantic-search", "interface-protection", "predictive-preparation",
  "storage-optimization", "machine-protection", "release-ranking", "scene-understanding",
  "family-scene-guidance", "dialogue-enhancement", "shared-taste-intelligence",
  "distributed-workload-scheduler", "in-flight-media-distillation",
  "ambient-presence-governor", "predictive-cache-oracle",
]);

function boundedText(value, limit = SMALL_TEXT_LIMIT) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").replace(SECRET_TEXT, "[redacted]")
    .replace(URL_SECRET, "$1[redacted]").trim().slice(0, limit);
}

function integer(value, fallback = null) {
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function boolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function oneOf(value, allowed, fallback) {
  const normalized = boundedText(value).toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function feature({ scope, entityId, featureSet, value }) {
  return [{
    scope, entityId, featureSet, featureSchemaVersion: 1,
    extractorVersion: "reelos-shipping-specialists-v1", confidence: 1, value,
  }];
}

function request({ resourceClass, privacyClass, input, deadlineMs = 250 }) {
  return {
    deadlineMs, qualityFloor: "deterministic", resourceClass,
    privacyClass, shadowAllowed: true, input,
  };
}

function searchTokens(query) {
  return [...new Set(boundedText(query, SEARCH_LIMIT).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [])].slice(0, 32);
}

function projectQueryTo512D(text) {
  const vec = new Float32Array(512);
  const clean = String(text || "").toLowerCase().trim();
  if (!clean) return Array.from(vec);
  const words = clean.split(/\s+/);
  for (const word of words) {
    let h = 2166136261;
    for (let i = 0; i < word.length; i++) {
      h = Math.imul(h ^ word.charCodeAt(i), 16777619);
      const dim = Math.abs(h) % 512;
      const sign = (h & 0x80000000) ? -1 : 1;
      vec[dim] += sign * (1.0 / Math.sqrt(words.length));
    }
  }
  let norm = 0;
  for (let i = 0; i < 512; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < 512; i++) vec[i] /= norm;
  }
  return Array.from(vec);
}

function tasteFallback({ input }) {
  const titleId = boundedText(input?.titleId, 128) || null;
  const eventType = boundedText(input?.eventType, 64);
  const titleVector = titleId ? projectQueryTo512D(titleId) : null;
  return {
    available: true, enhanced: true, strategy: "deterministic_profile_taste_projection",
    eventType, titleId, titleVector,
  };
}

function semanticFallback({ input }) {
  const query = boundedText(input?.query, SEARCH_LIMIT);
  const tokens = searchTokens(query);
  const latentVector = projectQueryTo512D(query);
  return {
    available: true, enhanced: true, strategy: "deterministic_latent_projection",
    query, tokens, latentVector,
    filters: {
      contentType: oneOf(input?.contentType, ["movie", "series", "book", "person", "any"], "any"),
      excludeWatched: boolean(input?.excludeWatched),
    },
  };
}

function interfaceFallback({ input }) {
  const reducedMotion = boolean(input?.reducedMotion);
  const pressure = oneOf(input?.pressure, ["none", "low", "moderate", "high", "critical"], "none");
  const constrained = ["high", "critical"].includes(pressure);
  return {
    available: true, enhanced: false, strategy: "saved_preferences_with_accessibility_override",
    motion: reducedMotion ? "still" : constrained ? "subtle" : oneOf(input?.motion, ["still", "subtle", "expressive"], "subtle"),
    density: oneOf(input?.density, ["comfortable", "compact"], "comfortable"),
    atmosphere: boolean(input?.atmosphere, true) && !constrained,
    reason: reducedMotion ? "reduced_motion" : constrained ? "resource_pressure" : "profile_preference",
  };
}

function preparationFallback({ input }) {
  let action = "unavailable";
  if (boolean(input?.authorizedSource)) {
    if (boolean(input?.directPlayable)) action = "direct_play";
    else if (boolean(input?.preparedAvailable)) action = "use_prepared_rendition";
    else if (boolean(input?.remuxCompatible)) action = "remux";
    else action = "request_bounded_preparation";
  }
  return {
    available: action !== "unavailable", enhanced: false, strategy: "compatibility_first", action,
    deviceClass: oneOf(input?.deviceClass, ["phone", "tablet", "desktop", "tv", "unknown"], "unknown"),
    requiresDeterministicAuthorization: action !== "unavailable",
  };
}

function storageFallback({ input }, context = {}) {
  const pinned = boolean(input?.pinned);
  const personalOriginal = boolean(input?.personalOriginal);
  return {
    available: true, enhanced: false, strategy: "protected_storage_authority",
    recommendation: pinned || personalOriginal ? "retain" : "defer_to_storage_authority",
    protectedOriginal: personalOriginal,
    reason: boundedText(context.reason, 128) || "deterministic_fallback",
  };
}

function machineFallback({ input }, _context = {}, { governor } = {}) {
  let snapshot = null;
  try { snapshot = governor?.snapshot?.() || null; } catch { snapshot = null; }
  const playbackActive = snapshot?.foreground?.playbackActive === true || boolean(input?.playbackActive);
  const pressure = oneOf(input?.pressure, ["none", "low", "moderate", "high", "critical"], "none");
  return {
    available: true, enhanced: false, strategy: "deterministic_resource_governor",
    recommendation: playbackActive || ["high", "critical"].includes(pressure) ? "yield_optional_work" : "admit_through_governor",
    playbackHasPriority: true, governorAvailable: Boolean(snapshot),
  };
}

function recoveryFallback({ input }) {
  const code = boundedText(input?.code, 128).toLowerCase() || "unknown_failure";
  const transient = /(?:timeout|busy|temporar|network|pressure|yield|unavailable)/.test(code);
  return {
    available: true, enhanced: false, strategy: "bounded_recovery_recommendation",
    recommendation: transient ? "retry_when_safe" : "inspect_local_state", code,
    destructiveActionAllowed: false, updateAuthorizationGranted: false,
  };
}

function sceneFallback({ input }) {
  return {
    available: false, enhanced: false, strategy: "metadata_and_timed_text_only",
    editionId: boundedText(input?.editionId, 128) || null,
    timelineId: boundedText(input?.timelineId, 128) || null,
    visualClaimsAllowed: false, reason: "visual_model_not_validated",
  };
}

function familyGuidanceFallback({ input }) {
  return {
    available: false, enhanced: false, strategy: "parent_policy_and_maturity_baseline",
    editionId: boundedText(input?.editionId, 128) || null,
    mayLowerParentRestriction: false, treatmentAuthorized: false,
    reason: "family_model_not_validated",
  };
}

function dialogueFallback({ input }) {
  return {
    available: false, enhanced: false, strategy: "original_audio_and_deterministic_levels",
    trackId: boundedText(input?.trackId, 128) || null,
    rewriteAuthorized: false, derivedAudioReady: false,
    reason: "dialogue_model_not_validated",
  };
}

function sharedTasteFallback() {
  return {
    available: false, enhanced: false, strategy: "local_taste_only",
    exportAllowed: false, payload: null, reason: "privacy_evaluation_pending",
  };
}

function workloadSchedulerFallback({ input }) {
  const isGamingActive = boolean(input?.isGamingActive);
  const cpuLoadPercent = Number.isFinite(input?.cpuLoadPercent) ? input.cpuLoadPercent : 0;
  return {
    available: true, enhanced: false, strategy: "deterministic_local_first_with_gaming_yield",
    recommendation: isGamingActive || cpuLoadPercent > 85 ? "yield_or_delegate_to_peer" : "execute_locally",
    targetNode: boundedText(input?.nodeId, 64) || "local",
    gamingYieldActive: isGamingActive,
  };
}

function inFlightDistillationFallback({ input }) {
  return {
    available: false, enhanced: false, strategy: "stream_pass_through_without_distillation",
    editionId: boundedText(input?.editionId, 128) || null,
    keyframeFeaturesExtracted: false, reason: "in_flight_model_shadow_mode",
  };
}

function ambientPresenceFallback({ input }) {
  const isBackgroundMode = boolean(input?.isBackgroundMode);
  const idleSeconds = integer(input?.idleDurationSeconds, 0);
  const isLowAttention = isBackgroundMode || idleSeconds >= 2700;
  return {
    available: true, enhanced: false, strategy: "deterministic_presence_threshold",
    isAmbient: isLowAttention,
    watchHistoryPolicy: isLowAttention ? "isolated" : "canonical",
    recommendedProfile: isLowAttention ? "720p-low-bitrate" : "source-max",
  };
}

function predictiveCacheFallback({ input }) {
  return {
    available: true, enhanced: false, strategy: "deterministic_on_demand_preparation",
    preCacheApproved: false,
    seriesId: boundedText(input?.seriesId, 64) || null,
    predictedNextEpisodeId: boundedText(input?.predictedNextEpisodeId, 64) || null,
    reason: "defer_to_on_demand_play",
  };
}

export const SHIPPING_DETERMINISTIC_FALLBACKS = Object.freeze({
  "taste-ranking": tasteFallback,
  "semantic-search": semanticFallback,
  "interface-protection": interfaceFallback,
  "predictive-preparation": preparationFallback,
  "storage-optimization": storageFallback,
  "machine-protection": machineFallback,
  "release-ranking": recoveryFallback,
  "scene-understanding": sceneFallback,
  "family-scene-guidance": familyGuidanceFallback,
  "dialogue-enhancement": dialogueFallback,
  "shared-taste-intelligence": sharedTasteFallback,
  "distributed-workload-scheduler": workloadSchedulerFallback,
  "in-flight-media-distillation": inFlightDistillationFallback,
  "ambient-presence-governor": ambientPresenceFallback,
  "predictive-cache-oracle": predictiveCacheFallback,
});

function registerRuntimeFallbacks(runtime, dependencies) {
  if (!runtime?.registerCapability) return;
  for (const [capabilityId, fallback] of Object.entries(SHIPPING_DETERMINISTIC_FALLBACKS)) {
    runtime.registerCapability(capabilityId, {
      fallback: (requestValue, context) => fallback(requestValue, context, dependencies),
    });
  }
}

/** Production adapters make bounded proposals only. They never authorize access,
 * mutate product state, or promote a capability. */
export function registerShippingIntelligenceSpecialists(coordinator, dependencies = {}) {
  if (!coordinator?.registerSpecialist) throw new TypeError("An intelligence coordinator is required.");
  registerRuntimeFallbacks(dependencies.runtime, dependencies);

  coordinator.registerSpecialist("taste-ranking", {
    perceive: async (event) => feature({
      scope: "profile", entityId: event.profileId, featureSet: "playback-behavior",
      value: {
        eventType: event.type, titleId: boundedText(event.payload?.titleId, 128) || null,
        completed: event.type === "playback.completed", stopped: event.type === "playback.stopped",
        failed: event.type === "playback.failed", paused: boolean(event.payload?.paused),
        positionTicks: integer(event.payload?.positionTicks), durationTicks: integer(event.payload?.durationTicks),
      },
    }),
    buildRequest: async ({ event, snapshot }) => request({
      resourceClass: "interactive", privacyClass: "profile_private",
      input: { eventType: event.type, titleId: boundedText(event.payload?.titleId, 128) || null, featureCount: snapshot.featureIds.length },
    }),
  });

  coordinator.registerSpecialist("semantic-search", {
    normalizeEvent: async (event) => ({
      ...event,
      payload: {
        query: boundedText(event.payload?.query, SEARCH_LIMIT),
        contentType: oneOf(event.payload?.contentType, ["movie", "series", "book", "person", "any"], "any"),
        excludeWatched: boolean(event.payload?.excludeWatched),
      },
    }),
    perceive: async (event) => feature({
      scope: "profile", entityId: event.profileId, featureSet: "search-intent",
      value: {
        query: boundedText(event.payload?.query, SEARCH_LIMIT),
        contentType: oneOf(event.payload?.contentType, ["movie", "series", "book", "person", "any"], "any"),
        excludeWatched: boolean(event.payload?.excludeWatched),
      },
    }),
    buildRequest: async ({ event }) => request({
      resourceClass: "interactive", privacyClass: "profile_private",
      input: {
        query: boundedText(event.payload?.query, SEARCH_LIMIT),
        contentType: oneOf(event.payload?.contentType, ["movie", "series", "book", "person", "any"], "any"),
        excludeWatched: boolean(event.payload?.excludeWatched),
      },
    }),
  });

  coordinator.registerSpecialist("interface-protection", {
    perceive: async (event) => feature({
      scope: event.profileId ? "profile" : "device", entityId: event.profileId || event.deviceId || "local-device",
      featureSet: "presentation-preferences",
      value: {
        motion: oneOf(event.payload?.motion, ["still", "subtle", "expressive"], "subtle"),
        density: oneOf(event.payload?.density, ["comfortable", "compact"], "comfortable"),
        atmosphere: boolean(event.payload?.atmosphere, true), reducedMotion: boolean(event.payload?.reducedMotion),
        pressure: oneOf(event.payload?.pressure, ["none", "low", "moderate", "high", "critical"], "none"),
      },
    }),
    buildRequest: async ({ event }) => request({
      resourceClass: "interactive", privacyClass: event.profileId ? "profile_private" : "household_private",
      input: {
        motion: oneOf(event.payload?.motion, ["still", "subtle", "expressive"], "subtle"),
        density: oneOf(event.payload?.density, ["comfortable", "compact"], "comfortable"),
        atmosphere: boolean(event.payload?.atmosphere, true), reducedMotion: boolean(event.payload?.reducedMotion),
        pressure: oneOf(event.payload?.pressure, ["none", "low", "moderate", "high", "critical"], "none"),
      },
    }),
  });

  coordinator.registerSpecialist("predictive-preparation", {
    perceive: async (event) => feature({
      scope: "media", entityId: event.workId || event.assetId || "unknown-media", featureSet: "rendition-compatibility",
      value: {
        authorizedSource: boolean(event.payload?.authorizedSource), directPlayable: boolean(event.payload?.directPlayable),
        preparedAvailable: boolean(event.payload?.preparedAvailable), remuxCompatible: boolean(event.payload?.remuxCompatible),
        deviceClass: oneOf(event.payload?.deviceClass, ["phone", "tablet", "desktop", "tv", "unknown"], "unknown"),
      },
    }),
    buildRequest: async ({ event }) => request({
      resourceClass: "predictive_prepare", privacyClass: "household_private", deadlineMs: 1000,
      input: {
        authorizedSource: boolean(event.payload?.authorizedSource), directPlayable: boolean(event.payload?.directPlayable),
        preparedAvailable: boolean(event.payload?.preparedAvailable), remuxCompatible: boolean(event.payload?.remuxCompatible),
        deviceClass: oneOf(event.payload?.deviceClass, ["phone", "tablet", "desktop", "tv", "unknown"], "unknown"),
      },
    }),
  });

  coordinator.registerSpecialist("storage-optimization", {
    perceive: async (event) => feature({
      scope: "household", entityId: "household-storage", featureSet: "retention-pressure",
      value: {
        pinned: boolean(event.payload?.pinned), personalOriginal: boolean(event.payload?.personalOriginal),
        managedBytes: integer(event.payload?.managedBytes), freeBytes: integer(event.payload?.freeBytes),
      },
    }),
    buildRequest: async ({ event }) => request({
      resourceClass: "maintenance", privacyClass: "household_private", deadlineMs: 1000,
      input: {
        pinned: boolean(event.payload?.pinned), personalOriginal: boolean(event.payload?.personalOriginal),
        managedBytes: integer(event.payload?.managedBytes), freeBytes: integer(event.payload?.freeBytes),
      },
    }),
  });

  coordinator.registerSpecialist("machine-protection", {
    perceive: async (event) => feature({
      scope: "machine", entityId: event.deviceId || "local-machine", featureSet: "resource-pressure",
      value: {
        pressure: oneOf(event.payload?.pressure, ["none", "low", "moderate", "high", "critical"], "none"),
        playbackActive: boolean(event.payload?.playbackActive), availableMemoryBytes: integer(event.payload?.availableMemoryBytes),
        freeDiskBytes: integer(event.payload?.freeDiskBytes), thermalState: boundedText(event.payload?.thermalState, 64) || null,
      },
    }),
    buildRequest: async ({ event }) => request({
      resourceClass: "maintenance", privacyClass: "household_private", deadlineMs: 500,
      input: {
        pressure: oneOf(event.payload?.pressure, ["none", "low", "moderate", "high", "critical"], "none"),
        playbackActive: boolean(event.payload?.playbackActive), availableMemoryBytes: integer(event.payload?.availableMemoryBytes),
        freeDiskBytes: integer(event.payload?.freeDiskBytes), thermalState: boundedText(event.payload?.thermalState, 64) || null,
      },
    }),
  });

  coordinator.registerSpecialist("release-ranking", {
    perceive: async (event) => feature({
      scope: "household", entityId: "local-release", featureSet: "fault-observation",
      value: {
        code: boundedText(event.payload?.code, 128) || "unknown_failure",
        component: boundedText(event.payload?.component, 128) || "unknown", attempt: integer(event.payload?.attempt, 0),
      },
    }),
    buildRequest: async ({ event }) => request({
      resourceClass: "recovery", privacyClass: "household_private", deadlineMs: 500,
      input: {
        code: boundedText(event.payload?.code, 128) || "unknown_failure",
        component: boundedText(event.payload?.component, 128) || "unknown", attempt: integer(event.payload?.attempt, 0),
      },
    }),
  });

  coordinator.registerSpecialist("scene-understanding", {
    perceive: async (event) => feature({
      scope: "media", entityId: event.editionId || event.assetId || "unknown-edition",
      featureSet: "scene-analysis-candidate",
      value: {
        editionId: boundedText(event.editionId, 128) || null,
        assetId: boundedText(event.assetId, 128) || null,
        timelineId: boundedText(event.timelineId, 128) || null,
        sampleCount: integer(event.payload?.sampleCount, 0),
        timedTextAvailable: boolean(event.payload?.timedTextAvailable),
      },
    }),
    buildRequest: async ({ event }) => request({
      resourceClass: "background_analysis", privacyClass: "household_private", deadlineMs: 5_000,
      input: {
        editionId: boundedText(event.editionId, 128) || null,
        timelineId: boundedText(event.timelineId, 128) || null,
        sampleCount: integer(event.payload?.sampleCount, 0),
        timedTextAvailable: boolean(event.payload?.timedTextAvailable),
      },
    }),
  });

  coordinator.registerSpecialist("family-scene-guidance", {
    perceive: async (event) => feature({
      scope: "media", entityId: event.editionId || "unknown-edition",
      featureSet: "family-guidance-candidate",
      value: {
        editionId: boundedText(event.editionId, 128) || null,
        timelineId: boundedText(event.timelineId, 128) || null,
        evidenceCount: integer(event.payload?.evidenceCount, 0),
        parentBoundaryId: boundedText(event.payload?.parentBoundaryId, 128) || null,
      },
    }),
    buildRequest: async ({ event }) => request({
      resourceClass: "background_analysis", privacyClass: "household_private", deadlineMs: 2_000,
      input: {
        editionId: boundedText(event.editionId, 128) || null,
        timelineId: boundedText(event.timelineId, 128) || null,
        evidenceCount: integer(event.payload?.evidenceCount, 0),
        parentBoundaryId: boundedText(event.payload?.parentBoundaryId, 128) || null,
      },
    }),
  });

  coordinator.registerSpecialist("dialogue-enhancement", {
    perceive: async (event) => feature({
      scope: "media", entityId: event.assetId || event.editionId || "unknown-audio",
      featureSet: "dialogue-analysis-candidate",
      value: {
        editionId: boundedText(event.editionId, 128) || null,
        trackId: boundedText(event.payload?.trackId, 128) || null,
        channelCount: integer(event.payload?.channelCount),
        sampleRate: integer(event.payload?.sampleRate),
      },
    }),
    buildRequest: async ({ event }) => request({
      resourceClass: "background_analysis", privacyClass: "household_private", deadlineMs: 5_000,
      input: {
        editionId: boundedText(event.editionId, 128) || null,
        trackId: boundedText(event.payload?.trackId, 128) || null,
        channelCount: integer(event.payload?.channelCount),
        sampleRate: integer(event.payload?.sampleRate),
      },
    }),
  });

  coordinator.registerSpecialist("shared-taste-intelligence", {
    perceive: async (event) => feature({
      scope: "household", entityId: "anonymous-taste-evaluation",
      featureSet: "taste-export-candidate",
      value: {
        cohortSize: integer(event.payload?.cohortSize, 0),
        dimensions: integer(event.payload?.dimensions, 0),
        linkabilityScore: Number.isFinite(event.payload?.linkabilityScore) ? event.payload.linkabilityScore : null,
      },
    }),
    buildRequest: async ({ event }) => request({
      resourceClass: "privacy_evaluation", privacyClass: "household_private", deadlineMs: 1_000,
      input: {
        cohortSize: integer(event.payload?.cohortSize, 0),
        dimensions: integer(event.payload?.dimensions, 0),
        linkabilityScore: Number.isFinite(event.payload?.linkabilityScore) ? event.payload.linkabilityScore : null,
      },
    }),
  });

  coordinator.registerSpecialist("distributed-workload-scheduler", {
    perceive: async (event) => feature({
      scope: "household", entityId: boundedText(event.entityId || "cluster-telemetry", 128),
      featureSet: "cluster-compute-headroom",
      value: {
        nodeId: boundedText(event.payload?.nodeId, 64) || "local",
        cpuLoadPercent: Number.isFinite(event.payload?.cpuLoadPercent) ? event.payload.cpuLoadPercent : null,
        freeRamMb: integer(event.payload?.freeRamMb, 0),
        isGamingActive: boolean(event.payload?.isGamingActive, false),
        hasHardwareEncoder: boolean(event.payload?.hasHardwareEncoder, false),
      },
    }),
    buildRequest: async ({ event }) => request({
      resourceClass: "system_coordination", privacyClass: "household_private", deadlineMs: 500,
      input: {
        nodeId: boundedText(event.payload?.nodeId, 64) || "local",
        cpuLoadPercent: Number.isFinite(event.payload?.cpuLoadPercent) ? event.payload.cpuLoadPercent : null,
        freeRamMb: integer(event.payload?.freeRamMb, 0),
        isGamingActive: boolean(event.payload?.isGamingActive, false),
        hasHardwareEncoder: boolean(event.payload?.hasHardwareEncoder, false),
      },
    }),
  });

  coordinator.registerSpecialist("in-flight-media-distillation", {
    perceive: async (event) => feature({
      scope: "household", entityId: boundedText(event.editionId || event.entityId || "transcode-stream", 128),
      featureSet: "in-flight-stream-features",
      value: {
        editionId: boundedText(event.editionId, 128) || null,
        keyframeIndex: integer(event.payload?.keyframeIndex, 0),
        audioEnergyDb: Number.isFinite(event.payload?.audioEnergyDb) ? event.payload.audioEnergyDb : null,
        vocalDominancePercent: integer(event.payload?.vocalDominancePercent, 0),
        moodVectorCandidate: Array.isArray(event.payload?.moodVectorCandidate) ? event.payload.moodVectorCandidate.slice(0, 16) : null,
      },
    }),
    buildRequest: async ({ event }) => request({
      resourceClass: "background_analysis", privacyClass: "household_private", deadlineMs: 2_000,
      input: {
        editionId: boundedText(event.editionId, 128) || null,
        keyframeIndex: integer(event.payload?.keyframeIndex, 0),
        audioEnergyDb: Number.isFinite(event.payload?.audioEnergyDb) ? event.payload.audioEnergyDb : null,
        vocalDominancePercent: integer(event.payload?.vocalDominancePercent, 0),
      },
    }),
  });

  coordinator.registerSpecialist("ambient-presence-governor", {
    perceive: async (event) => feature({
      scope: "device", entityId: boundedText(event.entityId || "playback-presence", 128),
      featureSet: "ambient-viewing-presence",
      value: {
        sessionId: boundedText(event.payload?.sessionId, 64) || null,
        idleDurationSeconds: integer(event.payload?.idleDurationSeconds, 0),
        isBackgroundMode: boolean(event.payload?.isBackgroundMode, false),
        recommendedBitrateCap: integer(event.payload?.recommendedBitrateCap, 4_000_000),
        watchHistoryPolicy: oneOf(event.payload?.watchHistoryPolicy, ["isolated", "canonical"], "canonical"),
      },
    }),
    buildRequest: async ({ event }) => request({
      resourceClass: "interaction_adaptation", privacyClass: "household_private", deadlineMs: 250,
      input: {
        sessionId: boundedText(event.payload?.sessionId, 64) || null,
        idleDurationSeconds: integer(event.payload?.idleDurationSeconds, 0),
        isBackgroundMode: boolean(event.payload?.isBackgroundMode, false),
      },
    }),
  });

  coordinator.registerSpecialist("predictive-cache-oracle", {
    perceive: async (event) => feature({
      scope: "household", entityId: boundedText(event.entityId || "household-cache-horizon", 128),
      featureSet: "predictive-cache-schedule",
      value: {
        seriesId: boundedText(event.payload?.seriesId, 64) || null,
        predictedNextEpisodeId: boundedText(event.payload?.predictedNextEpisodeId, 64) || null,
        confidence: Number.isFinite(event.payload?.confidence) ? event.payload.confidence : 0.5,
        torboxHeadroomHours: integer(event.payload?.torboxHeadroomHours, 24),
        downscaleTargetResolution: oneOf(event.payload?.downscaleTargetResolution, ["720p", "1080p"], "1080p"),
      },
    }),
    buildRequest: async ({ event }) => request({
      resourceClass: "background_preparation", privacyClass: "household_private", deadlineMs: 3_000,
      input: {
        seriesId: boundedText(event.payload?.seriesId, 64) || null,
        predictedNextEpisodeId: boundedText(event.payload?.predictedNextEpisodeId, 64) || null,
        confidence: Number.isFinite(event.payload?.confidence) ? event.payload.confidence : 0.5,
      },
    }),
  });

  return coordinator;
}
