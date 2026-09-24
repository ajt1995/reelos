package com.reelos.providers

/** One implementation shared by all hosts; only encryption and media rendering are platform adapters. */
class ProviderConnectionController(
    val displayName: String,
    private val client: ProviderClient,
    private val store: ProtectedConnectionStore,
) {
    private val gate = Any()
    private var operation = 0L

    fun hasSavedConnection(): Boolean = store.read()?.use { it.accountId != null } ?: false

    /** Replacement first revokes old credentials; failed validation never preserves stale authority. */
    fun connect(secret: CharArray, stillWanted: () -> Boolean = { true }) {
        if (secret.size !in 1..4096 || secret.any { it.isWhitespace() || it.code < 32 }) throw ProviderFailure(ProviderFailureCode.INVALID_CREDENTIAL)
        val (ticket, revision) = synchronized(gate) { (++operation) to store.invalidate() }
        val account = client.validate(secret)
        synchronized(gate) {
            if (ticket != operation || !stillWanted()) throw ConnectionChanged()
            store.replace(revision, account.id, secret)
        }
    }

    fun disconnect() = synchronized(gate) { operation++; store.invalidate(); Unit }

    /** Screen cancellation prevents a slow connect response saving after the person left. */
    fun cancelPending() = synchronized(gate) { operation++; Unit }

    fun videos(): List<ProviderVideo> {
        val saved = store.read() ?: throw ConnectionChanged()
        return saved.use {
            val account = saved.accountId ?: throw ConnectionChanged()
            val videos = client.list(saved.secret, account)
            if (!store.isCurrent(saved.revision)) throw ConnectionChanged()
            videos
        }
    }

    fun page(offset: Int = 0): ProviderPage {
        val saved = store.read() ?: throw ConnectionChanged()
        return saved.use {
            val account = saved.accountId ?: throw ConnectionChanged()
            val page = client.page(saved.secret, account, offset)
            if (!store.isCurrent(saved.revision)) throw ConnectionChanged()
            page
        }
    }

    /** Bounded in time, not library size; never retain all pages just to resume one file. */
    fun findVideo(matches: (ProviderVideo) -> Boolean): ProviderVideo? {
        val scope = sourceScope() ?: throw ConnectionChanged()
        val deadline = System.nanoTime() + 60_000_000_000L
        var offset = 0
        while (true) {
            if (Thread.currentThread().isInterrupted || System.nanoTime() > deadline)
                throw ProviderFailure(ProviderFailureCode.TIMEOUT)
            val page = page(offset)
            if (sourceScope() != scope) throw ConnectionChanged()
            page.videos.singleOrNull(matches)?.let { return it }
            val next = page.nextOffset ?: return null
            if (next <= offset) throw ProviderFailure(ProviderFailureCode.INVALID_RESPONSE)
            offset = next
        }
    }

    fun sourceScope(): String? = store.read()?.use { saved ->
        saved.accountId?.let { scope(saved.revision, it) }
    }

    fun resolve(video: ProviderVideo): BoundProviderLease {
        val saved = store.read() ?: throw ConnectionChanged()
        return saved.use {
            val account = saved.accountId ?: throw ConnectionChanged()
            val stream = client.resolve(saved.secret, account, video)
            if (!store.isCurrent(saved.revision)) throw ConnectionChanged()
            BoundProviderLease(scope(saved.revision, account), video, stream) { store.isCurrent(saved.revision) }
        }
    }

    private fun scope(revision: String, account: String) = "external-provider-" + java.security.MessageDigest.getInstance("SHA-256")
        .digest((revision + "\u0000" + account).toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
}

class BoundProviderLease internal constructor(val sourceId: String, val video: ProviderVideo,
    val stream: ProviderStream, private val authorized: () -> Boolean) {
    fun isCurrent(): Boolean = runCatching(authorized).getOrDefault(false)
    override fun toString() = "BoundProviderLease(redacted)"
}
