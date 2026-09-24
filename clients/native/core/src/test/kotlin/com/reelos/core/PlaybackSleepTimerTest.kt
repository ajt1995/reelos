package com.reelos.core

import kotlin.test.*

class PlaybackSleepTimerTest {
    @Test fun expiresOnceWithoutDependingOnPlaybackProgress() {
        var now = 1_000L
        val timer = PlaybackSleepTimer { now }
        timer.after(60_001)
        assertEquals("Sleep · 2 min", timer.label())
        now += 1
        assertEquals("Sleep · 1 min", timer.label())
        assertFalse(timer.shouldPause(false))
        now += 60_000
        assertTrue(timer.shouldPause(false))
        assertFalse(timer.shouldPause(false))
        assertEquals("Sleep · Off", timer.label())
    }
    @Test fun endCancelAndReplacementAreSessionLocal() {
        var now = 0L
        val timer = PlaybackSleepTimer { now }
        timer.atEnd()
        now = 1_000_000
        assertFalse(timer.shouldPause(false))
        assertTrue(timer.shouldPause(true))
        timer.after(100)
        timer.cancel()
        now += 1_000
        assertFalse(timer.shouldPause(true))
        timer.atEnd()
        timer.after(200)
        assertFalse(timer.shouldPause(true))
        assertNull(PlaybackSleepTimer { now }.state)
    }
    @Test fun recreationRetainsDeadlineAndClockResetExpires() {
        var now = 500L
        val old = PlaybackSleepTimer { now }.apply { after(1_000) }
        val restored = PlaybackSleepTimer { now }.apply { restore(old.state) }
        now = 1_500
        assertTrue(restored.shouldPause(false))
        restored.restore(old.state)
        now = 0
        assertTrue(restored.shouldPause(false))
    }
    @Test fun badDurationsAndSnapshotsCannotReplaceActiveTimer() {
        val timer = PlaybackSleepTimer { Long.MAX_VALUE - 100 }
        timer.atEnd()
        val previous = timer.state
        assertFailsWith<IllegalArgumentException> { timer.after(0) }
        assertFailsWith<ArithmeticException> { timer.after(101) }
        assertFailsWith<IllegalArgumentException> { timer.restore(PlaybackSleepTimer.State(2, 1, false)) }
        assertEquals(previous, timer.state)
    }
}
