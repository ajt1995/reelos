package com.reelos.core

/** Session-only sleep policy. Hosts supply monotonic time and perform the authorized pause/save. */
class PlaybackSleepTimer(private val nowMs: () -> Long) {
    data class State(val startedAtMs: Long, val deadlineMs: Long?, val endOfTitle: Boolean)
    var state: State? = null
        private set

    fun after(durationMs: Long) {
        require(durationMs > 0) { "Sleep duration must be positive" }
        val now = nowMs()
        state = State(now, Math.addExact(now, durationMs), false)
    }
    fun atEnd() { state = State(nowMs(), null, true) }
    fun cancel() { state = null }
    fun restore(saved: State?) {
        require(saved == null || if (saved.endOfTitle) saved.deadlineMs == null
            else saved.deadlineMs != null && saved.deadlineMs > saved.startedAtMs)
        state = saved
    }

    /** Consume once, including while paused/buffering. A clock reset expires rather than extending sleep. */
    fun shouldPause(ended: Boolean): Boolean {
        val active = state ?: return false
        val now = nowMs()
        val due = now < active.startedAtMs || if (active.endOfTitle) ended else now >= requireNotNull(active.deadlineMs)
        if (due) state = null
        return due
    }

    fun label(): String {
        val active = state ?: return "Sleep · Off"
        if (active.endOfTitle) return "Sleep · End of title"
        val remaining = (requireNotNull(active.deadlineMs) - nowMs()).coerceAtLeast(0)
        val minutes = remaining / 60_000 + if (remaining % 60_000 > 0) 1 else 0
        return "Sleep · $minutes min"
    }
}
