package com.reelos.nativepreview

import androidx.media3.exoplayer.Renderer
import com.reelos.core.SubtitleTiming

/** Media3 1.5 adapter: shift only the text renderer's clock, never audio/video or source authority. */
@androidx.media3.common.util.UnstableApi
internal class SubtitleTimingRenderer(private val text: Renderer) : Renderer by text {
    @Volatile var delayMs: Long = 0
        private set
    override fun render(positionUs: Long, elapsedRealtimeUs: Long) {
        text.render(SubtitleTiming.rendererPosition(positionUs, delayMs), elapsedRealtimeUs)
    }
    override fun resetPosition(positionUs: Long) {
        text.resetPosition(SubtitleTiming.rendererPosition(positionUs, delayMs))
    }
    override fun handleMessage(messageType: Int, message: Any?) {
        if (messageType == SET_DELAY) {
            val next = message as Long
            SubtitleTiming.micros(next)
            delayMs = next
        } else text.handleMessage(messageType, message)
    }
    companion object { const val SET_DELAY = 0x52454C }
}
