package com.reelos.nativepreview

import android.app.UiModeManager
import android.app.AlertDialog
import android.content.Intent
import android.content.res.Configuration
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import com.reelos.core.*
import com.reelos.presentation.NativeExperience
import java.security.MessageDigest
import java.util.ConcurrentModificationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    private val connection by lazy {
        com.reelos.providers.ProviderConnectionController("External media connection",
            com.reelos.providers.TorBoxProviderClient(),
            com.reelos.providers.ProtectedConnectionStore(noBackupFilesDir.resolve("connection.bin").toPath(), AndroidCredentialProtector(this)))
    }
    private lateinit var core: ReelCore
    private var hostRevision by mutableStateOf(0)
    private var backRevision by mutableStateOf(0)
    private var handlesBack by mutableStateOf(false)
    private var hostMessage by mutableStateOf<String?>(null)
    private var importRunning = false
    private var remotePreparing = false
    private fun providerMedia() = com.reelos.presentation.ProviderMediaAccess(
        { ReelCore(FileCoreStore(filesDir.resolve("core.bin").toPath()), core.deviceKind) }, connection)

    private fun reconcileConnection() {
        lifecycleScope.launch {
            runCatching { withContext(Dispatchers.IO) { providerMedia().reconcile() } }
                .onFailure { hostMessage = "Connection changes could not be applied to the library. Retry before playing." }
            runCatching { ReelCore(FileCoreStore(filesDir.resolve("core.bin").toPath()), core.deviceKind) }
                .onSuccess { core = it; hostRevision++ }
        }
    }

    private fun playRemote(video: com.reelos.providers.ProviderVideo? = null, mediaId: String? = null) {
        if (remotePreparing) return
        remotePreparing = true; hostMessage = "Checking the source and preparing playback…"
        lifecycleScope.launch {
            var prepared: com.reelos.presentation.PreparedProviderPlayback? = null
            var pendingId: String? = null
            try {
                withContext(Dispatchers.IO) { prepared = if (video != null) providerMedia().prepare(video) else providerMedia().openMedia(requireNotNull(mediaId)) }
                check(lifecycle.currentState.isAtLeast(androidx.lifecycle.Lifecycle.State.RESUMED))
                core = ReelCore(FileCoreStore(filesDir.resolve("core.bin").toPath()), core.deviceKind)
                hostRevision++
                pendingId = PendingProviderPlayback.put(requireNotNull(prepared))
                prepared = null
                startActivity(Intent(this@MainActivity, PlaybackActivity::class.java).putExtra("providerPlayback", pendingId))
                pendingId = null; hostMessage = null
            } catch (_: Exception) {
                hostMessage = "This stream could not start. Check the connection, file readiness and network, then retry."
            } finally {
                prepared?.close(); pendingId?.let(PendingProviderPlayback::discard)
                remotePreparing = false
            }
        }
    }
    private val mediaPicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) acceptImport(uri)
    }

    private fun acceptImport(uri: Uri) {
        if (importRunning) return
        val importingProfileId = core.snapshot.activeProfileId
        val kind = core.deviceKind
        importRunning = true
        lifecycleScope.launch {
            hostMessage = "Checking your video…"
            val result = withContext(Dispatchers.IO) { runCatching { importVideo(uri, requireNotNull(importingProfileId), kind) } }
            hostMessage = if (result.isSuccess) {
                runCatching { ReelCore(FileCoreStore(filesDir.resolve("core.bin").toPath()), core.deviceKind) }
                    .fold(onSuccess = { core = it; null }, onFailure = {
                        "Video was imported, but your library could not be refreshed. Close and reopen ReelOS."
                    })
            } else "Couldn’t import this video. Check its format, file access and free storage, then try again."
            importRunning = false
            hostRevision++
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val tv = (getSystemService(UI_MODE_SERVICE) as UiModeManager).currentModeType == Configuration.UI_MODE_TYPE_TELEVISION
        val kind = if (tv) DeviceKind.ANDROID_TV else DeviceKind.ANDROID_PHONE
        val loaded = runCatching { ReelCore(FileCoreStore(filesDir.resolve("core.bin").toPath()), kind) }
        if (loaded.isFailure) {
            setContent { MaterialTheme(colorScheme = darkColorScheme()) {
                Text("Your saved state could not be opened. Nothing was reset. Close ReelOS and use recovery before continuing.", Modifier.padding(32.dp))
            } }
            return
        }
        core = loaded.getOrThrow()
        offerIncomingVideo(intent)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                BackHandler(enabled = handlesBack) { backRevision++ }
                Surface(modifier = Modifier.fillMaxSize()) {
                Column(Modifier.safeDrawingPadding().imePadding()) {
                    Text("Native validation · isolated from your installed ReelOS", Modifier.padding(12.dp), style = MaterialTheme.typography.labelSmall)
                    hostMessage?.let { Text(it, Modifier.padding(12.dp)) }
                    NativeExperience(core, onImport = {
                        runCatching { mediaPicker.launch(arrayOf("video/*")) }.onFailure {
                            hostMessage = "This device has no file picker. File import needs a supported local source adapter."
                        }
                    }, onPlay = { id ->
                        if (id.startsWith("remote-")) playRemote(mediaId = id)
                        else if (core.mediaAction(id) == MediaAction.PLAY) {
                            startActivity(Intent(this@MainActivity, PlaybackActivity::class.java).putExtra("mediaId", id))
                        } else hostMessage = "This title is not available from your current sources."
                    }, hostRevision = hostRevision, motionAllowed = Settings.Global.getFloat(contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f,
                        backRevision = backRevision, onBackAvailabilityChanged = { handlesBack = it }, connection = connection,
                        onProviderPlay = { playRemote(video = it) }, onConnectionChanged = ::reconcileConnection)
                }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (::core.isInitialized) offerIncomingVideo(intent)
    }

    private fun offerIncomingVideo(incoming: Intent) {
        val uri = incoming.data ?: return
        if (incoming.action != Intent.ACTION_VIEW || uri.scheme != "content") return
        val profile = core.snapshot.activeProfile
        if (profile == null || !core.canEnterHome(profile.id)) {
            hostMessage = "Finish setup, then open this video with ReelOS again."
            return
        }
        // External intents cannot silently import, play, or bypass future profile authorization.
        AlertDialog.Builder(this).setTitle("Add this video?")
            .setMessage("ReelOS will check the selected video. If its file access is temporary, a private copy uses this device’s storage (up to 1 GB, leaving 256 MB free).")
            .setPositiveButton("Add video") { _, _ -> acceptImport(uri) }
            .setNegativeButton("Cancel", null).show()
    }

    override fun onResume() {
        super.onResume()
        // A player activity can persist progress while this screen is stopped.
        // Reload its revision before issuing another write; never overwrite it with a stale snapshot.
        if (::core.isInitialized) {
            reconcileConnection()
            runCatching { ReelCore(FileCoreStore(filesDir.resolve("core.bin").toPath()), core.deviceKind) }
                .onSuccess { core = it; hostRevision++ }
                .onFailure { hostMessage = "Saved state changed but could not be reloaded. Nothing was reset." }
        }
    }

    private fun importVideo(uri: Uri) = importVideo(uri, requireNotNull(core.snapshot.activeProfileId), core.deviceKind)

    private fun importVideo(uri: Uri, importingProfileId: String, kind: DeviceKind) {
        require(uri.scheme == "content")
        // Validate the exact bytes retained for playback; a content provider may change
        // its stream between opens or grant only temporary access.
        val retainedUri = LocalVideo.retain(this, uri)
        var discardOnFailure = true
        try {
            LocalVideo.verifyFirstFrame(this, retainedUri)
            val metadata = MediaMetadataRetriever()
            try {
                if (retainedUri.scheme == "file") metadata.setDataSource(requireNotNull(retainedUri.path))
                else metadata.setDataSource(this, retainedUri)
                require(metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_VIDEO) == "yes")
                require((metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L) > 0L)
            } finally { metadata.release() }
            val title = contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) else null
            } ?: "Personal video"
            val id = MessageDigest.getInstance("SHA-256").digest(uri.toString().toByteArray()).joinToString("") { "%02x".format(it) }
            // Private mapping is never included in shared core/diagnostics. No arbitrary network URLs.
            val mappings = getSharedPreferences("local-media", MODE_PRIVATE)
            val prior = mappings.getString(id, null)
            try {
                check(mappings.edit().putString(id, retainedUri.toString()).commit())
                commitImportedMedia(kind, importingProfileId, MediaRecord(id, title.take(512), PERSONAL_SOURCE_ID, MediaAvailability.READY))
            } catch (failure: Exception) {
                discardOnFailure = if (prior == null) mappings.edit().remove(id).commit()
                    else mappings.edit().putString(id, prior).commit()
                throw failure
            }
            if (prior != null && prior != retainedUri.toString()) {
                runCatching { LocalVideo.discardPrivateCopy(this, Uri.parse(prior)) }
            }
        } catch (failure: Exception) {
            if (discardOnFailure) runCatching { LocalVideo.discardPrivateCopy(this, retainedUri) }
            throw failure
        }
    }

    private fun commitImportedMedia(kind: DeviceKind, importingProfileId: String, item: MediaRecord) {
        val store = FileCoreStore(filesDir.resolve("core.bin").toPath())
        val source = SourceRecord(PERSONAL_SOURCE_ID, SourceKind.PERSONAL, SourceStatus.AVAILABLE)
        var stale: ConcurrentModificationException? = null
        repeat(3) {
            val current = ReelCore(store, kind)
            check(current.snapshot.activeProfileId == importingProfileId && current.canEnterHome(importingProfileId)) {
                "The active profile changed during import"
            }
            try {
                if (current.snapshot.sources[PERSONAL_SOURCE_ID] != source) current.putSource(source)
                current.putMedia(item)
                return
            } catch (failure: ConcurrentModificationException) {
                stale = failure
            }
        }
        throw requireNotNull(stale)
    }
}
