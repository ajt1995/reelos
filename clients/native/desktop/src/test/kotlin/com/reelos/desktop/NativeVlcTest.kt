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
    fun captionRestartChecksSleepDeadlineAtResumeAndStaysPaused() {
        val supplied = System.getenv("REELOS_DESKTOP_TRACK_FIXTURE")
        assumeTrue("Real multitrack fixture required", !supplied.isNullOrBlank())
        val frame = Frame()
        val canvas = Canvas()
        SwingUtilities.invokeAndWait { frame.add(canvas); frame.setSize(640, 360); frame.addNotify(); frame.validate() }
        var clock = 0L
        val sleep = com.reelos.core.PlaybackSleepTimer { clock }.apply { after(1_000) }
        var policyCalls = 0
        try {
            NativeVlc.open().getOrThrow().use { vlc ->
                vlc.player(Path.of(requireNotNull(supplied)), 0).use { playback ->
                    playback.restoreBeforeAttach(VlcContinuation(6_000, true, null, null, 0)) {
                        policyCalls++
                        !sleep.shouldPause(false)
                    }
                    clock = 1_000 // Deadline expires after preparation, before actual native restoration.
                    SwingUtilities.invokeAndWait { playback.attach(canvas) }
                    val state = awaitTrackState(playback) { state, _ -> !state.restoring && state.seekable }.first
                    assertEquals(1, policyCalls)
                    assertFalse(state.playing)
                    assertTrue(kotlin.math.abs(state.positionMs - 6_000) <= 400)
                    Thread.sleep(350)
                    assertFalse(playback.poll().playing)
                }
            }
        } finally { SwingUtilities.invokeAndWait { frame.dispose() } }
    }

    @Test
    fun deniedCaptionRestartKeepsOriginalAvailableForPausedReattachment() {
        val supplied = System.getenv("REELOS_DESKTOP_TRACK_FIXTURE")
        assumeTrue("Real multitrack fixture required", !supplied.isNullOrBlank())
        val fixture = Path.of(requireNotNull(supplied))
        val frame = Frame()
        val canvas = Canvas()
        SwingUtilities.invokeAndWait { frame.add(canvas); frame.setSize(640, 360); frame.addNotify(); frame.validate() }
        try {
            NativeVlc.open().getOrThrow().use { originalRuntime ->
                originalRuntime.player(fixture, 0).use { original ->
                    SwingUtilities.invokeAndWait { original.attach(canvas) }
                    awaitTrackState(original) { state, _ -> state.playing && state.seekable }
                    original.seek(6_000)
                    awaitTrackState(original) { state, _ -> state.positionMs in 5_600..7_000 }
                    val saved = original.pauseForReplacement()
                    awaitTrackState(original) { state, _ -> !state.playing }
                    original.releaseDrawableForReplacement()
                    NativeVlc.open().getOrThrow().use { replacementRuntime ->
                        replacementRuntime.player(fixture, 0).use { replacement ->
                            replacement.restoreBeforeAttach(saved) { error("Test source authority revoked") }
                            SwingUtilities.invokeAndWait { replacement.attach(canvas) }
                            val failure = runCatching {
                                awaitTrackState(replacement) { state, _ -> !state.restoring }
                            }.exceptionOrNull()
                            assertEquals("Test source authority revoked", failure?.message)
                        }
                    }
                    val freshCanvas = Canvas()
                    SwingUtilities.invokeAndWait {
                        frame.remove(canvas); frame.add(freshCanvas); frame.validate()
                        original.attach(freshCanvas)
                    }
                    val returned = awaitTrackState(original) { state, _ -> !state.restoring && state.seekable && !state.playing }.first
                    assertTrue(kotlin.math.abs(returned.positionMs - saved.positionMs) < 500,
                        "Fallback position changed from ${saved.positionMs} to ${returned.positionMs}")
                    original.togglePause()
                    awaitTrackState(original) { state, _ -> state.playing && state.positionMs > returned.positionMs + 250 }
                }
            }
        } finally { SwingUtilities.invokeAndWait { frame.dispose() } }
    }

    @Test
    fun captionRestartRetainsPositionTracksTimingAndPauseIntent() {
        val supplied = System.getenv("REELOS_DESKTOP_TRACK_FIXTURE")
        assumeTrue("Real multitrack fixture required", !supplied.isNullOrBlank())
        val fixture = Path.of(requireNotNull(supplied))
        val frame = Frame()
        val canvas = Canvas()
        SwingUtilities.invokeAndWait { frame.add(canvas); frame.setSize(640, 360); frame.addNotify(); frame.validate() }
        try {
            for (playing in listOf(false, true)) {
                val saved = NativeVlc.open().getOrThrow().use { vlc ->
                    vlc.player(fixture, 0).use { playback ->
                        SwingUtilities.invokeAndWait { playback.attach(canvas) }
                        val tracks = awaitTrackState(playback) { state, tracks -> state.playing && state.seekable && tracks.audio.size == 2 && tracks.subtitles.size == 2 }.second
                        playback.selectAudioTrack(tracks.audio.last().id)
                        playback.selectSubtitleTrack(if (playing) -1 else tracks.subtitles.last().id)
                        playback.setSubtitleDelayMs(250)
                        playback.seek(6_000)
                        awaitTrackState(playback) { state, _ -> state.positionMs in 5_500..8_000 }
                        if (!playing) {
                            playback.pause()
                            awaitTrackState(playback) { state, _ -> !state.playing }
                        }
                        playback.captureContinuation()
                    }
                }
                assertEquals(playing, saved.playing)
                NativeVlc.open(DesktopCaptionAppearance(com.reelos.ui.CaptionSize.LARGE, com.reelos.ui.CaptionStyle.YELLOW)).getOrThrow().use { vlc ->
                    vlc.player(fixture, 0).use { restored ->
                        restored.restoreBeforeAttach(saved)
                        SwingUtilities.invokeAndWait { restored.attach(canvas) }
                        val state = awaitTrackState(restored) { state, tracks ->
                            state.positionMs in (saved.positionMs - 400)..(saved.positionMs + 1_500) &&
                                state.playing == playing && tracks.audioId == saved.audioId && tracks.subtitleId == saved.subtitleId && restored.subtitleDelayMs() == 250L
                        }.first
                        if (playing) awaitTrackState(restored) { current, _ -> current.positionMs > state.positionMs + 250 }
                        else {
                            Thread.sleep(350)
                            assertFalse(restored.poll().playing)
                            assertTrue(kotlin.math.abs(restored.poll().positionMs - state.positionMs) < 400)
                        }
                    }
                }
            }
        } finally { SwingUtilities.invokeAndWait { frame.dispose() } }
    }

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
            frame.validate()
        }
        check(canvas.isDisplayable) { "Native test drawable could not be created" }
        try {
            NativeVlc.open().getOrThrow().use { vlc ->
                vlc.player(fixture, 0, PlaybackPreferences("es", "en", SubtitleMode.ON)).use { playback ->
                    SwingUtilities.invokeAndWait { playback.attach(canvas) }
                    awaitTrackState(playback) { state, _ -> state.playing && state.positionMs > 500 }
                    SwingUtilities.invokeAndWait { playback.attach(canvas) }
                    assertFalse(playback.poll().restoring, "Duplicate attachment must not restart an existing drawable")
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
