package com.reelos.desktop

import com.reelos.core.DeviceKind
import com.reelos.core.FileCoreStore
import com.reelos.core.MediaAction
import com.reelos.core.ReelCore
import java.nio.file.Files
import java.nio.file.Path
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.rules.TemporaryFolder
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class DesktopMediaLibraryTest {
    @get:Rule val temporary = TemporaryFolder()

    @Test
    fun importUsesPrivateMappingAndMissingMappingRevokesPlay() {
        val fixture = System.getenv("REELOS_DESKTOP_FIXTURE")
        assumeTrue("Set REELOS_DESKTOP_FIXTURE to exercise local media", fixture != null)
        val directory = temporary.newFolder("native-data").toPath()
        val core = ReelCore(FileCoreStore(directory.resolve("core.bin")), DeviceKind.WINDOWS)
        core.createProfile("adult", "Ada")
        core.setColor("adult", "#7357A6")
        core.acknowledgeCurator("adult")
        core.setTasteSeeds("adult", emptySet())
        core.confirmDefaultSources("adult")
        core.chooseHome("adult", null)

        NativeVlc.open().getOrThrow().use { vlc ->
            val library = DesktopMediaLibrary(directory, core, vlc)
            val record = library.importFile(Path.of(requireNotNull(fixture)))
            assertEquals(MediaAction.PLAY, core.mediaAction(record.id))
            library.open(record.id, "adult").close()

            val mapping = directory.resolve("personal-media-paths").resolve("${record.id}.path")
            Files.delete(mapping)
            assertFailsWith<Exception> { library.open(record.id, "adult") }
            assertEquals(MediaAction.UNAVAILABLE, core.mediaAction(record.id))
        }
    }
}
