package com.reelos.core

/** Platform identity affects presentation, never the owner's local data. */
enum class DeviceKind { WINDOWS, LINUX, ANDROID_PHONE, ANDROID_TABLET, ANDROID_TV }

enum class Destination { HOME, DISCOVER, LIBRARY, BOOKS, SETTINGS }

enum class OnboardingStep { IDENTITY, ATMOSPHERE, CURATOR, TASTE, SOURCES, HOME, COMPLETE }
enum class GuidanceLevel { GUIDED, BALANCED, INDEPENDENT }
enum class MotionMode { STILL, SUBTLE, EXPRESSIVE }
enum class BrowsingDensity { COMFORTABLE, COMPACT }

/** OS reduced-motion and explicit Still take priority; setup otherwise uses expressive motion. */
fun effectiveMotionMode(profile: ProfileState, osMotionAllowed: Boolean, setup: Boolean): MotionMode = when {
    !osMotionAllowed || profile.motionMode == MotionMode.STILL -> MotionMode.STILL
    setup -> MotionMode.EXPRESSIVE
    else -> profile.motionMode
}

enum class ReactionKind { LIKE, LOVE, COZY, DISMISS, LESS }

enum class SourceKind { PERSONAL, PUBLIC_DOMAIN, OPTIONAL_ADAPTER }
enum class SourceStatus { AVAILABLE, UNAVAILABLE, REVOKED }
enum class MediaAvailability { METADATA_ONLY, PREPARING, READY, UNAVAILABLE }
enum class MediaAction { PLAY, FIND, PREPARING, UNAVAILABLE }

data class ProfileState(
    val id: String,
    val name: String = "",
    val color: String = "#7357A6",
    val onboardingStep: OnboardingStep = OnboardingStep.IDENTITY,
    val guidance: GuidanceLevel = GuidanceLevel.BALANCED,
    val tasteSeeds: Set<String> = emptySet(),
    /** Only positive reactions live here. Dismiss and Less have separate meanings. */
    val positiveReactions: Map<String, ReactionKind> = emptyMap(),
    val dismissedIds: Set<String> = emptySet(),
    val lessLikeIds: Set<String> = emptySet(),
    val savedMediaIds: Set<String> = emptySet(),
    val playbackPositionsMs: Map<String, Long> = emptyMap(),
    val readingPositions: Map<String, String> = emptyMap(),
    val motionMode: MotionMode = MotionMode.SUBTLE,
    val browsingDensity: BrowsingDensity = BrowsingDensity.COMFORTABLE,
    val transparencyEnabled: Boolean = true,
    val playbackPreferences: PlaybackPreferences = PlaybackPreferences(),
)

data class SourceRecord(
    val id: String,
    val kind: SourceKind,
    val status: SourceStatus,
)

/** READY is asserted by a source adapter after it has verified playable bytes. */
data class MediaRecord(
    val id: String,
    val title: String,
    val sourceId: String?,
    val availability: MediaAvailability = MediaAvailability.METADATA_ONLY,
)

data class CoreState(
    val schemaVersion: Int = CORE_SCHEMA_VERSION,
    /** Monotonic local snapshot revision used to reject stale writers. */
    val revision: Long = 0,
    val profiles: Map<String, ProfileState> = emptyMap(),
    val activeProfileId: String? = null,
    /** A local choice only; an authenticated Home adapter must establish actual membership. */
    val requestedHomeId: String? = null,
    val sources: Map<String, SourceRecord> = emptyMap(),
    val media: Map<String, MediaRecord> = emptyMap(),
    /** Unverified external-app handoff experiments only; never gates validated media sources. */
    val experimentalHandoffsEnabled: Boolean = false,
    /** Monotonic local access generations; keep tombstones so reused IDs cannot revive sessions. */
    val playbackEpochs: Map<String, Long> = emptyMap(),
) {
    val activeProfile: ProfileState? get() = activeProfileId?.let(profiles::get)
}

const val CORE_SCHEMA_VERSION = 6
const val PERSONAL_SOURCE_ID = "personal"
const val PUBLIC_DOMAIN_SOURCE_ID = "public-domain"
