package com.reelos.core.offline

import android.content.Context
import com.reelos.core.api.ReelOsClient
import com.reelos.core.model.ClientResult
import com.reelos.core.model.MediaItem
import com.reelos.core.prefs.AppPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import org.json.JSONArray
import org.json.JSONObject

class TravelDownloadManager(
    context: Context,
    private val preferences: AppPreferences,
    private val api: ReelOsClient,
    private val http: OkHttpClient = OkHttpClient(),
) {
    private val directory = File(context.getExternalFilesDir(null) ?: context.filesDir, "travel").apply { mkdirs() }
    private val indexFile = File(directory, "index.json")

    fun localFile(itemId: String): File? = target(itemId).takeIf { it.isFile && it.length() > 0 }

    fun savedItems(): List<MediaItem> = runCatching {
        val array = JSONArray(indexFile.takeIf(File::isFile)?.readText().orEmpty().ifBlank { "[]" })
        (0 until array.length()).mapNotNull { index ->
            val row = array.optJSONObject(index) ?: return@mapNotNull null
            val id = row.optString("id")
            val file = localFile(id) ?: return@mapNotNull null
            MediaItem(
                id = id,
                title = row.optString("title", "Saved title"),
                year = row.optInt("year").takeIf { it > 0 },
                streamUrl = file.toURI().toString(),
                available = true,
            )
        }
    }.getOrDefault(emptyList())

    suspend fun save(item: MediaItem, onProgress: (Float) -> Unit = {}): ClientResult<File> = withContext(Dispatchers.IO) {
        val resolved = when (val result = api.resolvePlayback(item)) {
            is ClientResult.Success -> result.value
            is ClientResult.Failure -> return@withContext result
        }
        val streamUrl = resolved.streamUrl
            ?: return@withContext ClientResult.Failure("This title has no verified download source.", "source_unavailable")
        val output = target(item.id)
        val partial = File(output.parentFile, "${output.name}.part")
        partial.delete()
        try {
            val request = Request.Builder().url(streamUrl).apply {
                preferences.cookieHeader.takeIf(String::isNotBlank)?.let { header("Cookie", it) }
            }.build()
            http.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext ClientResult.Failure("The home could not prepare this travel download.", "download_http_${response.code}")
                }
                val body = response.body ?: return@withContext ClientResult.Failure("The download was empty.", "empty_download")
                val expected = body.contentLength()
                if (expected <= 0) return@withContext ClientResult.Failure("The home did not provide a verifiable file size.", "size_unavailable")
                val cap = preferences.offlineStorageLimitGb.toLong() * 1024L * 1024L * 1024L
                val used = directory.listFiles()?.filter { it.isFile && !it.name.endsWith(".part") }?.sumOf { it.length() } ?: 0L
                if (expected > cap || used + expected > cap) {
                    return@withContext ClientResult.Failure("Not enough travel storage is available under your limit.", "storage_limit")
                }
                var copied = 0L
                body.byteStream().use { input ->
                    FileOutputStream(partial).use { sink ->
                        val buffer = ByteArray(64 * 1024)
                        while (true) {
                            val count = input.read(buffer)
                            if (count < 0) break
                            sink.write(buffer, 0, count)
                            copied += count
                            onProgress((copied.toFloat() / expected.toFloat()).coerceIn(0f, 1f))
                        }
                        sink.fd.sync()
                    }
                }
                if (copied != expected) {
                    partial.delete()
                    return@withContext ClientResult.Failure("The download ended before the verified size was received.", "download_incomplete")
                }
                output.delete()
                if (!partial.renameTo(output)) {
                    partial.delete()
                    return@withContext ClientResult.Failure("The completed download could not be published.", "publish_failed")
                }
                publishIndex(item)
                ClientResult.Success(output)
            }
        } catch (_: Exception) {
            partial.delete()
            ClientResult.Failure("The travel download was interrupted.", "download_interrupted")
        }
    }

    fun remove(itemId: String): Boolean {
        val removed = target(itemId).let { !it.exists() || it.delete() }
        if (removed) {
            val retained = savedItems().filterNot { it.id == itemId }
            writeIndex(retained)
        }
        return removed
    }

    private fun publishIndex(item: MediaItem) {
        val items = savedItems().filterNot { it.id == item.id } + item.copy(streamUrl = null)
        writeIndex(items)
    }

    private fun writeIndex(items: List<MediaItem>) {
        val array = JSONArray()
        items.forEach { item -> array.put(JSONObject().put("id", item.id).put("title", item.title).put("year", item.year)) }
        val partial = File(directory, "index.json.part")
        partial.writeText(array.toString())
        indexFile.delete()
        if (!partial.renameTo(indexFile)) partial.delete()
    }

    private fun target(itemId: String): File {
        val id = MessageDigest.getInstance("SHA-256").digest(itemId.toByteArray())
            .joinToString("") { "%02x".format(it) }
        return File(directory, "$id.media")
    }
}
