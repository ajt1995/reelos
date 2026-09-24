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
            frame.add(canvas)
            frame.setSize(960, 600)
            frame.setLocation(20, 20)
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
                            if (glyphs > 20 && glyphs < image.width * image.height / 4) break
                        }
                        Thread.sleep(100)
                    }
                    val rendered = requireNotNull(image) { "Native subtitle frame never appeared" }
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
