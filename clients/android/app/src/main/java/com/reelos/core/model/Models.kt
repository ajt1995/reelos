package com.reelos.core.model

data class DiscoveryInfo(
    val app: String = "reelos",
    val version: String = "",
    val boxName: String = "ReelOS Home",
    val baseUrl: String,
    val tailscaleHost: String? = null,
)

data class MediaItem(
    val id: String,
    val title: String,
    val year: Int? = null,
    val overview: String? = null,
    val posterUrl: String? = null,
    val backdropUrl: String? = null,
    val streamUrl: String? = null,
    val durationMs: Long = 0,
    val resumePositionMs: Long = 0,
    val is4k: Boolean = false,
    val isHdr: Boolean = false,
    val hasDolbyVision: Boolean = false,
    val audioCodec: String = "Unknown audio",
    val videoCodec: String = "Unknown video",
    val genre: String = "",
    val available: Boolean = false,
)

data class ResidentProfile(
    val id: String,
    val name: String,
    val avatar: String = "clapperboard",
    val isKids: Boolean = false,
    val hasPin: Boolean = false,
)

data class PairingStatus(
    val deviceAuthorized: Boolean,
    val profileAuthenticated: Boolean,
    val activeProfileId: String? = null,
)

sealed interface ClientResult<out T> {
    data class Success<T>(val value: T) : ClientResult<T>
    data class Failure(val message: String, val code: String? = null) : ClientResult<Nothing>
}

data class AmbientChannel(
    val id: String,
    val name: String,
    val tagline: String = "",
    val vibe: String = "",
    val curatorNote: String = "",
    val streamUrl: String = "",
)
