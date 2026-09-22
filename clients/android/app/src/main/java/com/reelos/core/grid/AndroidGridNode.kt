package com.reelos.core.grid

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.StatFs
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

class AndroidGridNode(private val context: Context) {
    private val running = AtomicBoolean(false)
    private val prefs = context.getSharedPreferences("reelos_grid_node", Context.MODE_PRIVATE)
    private val machineId = prefs.getString("machine_id", null) ?: "android-${UUID.randomUUID()}".also {
        prefs.edit().putString("machine_id", it).apply()
    }
    private var httpServer: ServerSocket? = null
    private var beaconSocket: DatagramSocket? = null

    fun start() {
        if (!running.compareAndSet(false, true)) return
        Thread(::serveGrid, "ReelOS-grid-http").apply { isDaemon = true; start() }
        Thread(::beaconLoop, "ReelOS-grid-beacon").apply { isDaemon = true; start() }
    }

    fun stop() {
        running.set(false)
        runCatching { httpServer?.close() }
        runCatching { beaconSocket?.close() }
    }

    private fun serveGrid() {
        val server = runCatching { ServerSocket(0) }.getOrNull() ?: return
        httpServer = server
        while (running.get()) {
            val socket = runCatching { server.accept() }.getOrNull() ?: break
            Thread({ handle(socket) }, "ReelOS-grid-request").apply { isDaemon = true; start() }
        }
    }

    private fun handle(socket: Socket) = socket.use { client ->
        client.soTimeout = 1500
        val first = BufferedReader(InputStreamReader(client.getInputStream())).readLine().orEmpty()
        val target = first.split(' ').getOrNull(1).orEmpty()
        val (status, payload) = when {
            target == "/api/grid/status" -> 200 to status()
            target == "/api/grid/capabilities" -> 200 to nodeManifest()
            target == "/api/grid/transcode/capabilities" -> 200 to JSONObject()
                .put("ok", true)
                .put("available", false)
                .put("reason", "Android transcoding has not passed the measured safety gate.")
            target.startsWith("/api/grid/cache/has/") -> 200 to JSONObject()
                .put("ok", true)
                .put("hasCache", false)
                .put("sizeBytes", 0)
                .put("inRam", false)
            target == "/api/grid/announce" -> 200 to JSONObject().put("ok", true).put("registered", machineId)
            else -> 404 to JSONObject().put("ok", false).put("error", "Unsupported ReelOS grid route")
        }
        val bytes = payload.toString().toByteArray()
        client.getOutputStream().apply {
            write("HTTP/1.1 $status ${if (status == 200) "OK" else "Not Found"}\r\n".toByteArray())
            write("Content-Type: application/json\r\n".toByteArray())
            write("Cache-Control: no-store\r\n".toByteArray())
            write("Content-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
            write(bytes)
            flush()
        }
    }

    private fun beaconLoop() {
        val socket = runCatching { DatagramSocket().apply { broadcast = true } }.getOrNull() ?: return
        beaconSocket = socket
        while (running.get()) {
            val port = httpServer?.localPort ?: 0
            if (port > 0) runCatching {
                val payload = JSONObject()
                    .put("type", "REELOS_MESH_BEACON")
                    .put("machineId", machineId)
                    .put("remoteCompute", false)
                    .put("port", port)
                    .put("manifest", nodeManifest())
                    .put("timestamp", System.currentTimeMillis())
                    .toString()
                    .toByteArray()
                socket.send(DatagramPacket(payload, payload.size, InetAddress.getByName("255.255.255.255"), GRID_PORT))
            }
            try { Thread.sleep(15_000) } catch (_: InterruptedException) { break }
        }
    }

    private fun status(): JSONObject = JSONObject()
        .put("ok", true)
        .put("remoteCompute", false)
        .put("hardware", hardware())
        .put("isThermalThrottled", false)
        .put("capabilityStage", "local")
        .put("manifest", nodeManifest())
        .put("peerNodes", org.json.JSONArray())

    private fun nodeManifest(): JSONObject {
        val hardware = hardware()
        val householdId = prefs.getString("household_id", null)
        return JSONObject()
            .put("schemaVersion", 1)
            .put("nodeId", machineId)
            .put("householdId", householdId ?: JSONObject.NULL)
            .put("platform", "android")
            .put("version", context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "unknown")
            .put("workloads", org.json.JSONArray().put("playback").put("storage").put("analysis"))
            .put("capabilities", JSONObject()
                .put("playback", JSONObject().put("stage", "validating").put("measured", false).put("reason", "Real-device playback evidence is pending."))
                .put("storage", JSONObject().put("stage", "assisting").put("measured", true).put("reason", "Local app storage is bounded by Android."))
                .put("analysis", JSONObject().put("stage", "validating").put("measured", false).put("reason", "Local model packs are not installed."))
                .put("transcode", JSONObject().put("stage", "unavailable").put("measured", false).put("reason", "Measured safety gate has not passed.")))
            .put("resourceLimits", JSONObject()
                .put("memoryBytes", hardware.getLong("totalMemoryMb") * 1024L * 1024L)
                .put("storageBytes", hardware.getLong("storageFreeMb") * 1024L * 1024L)
                .put("concurrency", 1)
                .put("playbackPriority", true))
            .put("generatedAt", System.currentTimeMillis())
    }

    private fun hardware(): JSONObject {
        val memory = ActivityManager.MemoryInfo().also {
            (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(it)
        }
        val storage = StatFs(context.filesDir.absolutePath)
        return JSONObject()
            .put("machineId", machineId)
            .put("platform", "android")
            .put("arch", Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown")
            .put("model", Build.MODEL)
            .put("coreCount", Runtime.getRuntime().availableProcessors())
            .put("totalMemoryMb", memory.totalMem / (1024 * 1024))
            .put("freeMemoryMb", memory.availMem / (1024 * 1024))
            .put("memoryHeadroomPercent", if (memory.totalMem > 0) memory.availMem * 100 / memory.totalMem else 0)
            .put("storageFreeMb", storage.availableBytes / (1024 * 1024))
            .put("hasGpu", true)
            .put("temperatureAvailable", false)
            .put("playbackPriority", true)
    }

    private companion object { const val GRID_PORT = 44445 }
}
