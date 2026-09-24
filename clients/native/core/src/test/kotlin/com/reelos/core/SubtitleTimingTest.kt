package com.reelos.core

import kotlin.test.*

class SubtitleTimingTest {
    @Test fun positiveMeansLaterAndNegativeMeansEarlier() {
        assertEquals(1_000_000L, SubtitleTiming.rendererPosition(3_000_000, 2_000))
        assertEquals(5_000_000L, SubtitleTiming.rendererPosition(3_000_000, -2_000))
        assertEquals(-2_000_000L, SubtitleTiming.rendererPosition(0, 2_000))
        assertEquals(0L, SubtitleTiming.adjust(100, -100))
    }
    @Test fun arithmeticCannotWrapToOppositeTiming() {
        assertFailsWith<ArithmeticException> { SubtitleTiming.micros(Long.MAX_VALUE) }
        assertFailsWith<ArithmeticException> { SubtitleTiming.adjust(Long.MAX_VALUE, 1) }
        assertFailsWith<ArithmeticException> { SubtitleTiming.rendererPosition(Long.MIN_VALUE, 1) }
    }
}
