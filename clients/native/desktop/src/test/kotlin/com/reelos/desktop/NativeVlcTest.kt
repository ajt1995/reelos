package com.reelos.desktop

import java.awt.Canvas
import com.reelos.core.PlaybackPreferences
import com.reelos.core.SubtitleMode
import java.awt.Frame
import java.awt.GraphicsEnvironment
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.TimeUnit
import org.junit.Assume.assumeTrue
import javax.swing.SwingUtilities
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class NativeVlcTest {
    @Test
    fun installedDecoderSwitchesRealMultitrackFixtureWhenOptedIn() {
        val supplied = System.getenv("REELOS_DESKTOP_TRACK_FIXTURE")
        assumeTrue("Set REELOS_DESKTOP_TRACK_FIXTURE for the real multitrack test", !supplied.isNullOrBlank())
        check(!GraphicsEnvironment.isHeadless()) { "A desktop display is required for native track validation" }
        val fixture = Path.of(requireNotNull(supplied))
        check(Files.isRegularFile(fixture) && fixture.fileName.toString() == "Native-Tracks-30s.mp4") {
            "The bundled multitrack fixture is missing"
        }
        val frame = Frame()
        val canvas = Canvas()
        SwingUtilities.invokeAndWait {
            frame.add(canvas)
            frame.setSize(320, 180)
            frame.addNotify()
        }
        check(canvas.isDisplayable) { "Native test drawable could not be created" }
        try {
            NativeVlc.open().getOrThrow().use { vlc ->
                vlc.player(fixture, 0, PlaybackPreferences("es", "en", SubtitleMode.ON)).use { playback ->
                    SwingUtilities.invokeAndWait { playback.attach(canvas) }
                    awaitTrackState(playback) { state, _ -> state.playing && state.positionMs > 500 }
                    val initial = awaitTrackState(playback) { _, tracks ->
                        tracks.audio.size == 2 && tracks.subtitles.size == 2
                    }.second
                    assertEquals(2, initial.audio.map { it.id }.distinct().size)
                    assertEquals(2, initial.subtitles.map { it.id }.distinct().size)
                    // Fixture track order is English then Spanish for both media types.
                    awaitTrackState(playback) { _, tracks -> tracks.audioId == tracks.audio.last().id && tracks.subtitleId == tracks.subtitles.first().id }
                    initial.audio.forEach { track ->
                        playback.selectAudioTrack(track.id)
                        awaitTrackState(playback) { _, tracks -> tracks.audioId == track.id }
                    }
                    initial.subtitles.forEach { track ->
                        playback.selectSubtitleTrack(track.id)
                        awaitTrackState(playback) { _, tracks -> tracks.subtitleId == track.id }
                    }
                    listOf(5_000L, -5_000L, 0L).forEach { offset ->
                        playback.setSubtitleDelayMs(offset)
                        assertEquals(offset, playback.subtitleDelayMs())
                        assertFalse(playback.poll().error)
                    }
                    playback.selectSubtitleTrack(-1)
                    val afterOff = awaitTrackState(playback) { _, tracks -> tracks.subtitleId == -1 }
                    assertFalse(afterOff.first.error)
                    awaitTrackState(playback) { state, _ ->
                        state.playing && state.positionMs >= afterOff.first.positionMs + 300
                    }
                    var clock = 0L
                    val sleep = com.reelos.core.PlaybackSleepTimer { clock }.apply { after(1_000) }
                    clock = 1_000
                    assertTrue(sleep.shouldPause(false))
                    playback.pause()
                    val paused = awaitTrackState(playback) { state, _ -> !state.playing && !state.ended }.first
                    Thread.sleep(350)
                    assertTrue(kotlin.math.abs(playback.poll().positionMs - paused.positionMs) < 400)
                    playback.togglePause()
                    awaitTrackState(playback) { state, _ -> state.playing && state.positionMs > paused.positionMs }
                }
                vlc.player(fixture, 0, PlaybackPreferences(subtitleMode = SubtitleMode.OFF)).use { playback ->
                    SwingUtilities.invokeAndWait { playback.attach(canvas) }
                    awaitTrackState(playback) { state, tracks -> state.playing && state.positionMs > 500 && tracks.subtitleId == -1 }
                }
            }
        } finally {
            SwingUtilities.invokeAndWait { frame.dispose() }
        }
    }

    private fun awaitTrackState(
        playback: VlcPlayback,
        accepted: (PlaybackState, VlcTracks) -> Boolean,
    ): Pair<PlaybackState, VlcTracks> {
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(15)
        var last = "not observed"
        while (System.nanoTime() < deadline) {
            val state = playback.poll()
            check(!state.error) { "LibVLC reported a media or decoding error" }
            val tracks = playback.tracks()
            last = "audio=${tracks.audioId}/${tracks.audio}, subtitles=${tracks.subtitleId}/${tracks.subtitles}"
            if (accepted(state, tracks)) return state to tracks
            Thread.sleep(100)
        }
        error("LibVLC fixture did not reach expected track state: $last")
    }

    @Test
    fun installedDecoderParsesRealLocalMediaWhenFixtureIsProvided() {
        val fixture = System.getenv("REELOS_DESKTOP_FIXTURE")
        assumeTrue("Set REELOS_DESKTOP_FIXTURE to exercise the installed decoder", fixture != null)
        NativeVlc.open().getOrThrow().use { vlc ->
            assertTrue(vlc.verify(Path.of(requireNotNull(fixture))) > 0)
        }
    }
}
