package com.reelos.core.discovery

import android.content.Context
import com.reelos.core.model.DiscoveryInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.OkHttpClient
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Request
import org.json.JSONObject
import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.concurrent.TimeUnit

class ServerDiscovery(@Suppress("UNUSED_PARAMETER") context: Context) {
    private val client = OkHttpClient.Builder()
        .dispatcher(okhttp3.Dispatcher().apply {
            maxRequests = 256
            maxRequestsPerHost = 16
        })
        .connectTimeout(600, TimeUnit.MILLISECONDS)
        .readTimeout(600, TimeUnit.MILLISECONDS)
        .followRedirects(false)
        .build()

    suspend fun probeServer(address: String): DiscoveryInfo? = withContext(Dispatchers.IO) {
        val base = discoveryBaseUrl(address) ?: return@withContext null
        try {
            client.newCall(Request.Builder().url(base.resolve("/api/discovery")!!).build()).execute().use { response ->
                if (!response.isSuccessful) return@use null
                val json = JSONObject(response.body?.string().orEmpty())
                if (!json.optString("app").equals("reelos", true)) return@use null
                DiscoveryInfo(
                    version = json.optString("version"),
                    boxName = json.optString("boxName", "ReelOS Home"),
                    baseUrl = base.toString().trimEnd('/'),
                    tailscaleHost = json.optString("tailscaleIp").takeIf(String::isNotBlank),
                )
            }
        } catch (_: Exception) { null }
    }

    internal fun discoveryBaseUrl(address: String): HttpUrl? {
        val raw = address.trim().trimEnd('/')
        val supplied = when {
            raw.startsWith("http://", true) || raw.startsWith("https://", true) -> raw.toHttpUrlOrNull()
            raw.endsWith(".ts.net", true) -> "https://$raw".toHttpUrlOrNull()
            else -> "http://$raw:8080".toHttpUrlOrNull()
        } ?: return null
        if (supplied.scheme == "http" && !isPrivateHouseholdHost(supplied.host)) return null
        if (supplied.username.isNotEmpty() || supplied.password.isNotEmpty() || supplied.query != null) return null
        return supplied.newBuilder().encodedPath("/").build()
    }

    private fun isPrivateHouseholdHost(host: String): Boolean {
        if (host == "localhost" || host.endsWith(".local", true) || host == "255.255.255.255") return true
        val octets = host.split('.').mapNotNull(String::toIntOrNull)
        if (octets.size != 4 || octets.any { it !in 0..255 }) return false
        return octets[0] == 10 || octets[0] == 127 ||
            (octets[0] == 192 && octets[1] == 168) ||
            (octets[0] == 172 && octets[1] in 16..31) ||
            (octets[0] == 100 && octets[1] in 64..127) ||
            (octets[0] == 255 && octets[1] == 255 && octets[2] == 255 && octets[3] == 255)
    }

    suspend fun discoverLocalServer(timeoutMs: Long = 2_500L): DiscoveryInfo? = withContext(Dispatchers.IO) {
        // Fast path 1: Listen for UDP mesh beacons broadcast on port 44445
        val beaconFound = runCatching {
            val socket = java.net.DatagramSocket(null).apply {
                reuseAddress = true
                soTimeout = 1200
                bind(java.net.InetSocketAddress(44445))
            }
            socket.use { s ->
                val buf = ByteArray(2048)
                val packet = java.net.DatagramPacket(buf, buf.size)
                s.receive(packet)
                val str = String(packet.data, 0, packet.length, Charsets.UTF_8)
                val json = JSONObject(str)
                if (json.optString("type") == "REELOS_MESH_BEACON") {
                    val port = json.optInt("port", 8080)
                    val senderIp = packet.address.hostAddress ?: ""
                    probeServer("http://$senderIp:$port")
                } else null
            }
        }.getOrNull()

        if (beaconFound != null) return@withContext beaconFound

        // Fast path 2: Standard mDNS and network gateways
        val candidates = linkedSetOf(
            "reelos.local",  // Local mDNS household hostname
            "10.0.2.2",      // Android emulator loopback host
            "127.0.0.1",     // Localhost loopback
        )
        runCatching {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val network = interfaces.nextElement()
                if (!network.isUp || network.isLoopback) continue
                for (ia in network.interfaceAddresses) {
                    val address = ia.address
                    if (address is Inet4Address && !address.isLoopbackAddress) {
                        val subnet = address.hostAddress?.substringBeforeLast('.') ?: continue
                        candidates += "$subnet.1"   // Active subnet gateway
                        candidates += "$subnet.254" // Alternate router gateway
                        ia.broadcast?.hostAddress?.let { candidates += it }
                    }
                }
            }
        }
        withTimeoutOrNull(timeoutMs) {
            coroutineScope {
                candidates.map { async { probeServer(it) } }.awaitAll().firstOrNull { it != null }
            }
        }
    }
}
