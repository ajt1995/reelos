package com.reelos.desktop

import java.nio.file.Path
import org.junit.Assume.assumeTrue
import kotlin.test.Test
import kotlin.test.assertTrue

class NativeVlcTest {
    @Test
    fun installedDecoderParsesRealLocalMediaWhenFixtureIsProvided() {
        val fixture = System.getenv("REELOS_DESKTOP_FIXTURE")
        assumeTrue("Set REELOS_DESKTOP_FIXTURE to exercise the installed decoder", fixture != null)
        NativeVlc.open().getOrThrow().use { vlc ->
            assertTrue(vlc.verify(Path.of(requireNotNull(fixture))) > 0)
        }
    }
}
