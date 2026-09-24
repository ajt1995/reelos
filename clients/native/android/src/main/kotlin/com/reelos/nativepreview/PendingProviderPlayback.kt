package com.reelos.nativepreview

import com.reelos.presentation.PreparedProviderPlayback
import java.util.UUID

/** One-use, process-local handoff; no provider URL or credential ever enters an Android intent. */
internal object PendingProviderPlayback {
    private var entry: Triple<String, Long, PreparedProviderPlayback>? = null
    @Synchronized fun put(value: PreparedProviderPlayback): String {
        entry?.third?.close()
        val id = UUID.randomUUID().toString()
        entry = Triple(id, System.nanoTime(), value)
        return id
    }
    @Synchronized fun take(id: String): PreparedProviderPlayback? {
        val pending = entry ?: return null
        entry = null
        if (pending.first != id || System.nanoTime() - pending.second > 60_000_000_000L) {
            pending.third.close(); return null
        }
        return pending.third
    }
    @Synchronized fun discard(id: String) {
        if (entry?.first == id) { entry?.third?.close(); entry = null }
    }
}
