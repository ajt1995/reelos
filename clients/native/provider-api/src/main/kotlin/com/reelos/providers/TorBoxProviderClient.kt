package com.reelos.providers

import java.net.URI
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.security.MessageDigest

/** Synchronous optional provider protocol. Callers own secure keys and current-authority checks. */
class TorBoxProviderClient(private val transport: ProviderTransport = JdkProviderTransport()) : ProviderClient {
    override fun validate(secret: CharArray): ProviderAccount {
        requireSecret(secret)
        val data = data(request("/v1/api/user/me", secret)) as? Map<*, *> ?: invalid()
        val user = (data["user"] as? Map<*, *>) ?: data
        val id = identity(user["id"] ?: user["user_id"] ?: data["user_id"]) ?: invalid()
        return ProviderAccount(id)
    }

    override fun list(secret: CharArray, expectedAccount: String): List<ProviderVideo> {
        val account = checkAccount(secret, expectedAccount)
        val payload = data(request("/v1/api/torrents/mylist?bypass_cache=true&limit=1000", secret))
        val rows = when (payload) {
            is List<*> -> payload
            is Map<*, *> -> payload["torrents"] as? List<*> ?: invalid()
            else -> invalid()
        }
        if (rows.size > 1000) invalid()
        val digest = credentialDigest(secret, account)
        val result = ArrayList<ProviderVideo>()
        val seen = HashSet<String>()
        for (raw in rows) {
            val row = raw as? Map<*, *> ?: invalid()
            val torrentId = identity(row["id"]) ?: invalid()
            val hash = (row["hash"] ?: row["infohash"] as Any?) as? String ?: invalid()
            if (!HASH.matches(hash)) invalid()
            val files = row["files"] as? List<*> ?: invalid()
            if (files.size > 1000) invalid()
            val ready = (row["download_state"] ?: row["state"] as Any?)
                .let { it as? String }?.lowercase() in READY_STATES
            for (rawFile in files) {
                val file = rawFile as? Map<*, *> ?: invalid()
                val fileId = identity(file["id"]) ?: continue
                val name = (file["name"] ?: file["short_name"] ?: file["path"]) as? String ?: continue
                val size = positiveSize(file["size"]) ?: continue
                if (name.length > 1024 || !VIDEO.containsMatchIn(name)) continue
                val key = "$torrentId:${hash.lowercase()}:$fileId"
                if (!seen.add(key)) invalid()
                result.add(ProviderVideo(account, torrentId, hash.lowercase(), fileId, name, size, ready, digest.copyOf()))
                if (result.size > 5000) invalid()
            }
        }
        digest.fill(0)
        return result
    }

    override fun resolve(secret: CharArray, expectedAccount: String, video: ProviderVideo): ProviderStream {
        val account = checkAccount(secret, expectedAccount)
        val currentDigest = credentialDigest(secret, account)
        val sameCredential = try { MessageDigest.isEqual(video.credentialDigest, currentDigest) }
        finally { currentDigest.fill(0) }
        if (video.accountId != account || !sameCredential) {
            throw ProviderFailure(ProviderFailureCode.INVALID_CREDENTIAL)
        }
        val torrentId = identity(video.torrentId) ?: invalid()
        val fileId = identity(video.fileId) ?: invalid()
        if (!HASH.matches(video.infohash)) invalid()
        val payload = data(request("/v1/api/torrents/mylist?id=$torrentId&bypass_cache=true", secret))
        val rows = when (payload) {
            is List<*> -> payload
            is Map<*, *> -> payload["torrents"] as? List<*> ?: listOf(payload)
            else -> invalid()
        }
        val matches = rows.filter { row ->
            row is Map<*, *> && identity(row["id"]) == torrentId &&
                (row["hash"] ?: row["infohash"]).let { it is String && it.equals(video.infohash, true) }
        }
        if (matches.size != 1) invalid()
        val row = matches.single() as Map<*, *>
        val state = (row["download_state"] ?: row["state"]) as? String
        if (state?.lowercase() !in READY_STATES) throw ProviderFailure(ProviderFailureCode.NOT_READY)
        val files = row["files"] as? List<*> ?: invalid()
        val matchingFiles = files.filter { it is Map<*, *> && identity(it["id"]) == fileId }
        if (matchingFiles.size != 1) invalid()
        val file = matchingFiles.single() as Map<*, *>
        val name = (file["name"] ?: file["short_name"] ?: file["path"]) as? String ?: invalid()
        if (name != video.name || positiveSize(file["size"]) != video.sizeBytes ||
            !VIDEO.containsMatchIn(name)) invalid()
        val download = data(request(
            "/v1/api/torrents/requestdl?torrent_id=$torrentId&file_id=$fileId&redirect=false",
            secret,
            ProviderAuth.TORBOX_DOWNLOAD_QUERY,
        ))
        val value = when (download) {
            is String -> download
            is Map<*, *> -> (download["url"] ?: download["link"]) as? String ?: invalid()
            else -> invalid()
        }
        val lease = try { URI(value) } catch (_: Exception) { invalid() }
        if (lease.scheme != "https" || lease.host.isNullOrBlank() || lease.userInfo != null ||
            lease.fragment != null || lease.port !in -1..65535 || value.length > 8192 ||
            value.contains(String(secret)) || value.contains(URLEncoder.encode(String(secret), StandardCharsets.UTF_8))
        ) invalid()
        return ProviderStream(lease)
    }

    private fun checkAccount(secret: CharArray, expected: String): String {
        val current = validate(secret).id
        if (expected.isBlank() || expected != current) throw ProviderFailure(ProviderFailureCode.INVALID_CREDENTIAL)
        return current
    }

    private fun request(path: String, secret: CharArray, auth: ProviderAuth = ProviderAuth.BEARER): Any? {
        val response = try { transport.get(path, secret, auth) }
        catch (failure: ProviderFailure) { throw failure }
        catch (_: Exception) { throw ProviderFailure(ProviderFailureCode.CONNECTIVITY) }
        when (response.status) {
            401, 403 -> throw ProviderFailure(ProviderFailureCode.INVALID_CREDENTIAL)
            408, 504 -> throw ProviderFailure(ProviderFailureCode.TIMEOUT)
            429 -> throw ProviderFailure(ProviderFailureCode.RATE_LIMITED)
        }
        if (response.status !in 200..299) throw ProviderFailure(ProviderFailureCode.UNAVAILABLE)
        val json = BoundedJson.parse(response.body) as? Map<*, *> ?: invalid()
        if (json["success"] != true) {
            // TorBox's documented error table identifies only these as bad/missing credentials.
            val code = if (json["error"] == "BAD_TOKEN" || json["error"] == "NO_AUTH")
                ProviderFailureCode.INVALID_CREDENTIAL else ProviderFailureCode.UNAVAILABLE
            throw ProviderFailure(code)
        }
        return json
    }

    private fun data(value: Any?): Any? = (value as? Map<*, *>)?.get("data") ?: invalid()

    private fun requireSecret(secret: CharArray) {
        if (secret.isEmpty() || secret.size > 1024 || secret.any { it.isISOControl() })
            throw ProviderFailure(ProviderFailureCode.INVALID_CREDENTIAL)
    }

    private fun credentialDigest(secret: CharArray, account: String): ByteArray {
        val bytes = String(secret).toByteArray(StandardCharsets.UTF_8)
        return try {
            MessageDigest.getInstance("SHA-256").apply {
                update("torbox\u0000$account\u0000".toByteArray(StandardCharsets.UTF_8))
                update(bytes)
            }.digest()
        } finally { bytes.fill(0) }
    }

    private fun identity(value: Any?): String? = when (value) {
        is String -> value.takeIf { it.length in 1..128 && ID.matches(it) }
        is Long -> value.takeIf { it >= 0 }?.toString()
        else -> null
    }

    private fun positiveSize(value: Any?): Long? = when (value) {
        is Long -> value.takeIf { it > 0 }
        else -> null
    }

    private fun invalid(): Nothing = throw ProviderFailure(ProviderFailureCode.INVALID_RESPONSE)

    private companion object {
        val ID = Regex("[A-Za-z0-9_-]+")
        val HASH = Regex("[A-Fa-f0-9]{40}")
        val VIDEO = Regex("(?i)\\.(mkv|mp4|m4v|webm|avi|mov|ts)$")
        val READY_STATES = setOf("completed", "cached", "seeding", "uploading")
    }
}
