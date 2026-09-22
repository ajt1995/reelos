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
        get() = connectionMode == "standalone" && !isConfigured

    fun useStandalone() {
        connectionMode = "standalone"
        clearSession()
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

    var areSubtitlesEnabled: Boolean
        get() = prefs.getBoolean("subtitles_enabled", true)
        set(value) = prefs.edit().putBoolean("subtitles_enabled", value).apply()

    var offlineStorageLimitGb: Int
        get() = prefs.getInt("offline_storage_limit_gb", 25)
        set(value) = prefs.edit().putInt("offline_storage_limit_gb", value.coerceIn(1, 100)).apply()

    val cookieHeader: String
        get() = listOfNotNull(deviceCookie, profileCookie).joinToString("; ")

    val isConfigured: Boolean
        get() = serverBaseUrl.isNotBlank() && !deviceCookie.isNullOrBlank() && !profileCookie.isNullOrBlank()

    fun clearSession() {
        prefs.edit()
            .remove("server_base_url")
            .remove("device_cookie")
            .remove("profile_cookie")
            .remove("active_resident_id")
            .apply()
    }
}
