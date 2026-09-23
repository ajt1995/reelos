package com.reelos.desktop

import com.reelos.core.MediaAction
import com.reelos.core.MediaAvailability
import com.reelos.core.MediaRecord
import com.reelos.core.PERSONAL_SOURCE_ID
import com.reelos.core.ReelCore
import com.reelos.core.SourceStatus
import java.net.URI
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption.ATOMIC_MOVE
import java.nio.file.StandardCopyOption.REPLACE_EXISTING
import java.security.MessageDigest

/** Keeps private file paths outside the shared profile/catalog snapshot. */
internal class DesktopMediaLibrary(private val directory: Path, private val core: ReelCore, private val vlc: NativeVlc?) {
    private val mappings = directory.resolve("personal-media-paths")

    @Synchronized
    fun importFile(path: Path): MediaRecord {
        check(core.snapshot.sources[PERSONAL_SOURCE_ID]?.status == SourceStatus.AVAILABLE) { "Finish source setup before importing media" }
        val real = readableFile(path)
        val id = idFor(real)
        val title = real.fileName.toString().take(512)
        val status = if (vlc == null) MediaAvailability.UNAVAILABLE else {
            vlc.verify(real)
            MediaAvailability.READY
        }
        Files.createDirectories(mappings)
        val temporary = Files.createTempFile(mappings, "$id-", ".tmp")
        try {
            Files.writeString(temporary, real.toUri().toString())
            Files.move(temporary, mapping(id), ATOMIC_MOVE, REPLACE_EXISTING)
        } finally {
            Files.deleteIfExists(temporary)
        }
        return MediaRecord(id, title, PERSONAL_SOURCE_ID, status).also(core::putMedia)
    }

    /** Recheck the real file and local decoder before granting playback. */
    @Synchronized
    fun open(id: String, profileId: String): VlcPlayback {
        check(core.snapshot.activeProfileId == profileId && core.canEnterHome(profileId)) { "This profile is not ready for playback" }
        check(core.mediaAction(id) == MediaAction.PLAY) { "This media is unavailable" }
        val record = core.snapshot.media[id]
        check(record?.sourceId == PERSONAL_SOURCE_ID && id.startsWith("desktop-personal-")) { "This is not desktop personal media" }
        val real = try { resolve(id) } catch (failure: Exception) {
            markUnavailable(record)
            throw failure
        }
        val decoder = vlc ?: run {
            markUnavailable(record)
            error("In-process LibVLC is unavailable on this computer")
        }
        try {
            decoder.verify(real)
        } catch (failure: Exception) {
            markUnavailable(record)
            throw failure
        }
        val savedPosition = core.snapshot.profiles.getValue(profileId).playbackPositionsMs[id] ?: 0L
        return decoder.player(real, savedPosition)
    }

    /** Revalidate persisted paths so returning files can become playable again. */
    @Synchronized
    fun reconcile() {
        for (record in core.snapshot.media.values.filter { it.id.startsWith("desktop-personal-") && it.sourceId == PERSONAL_SOURCE_ID }) {
            val available = vlc?.let { decoder ->
                try {
                    decoder.verify(resolve(record.id))
                    true
                } catch (interrupted: InterruptedException) {
                    Thread.currentThread().interrupt()
                    throw interrupted
                } catch (_: Exception) { false }
            } == true
            val status = if (available) MediaAvailability.READY else MediaAvailability.UNAVAILABLE
            if (record.availability != status) core.putMedia(record.copy(availability = status))
        }
    }

    private fun markUnavailable(record: MediaRecord) {
        core.putMedia(record.copy(availability = MediaAvailability.UNAVAILABLE))
    }

    private fun resolve(id: String): Path {
        check(Regex("desktop-personal-[0-9a-f]{64}").matches(id)) { "Invalid personal media identifier" }
        val mapped = Path.of(URI.create(Files.readString(mapping(id))))
        val real = readableFile(mapped)
        check(idFor(real) == id) { "The personal media path changed" }
        return real
    }

    private fun mapping(id: String): Path = mappings.resolve("$id.path")

    private fun readableFile(path: Path): Path {
        val real = path.toRealPath()
        check(Files.isRegularFile(real) && Files.isReadable(real)) { "The local media file is missing or unreadable" }
        return real
    }

    private fun idFor(real: Path): String = "desktop-personal-" + MessageDigest.getInstance("SHA-256")
        .digest(real.toUri().toString().toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
}
