package com.reelos.providers

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.URI
import java.net.URLEncoder
import java.net.URL
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.StandardCharsets
import javax.net.ssl.HttpsURLConnection

/** Fixed TorBox API origin. No redirects, caches, raw exceptions, or credential-bearing diagnostics. */
class JdkProviderTransport : ProviderTransport {
    override fun get(pathAndQuery: String, secret: CharArray, auth: ProviderAuth): ProviderHttpResponse {
        if (secret.isEmpty() || secret.size > 1024 || secret.any { it.isISOControl() })
            throw ProviderFailure(ProviderFailureCode.INVALID_CREDENTIAL)
        if (!pathAndQuery.startsWith("/v1/api/") || pathAndQuery.contains('#') ||
            pathAndQuery.contains('@') || pathAndQuery.startsWith("//") ||
            pathAndQuery.contains("\\") || pathAndQuery.length > 512
        ) invalid()
        val allowed = when (auth) {
            ProviderAuth.BEARER -> pathAndQuery == "/v1/api/user/me" ||
                pathAndQuery == "/v1/api/torrents/mylist?bypass_cache=true&limit=1000" ||
                pathAndQuery.matches(Regex("/v1/api/torrents/mylist\\?id=[A-Za-z0-9_-]+&bypass_cache=true"))
            ProviderAuth.TORBOX_DOWNLOAD_QUERY ->
                pathAndQuery.matches(Regex("/v1/api/torrents/requestdl\\?torrent_id=[A-Za-z0-9_-]+&file_id=[A-Za-z0-9_-]+&redirect=false"))
        }
        if (!allowed) invalid()
        // The provider documents this single endpoint with a token query. It never leaves this transport.
        val authenticatedPath = if (auth == ProviderAuth.TORBOX_DOWNLOAD_QUERY) {
            "$pathAndQuery&token=${URLEncoder.encode(String(secret), StandardCharsets.UTF_8)}"
        } else pathAndQuery
        val uri = try { URI.create("https://api.torbox.app$authenticatedPath") }
        catch (_: IllegalArgumentException) { invalid() }
        if (uri.scheme != "https" || uri.host != "api.torbox.app" || uri.port != -1 ||
            uri.userInfo != null || !uri.path.startsWith("/v1/api/")) invalid()
        val connection = try { URL(uri.toASCIIString()).openConnection() as HttpsURLConnection }
        catch (_: Exception) { throw ProviderFailure(ProviderFailureCode.CONNECTIVITY) }
        try {
            connection.instanceFollowRedirects = false
            connection.useCaches = false
            connection.connectTimeout = 5_000
            connection.readTimeout = 10_000
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("User-Agent", "ReelOS-native-provider")
            if (auth == ProviderAuth.BEARER)
                connection.setRequestProperty("Authorization", "Bearer ${String(secret)}")
            val status = connection.responseCode
            if (status in 300..399) invalid()
            if (status !in 200..299) return ProviderHttpResponse(status, "")
            val deadline = System.nanoTime() + 15_000_000_000L
            val bytes = connection.inputStream.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                while (true) {
                    val remainingMs = (deadline - System.nanoTime()) / 1_000_000
                    if (remainingMs <= 0) throw ProviderFailure(ProviderFailureCode.TIMEOUT)
                    connection.readTimeout = remainingMs.coerceAtMost(10_000).toInt().coerceAtLeast(1)
                    val count = input.read(buffer)
                    if (count < 0) break
                    if (output.size() + count > 256 * 1024) invalid()
                    output.write(buffer, 0, count)
                }
                output.toByteArray()
            }
            val body = try { StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString() }
            catch (_: CharacterCodingException) { invalid() }
            return ProviderHttpResponse(status, body)
        } catch (failure: ProviderFailure) {
            throw failure
        } catch (_: SocketTimeoutException) {
            throw ProviderFailure(ProviderFailureCode.TIMEOUT)
        } catch (_: IOException) {
            throw ProviderFailure(ProviderFailureCode.CONNECTIVITY)
        } catch (_: RuntimeException) {
            throw ProviderFailure(ProviderFailureCode.UNAVAILABLE)
        } finally {
            connection.disconnect()
        }
    }

    private fun invalid(): Nothing = throw ProviderFailure(ProviderFailureCode.INVALID_RESPONSE)
}
