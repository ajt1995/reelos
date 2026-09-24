package com.reelos.providers

import java.net.URI

interface ProviderClient {
    fun validate(secret: CharArray): ProviderAccount
    fun list(secret: CharArray, expectedAccount: String): List<ProviderVideo>
    fun page(secret: CharArray, expectedAccount: String, offset: Int = 0): ProviderPage {
        require(offset >= 0)
        val all = list(secret, expectedAccount)
        val end = minOf(all.size.toLong(), offset.toLong() + 25).toInt()
        return ProviderPage(all.drop(offset).take(25), if (end < all.size) end else null)
    }
    fun resolve(secret: CharArray, expectedAccount: String, video: ProviderVideo): ProviderStream
}

/** Bounded browsing window; a continuation is not a maximum library size. */
class ProviderPage(val videos: List<ProviderVideo>, val nextOffset: Int?) {
    override fun toString() = "ProviderPage(count=${videos.size}, hasMore=${nextOffset != null})"
}

class ProviderAccount(val id: String) {
    override fun toString(): String = "ProviderAccount([redacted])"
}

/** One explicit file in one exact torrent, scoped to the account and credential that listed it. */
class ProviderVideo internal constructor(
    val accountId: String,
    val torrentId: String,
    val infohash: String,
    val fileId: String,
    val name: String,
    val sizeBytes: Long,
    val ready: Boolean,
    internal val credentialDigest: ByteArray,
) {
    override fun toString(): String = "ProviderVideo([redacted])"
}

/** A short-lived lease, not a persistent media identity or a loggable value. */
class ProviderStream internal constructor(private val lease: URI,
    private val destinationAllowed: (URI) -> Boolean = { true }) {
    internal fun <T> useLease(block: (URI) -> T): T = block(lease)
    /** Hosts receive guarded bytes, never a credential-bearing URL for a player, intent or log. */
    fun openBytes(expectedSize: Long, authorize: () -> Boolean): RemoteByteStream =
        RemoteByteStream(lease, expectedSize, authorize, destinationAllowed)
    override fun toString(): String = "ProviderStream([redacted])"
}

enum class ProviderFailureCode {
    INVALID_CREDENTIAL, CONNECTIVITY, TIMEOUT, RATE_LIMITED, UNAVAILABLE, NOT_READY, INVALID_RESPONSE
}

class ProviderFailure(val code: ProviderFailureCode) : RuntimeException(code.name) {
    override fun toString(): String = "ProviderFailure(${code.name})"
}

enum class ProviderAuth { BEARER, TORBOX_DOWNLOAD_QUERY }

/** The transport must never expose its authenticated request URI or raw response in diagnostics. */
fun interface ProviderTransport {
    fun get(pathAndQuery: String, secret: CharArray, auth: ProviderAuth): ProviderHttpResponse
}

class ProviderHttpResponse(val status: Int, val body: String) {
    override fun toString(): String = "ProviderHttpResponse(status=$status, body=[redacted])"
}
