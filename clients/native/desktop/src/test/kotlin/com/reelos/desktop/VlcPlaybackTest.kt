package com.reelos.desktop

import com.sun.jna.Pointer
import java.lang.reflect.Proxy
import kotlin.test.Test
import kotlin.test.assertEquals

class VlcPlaybackTest {
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
