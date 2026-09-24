package com.reelos.presentation

import com.reelos.core.*
import com.reelos.providers.*
import java.security.MessageDigest

class PreparedProviderPlayback(val mediaId: String, val profileId: String, val title: String,
    val guard: LocalPlaybackSession, val bytes: RemoteByteStream, private val authorized: () -> Boolean) : AutoCloseable {
    fun isAuthorized(): Boolean = runCatching(authorized).getOrDefault(false)
    override fun close() = bytes.close()
    override fun toString() = "PreparedProviderPlayback(redacted)"
}

/** Shared projection and preparation, not a second Android/desktop provider implementation. */
class ProviderMediaAccess internal constructor(private val current: () -> ReelCore, private val connection: ProviderConnectionController,
    private val probe: (RemoteByteStream) -> Unit = ::probeRemoteBytes) {
    fun reconcile() {
        val allowed = connection.sourceScope()
        val core = current()
        core.snapshot.sources.values.filter { it.id.startsWith("external-provider-") && it.id != allowed && it.status != SourceStatus.REVOKED }
            .forEach { core.revokeSource(it.id) }
    }

    fun openMedia(id: String): PreparedProviderPlayback {
        reconcile()
        val source = connection.sourceScope() ?: throw ConnectionChanged()
        val video = connection.findVideo { mediaId(source, it) == id } ?: throw ConnectionChanged()
        return prepare(video)
    }

    fun prepare(video: ProviderVideo): PreparedProviderPlayback {
        reconcile()
        val initial = current().snapshot
        val profile = initial.activeProfile ?: throw ConnectionChanged()
        check(profile.onboardingStep == OnboardingStep.COMPLETE)
        val lease = connection.resolve(video)
        var guard: LocalPlaybackSession? = null
        var lastCheck = 0L
        var denied = false
        val gate = Any()
        // Keystore/disk checks are bounded to once per 250ms; every read still consults this guard.
        fun authorized(): Boolean = synchronized(gate) {
            if (denied) return@synchronized false
            val now = System.nanoTime()
            if (now - lastCheck >= 250_000_000L || lastCheck == 0L) {
                lastCheck = now
                val allowed = runCatching {
                    val state = current().snapshot
                    lease.isCurrent() && (guard?.isAllowed(state) ?: (state.revision == initial.revision && state.activeProfileId == profile.id))
                }.getOrDefault(false)
                if (!allowed) denied = true
            }
            !denied
        }
        val remote = lease.stream.openBytes(video.sizeBytes, ::authorized)
        try {
            // Prove ranged source bytes before publishing a Play projection. Decoder errors remain explicit.
            probe(remote)
            val core = current()
            check(core.snapshot.revision == initial.revision && lease.isCurrent()) { "Playback access changed" }
            val id = mediaId(lease.sourceId, video)
            if (core.snapshot.sources[lease.sourceId]?.status != SourceStatus.AVAILABLE) core.putOptionalSource(lease.sourceId, SourceStatus.AVAILABLE)
            val item = MediaRecord(id, video.name.take(512), lease.sourceId, MediaAvailability.READY)
            if (core.snapshot.media[id] != item) core.putMedia(item)
            guard = LocalPlaybackSession.open(core.snapshot, id)
            lastCheck = 0L
            check(authorized()) { "Playback access changed" }
            return PreparedProviderPlayback(id, profile.id, item.title, requireNotNull(guard), remote) { lease.isCurrent() && requireNotNull(guard).isAllowed(current().snapshot) }
        } catch (failure: Exception) { remote.close(); throw failure }
    }

    private fun mediaId(source: String, video: ProviderVideo) = "remote-" + MessageDigest.getInstance("SHA-256")
        .digest(listOf(source, video.torrentId, video.infohash, video.fileId).joinToString("\u0000").toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
}

private fun probeRemoteBytes(remote: RemoteByteStream) {
    val expected = minOf(remote.expectedSize, 16_384L)
    remote.open(0, expected).use { range ->
        val buffer = ByteArray(8192)
        var received = 0
        while (true) { val n = range.read(buffer); if (n < 0) break; received += n }
        check(received.toLong() == expected)
    }
}
