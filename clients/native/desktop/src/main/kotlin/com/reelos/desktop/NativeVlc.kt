package com.reelos.desktop

import com.sun.jna.Library
import com.sun.jna.Native
import com.sun.jna.Pointer
import java.awt.Canvas
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.atomic.AtomicBoolean

/** In-process LibVLC bridge. The native video target is an AWT Canvas inside Compose SwingPanel. */
internal class NativeVlc private constructor(private val api: LibVlc, private val instance: Pointer) : AutoCloseable {
    private val closed = AtomicBoolean(false)
    companion object {
        fun open(): Result<NativeVlc> = runCatching {
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
                    val instance = api.libvlc_new(3, arrayOf("--no-video-title-show", "--no-media-library", "--no-metadata-network-access"))
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
    fun player(path: Path, resumeMs: Long): VlcPlayback {
        check(!closed.get()) { "The native decoder is closed" }
        val media = api.libvlc_media_new_path(instance, path.toString()) ?: error("LibVLC could not open this local file")
        try {
            val player = api.libvlc_media_player_new_from_media(media) ?: error("LibVLC could not create a media player")
            return VlcPlayback(api, player, resumeMs)
        } finally {
            api.libvlc_media_release(media)
        }
    }

    @Synchronized
    override fun close() {
        if (closed.compareAndSet(false, true)) api.libvlc_release(instance)
    }
}

internal data class PlaybackState(val positionMs: Long, val durationMs: Long, val playing: Boolean, val ended: Boolean, val error: Boolean, val seekable: Boolean)

internal class VlcPlayback(private val api: LibVlc, private val player: Pointer, private val resumeMs: Long) : AutoCloseable {
    private val started = AtomicBoolean(false)
    private val closed = AtomicBoolean(false)
    private var resumeApplied = false

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
            error = state == 7,
            seekable = seekable,
        )
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
        try {
            if (started.get()) api.libvlc_media_player_stop(player)
        } finally {
            api.libvlc_media_player_release(player)
        }
    }
}

internal interface LibVlc : Library {
    fun libvlc_new(argc: Int, argv: Array<String>): Pointer?
    fun libvlc_release(instance: Pointer)
    fun libvlc_media_new_path(instance: Pointer, path: String): Pointer?
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
}
