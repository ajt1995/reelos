package com.reelos.core.offline

import android.content.Context
import android.net.Uri
import com.reelos.core.model.MediaItem
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class NodeApiResponse(val status: Int, val body: String)

/** Local, credential-free ReelOS node API used when Android is not joined to a Home. */
class StandaloneNodeApi(context: Context, private val tvMode: Boolean) {
    private val prefs = context.getSharedPreferences("reelos_native_node", Context.MODE_PRIVATE)
    private val media = StandaloneMediaStore(context)
    private val appVersion = runCatching {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName
    }.getOrNull() ?: "unknown"

    fun request(rawUrl: String, rawMethod: String, body: String? = null): NodeApiResponse {
        val uri = Uri.parse(rawUrl)
        val path = uri.path.orEmpty()
        val method = rawMethod.uppercase()
        return runCatching {
            when {
                path == "/api/discovery" && method == "GET" -> ok(discovery())
                path == "/api/gate/status" && method == "GET" -> ok(JSONObject()
                    .put("ok", true).put("isLan", true).put("isPaired", false).put("standalone", true))
                path == "/api/settings" && method == "GET" -> ok(settings())
                path == "/api/settings" && method == "POST" -> ok(saveSettings(json(body)))
                path == "/api/profiles" && method == "GET" -> ok(profileEnvelope())
                path == "/api/profiles" && method == "POST" -> saveProfile(json(body))
                path == "/api/profiles/active" && method == "POST" -> activateProfile(json(body))
                path == "/api/profiles/setup/complete" && method == "POST" -> completeSetup()
                path == "/api/provision" && method == "POST" -> provision()
                path == "/api/ready" && method == "GET" -> ok(ready())
                path == "/api/library" && method == "GET" -> ok(library())
                path == "/api/library/progress" && method == "POST" -> saveProgress(json(body))
                path == "/api/lookup" && method == "GET" -> ok(lookup(uri))
                path.matches(Regex("^/api/media/[^/]+/sources$")) && method == "GET" -> sources(path)
                path.matches(Regex("^/api/media/[^/]+/intro-timestamps$")) && method == "GET" ->
                    ok(JSONObject().put("hasIntro", false))
                path == "/api/capabilities" && method == "GET" -> ok(capabilities())
                path == "/api/ambient/channels" && method == "GET" -> ok(ambientChannels())
                path == "/api/ambient/flip" && method == "POST" -> ok(ambientFlip(uri))
                path == "/api/activity" && method == "GET" -> ok(JSONObject().put("ok", true).put("activity", JSONArray()))
                path == "/api/books/library" && method == "GET" -> ok(JSONObject().put("ok", true).put("books", JSONArray()))
                path == "/api/books/discover" && method == "GET" -> ok(JSONObject().put("ok", true).put("books", JSONArray()))
                else -> unavailable(path)
            }
        }.getOrElse { error(500, "native_node_failure", "This device could not read its local ReelOS state.") }
    }

    private fun discovery() = JSONObject()
        .put("app", "reelos").put("version", appVersion)
        .put("boxName", android.os.Build.MODEL).put("platform", if (tvMode) "android-tv" else "android")
        .put("sharedComputeStage", "local").put("householdSynchronization", "discoverable")
        .put("standalone", true)

    private fun settings(): JSONObject = runCatching {
        JSONObject(prefs.getString("settings", "{}") ?: "{}")
    }.getOrDefault(JSONObject()).apply {
        if (!has("betaChannel")) put("betaChannel", false)
        if (!has("region")) put("region", "US")
    }

    private fun saveSettings(update: JSONObject): JSONObject {
        val next = settings()
        update.keys().forEach { key ->
            if (key !in setOf("apiKey", "token", "password", "credential")) next.put(key, update.get(key))
        }
        prefs.edit().putString("settings", next.toString()).apply()
        return next.put("ok", true)
    }

    private fun defaultProfile() = JSONObject()
        .put("experienceVersion", 2).put("id", "android-local").put("name", "")
        .put("color", "#f5c518").put("isKids", false).put("pinEnabled", false)
        .put("atmosphere", true).put("transparency", true).put("motion", "subtle")
        .put("density", "comfortable").put("exploration", "balanced")
        .put("reactions", JSONObject()).put("dismissedTasteIds", JSONArray()).put("lessLikeIds", JSONArray())
        .put("watchlist", JSONArray()).put("watchProgress", JSONObject()).put("bookProgress", JSONObject())
        .put("bookLocations", JSONObject()).put("bookBookmarks", JSONObject())

    private fun profiles(): JSONArray = runCatching {
        JSONArray(prefs.getString("profiles", "[]") ?: "[]")
    }.getOrDefault(JSONArray()).let { if (it.length() == 0) JSONArray().put(defaultProfile()) else it }

    private fun activeId(): String = prefs.getString("active_profile", null)
        ?: profiles().optJSONObject(0)?.optString("id", "android-local") ?: "android-local"

    private fun profileEnvelope(): JSONObject = JSONObject()
        .put("ok", true).put("profiles", profiles()).put("activeId", activeId())
        .put("auth", JSONObject().put("bootstrapRequired", false).put("authenticated", true)
            .put("role", "owner").put("profileId", activeId()).put("deviceAuthorized", true))
        .put("setup", JSONObject().put("status", if (prefs.getBoolean("setup_complete", false)) "complete" else "in_progress")
            .put("completedAt", if (prefs.contains("setup_completed_at")) prefs.getLong("setup_completed_at", 0) else JSONObject.NULL))

    private fun saveProfile(profile: JSONObject): NodeApiResponse {
        val profileId = profile.optString("id").takeIf { it.matches(Regex("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")) }
            ?: return error(400, "profile_invalid", "This profile needs a valid identity.")
        if (profile.optString("name").isBlank()) return error(400, "profile_invalid", "This profile needs a name.")
        profile.put("experienceVersion", 2).put("updatedAt", System.currentTimeMillis())
        val rows = JSONArray()
        var replaced = false
        val existing = profiles()
        for (index in 0 until existing.length()) {
            val row = existing.optJSONObject(index) ?: continue
            if (row.optString("id") == profileId) { rows.put(profile); replaced = true } else rows.put(row)
        }
        if (!replaced) rows.put(profile)
        prefs.edit().putString("profiles", rows.toString()).apply()
        return ok(JSONObject().put("ok", true).put("profile", profile).put("activeId", activeId()))
    }

    private fun activateProfile(input: JSONObject): NodeApiResponse {
        val requested = input.optString("id")
        val profile = (0 until profiles().length()).mapNotNull { profiles().optJSONObject(it) }
            .firstOrNull { it.optString("id") == requested }
            ?: return error(404, "profile_not_found", "That profile is not on this device.")
        if (profile.optBoolean("pinEnabled") || profile.optBoolean("isKids")) {
            return error(409, "profile_pin_requires_home_policy", "Protected profiles require verified Home policy on this build.")
        }
        prefs.edit().putString("active_profile", requested).apply()
        return ok(JSONObject().put("ok", true).put("profile", profile).put("activeId", requested)
            .put("auth", JSONObject().put("bootstrapRequired", false).put("authenticated", true)
                .put("role", "owner").put("profileId", requested).put("deviceAuthorized", true)))
    }

    private fun completeSetup(): NodeApiResponse {
        val now = System.currentTimeMillis()
        prefs.edit().putBoolean("setup_complete", true).putLong("setup_completed_at", now).apply()
        return ok(JSONObject().put("ok", true).put("setup", JSONObject().put("status", "complete").put("completedAt", now)))
    }

    private fun provision(): NodeApiResponse {
        prefs.edit().putBoolean("provisioned", true).apply()
        return ok(JSONObject().put("ok", true).put("platform", "android").put("standalone", true))
    }

    private fun itemJson(item: MediaItem): JSONObject = JSONObject()
        .put("id", item.id).put("title", item.title).put("year", item.year ?: JSONObject.NULL)
        .put("overview", item.overview ?: "Available on this device.").put("poster", item.posterUrl ?: "")
        .put("backdrop", item.backdropUrl ?: "").put("jellyfinId", item.id).put("kind", "movie")
        .put("sourceKind", "personal_import").put("sourceVerified", true)
        .put("runtime", if (item.durationMs > 0) item.durationMs / 60_000 else 0)

    private fun progress(): JSONObject = runCatching {
        JSONObject(prefs.getString("progress", "{}") ?: "{}")
    }.getOrDefault(JSONObject())

    private fun library(): JSONObject {
        val titles = JSONArray(); val continuing = JSONArray(); val progress = progress()
        media.items().forEach { item ->
            val row = itemJson(item); titles.put(row)
            val position = progress.optDouble(item.id, 0.0)
            if (position > 0.0) continuing.put(JSONObject(row.toString()).put("progress", position))
        }
        return JSONObject().put("ok", true).put("engine", "android-native")
            .put("titles", titles).put("continueWatching", continuing).put("error", JSONObject.NULL)
    }

    private fun ready() = library().put("provisioned", prefs.getBoolean("provisioned", false))
        .put("requests", JSONArray()).put("betaChannel", settings().optBoolean("betaChannel", false))
        .put("platform", if (tvMode) "android-tv" else "android").put("sharedComputeStage", "local")

    private fun saveProgress(input: JSONObject): NodeApiResponse {
        val itemId = input.optString("itemId", input.optString("id"))
        if (media.items().none { it.id == itemId }) return error(404, "media_not_found", "That local title is unavailable.")
        val duration = input.optDouble("duration", input.optDouble("durationMs", 0.0))
        val position = input.optDouble("position", input.optDouble("positionMs", 0.0))
        val normalized = if (duration > 0) (position / duration).coerceIn(0.0, 1.0) else input.optDouble("progress", 0.0).coerceIn(0.0, 1.0)
        val next = progress().put(itemId, normalized)
        prefs.edit().putString("progress", next.toString()).apply()
        return ok(JSONObject().put("ok", true).put("itemId", itemId).put("progress", normalized))
    }

    private fun lookup(uri: Uri): JSONObject {
        val id = uri.getQueryParameter("id")
        val query = uri.getQueryParameter("q")?.trim()?.lowercase()
        val matches = media.items().filter { item -> id?.let { item.id == it } ?: (query.isNullOrBlank() || item.title.lowercase().contains(query)) }
        return JSONObject().put("titles", JSONArray().apply { matches.forEach { put(itemJson(it)) } })
            .put("source", "android-local")
    }

    private fun sources(path: String): NodeApiResponse {
        val itemId = Uri.decode(path.removePrefix("/api/media/").removeSuffix("/sources"))
        val item = media.items().firstOrNull { it.id == itemId }
            ?: return error(404, "media_not_found", "That local title is unavailable.")
        val source = JSONObject().put("id", item.id).put("name", "This device")
            .put("url", item.streamUrl).put("streamUrl", item.streamUrl).put("container", "auto")
            .put("directPlay", true).put("verified", true)
        return ok(JSONObject().put("ok", true).put("activeProfileId", activeId()).put("progressTitleId", item.id)
            .put("title", itemJson(item)).put("jellyfinId", item.id).put("sources", JSONArray().put(source))
            .put("recommendedForBrowser", source).put("reaction", JSONObject.NULL))
    }

    private fun capabilities() = JSONObject().put("ok", true).put("capabilities", JSONArray()
        .put(capability("taste-ranking", "assisting", true))
        .put(capability("semantic-search", "assisting", true))
        .put(capability("scene-understanding", "validating", false))
        .put(capability("family-scene-guidance", "validating", false))
        .put(capability("dialogue-enhancement", "validating", false))
        .put(capability("shared-taste-intelligence", "validating", false)))

    private fun capability(id: String, state: String, available: Boolean) = JSONObject()
        .put("id", id).put("state", state).put("available", available)
        .put("scope", "device").put("reason", if (available) "Local deterministic fallback is active." else "Local model evidence is still validating.")

    private fun ambientChannels(): JSONObject = JSONObject()
        .put("ok", true)
        .put("channels", JSONArray(listOf(
            JSONObject().put("id", "comfort-sitcoms").put("name", "Comfort Sitcoms").put("tagline", "Background laughter and familiar living rooms"),
            JSONObject().put("id", "nature-slow-cinema").put("name", "Nature & Slow Cinema").put("tagline", "4K landscapes, ambient soundscapes, minimal dialogue"),
            JSONObject().put("id", "late-night-noir").put("name", "Late-Night Noir").put("tagline", "Shadows, jazz, rain-slicked streets, moody dialogue"),
            JSONObject().put("id", "weekend-animation").put("name", "Weekend Animation").put("tagline", "Classic cel animation, indie shorts, Saturday morning nostalgia"),
            JSONObject().put("id", "resident-cinema-radio").put("name", "Resident Cinema Radio").put("tagline", "Curated cinematic score streams with synchronized film stills"),
        )))

    private fun ambientFlip(uri: Uri): JSONObject = JSONObject()
        .put("ok", true)
        .put("direction", uri.getQueryParameter("dir") ?: "next")
        .put("switchedInMs", 18)

    private fun json(body: String?): JSONObject = if (body.isNullOrBlank()) JSONObject() else JSONObject(body)
    private fun ok(value: JSONObject) = NodeApiResponse(200, value.toString())
    private fun unavailable(path: String) = error(
        503,
        "native_capability_unavailable",
        if (path.startsWith("/api/preparation"))
            "Prepared copies need a capable ReelOS home. Compatible media can still play directly on this device."
        else "This capability is not available on this device yet.",
    )
    private fun error(status: Int, code: String, message: String) = NodeApiResponse(status,
        JSONObject().put("ok", false).put("code", code).put("error", message).toString())
}
