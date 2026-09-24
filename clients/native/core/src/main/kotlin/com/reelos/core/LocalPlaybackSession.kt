package com.reelos.core

/** Local validation-state guard, not a credential, byte lease, or child/PIN authorization. */
class LocalPlaybackSession private constructor(
    val profileId: String,
    val mediaId: String,
    val sourceId: String,
    val sourceKind: SourceKind,
    private val profileEpoch: Long,
    private val sourceEpoch: Long,
    private val mediaEpoch: Long,
) {
    fun isAllowed(state: CoreState): Boolean {
        val profile = state.profiles[profileId] ?: return false
        val media = state.media[mediaId] ?: return false
        val source = state.sources[sourceId] ?: return false
        return state.activeProfileId == profileId && profile.onboardingStep == OnboardingStep.COMPLETE &&
            media.availability == MediaAvailability.READY && media.sourceId == sourceId &&
            source.kind == sourceKind && source.status == SourceStatus.AVAILABLE &&
            (state.playbackEpochs[PlaybackEpoch.PROFILE] ?: 0L) == profileEpoch &&
            (state.playbackEpochs[PlaybackEpoch.source(sourceId)] ?: 0L) == sourceEpoch &&
            (state.playbackEpochs[PlaybackEpoch.media(mediaId)] ?: 0L) == mediaEpoch
    }

    companion object {
        fun open(state: CoreState, mediaId: String): LocalPlaybackSession {
            val profileId = requireNotNull(state.activeProfileId) { "Choose a profile before playing" }
            val sourceId = requireNotNull(state.media[mediaId]?.sourceId) { "This media has no available source" }
            val source = requireNotNull(state.sources[sourceId]) { "This source is unavailable" }
            return LocalPlaybackSession(profileId, mediaId, sourceId, source.kind,
                state.playbackEpochs[PlaybackEpoch.PROFILE] ?: 0L,
                state.playbackEpochs[PlaybackEpoch.source(sourceId)] ?: 0L,
                state.playbackEpochs[PlaybackEpoch.media(mediaId)] ?: 0L).also {
                check(it.isAllowed(state)) { "This profile or source is no longer available for playback" }
            }
        }
    }
}

internal object PlaybackEpoch {
    const val PROFILE = "active-profile"
    fun source(id: String) = "source:$id"
    fun media(id: String) = "media:$id"
}
