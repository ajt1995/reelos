package com.reelos.providers

import okhttp3.Authenticator
import okhttp3.Call
import okhttp3.ConnectionPool
import okhttp3.CookieJar
import okhttp3.Dns
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.IOException
import java.io.InputStream
import java.net.InetAddress
import java.net.Proxy
import java.net.URI
import java.util.concurrent.CancellationException
import java.util.concurrent.ExecutionException
import java.util.concurrent.Future
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.SynchronousQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

/** Reads an already authorized, provider-resolved HTTPS media URL as exact byte ranges. */
class RemoteByteStream internal constructor(
    private val uri: URI,
    val expectedSize: Long,
    private val authorize: () -> Boolean,
    private val client: OkHttpClient,
    private val resolver: Dns,
    private val destinationAllowed: (URI) -> Boolean = { true },
) : AutoCloseable {
    constructor(
        uri: URI,
        expectedSize: Long,
        authorize: () -> Boolean,
        destinationAllowed: (URI) -> Boolean = { true },
    ) : this(
        uri, expectedSize, authorize, secureClient(), Dns.SYSTEM, destinationAllowed,
    )

    private val lock = Any()
    @Volatile private var closed = false
    private val dnsLookups = mutableSetOf<Future<*>>()
    private val calls = mutableSetOf<Call>()
    private val ranges = mutableSetOf<RemoteRange>()

    init {
        validateUri(uri)
        require(expectedSize > 0) { "Invalid remote media size" }
    }

    fun open(offset: Long, length: Long? = null): RemoteRange {
        require(offset >= 0 && offset < expectedSize) { "Invalid remote range" }
        val requestedLength = length ?: (expectedSize - offset)
        require(requestedLength > 0 && requestedLength <= expectedSize - offset) { "Invalid remote range" }
        val lastByte = offset + requestedLength - 1
        try {
            var target = uri
            repeat(MAX_REDIRECTS + 1) { redirectCount ->
                requireAuthorized()
                validateUri(target)
                check(try { destinationAllowed(target) } catch (_: Exception) { false })
                val host = checkNotNull(target.host)
                // Pin this request to the exact set checked here. OkHttp cannot re-resolve it later.
                val addresses = resolveAddresses(host)
                val requestClient = client.newBuilder()
                    .dns(object : Dns {
                        override fun lookup(requestedHost: String): List<InetAddress> {
                            check(requestedHost.equals(host, ignoreCase = true))
                            return addresses
                        }
                    })
                    .proxy(Proxy.NO_PROXY)
                    .cookieJar(CookieJar.NO_COOKIES)
                    .authenticator(Authenticator.NONE)
                    .proxyAuthenticator(Authenticator.NONE)
                    .followRedirects(false)
                    .followSslRedirects(false)
                    .retryOnConnectionFailure(false)
                    .connectionPool(ConnectionPool(0, 1, TimeUnit.NANOSECONDS))
                    .build()
                val request = Request.Builder()
                    .url(target.toString())
                    .get()
                    .header("Range", "bytes=$offset-$lastByte")
                    .header("Accept-Encoding", "identity")
                    .header("Cache-Control", "no-store")
                    .build()
                val call = requestClient.newCall(request)
                synchronized(lock) {
                    check(!closed)
                    calls.add(call)
                }
                var response: Response? = null
                var retained = false
                try {
                    requireAuthorized()
                    response = call.execute()
                    requireAuthorized()
                    if (response.code in REDIRECT_CODES) {
                        check(redirectCount < MAX_REDIRECTS)
                        val location = checkNotNull(response.header("Location"))
                        target = target.resolve(URI(location))
                        validateUri(target)
                    } else {
                        validateRange(response, offset, lastByte, requestedLength)
                        val range = RemoteRange(
                            response, call, requestedLength,
                            ::requireAuthorized,
                            { closedRange -> synchronized(lock) { ranges.remove(closedRange) } },
                        )
                        requireAuthorized()
                        synchronized(lock) {
                            check(!closed)
                            calls.remove(call)
                            ranges.add(range)
                        }
                        retained = true
                        return range
                    }
                } finally {
                    synchronized(lock) { calls.remove(call) }
                    if (!retained) {
                        response?.close()
                        call.cancel()
                    }
                }
            }
            error("Redirect limit exceeded")
        } catch (_: Exception) {
            throw IllegalStateException("Remote media unavailable")
        }
    }

    override fun close() {
        val pendingDns: List<Future<*>>
        val pendingCalls: List<Call>
        val openRanges: List<RemoteRange>
        synchronized(lock) {
            if (closed) return
            closed = true
            pendingDns = dnsLookups.toList()
            pendingCalls = calls.toList()
            openRanges = ranges.toList()
            dnsLookups.clear()
            calls.clear()
            ranges.clear()
        }
        pendingDns.forEach { it.cancel(true) }
        pendingCalls.forEach(Call::cancel)
        openRanges.forEach(RemoteRange::close)
    }

    private fun requireAuthorized() {
        check(!closed && try { authorize() } catch (_: Exception) { false })
        check(!closed)
    }

    private fun resolveAddresses(host: String): List<InetAddress> {
        val future = try {
            DNS_EXECUTOR.submit<List<InetAddress>> { resolver.lookup(host) }
        } catch (_: RejectedExecutionException) {
            throw IllegalStateException("Remote media unavailable")
        }
        synchronized(lock) {
            if (closed) {
                future.cancel(true)
                throw IllegalStateException("Remote media unavailable")
            }
            dnsLookups.add(future)
        }
        try {
            val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(DNS_TIMEOUT_MILLIS)
            while (true) {
                requireAuthorized()
                val left = deadline - System.nanoTime()
                check(left > 0) { "Remote media unavailable" }
                try {
                    val addresses = future.get(minOf(left, DNS_AUTH_CHECK_NANOS), TimeUnit.NANOSECONDS).toList()
                    requireAuthorized()
                    check(addresses.isNotEmpty() && addresses.all(RemoteAddressPolicy::isPublic))
                    return addresses
                } catch (_: TimeoutException) {
                    // Poll authorization while a platform resolver is waiting.
                }
            }
        } catch (_: CancellationException) {
            throw IllegalStateException("Remote media unavailable")
        } catch (_: ExecutionException) {
            throw IllegalStateException("Remote media unavailable")
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
            throw IllegalStateException("Remote media unavailable")
        } finally {
            synchronized(lock) { dnsLookups.remove(future) }
            future.cancel(true)
        }
    }

    private fun validateRange(response: Response, first: Long, last: Long, length: Long) {
        check(response.code == 206)
        val match = CONTENT_RANGE.matchEntire(response.header("Content-Range") ?: "")
        check(match != null)
        check(match.groupValues[1].toLongOrNull() == first)
        check(match.groupValues[2].toLongOrNull() == last)
        check(match.groupValues[3].toLongOrNull() == expectedSize)
        check(response.header("Content-Length")?.toLongOrNull() == length)
        check(response.body != null)
        check(response.body!!.contentLength() == length)
        check(response.header("Content-Encoding")?.equals("identity", ignoreCase = true) != false)
        val contentType = response.header("Content-Type")?.lowercase().orEmpty()
        check(!contentType.startsWith("text/") && !contentType.contains("html") &&
            !contentType.contains("json") && !contentType.contains("xml"))
        val sample = response.peekBody(128).bytes()
        try {
            val prefix = sample.toString(Charsets.US_ASCII).trimStart().lowercase()
            check(!prefix.startsWith("<html") && !prefix.startsWith("<!doctype html"))
        } finally {
            sample.fill(0)
        }
    }

    private companion object {
        const val MAX_REDIRECTS = 3
        const val DNS_TIMEOUT_MILLIS = 5_000L
        val DNS_AUTH_CHECK_NANOS = TimeUnit.MILLISECONDS.toNanos(100)
        // Synchronous handoff bounds even uninterruptible platform DNS lookups to four daemon threads.
        val DNS_EXECUTOR = ThreadPoolExecutor(
            0, 4, 30, TimeUnit.SECONDS, SynchronousQueue(),
            { task -> Thread(task, "reelos-remote-dns").apply { isDaemon = true } },
            ThreadPoolExecutor.AbortPolicy(),
        )
        val REDIRECT_CODES = setOf(301, 302, 303, 307, 308)
        val CONTENT_RANGE = Regex("bytes ([0-9]+)-([0-9]+)/([0-9]+)")

        fun validateUri(target: URI) {
            require(!target.isOpaque && target.scheme.equals("https", ignoreCase = true)) { "Invalid remote media endpoint" }
            require(target.userInfo == null && target.fragment == null) { "Invalid remote media endpoint" }
            require(target.port == -1 || target.port == 443) { "Invalid remote media endpoint" }
            val host = target.host ?: throw IllegalArgumentException("Invalid remote media endpoint")
            val labels = host.split('.')
            require(host.length <= 253 && labels.size >= 2 && labels.all { label ->
                label.length in 1..63 && label.first().isAsciiAlphanumeric() &&
                    label.last().isAsciiAlphanumeric() && label.all { it.isAsciiAlphanumeric() || it == '-' }
            } && labels.last().any { it in 'a'..'z' || it in 'A'..'Z' }) {
                "Invalid remote media endpoint"
            }
        }

        fun Char.isAsciiAlphanumeric(): Boolean =
            this in 'a'..'z' || this in 'A'..'Z' || this in '0'..'9'

        fun secureClient(): OkHttpClient = OkHttpClient.Builder()
            .proxy(Proxy.NO_PROXY)
            .cookieJar(CookieJar.NO_COOKIES)
            .authenticator(Authenticator.NONE)
            .proxyAuthenticator(Authenticator.NONE)
            .followRedirects(false)
            .followSslRedirects(false)
            .retryOnConnectionFailure(false)
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            // A paused or long-running film may outlive a total deadline; reads still have inactivity limits.
            .callTimeout(0, TimeUnit.MILLISECONDS)
            .build()
    }
}

/** A live range. Every read rechecks the caller's current authorization. */
class RemoteRange internal constructor(
    private val response: Response,
    private val call: Call,
    val length: Long,
    private val authorize: () -> Unit,
    private val onClose: (RemoteRange) -> Unit,
) : InputStream() {
    private val source = checkNotNull(response.body).byteStream()
    @Volatile private var closed = false
    private var remaining = length

    override fun read(): Int {
        val one = ByteArray(1)
        try {
            val count = read(one, 0, 1)
            return if (count < 0) -1 else one[0].toInt() and 0xff
        } finally {
            one.fill(0)
        }
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        if (offset < 0 || length < 0 || offset > buffer.size - length) throw IndexOutOfBoundsException()
        try {
            authorize()
            check(!closed)
            if (length == 0) return 0
            if (remaining == 0L) return -1
            val count = source.read(buffer, offset, minOf(length.toLong(), remaining).toInt())
            if (count < 0) error("Remote range truncated")
            try {
                authorize()
                check(!closed)
            } catch (_: Exception) {
                buffer.fill(0, offset, offset + count)
                throw IllegalStateException("Remote media unavailable")
            }
            remaining -= count
            return count
        } catch (_: Exception) {
            buffer.fill(0, offset, offset + length)
            close()
            throw IOException("Remote media unavailable")
        }
    }

    override fun close() {
        if (closed) return
        closed = true
        call.cancel()
        try { source.close() } catch (_: Exception) { /* No URL or response details leave this adapter. */ }
        try { response.close() } catch (_: Exception) { /* Cancellation already revoked access. */ }
        onClose(this)
    }
}

/** Public addresses only. Translation and tunneling ranges are rejected, including mapped IPv4. */
internal object RemoteAddressPolicy {
    fun isPublic(address: InetAddress): Boolean {
        if (address.isAnyLocalAddress || address.isLoopbackAddress || address.isLinkLocalAddress ||
            address.isSiteLocalAddress || address.isMulticastAddress
        ) return false
        val bytes = address.address.map { it.toInt() and 0xff }
        return when (bytes.size) {
            4 -> publicIpv4(bytes)
            16 -> publicIpv6(bytes)
            else -> false
        }
    }

    private fun publicIpv4(b: List<Int>): Boolean {
        val a = b[0]
        val second = b[1]
        if (a == 0 || a == 10 || a == 127 || a >= 224) return false
        if (a == 100 && second in 64..127) return false // Carrier-grade NAT.
        if (a == 169 && second == 254) return false
        if (a == 172 && second in 16..31) return false
        if (a == 192 && (second == 0 || second == 168)) return false
        if (a == 192 && second == 88 && b[2] == 99) return false // Deprecated 6to4 relay.
        if (a == 198 && (second in 18..19 || second == 51 && b[2] == 100)) return false
        if (a == 192 && second == 0 && b[2] == 2) return false
        if (a == 203 && second == 0 && b[2] == 113) return false
        return true
    }

    private fun publicIpv6(b: List<Int>): Boolean {
        if (b[0] !in 0x20..0x3f) return false // Only global unicast; excludes NAT64 and mapped IPv4.
        if (b[0] == 0x20 && b[1] == 0x02) return false // 6to4 tunneling.
        if (b[0] == 0x20 && b[1] == 0x01) {
            if (b[2] == 0x0d && b[3] == 0xb8) return false // Documentation.
            if (b[2] == 0 && b[3] == 0) return false // Teredo and special-purpose space.
            if (b[2] == 0 && b[3] == 2) return false // Benchmarking.
            if (b[2] == 0 && b[3] in 0x10..0x2f) return false // ORCHID identifiers.
        }
        return true
    }
}
