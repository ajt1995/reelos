package com.reelos.desktop

import com.sun.jna.Pointer
import com.sun.jna.Memory
import com.sun.jna.Native
import java.lang.reflect.Proxy
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlin.test.assertFalse

class VlcPlaybackTest {
    @Test
    fun lateTracksReseekOnceAndNeverCommitAnAdvancedMutedPosition() {
        val frame = java.awt.Frame()
        val canvas = java.awt.Canvas()
        javax.swing.SwingUtilities.invokeAndWait { frame.add(canvas); frame.setSize(320, 180); frame.addNotify(); frame.validate() }
        val entry = Memory((3 * Native.POINTER_SIZE).toLong()).apply { clear(); setInt(0, 1) }
        var tracksReady = false
        var position = 6_000L
        var state = 3
        var muted = 0
        var seeks = 0
        var policyCalls = 0
        val api = Proxy.newProxyInstance(LibVlc::class.java.classLoader, arrayOf(LibVlc::class.java)) { _, method, args ->
            when (method.name) {
                "libvlc_get_version" -> "3.0.21"
                "libvlc_audio_get_track_description" -> if (tracksReady) entry else null
                "libvlc_video_get_spu_description" -> null
                "libvlc_audio_get_track" -> 1
                "libvlc_video_get_spu" -> -1
                "libvlc_video_get_spu_delay" -> 0L
                "libvlc_media_player_get_length" -> 30_000L
                "libvlc_media_player_get_time" -> position
                "libvlc_media_player_get_state" -> state
                "libvlc_media_get_stats" -> { (args!![1] as VlcMediaStats).apply { displayedPictures = 1; write() }; 1 }
                "libvlc_media_player_is_playing" -> if (state == 3) 1 else 0
                "libvlc_media_player_has_vout", "libvlc_media_player_is_seekable" -> 1
                "libvlc_audio_get_mute" -> muted
                "libvlc_audio_set_mute" -> { muted = args!![1] as Int; null }
                "libvlc_media_player_set_pause" -> { state = 4; null }
                "libvlc_media_player_set_time" -> { assertEquals(6_000L, args!![1]); seeks++; null }
                "libvlc_media_player_play" -> 0
                "libvlc_media_add_option", "libvlc_media_player_set_hwnd", "libvlc_media_player_set_xwindow",
                "libvlc_track_description_list_release", "libvlc_media_player_stop", "libvlc_media_player_release" -> null
                else -> error("Unexpected native call ${method.name}")
            }
        } as LibVlc
        try {
            VlcPlayback(api, Pointer(1), 0, media = Pointer(2)).use { playback ->
                playback.restoreBeforeAttach(VlcContinuation(6_000, false, 1, null, 0)) { policyCalls++; true }
                javax.swing.SwingUtilities.invokeAndWait { playback.attach(canvas) }
                assertTrue(playback.poll().restoring)
                position = 10_000 // Decoder advances before track discovery completes.
                tracksReady = true
                repeat(3) { assertTrue(playback.poll().restoring) }
                assertEquals(1, seeks, "Asynchronous seek must not be reset every poll")
                assertEquals(1, muted)
                assertEquals(0, policyCalls)
                position = 6_050 // Seek acknowledgment.
                assertTrue(playback.poll().restoring)
                assertEquals(1, muted, "Remain muted until pause is acknowledged")
                val restored = playback.poll()
                assertFalse(restored.restoring)
                assertFalse(restored.playing)
                assertEquals(0, muted)
                assertEquals(1, policyCalls)
            }
        } finally { javax.swing.SwingUtilities.invokeAndWait { frame.dispose() } }
    }

    @Test
    fun enumeratesNativeTracksSelectsOnlyAvailableIdsAndReleasesDescriptions() {
        val allocated = mutableListOf<Memory>()
        fun description(id: Int, name: String, next: Pointer? = null): Pointer {
            val text = Memory(name.toByteArray(Charsets.UTF_8).size.toLong() + 1)
            text.setString(0, name, "UTF-8")
            val entry = Memory((3 * Native.POINTER_SIZE).toLong())
            entry.setInt(0, id)
            entry.setPointer(Native.POINTER_SIZE.toLong(), text)
            entry.setPointer((2 * Native.POINTER_SIZE).toLong(), next)
            allocated += text
            allocated += entry
            return entry
        }
        val audio = description(2, "Español", description(1, "English"))
        val subtitles = description(8, "Español", description(7, "English"))
        val selected = mutableListOf<String>()
        var audioId = 1
        var subtitleId = -1
        val api = Proxy.newProxyInstance(LibVlc::class.java.classLoader, arrayOf(LibVlc::class.java)) { _, method, args ->
            when (method.name) {
                "libvlc_get_version" -> "3.0.21 Vetinari"
                "libvlc_audio_get_track_description" -> audio
                "libvlc_video_get_spu_description" -> subtitles
                "libvlc_track_description_list_release" -> { selected += "release"; null }
                "libvlc_audio_get_track" -> audioId
                "libvlc_video_get_spu" -> subtitleId
                "libvlc_audio_set_track" -> { audioId = args!![1] as Int; selected += "audio:$audioId"; 0 }
                "libvlc_video_set_spu" -> { subtitleId = args!![1] as Int; selected += "subtitle:$subtitleId"; 0 }
                "libvlc_media_player_release" -> null
                else -> error("Unexpected native call ${method.name}")
            }
        } as LibVlc
        VlcPlayback(api, Pointer(1), 0).use { playback ->
            val found = playback.tracks()
            assertEquals(listOf(VlcTrack(2, "Español"), VlcTrack(1, "English")), found.audio)
            assertEquals(listOf(VlcTrack(8, "Español"), VlcTrack(7, "English")), found.subtitles)
            assertEquals(-1, found.subtitleId)
            playback.selectAudioTrack(2)
            playback.selectSubtitleTrack(8)
            playback.selectSubtitleTrack(-1)
            assertFailsWith<IllegalArgumentException> { playback.selectAudioTrack(99) }
            assertFailsWith<IllegalArgumentException> { playback.selectSubtitleTrack(99) }
            assertEquals(2, playback.tracks().audioId)
            assertEquals(-1, playback.tracks().subtitleId)
        }
        assertEquals(16, selected.count { it == "release" })
        assertEquals(listOf("audio:2", "subtitle:8", "subtitle:-1"), selected.filter { it != "release" })
        assertEquals(8, allocated.size)
    }

    @Test
    fun replayStopsEndedPlayerBeforeStartingItAgain() {
        val calls = mutableListOf<String>()
        var state = 6 // LibVLC Ended
        val api = Proxy.newProxyInstance(LibVlc::class.java.classLoader, arrayOf(LibVlc::class.java)) { _, method, _ ->
            when (method.name) {
                "libvlc_media_player_get_state" -> { calls += "state"; state }
                "libvlc_media_player_stop" -> { calls += "stop"; state = 5; null }
                "libvlc_media_player_play" -> { calls += "play"; state = 3; 0 }
                "libvlc_media_player_release" -> null
                else -> error("Unexpected native call ${method.name}")
            }
        } as LibVlc
        val playback = VlcPlayback(api, Pointer(1), 28_000)
        try {
            playback.togglePause()
            assertEquals(3, state)
            assertEquals(listOf("state", "stop", "play"), calls)
        } finally { playback.close() }
    }
}
