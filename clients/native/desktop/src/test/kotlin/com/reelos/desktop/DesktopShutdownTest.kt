package com.reelos.desktop

import kotlinx.coroutines.Job
import kotlin.test.Test
import kotlin.test.assertEquals

class DesktopShutdownTest {
    @Test
    fun closesImmediatelyWhenNoImportIsRunning() {
        var exits = 0
        finishAfterImport(null, { error("No dispatch needed for idle close") }) { exits++ }
        assertEquals(1, exits)
    }

    @Test
    fun activeImportSchedulesOneCloseAfterCompletion() {
        val import = Job()
        val queued = mutableListOf<() -> Unit>()
        var exits = 0
        finishAfterImport(import, { queued += it }) { exits++ }
        assertEquals(0, exits)
        import.complete()
        assertEquals(1, queued.size)
        queued.single().invoke()
        assertEquals(1, exits)
    }
}
