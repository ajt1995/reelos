package com.reelos.core

/** Positive delay means later captions on every platform. Session-specific, never a global language setting. */
object SubtitleTiming {
    fun micros(delayMs: Long): Long = Math.multiplyExact(delayMs, 1_000L)
    fun rendererPosition(positionUs: Long, delayMs: Long): Long = Math.subtractExact(positionUs, micros(delayMs))
    fun adjust(delayMs: Long, adjustmentMs: Long): Long = Math.addExact(delayMs, adjustmentMs).also { micros(it) }
}
