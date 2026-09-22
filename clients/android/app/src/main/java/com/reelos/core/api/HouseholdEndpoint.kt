package com.reelos.core.api

import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

object HouseholdEndpoint {
    fun parse(input: String, defaultPort: Int = 8080): HttpUrl? {
        val raw = input.trim().trimEnd('/')
        if (raw.isEmpty()) return null
        val supplied = when {
            raw.startsWith("http://", true) || raw.startsWith("https://", true) -> raw.toHttpUrlOrNull()
            raw.endsWith(".ts.net", true) -> "https://$raw".toHttpUrlOrNull()
            else -> "http://$raw:$defaultPort".toHttpUrlOrNull()
        } ?: return null
        if (supplied.username.isNotEmpty() || supplied.password.isNotEmpty()) return null
        if (supplied.query != null || supplied.fragment != null) return null
        if (supplied.scheme == "http" && !isPrivateHost(supplied.host)) return null
        return supplied.newBuilder().encodedPath("/").build()
    }

    fun sameOrigin(base: HttpUrl, candidate: String): HttpUrl? {
        val resolved = base.resolve(candidate) ?: return null
        return resolved.takeIf {
            it.scheme == base.scheme && it.host == base.host && it.port == base.port &&
                it.username.isEmpty() && it.password.isEmpty()
        }
    }

    internal fun isPrivateHost(host: String): Boolean {
        if (host == "localhost" || host.endsWith(".local", true)) return true
        val octets = host.split('.').mapNotNull(String::toIntOrNull)
        if (octets.size != 4 || octets.any { it !in 0..255 }) return false
        return octets[0] == 10 || octets[0] == 127 ||
            (octets[0] == 192 && octets[1] == 168) ||
            (octets[0] == 172 && octets[1] in 16..31) ||
            (octets[0] == 100 && octets[1] in 64..127)
    }
}
