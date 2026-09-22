package com.reelos.core.ota

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.FileProvider
import com.reelos.core.prefs.AppPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

data class UpdateInfo(
    val hasUpdate: Boolean,
    val latestVersion: String,
    val currentVersion: String,
    val downloadUrl: String = "",
    val sha256: String = "",
    val releaseNotes: String = "",
    val unavailableReason: String? = null,
    val householdOrigin: String = "",
)

internal fun isNewerVersion(remote: String, current: String): Boolean {
    if (remote == current) return false
    val remoteParts = remote.split('.').mapNotNull(String::toIntOrNull)
    val currentParts = current.split('.').mapNotNull(String::toIntOrNull)
    val length = maxOf(remoteParts.size, currentParts.size)
    for (index in 0 until length) {
        val remotePart = remoteParts.getOrElse(index) { 0 }
        val currentPart = currentParts.getOrElse(index) { 0 }
        if (remotePart != currentPart) return remotePart > currentPart
    }
    return false
}

internal fun authenticatedRequest(url: HttpUrl, deviceCookie: String?): Request? {
    val credential = deviceCookie?.trim()
    if (credential.isNullOrEmpty() || !credential.matches(Regex("^reelos_device_token=[A-Za-z0-9._~%+-]+$"))) return null
    return Request.Builder().url(url).header("Cookie", credential).build()
}

/**
 * Android updates are offered only by the paired household server. The server
 * supplies a pinned digest; this client never installs an unverified APK or
 * follows an arbitrary cross-origin update URL.
 */
class OtaUpdateManager(
    private val context: Context,
    private val preferences: AppPreferences = AppPreferences(context),
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .followRedirects(false)
        .build()

    suspend fun checkForUpdate(
        currentVersionName: String,
        serverBaseUrl: String?,
    ): UpdateInfo = withContext(Dispatchers.IO) {
        val base = serverBaseUrl?.trimEnd('/')?.toHttpUrlOrNull()
            ?: return@withContext unavailable(currentVersionName, "No paired ReelOS server is available.")
        val paired = preferences.serverBaseUrl.toHttpUrlOrNull()
            ?: return@withContext unavailable(currentVersionName, "No paired ReelOS server is available.")
        if (base.scheme != paired.scheme || base.host != paired.host || base.port != paired.port) {
            return@withContext unavailable(currentVersionName, "Updates are available only from the paired ReelOS home.")
        }
        val credential = preferences.deviceCookie
            ?: return@withContext unavailable(currentVersionName, "Pair this device again before checking for updates.")
        try {
            val endpoint = base.newBuilder().addPathSegments("api/app/version").build()
            val request = authenticatedRequest(endpoint, credential)
                ?: return@withContext unavailable(currentVersionName, "Pair this device again before checking for updates.")
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext unavailable(currentVersionName, "The paired server could not verify an update.")
                }
                val json = JSONObject(response.body?.string().orEmpty())
                val remoteVersion = json.optString("version").trim()
                if (remoteVersion.isEmpty() || !isNewerVersion(remoteVersion, currentVersionName)) {
                    return@withContext UpdateInfo(false, currentVersionName, currentVersionName)
                }
                val digest = json.optString("sha256").lowercase()
                require(digest.matches(Regex("^[a-f0-9]{64}$"))) { "Update manifest has no valid SHA-256 digest." }
                val relativeOrAbsolute = json.optString("apkUrl", "/clients/reelos-android-universal.apk")
                val download = base.resolve(relativeOrAbsolute)
                    ?: throw IllegalArgumentException("Update manifest contains an invalid APK URL.")
                require(download.scheme == base.scheme && download.host == base.host && download.port == base.port) {
                    "Update APK must come from the paired ReelOS server."
                }
                UpdateInfo(
                    hasUpdate = true,
                    latestVersion = remoteVersion,
                    currentVersion = currentVersionName,
                    downloadUrl = download.toString(),
                    sha256 = digest,
                    releaseNotes = json.optString("notes", "Verified ReelOS household update."),
                    householdOrigin = "${base.scheme}://${base.host}:${base.port}",
                )
            }
        } catch (_: Exception) {
            unavailable(currentVersionName, "A signed household update is not currently available.")
        }
    }

    suspend fun downloadAndInstall(
        update: UpdateInfo,
        onProgress: (Float) -> Unit = {},
    ): Result<Unit> = withContext(Dispatchers.IO) {
        if (!update.hasUpdate || !update.sha256.matches(Regex("^[a-f0-9]{64}$"))) {
            return@withContext Result.failure(IllegalArgumentException("A verified update manifest is required."))
        }
        try {
            val download = update.downloadUrl.toHttpUrlOrNull()
                ?: return@withContext Result.failure(SecurityException("Update URL is invalid."))
            val origin = "${download.scheme}://${download.host}:${download.port}"
            if (origin != update.householdOrigin) {
                return@withContext Result.failure(SecurityException("Update APK is not from the paired household origin."))
            }
            val paired = preferences.serverBaseUrl.toHttpUrlOrNull()
                ?: return@withContext Result.failure(SecurityException("No paired ReelOS server is available."))
            val pairedOrigin = "${paired.scheme}://${paired.host}:${paired.port}"
            if (origin != pairedOrigin) {
                return@withContext Result.failure(SecurityException("Update APK is not from the current paired household."))
            }
            val request = authenticatedRequest(download, preferences.deviceCookie)
                ?: return@withContext Result.failure(SecurityException("Pair this device again before installing updates."))
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("Failed to download APK: HTTP ${response.code}"))
                }
                val body = response.body ?: return@withContext Result.failure(Exception("Empty update response."))
                val apkFile = File(context.cacheDir, "reelos-update.apk")
                if (apkFile.exists()) apkFile.delete()
                val digest = MessageDigest.getInstance("SHA-256")
                val totalBytes = body.contentLength()
                body.byteStream().use { input ->
                    FileOutputStream(apkFile).use { output ->
                        val buffer = ByteArray(32 * 1024)
                        var totalRead = 0L
                        while (true) {
                            val read = input.read(buffer)
                            if (read < 0) break
                            output.write(buffer, 0, read)
                            digest.update(buffer, 0, read)
                            totalRead += read
                            if (totalBytes > 0) withContext(Dispatchers.Main) {
                                onProgress(totalRead.toFloat() / totalBytes.toFloat())
                            }
                        }
                    }
                }
                val actual = digest.digest().joinToString("") { byte -> "%02x".format(byte) }
                if (actual != update.sha256) {
                    apkFile.delete()
                    return@withContext Result.failure(SecurityException("Update digest did not match the manifest."))
                }
                if (!hasInstalledSigner(apkFile)) {
                    apkFile.delete()
                    return@withContext Result.failure(SecurityException("Update APK is not signed by the installed ReelOS identity."))
                }
                withContext(Dispatchers.Main) { launchInstaller(apkFile) }
                Result.success(Unit)
            }
        } catch (error: Exception) {
            Result.failure(error)
        }
    }

    private fun launchInstaller(apkFile: File) {
        val apkUri: Uri = FileProvider.getUriForFile(context, "${context.packageName}.provider", apkFile)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(apkUri, "application/vnd.android.package-archive")
            flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
    }

    @Suppress("DEPRECATION")
    private fun hasInstalledSigner(apkFile: File): Boolean {
        val manager = context.packageManager
        val candidate = manager.getPackageArchiveInfo(apkFile.absolutePath, PackageManager.GET_SIGNING_CERTIFICATES)
            ?: return false
        candidate.applicationInfo?.sourceDir = apkFile.absolutePath
        candidate.applicationInfo?.publicSourceDir = apkFile.absolutePath
        if (candidate.packageName != context.packageName) return false
        val installed = manager.getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
        val candidateSigners = candidate.signingInfo?.apkContentsSigners?.map { signer ->
            MessageDigest.getInstance("SHA-256").digest(signer.toByteArray()).joinToString("") { "%02x".format(it) }
        }?.toSet()
            ?: return false
        val installedSigners = installed.signingInfo?.apkContentsSigners?.map { signer ->
            MessageDigest.getInstance("SHA-256").digest(signer.toByteArray()).joinToString("") { "%02x".format(it) }
        }?.toSet()
            ?: return false
        return candidateSigners.isNotEmpty() && candidateSigners == installedSigners
    }

    private fun unavailable(current: String, reason: String) =
        UpdateInfo(false, current, current, unavailableReason = reason)

}
