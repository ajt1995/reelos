package com.reelos.desktop

import com.sun.jna.Pointer
import com.sun.jna.Memory
import com.sun.jna.Native
import java.lang.reflect.Proxy
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class VlcPlaybackTest {
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
