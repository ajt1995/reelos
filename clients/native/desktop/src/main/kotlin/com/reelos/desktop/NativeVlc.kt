package com.reelos.desktop

import com.reelos.providers.RemoteByteStream
import com.reelos.core.PlaybackPreferences
import com.reelos.core.SubtitleMode
import com.reelos.core.playbackLanguageMatches
import com.sun.jna.Callback
import com.sun.jna.Library
import com.sun.jna.Native
import com.sun.jna.Pointer
import com.sun.jna.Structure
import com.sun.jna.ptr.LongByReference
import com.sun.jna.ptr.PointerByReference
import java.awt.Canvas
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/** In-process LibVLC bridge. The native video target is an AWT Canvas inside Compose SwingPanel. */
internal class NativeVlc private constructor(private val api: LibVlc, private val instance: Pointer) : AutoCloseable {
    private val closed = AtomicBoolean(false)
    companion object {
        fun open(appearance: DesktopCaptionAppearance = DesktopCaptionAppearance()): Result<NativeVlc> = runCatching {
            val os = System.getProperty("os.name").lowercase()
            val candidates = when {
                os.contains("win") -> listOf(
                    System.getenv("REELOS_LIBVLC")?.takeIf(String::isNotBlank),
                    "C:/Program Files/VideoLAN/VLC/libvlc.dll",
                    "C:/Program Files (x86)/VideoLAN/VLC/libvlc.dll",
                )
                else -> listOf(System.getenv("REELOS_LIBVLC")?.takeIf(String::isNotBlank), "vlc")
            }.filterNotNull()
            val failure = mutableListOf<String>()
            for (candidate in candidates) {
                try {
                    val libraryPath = Path.of(candidate)
                    if (libraryPath.isAbsolute) {
                        check(Files.isRegularFile(libraryPath)) { "Library not installed at $candidate" }
                        val coreLibrary = libraryPath.parent.resolve("libvlccore.dll")
                        if (os.contains("win") && Files.isRegularFile(coreLibrary)) System.load(coreLibrary.toString())
                    }
                    val api = Native.load(candidate, LibVlc::class.java, mapOf(Library.OPTION_STRING_ENCODING to "UTF-8"))
                    val options = (listOf("--no-video-title-show", "--no-media-library", "--no-metadata-network-access") + appearance.options()).toTypedArray()
                    val instance = api.libvlc_new(options.size, options)
                    if (instance != null) return@runCatching NativeVlc(api, instance)
                    failure += "$candidate: initialization failed"
                } catch (error: RuntimeException) {
                    failure += "$candidate: ${error.message?.take(120) ?: "library could not load"}"
                } catch (error: LinkageError) {
                    failure += "$candidate: ${error.message?.take(120) ?: "library could not load"}"
                }
            }
            error("In-process LibVLC is unavailable. Install a compatible local VLC runtime or set REELOS_LIBVLC. ${failure.joinToString("; ")}")
        }
    }

    /** Local-only preparse; media with no known duration is left unavailable. */
    @Synchronized
    fun verify(path: Path): Long {
        check(!closed.get()) { "The native decoder is closed" }
        val media = api.libvlc_media_new_path(instance, path.toString()) ?: error("LibVLC could not open this local file")
        try {
            check(api.libvlc_media_parse_with_options(media, 0, 5_000) == 0) { "LibVLC could not inspect this file" }
            val deadline = System.nanoTime() + 6_000_000_000L
            var status = api.libvlc_media_get_parsed_status(media)
            while (status == 0 && System.nanoTime() < deadline) {
                Thread.sleep(25)
                status = api.libvlc_media_get_parsed_status(media)
            }
            check(status == 4) { "The local media could not be verified (parse status $status)" }
            val duration = api.libvlc_media_get_duration(media)
            check(duration > 0) { "The local media has no verified duration" }
            return duration
        } finally {
            api.libvlc_media_release(media)
        }
    }

    @Synchronized
    fun player(path: Path, resumeMs: Long, preferences: PlaybackPreferences = PlaybackPreferences()): VlcPlayback {
        check(!closed.get()) { "The native decoder is closed" }
        val media = api.libvlc_media_new_path(instance, path.toString()) ?: error("LibVLC could not open this local file")
        try {
            val player = api.libvlc_media_player_new_from_media(media) ?: error("LibVLC could not create a media player")
            return VlcPlayback(api, player, resumeMs, preferences = preferences, media = media)
        } finally {
            api.libvlc_media_release(media)
        }
    }

    /** LibVLC receives callbacks, never the signed provider URL. */
    @Synchronized
    fun player(remote: RemoteByteStream, resumeMs: Long, preferences: PlaybackPreferences = PlaybackPreferences()): VlcPlayback =
        player(ProviderByteSource(remote), resumeMs, preferences)

    @Synchronized
    internal fun player(source: RemoteByteSource, resumeMs: Long, preferences: PlaybackPreferences = PlaybackPreferences()): VlcPlayback {
        if (closed.get()) {
            source.close()
            error("The native decoder is closed")
        }
        // LibVLC 4 changed this C callback ABI; never call the 3.x signature on it.
        val version = try { api.libvlc_get_version() } catch (_: Throwable) { "" }
        if (!version.startsWith("3.")) {
            source.close()
            error("Remote callback playback requires LibVLC 3")
        }
        val callbacks = RemoteMediaCallbacks(source)
        val media = try {
            api.libvlc_media_new_callbacks(instance, callbacks.openCallback, callbacks.readCallback,
                callbacks.seekCallback, callbacks.closeCallback, null)
                ?: error("LibVLC could not open remote media")
        } catch (_: Throwable) {
            callbacks.stop()
            error("LibVLC could not open remote media")
        }
        try {
            val player = api.libvlc_media_player_new_from_media(media)
                ?: error("LibVLC could not create a media player")
            return VlcPlayback(api, player, resumeMs, callbacks, preferences, media)
        } catch (_: Throwable) {
            callbacks.stop()
            error("LibVLC could not create a media player")
        } finally {
            api.libvlc_media_release(media)
        }
    }

    @Synchronized
    override fun close() {
        if (closed.compareAndSet(false, true)) api.libvlc_release(instance)
    }

}

/** Exact LibVLC3 media-track ABI; language comes from stream metadata, not display-name guessing. */
@Structure.FieldOrder("codec", "original", "id", "type", "profile", "level", "details", "bitrate", "language", "description")
internal class VlcMediaTrack(pointer: Pointer) : Structure(pointer) {
    @JvmField var codec = 0
    @JvmField var original = 0
    @JvmField var id = 0
    @JvmField var type = 0
    @JvmField var profile = 0
    @JvmField var level = 0
    @JvmField var details: Pointer? = null
    @JvmField var bitrate = 0
    @JvmField var language: Pointer? = null
    @JvmField var description: Pointer? = null
    init { read() }
}

internal data class PlaybackState(val positionMs: Long, val durationMs: Long, val playing: Boolean, val ended: Boolean, val error: Boolean, val seekable: Boolean)
internal data class VlcTrack(val id: Int, val name: String)
internal data class VlcTracks(
    val audio: List<VlcTrack>, val audioId: Int,
    val subtitles: List<VlcTrack>, val subtitleId: Int,
)

/** libvlc_track_description_t in LibVLC 3; native strings and nodes belong to LibVLC. */
@Structure.FieldOrder("i_id", "psz_name", "p_next")
internal class VlcTrackDescription(pointer: Pointer) : Structure(pointer) {
    @JvmField var i_id: Int = 0
    @JvmField var psz_name: Pointer? = null
    @JvmField var p_next: Pointer? = null
    init { read() }
}

internal fun readTrackDescriptions(api: LibVlc, head: Pointer?): List<VlcTrack> {
    if (head == null) return emptyList()
    try {
        val result = mutableListOf<VlcTrack>()
        val seen = mutableSetOf<Long>()
        var node: Pointer? = head
        while (node != null && result.size < 128 && seen.add(Pointer.nativeValue(node))) {
            val entry = VlcTrackDescription(node)
            result += VlcTrack(entry.i_id, entry.psz_name?.getString(0, "UTF-8")?.take(120).orEmpty()
                .ifBlank { "Track ${entry.i_id}" })
            node = entry.p_next
        }
        return result.distinctBy(VlcTrack::id)
    } finally {
        api.libvlc_track_description_list_release(head)
    }
}

internal class VlcPlayback(
    private val api: LibVlc,
    private val player: Pointer,
    private val resumeMs: Long,
    private val remoteCallbacks: RemoteMediaCallbacks? = null,
    private val preferences: PlaybackPreferences = PlaybackPreferences(),
    /** Borrowed from this player, which retains its media until libvlc_media_player_release. */
    private val media: Pointer? = null,
) : AutoCloseable {
    private val started = AtomicBoolean(false)
    private val closed = AtomicBoolean(false)
    private var resumeApplied = false
    private var audioPreferenceApplied = preferences.audioLanguage == null
    private var subtitlePreferenceApplied = preferences.subtitleMode == SubtitleMode.AUTO

    @Synchronized
    fun tracks(): VlcTracks {
        check(!closed.get()) { "The player is closed" }
        // Track description ABI is the LibVLC 3 contract used by this desktop adapter.
        check(api.libvlc_get_version().startsWith("3.")) { "Track controls require LibVLC 3" }
        val audio = readTrackDescriptions(api, api.libvlc_audio_get_track_description(player)).filter { it.id >= 0 }
        val subtitles = readTrackDescriptions(api, api.libvlc_video_get_spu_description(player)).filter { it.id >= 0 }
        return VlcTracks(audio, api.libvlc_audio_get_track(player), subtitles, api.libvlc_video_get_spu(player))
    }

    @Synchronized
    fun selectAudioTrack(id: Int) {
        val available = tracks().audio
        require(available.any { it.id == id }) { "That audio track is unavailable" }
        check(api.libvlc_audio_set_track(player, id) == 0) { "LibVLC could not select that audio track" }
        audioPreferenceApplied = true // An explicit in-film choice wins over defaults and late tracks.
    }

    @Synchronized
    fun selectSubtitleTrack(id: Int) {
        val available = tracks().subtitles
        require((id == -1 && available.isNotEmpty()) || available.any { it.id == id }) { "That subtitle track is unavailable" }
        check(api.libvlc_video_set_spu(player, id) == 0) { "LibVLC could not select that subtitle track" }
        subtitlePreferenceApplied = true
    }

    @Synchronized
    fun subtitleDelayMs(): Long {
        check(!closed.get()) { "The player is closed" }
        return api.libvlc_video_get_spu_delay(player) / 1_000
    }

    @Synchronized
    fun setSubtitleDelayMs(delayMs: Long) {
        check(!closed.get()) { "The player is closed" }
        check(api.libvlc_video_set_spu_delay(player, com.reelos.core.SubtitleTiming.micros(delayMs)) == 0) {
            "Caption timing could not be changed"
        }
    }

    @Synchronized
    fun attach(canvas: Canvas) {
        check(!closed.get()) { "The player is closed" }
        if (!canvas.isDisplayable || !started.compareAndSet(false, true)) return
        if (System.getProperty("os.name").startsWith("Windows")) {
            api.libvlc_media_player_set_hwnd(player, Native.getComponentPointer(canvas))
        } else {
            api.libvlc_media_player_set_xwindow(player, Native.getComponentID(canvas).toInt())
        }
        check(api.libvlc_media_player_play(player) == 0) { "LibVLC could not begin playback" }
    }

    @Synchronized
    fun poll(): PlaybackState {
        check(!closed.get()) { "The player is closed" }
        if (started.get()) applyPreferredTracks()
        val duration = api.libvlc_media_player_get_length(player).coerceAtLeast(0)
        val seekable = api.libvlc_media_player_is_seekable(player) != 0
        if (started.get() && !resumeApplied && seekable && duration > 0) {
            if (resumeMs in 1 until duration) api.libvlc_media_player_set_time(player, resumeMs)
            resumeApplied = true
        }
        val state = api.libvlc_media_player_get_state(player)
        return PlaybackState(
            positionMs = api.libvlc_media_player_get_time(player).coerceAtLeast(0),
            durationMs = duration,
            playing = api.libvlc_media_player_is_playing(player) != 0,
            ended = state == 6,
            error = state == 7 || remoteCallbacks?.failed == true,
            seekable = seekable,
        )
    }

    private fun applyPreferredTracks() {
        if ((audioPreferenceApplied && subtitlePreferenceApplied) || media == null) return
        check(api.libvlc_get_version().startsWith("3.")) { "Language preferences require LibVLC 3" }
        val pointer = PointerByReference()
        val count = api.libvlc_media_tracks_get(media, pointer)
        val array = pointer.value ?: return
        try {
            require(count in 0..4096) { "Invalid native track count" }
            val available = tracks()
            if (!subtitlePreferenceApplied && preferences.subtitleMode == SubtitleMode.OFF && available.subtitles.isNotEmpty()) {
                subtitlePreferenceApplied = api.libvlc_video_set_spu(player, -1) == 0
            }
            for (index in 0 until count) {
                val entry = VlcMediaTrack(array.getPointer(index.toLong() * Native.POINTER_SIZE))
                val language = entry.language?.getString(0, "UTF-8")
                if (!audioPreferenceApplied && entry.type == 0 && available.audio.any { it.id == entry.id } &&
                    playbackLanguageMatches(preferences.audioLanguage, language)) {
                    audioPreferenceApplied = api.libvlc_audio_set_track(player, entry.id) == 0
                }
                if (!subtitlePreferenceApplied && preferences.subtitleMode == SubtitleMode.ON && entry.type == 2 &&
                    available.subtitles.any { it.id == entry.id } && (preferences.subtitleLanguage == null || playbackLanguageMatches(preferences.subtitleLanguage, language))) {
                    subtitlePreferenceApplied = api.libvlc_video_set_spu(player, entry.id) == 0
                }
            }
        } finally { api.libvlc_media_tracks_release(array, count) }
    }

    @Synchronized
    fun pause() {
        check(!closed.get()) { "The player is closed" }
        if (started.get()) api.libvlc_media_player_set_pause(player, 1)
    }

    @Synchronized
    fun togglePause() {
        check(!closed.get()) { "The player is closed" }
        if (api.libvlc_media_player_get_state(player) == 6) {
            // LibVLC 3 can remain in Ended after a bare seek(0) + play().
            api.libvlc_media_player_stop(player)
            resumeApplied = true
            check(api.libvlc_media_player_play(player) == 0) { "LibVLC could not replay this media" }
        } else {
            api.libvlc_media_player_set_pause(player, if (api.libvlc_media_player_is_playing(player) != 0) 1 else 0)
        }
    }

    @Synchronized
    fun seek(positionMs: Long) {
        check(!closed.get()) { "The player is closed" }
        check(api.libvlc_media_player_is_seekable(player) != 0) { "This media cannot be seeked" }
        resumeApplied = true
        api.libvlc_media_player_set_time(player, positionMs.coerceAtLeast(0))
    }

    @Synchronized
    override fun close() {
        if (!closed.compareAndSet(false, true)) return
        // Stop/cancel remote reads first: LibVLC stop waits for its read callback to return.
        remoteCallbacks?.stop()
        try {
            if (started.get()) api.libvlc_media_player_stop(player)
        } finally {
            api.libvlc_media_player_release(player)
        }
    }
}

internal interface RemoteByteSource : AutoCloseable {
    val expectedSize: Long
    fun open(offset: Long): InputStream
}

private class ProviderByteSource(private val remote: RemoteByteStream) : RemoteByteSource {
    override val expectedSize: Long get() = remote.expectedSize
    override fun open(offset: Long): InputStream = remote.open(offset)
    override fun close() = remote.close()
}

internal fun interface VlcOpenCallback : Callback {
    fun callback(opaque: Pointer?, data: PointerByReference?, size: LongByReference?): Int
}
internal fun interface VlcReadCallback : Callback {
    fun callback(data: Pointer?, buffer: Pointer?, length: Long): Long
}
internal fun interface VlcSeekCallback : Callback {
    fun callback(data: Pointer?, offset: Long): Int
}
internal fun interface VlcCloseCallback : Callback {
    fun callback(data: Pointer?)
}

/** Owns callback and stream lifetimes until the corresponding player has fully stopped. */
internal class RemoteMediaCallbacks(private val source: RemoteByteSource) {
    private class Cursor(@Volatile var input: InputStream, @Volatile var offset: Long)
    private val stopped = AtomicBoolean(false)
    private val failure = AtomicBoolean(false)
    private val nextId = AtomicLong(1)
    private val cursors = ConcurrentHashMap<Long, Cursor>()
    val failed: Boolean get() = failure.get()

    val openCallback = VlcOpenCallback { _, data, size ->
        try {
            check(data != null && size != null && !stopped.get() && source.expectedSize > 0)
            val input = source.open(0)
            if (stopped.get()) { input.close(); error("stopped") }
            val id = nextId.getAndIncrement()
            check(id > 0)
            cursors[id] = Cursor(input, 0)
            if (stopped.get()) {
                cursors.remove(id)?.input?.close()
                error("stopped")
            }
            data.value = Pointer(id)
            size.value = source.expectedSize
            0
        } catch (_: Throwable) {
            failure.set(true)
            -1
        }
    }

    val readCallback = VlcReadCallback { data, buffer, length ->
        try {
            val cursor = data?.let { cursors[Pointer.nativeValue(it)] }
            check(!stopped.get() && cursor != null && buffer != null && length >= 0)
            val remaining = source.expectedSize - cursor.offset
            if (remaining == 0L || length == 0L) 0L
            else {
                val count = minOf(length, remaining, 64L * 1024).toInt()
                val bytes = ByteArray(count)
                try {
                    val read = cursor.input.read(bytes)
                    check(!stopped.get() && read in 1..count)
                    buffer.write(0, bytes, 0, read)
                    cursor.offset += read
                    read.toLong()
                } finally { bytes.fill(0) }
            }
        } catch (_: Throwable) {
            failure.set(true)
            -1L
        }
    }

    val seekCallback = VlcSeekCallback { data, offset ->
        try {
            val cursor = data?.let { cursors[Pointer.nativeValue(it)] }
            check(!stopped.get() && cursor != null && offset in 0..source.expectedSize)
            val input = if (offset == source.expectedSize) ByteArrayInputStream(byteArrayOf())
                else source.open(offset)
            if (stopped.get()) { input.close(); error("stopped") }
            val old = cursor.input
            cursor.input = input
            cursor.offset = offset
            if (stopped.get()) { input.close(); error("stopped") }
            try { old.close() } catch (_: Exception) { /* Current source already replaced. */ }
            0
        } catch (_: Throwable) {
            failure.set(true)
            -1
        }
    }

    val closeCallback = VlcCloseCallback { data ->
        try {
            data?.let { cursors.remove(Pointer.nativeValue(it)) }?.let { cursor ->
                try { cursor.input.close() } catch (_: Throwable) { /* Already cancelled. */ }
            }
        } catch (_: Throwable) { failure.set(true) }
    }

    fun stop() {
        if (!stopped.compareAndSet(false, true)) return
        try { source.close() } catch (_: Throwable) { failure.set(true) }
        cursors.values.forEach { cursor ->
            try { cursor.input.close() } catch (_: Throwable) { /* Already cancelled. */ }
        }
        cursors.clear()
    }
}

internal interface LibVlc : Library {
    fun libvlc_video_get_spu_delay(player: Pointer): Long
    fun libvlc_video_set_spu_delay(player: Pointer, delayUs: Long): Int
    fun libvlc_media_tracks_get(media: Pointer, tracks: PointerByReference): Int
    fun libvlc_media_tracks_release(tracks: Pointer, count: Int)
    fun libvlc_new(argc: Int, argv: Array<String>): Pointer?
    fun libvlc_get_version(): String
    fun libvlc_release(instance: Pointer)
    fun libvlc_media_new_path(instance: Pointer, path: String): Pointer?
    fun libvlc_media_new_callbacks(instance: Pointer, open: VlcOpenCallback, read: VlcReadCallback,
        seek: VlcSeekCallback, close: VlcCloseCallback, opaque: Pointer?): Pointer?
    fun libvlc_media_release(media: Pointer)
    fun libvlc_media_parse_with_options(media: Pointer, flags: Int, timeoutMs: Int): Int
    fun libvlc_media_get_parsed_status(media: Pointer): Int
    fun libvlc_media_get_duration(media: Pointer): Long
    fun libvlc_media_player_new_from_media(media: Pointer): Pointer?
    fun libvlc_media_player_set_hwnd(player: Pointer, handle: Pointer)
    fun libvlc_media_player_set_xwindow(player: Pointer, handle: Int)
    fun libvlc_media_player_play(player: Pointer): Int
    fun libvlc_media_player_stop(player: Pointer)
    fun libvlc_media_player_release(player: Pointer)
    fun libvlc_media_player_get_state(player: Pointer): Int
    fun libvlc_media_player_get_time(player: Pointer): Long
    fun libvlc_media_player_set_time(player: Pointer, positionMs: Long)
    fun libvlc_media_player_get_length(player: Pointer): Long
    fun libvlc_media_player_is_playing(player: Pointer): Int
    fun libvlc_media_player_is_seekable(player: Pointer): Int
    fun libvlc_media_player_set_pause(player: Pointer, paused: Int)
    fun libvlc_audio_get_track_description(player: Pointer): Pointer?
    fun libvlc_audio_get_track(player: Pointer): Int
    fun libvlc_audio_set_track(player: Pointer, trackId: Int): Int
    fun libvlc_video_get_spu_description(player: Pointer): Pointer?
    fun libvlc_video_get_spu(player: Pointer): Int
    fun libvlc_video_set_spu(player: Pointer, trackId: Int): Int
    fun libvlc_track_description_list_release(description: Pointer)
}
