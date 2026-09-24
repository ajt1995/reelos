package com.reelos.desktop

import com.reelos.core.PlaybackPreferences
import com.reelos.core.SubtitleMode
import com.reelos.ui.CaptionSize
import com.reelos.ui.CaptionStyle
import java.awt.Canvas
import java.awt.Frame
import java.awt.Robot
import java.awt.Rectangle
import java.awt.image.BufferedImage
import java.nio.file.Files
import java.nio.file.Path
import javax.imageio.ImageIO
import javax.swing.SwingUtilities
import org.junit.Assume.assumeTrue
import kotlin.test.*

class DesktopCaptionAppearanceTest {
    @Test fun restartedPauseDisplaysTheActualSavedFrame() {
        assumeTrue("Opt in to installed decoder pixel validation", System.getenv("REELOS_DESKTOP_TRACK_FIXTURE") != null)
        assertPausedReplacement(Path.of("src/test/assets/Native-Seek-Colors-12s.mp4").toAbsolutePath(), false)
    }

    @Test fun restartedMultitrackPauseDisplaysVideoAfterRestoringTrackIds() {
        val fixture = System.getenv("REELOS_DESKTOP_TRACK_FIXTURE")
        assumeTrue("Opt in to installed multitrack pixel validation", fixture != null)
        assertPausedReplacement(Path.of(requireNotNull(fixture)), true)
    }

    private fun assertPausedReplacement(fixture: Path, multitrack: Boolean) {
        val frame = Frame("ReelOS seek pixel validation")
        val canvas = Canvas()
        SwingUtilities.invokeAndWait {
            frame.add(canvas); frame.setSize(640, 400); frame.setLocation(20, 20)
            frame.isAlwaysOnTop = true; frame.isVisible = true; frame.toFront()
        }
        val robot = Robot()
        val originalRuntime = NativeVlc.open().getOrThrow()
        val original = originalRuntime.player(fixture, 0)
        try {
            SwingUtilities.invokeAndWait { original.attach(canvas) }
            val originalDeadline = System.nanoTime() + 10_000_000_000L
            while ((!original.poll().seekable || (multitrack && original.tracks().audio.isEmpty())) && System.nanoTime() < originalDeadline) Thread.sleep(100)
            original.seek(6_000)
            val saved = original.pauseForReplacement().copy(positionMs = 6_000, playing = false)
            original.releaseDrawableForReplacement()
            val replacementCanvas = Canvas()
            SwingUtilities.invokeAndWait {
                frame.remove(canvas); frame.add(replacementCanvas); frame.validate()
            }
            NativeVlc.open(DesktopCaptionAppearance(CaptionSize.LARGE, CaptionStyle.YELLOW)).getOrThrow().use { vlc ->
                vlc.player(fixture, 0).use { player ->
                    player.restoreBeforeAttach(saved)
                    SwingUtilities.invokeAndWait { player.attach(replacementCanvas) }
                    val deadline = System.nanoTime() + 15_000_000_000L
                    var green = false
                    var state = player.poll()
                    while (System.nanoTime() < deadline) {
                        state = player.poll()
                        check(!state.error)
                        if (!state.restoring) original.close() // Mirrors Main's onReady fallback retirement.
                        lateinit var bounds: Rectangle
                        SwingUtilities.invokeAndWait {
                            val p = replacementCanvas.locationOnScreen
                            bounds = Rectangle(p.x + replacementCanvas.width / 2 - 10, p.y + replacementCanvas.height / 2 - 10, 20, 20)
                        }
                        val image = robot.createScreenCapture(bounds)
                        val color = java.awt.Color(image.getRGB(10, 10))
                        green = if (multitrack) color.red > 100 || color.green > 100 || color.blue > 100
                            else color.green > 180 && color.red < 60 && color.blue < 60
                        if (!state.restoring && green) break
                        Thread.sleep(100)
                    }
                    assertFalse(state.restoring)
                    assertFalse(state.playing)
                    assertTrue(kotlin.math.abs(state.positionMs - 6_000) <= 400)
                    assertTrue(green, "Paused replacement must display decoded video, not a clock over black video (multitrack=$multitrack)")
                }
            }
        } finally { original.close(); originalRuntime.close(); SwingUtilities.invokeAndWait { frame.dispose() } }
    }

    @Test fun optionsAreBoundedAndDeviceDefaultsAreNotOverridden() {
        assertTrue(DesktopCaptionAppearance().options().isEmpty())
        assertContains(DesktopCaptionAppearance(CaptionSize.LARGE, CaptionStyle.YELLOW).options(), "--freetype-rel-fontsize=12")
        assertContains(DesktopCaptionAppearance(CaptionSize.LARGE, CaptionStyle.YELLOW).options(), "--freetype-color=16776960")
        assertContains(DesktopCaptionAppearance(CaptionSize.SMALL, CaptionStyle.OUTLINED).options(), "--freetype-background-opacity=0")
    }

    @Test fun installedRendererChangesActualCaptionPixels() {
        assumeTrue("Opt in to installed desktop caption rendering", System.getenv("REELOS_DESKTOP_TRACK_FIXTURE") != null)
        val fixture = Path.of("src/test/assets/Native-Captions-10s.mkv").toAbsolutePath()
        check(Files.isRegularFile(fixture))
        val frame = Frame("ReelOS native caption validation")
        val canvas = Canvas()
        SwingUtilities.invokeAndWait {
            canvas.background = java.awt.Color.BLACK
            frame.add(canvas)
            frame.setSize(960, 600)
            frame.setLocation(20, 20)
            frame.isAlwaysOnTop = true
            frame.isVisible = true
            frame.toFront()
        }
        val robot = Robot().apply { autoDelay = 50 }
        val output = Path.of("build/reports/caption-pixels")
        Files.createDirectories(output)
        fun capture(): BufferedImage {
            lateinit var bounds: Rectangle
            SwingUtilities.invokeAndWait {
                val origin = canvas.locationOnScreen
                bounds = Rectangle(origin.x, origin.y + canvas.height / 2, canvas.width, canvas.height / 2)
            }
            return robot.createScreenCapture(bounds)
        }
        fun count(image: BufferedImage, yellow: Boolean): Int {
            var total = 0
            for (y in 0 until image.height) for (x in 0 until image.width) {
                val color = java.awt.Color(image.getRGB(x, y))
                if (color.red > 180 && color.green > 180 && (if (yellow) color.blue < 80 else color.blue > 180)) total++
            }
            return total
        }
        fun blackFixtureVisible(image: BufferedImage): Boolean {
            var black = 0
            for (y in 0 until image.height) for (x in 0 until image.width) {
                val color = java.awt.Color(image.getRGB(x, y))
                if (color.red < 8 && color.green < 8 && color.blue < 8) black++
            }
            return black > image.width * image.height * .9
        }
        fun render(size: CaptionSize, style: CaptionStyle, name: String): Pair<Int, Int> {
            NativeVlc.open(DesktopCaptionAppearance(size, style)).getOrThrow().use { vlc ->
                vlc.player(fixture, 1_000, PlaybackPreferences(subtitleMode = SubtitleMode.ON)).use { player ->
                    SwingUtilities.invokeAndWait { player.attach(canvas) }
                    val deadline = System.nanoTime() + 15_000_000_000
                    var image: BufferedImage? = null
                    while (System.nanoTime() < deadline) {
                        val state = player.poll()
                        check(!state.error)
                        if (state.positionMs >= 1_000 && player.tracks().subtitleId >= 0) {
                            image = capture()
                            val glyphs = count(image, style == CaptionStyle.YELLOW)
                            if (blackFixtureVisible(image) && glyphs > 20 && glyphs < image.width * image.height / 4) break
                        }
                        Thread.sleep(100)
                    }
                    val rendered = requireNotNull(image) { "Native subtitle frame never appeared" }
                    check(blackFixtureVisible(rendered)) { "Test canvas was not visible; refusing to save a non-fixture screenshot" }
                    ImageIO.write(rendered, "png", output.resolve("$name.png").toFile())
                    val measured = count(rendered, false) to count(rendered, true)
                    check((if (style == CaptionStyle.YELLOW) measured.second else measured.first) > 20) {
                        "Requested native glyph color not rendered: $name, white=${measured.first}, yellow=${measured.second}"
                    }
                    return measured
                }
            }
        }
        try {
            val small = render(CaptionSize.SMALL, CaptionStyle.OUTLINED, "small-white")
            val large = render(CaptionSize.LARGE, CaptionStyle.OUTLINED, "large-white")
            assertTrue(large.first > small.first * 1.3, "Native glyph area did not grow: $small -> $large")
            val yellow = render(CaptionSize.LARGE, CaptionStyle.YELLOW, "large-yellow")
            assertTrue(yellow.second > 20 && yellow.first < 10, "Color override not visible: $yellow")
        } finally { SwingUtilities.invokeAndWait { frame.dispose() } }
    }
}
