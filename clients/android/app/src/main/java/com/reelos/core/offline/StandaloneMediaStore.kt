package com.reelos.core.offline

import android.content.Context
import com.reelos.core.model.MediaItem
import org.json.JSONArray
import org.json.JSONObject

/** User-owned local media for the no-home Android path. No catalog or provider is invented. */
class StandaloneMediaStore(context: Context) {
    private val prefs = context.getSharedPreferences("reelos_standalone_media", Context.MODE_PRIVATE)

    fun items(): List<MediaItem> = runCatching {
        val rows = JSONArray(prefs.getString("items", "[]"))
        (0 until rows.length()).mapNotNull { index ->
            val row = rows.optJSONObject(index) ?: return@mapNotNull null
            val uri = row.optString("uri").takeIf { it.isNotBlank() } ?: return@mapNotNull null
            MediaItem(
                id = row.optString("id", uri),
                title = row.optString("title", "Local video"),
                year = row.optInt("year").takeIf { it > 0 },
                streamUrl = uri,
                available = true,
            )
        }
    }.getOrDefault(emptyList())

    fun add(uri: String, title: String) {
        val retained = items().filterNot { it.streamUrl == uri }
        val rows = JSONArray()
        (retained + MediaItem(id = uri, title = title, streamUrl = uri, available = true)).forEach { item ->
            rows.put(JSONObject().put("id", item.id).put("uri", item.streamUrl).put("title", item.title).put("year", item.year))
        }
        prefs.edit().putString("items", rows.toString()).apply()
    }
}
