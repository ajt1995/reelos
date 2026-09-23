package com.reelos.desktop

import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class FileLaunchTest {
    @Test
    fun acceptsOneExistingLocalFile() {
        val file = Files.createTempFile("reelos-open-with-", ".mp4")
        try {
            val launch = parseFileLaunch(arrayOf(file.toString()))
            assertEquals(file.toRealPath(), launch.path)
            assertNull(launch.error)
        } finally { Files.deleteIfExists(file) }
    }

    @Test
    fun rejectsMultiplePathsAndRemoteAddresses() {
        assertNotNull(parseFileLaunch(arrayOf("one.mp4", "two.mp4")).error)
        assertNotNull(parseFileLaunch(arrayOf("https://example.test/movie.mp4")).error)
        assertNotNull(parseFileLaunch(arrayOf("\\\\server\\share\\movie.mp4")).error)
        assertNotNull(parseFileLaunch(arrayOf("relative.mp4")).error)
    }
}
