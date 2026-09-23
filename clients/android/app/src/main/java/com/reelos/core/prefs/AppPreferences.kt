package com.reelos.core.prefs

import android.content.Context
import android.content.SharedPreferences

class AppPreferences(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("reelos_client_prefs", Context.MODE_PRIVATE)

    init {
        if (prefs.getInt("paired_home_schema", 0) < 1) {
            // The pre-Day-0 prototype stored incompatible connection material.
            // Do not retain or inspect it; start the paired-home trust flow cleanly.
            prefs.edit().clear().putInt("paired_home_schema", 1).commit()
        }
    }

    var serverBaseUrl: String
        get() = prefs.getString("server_base_url", "") ?: ""
        set(value) = prefs.edit().putString("server_base_url", value.trimEnd('/')).apply()

    var connectionMode: String
        get() = prefs.getString("connection_mode", "choice") ?: "choice"
        set(value) = prefs.edit().putString("connection_mode", value).apply()

    val isStandalone: Boolean
        get() = connectionMode == "standalone"

    val useStandaloneNode: Boolean
        get() = isStandalone

    fun useStandalone() {
        connectionMode = "standalone"
    }

    fun useHome() {
        connectionMode = "home"
    }

    var deviceCookie: String?
        get() = prefs.getString("device_cookie", null)
        set(value) = prefs.edit().putString("device_cookie", value).apply()

    var profileCookie: String?
        get() = prefs.getString("profile_cookie", null)
        set(value) = prefs.edit().putString("profile_cookie", value).apply()

    var activeResidentId: String?
        get() = prefs.getString("active_resident_id", null)
        set(value) = prefs.edit().putString("active_resident_id", value).apply()

    var activeResidentName: String
        get() = prefs.getString("active_resident_name", "Household") ?: "Household"
        set(value) = prefs.edit().putString("active_resident_name", value).apply()

    var isVolumeLevelingEnabled: Boolean
        get() = prefs.getBoolean("volume_leveling_enabled", false)
        set(value) = prefs.edit().putBoolean("volume_leveling_enabled", value).apply()

    var isDialogueFocusEnabled: Boolean
        get() = prefs.getBoolean("dialogue_focus_enabled", false)
        set(value) = prefs.edit().putBoolean("dialogue_focus_enabled", value).apply()

    var areSubtitlesEnabled: Boolean
        get() = prefs.getBoolean("subtitles_enabled", true)
        set(value) = prefs.edit().putBoolean("subtitles_enabled", value).apply()

    var offlineStorageLimitGb: Int
        get() = prefs.getInt("offline_storage_limit_gb", 25)
        set(value) = prefs.edit().putInt("offline_storage_limit_gb", value.coerceIn(1, 1000)).apply()

    var overnightChargingOnly: Boolean
        get() = prefs.getBoolean("overnight_charging_only", true)
        set(value) = prefs.edit().putBoolean("overnight_charging_only", value).apply()

    var overnightPreStage: Boolean
        get() = prefs.getBoolean("overnight_pre_stage", true)
        set(value) = prefs.edit().putBoolean("overnight_pre_stage", value).apply()

    var prowlarrUrl: String
        get() = prefs.getString("prowlarr_url", "") ?: ""
        set(value) = prefs.edit().putString("prowlarr_url", value).apply()

    var prowlarrApiKey: String
        get() = prefs.getString("prowlarr_api_key", "") ?: ""
        set(value) = prefs.edit().putString("prowlarr_api_key", value).apply()

    var customTorznabUrl: String
        get() = prefs.getString("custom_torznab_url", "") ?: ""
        set(value) = prefs.edit().putString("custom_torznab_url", value).apply()

    val cookieHeader: String
        get() = listOfNotNull(deviceCookie, profileCookie).joinToString("; ")

    var hasCompletedOnboarding: Boolean
        get() = prefs.getBoolean("has_completed_onboarding", false)
        set(value) = prefs.edit().putBoolean("has_completed_onboarding", value).apply()

    var onboardingAtmosphereColor: String
        get() = prefs.getString("onboarding_atmosphere_color", "gold") ?: "gold"
        set(value) = prefs.edit().putString("onboarding_atmosphere_color", value).apply()

    var residentTasteVectorJson: String
        get() = prefs.getString("resident_taste_vector_json", "") ?: ""
        set(value) = prefs.edit().putString("resident_taste_vector_json", value).apply()

    fun getResidentTasteVector(): FloatArray {
        val json = residentTasteVectorJson
        if (json.isBlank()) return FloatArray(512)
        return try {
            val arr = org.json.JSONArray(json)
            FloatArray(512) { i -> if (i < arr.length()) arr.getDouble(i).toFloat() else 0f }
        } catch (_: Exception) {
            FloatArray(512)
        }
    }

    fun setResidentTasteVector(vector: FloatArray) {
        val arr = org.json.JSONArray()
        for (v in vector) arr.put(v.toDouble())
        residentTasteVectorJson = arr.toString()
    }

    val isConfigured: Boolean
        get() = (serverBaseUrl.isNotBlank() && !deviceCookie.isNullOrBlank() && !profileCookie.isNullOrBlank()) || (isStandalone && hasCompletedOnboarding)

    fun clearSession() {
        prefs.edit()
            .remove("server_base_url")
            .remove("device_cookie")
            .remove("profile_cookie")
            .remove("active_resident_id")
            .remove("has_completed_onboarding")
            .apply()
    }
}
