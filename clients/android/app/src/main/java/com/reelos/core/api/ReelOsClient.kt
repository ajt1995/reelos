package com.reelos.core.api

import com.reelos.core.model.ClientResult
import com.reelos.core.model.DiscoveryInfo
import com.reelos.core.model.MediaItem
import com.reelos.core.model.PairingStatus
import com.reelos.core.model.ResidentProfile
import com.reelos.core.prefs.AppPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class ReelOsClient(
    private val preferences: AppPreferences,
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .followRedirects(false)
        .build(),
) {
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    suspend fun discover(input: String): ClientResult<DiscoveryInfo> = withContext(Dispatchers.IO) {
        val base = HouseholdEndpoint.parse(input)
            ?: return@withContext ClientResult.Failure("Use a private home address or an HTTPS Tailscale name.", "invalid_home")
        try {
            val request = Request.Builder().url(base.resolve("/api/discovery")!!).build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext failure(response, "That ReelOS home did not answer.")
                val json = JSONObject(response.body?.string().orEmpty())
                if (!json.optString("app").equals("reelos", true)) {
                    return@withContext ClientResult.Failure("That address is not a ReelOS home.", "wrong_service")
                }
                preferences.serverBaseUrl = base.toString().trimEnd('/')
                ClientResult.Success(DiscoveryInfo(
                    app = "reelos",
                    version = json.optString("version"),
                    boxName = json.optString("boxName", "ReelOS Home"),
                    baseUrl = preferences.serverBaseUrl,
                    tailscaleHost = json.optString("tailscaleIp").takeIf { it.isNotBlank() },
                ))
            }
        } catch (_: Exception) {
            ClientResult.Failure("That ReelOS home could not be reached.", "home_unreachable")
        }
    }

    suspend fun pairDevice(): ClientResult<Unit> = withContext(Dispatchers.IO) {
        val response = post("/api/gate/pair-lan", JSONObject())
            ?: return@withContext ClientResult.Failure("No ReelOS home is selected.", "home_required")
        response.use {
            captureCookies(it)
            if (!it.isSuccessful) return@withContext failure(it, "Connect through this home's Wi-Fi or private Tailscale network.")
            if (preferences.deviceCookie.isNullOrBlank()) {
                return@withContext ClientResult.Failure("The home did not issue a device credential.", "pairing_incomplete")
            }
            ClientResult.Success(Unit)
        }
    }

    suspend fun pairingStatus(): ClientResult<PairingStatus> = withContext(Dispatchers.IO) {
        execute("/api/gate/status")?.use { response ->
            if (!response.isSuccessful) return@withContext failure(response, "Pairing status is unavailable.")
            val json = JSONObject(response.body?.string().orEmpty())
            ClientResult.Success(PairingStatus(
                deviceAuthorized = json.optBoolean("isPaired", false) || !preferences.deviceCookie.isNullOrBlank(),
                profileAuthenticated = !preferences.profileCookie.isNullOrBlank(),
                activeProfileId = preferences.activeResidentId,
            ))
        } ?: ClientResult.Failure("No ReelOS home is selected.", "home_required")
    }

    suspend fun getProfiles(): ClientResult<List<ResidentProfile>> = withContext(Dispatchers.IO) {
        execute("/api/profiles")?.use { response ->
            captureCookies(response)
            if (!response.isSuccessful) return@withContext failure(response, "Household profiles are unavailable.")
            val text = response.body?.string().orEmpty()
            val json = JSONObject(text)
            val profiles = json.optJSONArray("profiles") ?: JSONArray()
            ClientResult.Success((0 until profiles.length()).map { index ->
                val profile = profiles.getJSONObject(index)
                ResidentProfile(
                    id = profile.getString("id"),
                    name = profile.optString("name", "Resident"),
                    avatar = profile.optString("avatar", "clapperboard"),
                    isKids = profile.optBoolean("isKids", false),
                    hasPin = profile.optBoolean("pinEnabled", false) || profile.optBoolean("hasPin", false) || profile.optBoolean("pinProtected", false),
                )
            })
        } ?: ClientResult.Failure("No ReelOS home is selected.", "home_required")
    }

    suspend fun openProfile(profile: ResidentProfile, pin: String? = null): ClientResult<Unit> = withContext(Dispatchers.IO) {
        val body = JSONObject().put("id", profile.id)
        if (!pin.isNullOrBlank()) body.put("pin", pin)
        val response = post("/api/profiles/active", body)
            ?: return@withContext ClientResult.Failure("No ReelOS home is selected.", "home_required")
        response.use {
            captureCookies(it)
            if (!it.isSuccessful) return@withContext failure(it, "That profile could not be opened.")
            if (preferences.profileCookie.isNullOrBlank()) {
                return@withContext ClientResult.Failure("The home did not issue a profile session.", "profile_session_missing")
            }
            preferences.activeResidentId = profile.id
            preferences.activeResidentName = profile.name
            ClientResult.Success(Unit)
        }
    }

    suspend fun getLibrary(): ClientResult<List<MediaItem>> = withContext(Dispatchers.IO) {
        execute("/api/library")?.use { response ->
            if (!response.isSuccessful) return@withContext failure(response, "Your library is unavailable.")
            val text = response.body?.string().orEmpty()
            val root = JSONObject(text)
            val titles = root.optJSONArray("titles") ?: root.optJSONArray("items") ?: JSONArray()
            ClientResult.Success((0 until titles.length()).mapNotNull { index -> parseMedia(titles.optJSONObject(index)) })
        } ?: ClientResult.Failure("No ReelOS home is selected.", "home_required")
    }

    suspend fun resolvePlayback(item: MediaItem): ClientResult<MediaItem> = withContext(Dispatchers.IO) {
        execute("/api/media/${java.net.URLEncoder.encode(item.id, Charsets.UTF_8.name())}/sources")?.use { response ->
            if (!response.isSuccessful) return@withContext failure(response, "No verified playback source is available.")
            val root = JSONObject(response.body?.string().orEmpty())
            val source = root.optJSONObject("recommendedForMobile")
                ?: root.optJSONObject("recommendedForTv")
                ?: root.optJSONArray("sources")?.optJSONObject(0)
                ?: return@withContext ClientResult.Failure("This title is not ready to play.", "source_unavailable")
            val relative = source.optString("streamUrl")
            val base = baseUrl() ?: return@withContext ClientResult.Failure("No ReelOS home is selected.", "home_required")
            val stream = HouseholdEndpoint.sameOrigin(base, relative)
                ?: return@withContext ClientResult.Failure("The home returned an unsafe playback address.", "cross_origin_stream")
            val resume = root.optDouble("resumeProgress", 0.0).coerceIn(0.0, 1.0)
            ClientResult.Success(item.copy(
                streamUrl = stream.toString(),
                available = true,
                resumePositionMs = if (item.durationMs > 0) (item.durationMs * resume).toLong() else 0,
                audioCodec = source.optString("audioCodec", item.audioCodec),
                videoCodec = source.optString("videoCodec", item.videoCodec),
            ))
        } ?: ClientResult.Failure("No ReelOS home is selected.", "home_required")
    }

    suspend fun reportPlayback(action: String, item: MediaItem, positionMs: Long, durationMs: Long, sessionId: String, paused: Boolean): ClientResult<Unit> = withContext(Dispatchers.IO) {
        if (action !in setOf("start", "progress", "stop")) return@withContext ClientResult.Failure("Invalid playback event.")
        val body = JSONObject().apply {
            put("itemId", item.id)
            put("playSessionId", sessionId)
            put("positionTicks", positionMs.coerceAtLeast(0) * 10_000)
            put("durationTicks", durationMs.coerceAtLeast(0) * 10_000)
            put("isPaused", paused)
        }
        post("/api/playback/$action", body)?.use { response ->
            if (response.isSuccessful) ClientResult.Success(Unit) else failure(response, "Playback progress could not be saved.")
        } ?: ClientResult.Failure("No ReelOS home is selected.", "home_required")
    }

    fun authenticatedHeaders(): Map<String, String> = preferences.cookieHeader.takeIf { it.isNotBlank() }
        ?.let { mapOf("Cookie" to it) } ?: emptyMap()

    private fun parseMedia(value: JSONObject?): MediaItem? {
        value ?: return null
        val id = value.optString("id", value.optString("itemId")).trim()
        if (id.isEmpty()) return null
        return MediaItem(
            id = id,
            title = value.optString("title", "Untitled"),
            year = value.optInt("year").takeIf { it > 0 },
            overview = value.optString("overview").takeIf(String::isNotBlank),
            posterUrl = value.optString("posterUrl").takeIf(String::isNotBlank),
            backdropUrl = value.optString("backdropUrl").takeIf(String::isNotBlank),
            durationMs = value.optLong("durationMs", 0),
            available = value.optBoolean("ready", value.optBoolean("available", false)),
            genre = value.optString("genre"),
        )
    }

    private fun baseUrl(): HttpUrl? = HouseholdEndpoint.parse(preferences.serverBaseUrl)

    private fun execute(path: String): Response? {
        val url = baseUrl()?.resolve(path) ?: return null
        val builder = Request.Builder().url(url).header("Accept", "application/json")
        preferences.cookieHeader.takeIf { it.isNotBlank() }?.let { builder.header("Cookie", it) }
        return client.newCall(builder.build()).execute()
    }

    private fun post(path: String, body: JSONObject): Response? {
        val url = baseUrl()?.resolve(path) ?: return null
        val builder = Request.Builder().url(url).post(body.toString().toRequestBody(jsonMedia))
            .header("Accept", "application/json")
        preferences.cookieHeader.takeIf { it.isNotBlank() }?.let { builder.header("Cookie", it) }
        return client.newCall(builder.build()).execute()
    }

    private fun captureCookies(response: Response) {
        response.headers("Set-Cookie").forEach { raw ->
            val pair = raw.substringBefore(';')
            when {
                pair.startsWith("reelos_device_token=") -> preferences.deviceCookie = pair
                pair.startsWith("reelos_profile_session=") -> preferences.profileCookie = pair
            }
        }
    }

    private fun failure(response: Response, fallback: String): ClientResult.Failure {
        val body = runCatching { JSONObject(response.body?.string().orEmpty()) }.getOrNull()
        return ClientResult.Failure(
            message = body?.optString("error")?.takeIf(String::isNotBlank) ?: fallback,
            code = body?.optString("code")?.takeIf(String::isNotBlank),
        )
    }
}
