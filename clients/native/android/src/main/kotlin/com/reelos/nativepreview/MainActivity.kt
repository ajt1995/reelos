package com.reelos.nativepreview

import android.app.UiModeManager
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
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    private lateinit var core: ReelCore
    private var hostRevision by mutableStateOf(0)
    private var backRevision by mutableStateOf(0)
    private var handlesBack by mutableStateOf(false)
    private var hostMessage by mutableStateOf<String?>(null)
    private val mediaPicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) lifecycleScope.launch {
            hostMessage = "Checking your video…"
            val result = withContext(Dispatchers.IO) { runCatching { importVideo(uri) } }
            hostMessage = if (result.isSuccess) null else "Couldn’t open this video. Your existing library is unchanged. Try another file."
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
        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                BackHandler(enabled = handlesBack) { backRevision++ }
                Column {
                    Text("Native validation · isolated from your installed ReelOS", Modifier.padding(12.dp), style = MaterialTheme.typography.labelSmall)
                    hostMessage?.let { Text(it, Modifier.padding(12.dp)) }
                    NativeExperience(core, onImport = {
                        runCatching { mediaPicker.launch(arrayOf("video/*")) }.onFailure {
                            hostMessage = "This device has no file picker. File import needs a supported local source adapter."
                        }
                    }, onPlay = { id ->
                        if (core.mediaAction(id) == MediaAction.PLAY) {
                            startActivity(Intent(this@MainActivity, PlaybackActivity::class.java).putExtra("mediaId", id))
                        } else hostMessage = "This title is not available from your current sources."
                    }, hostRevision = hostRevision, motionAllowed = Settings.Global.getFloat(contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f,
                        backRevision = backRevision, onBackAvailabilityChanged = { handlesBack = it })
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // A player activity can persist progress while this screen is stopped.
        // Reload its revision before issuing another write; never overwrite it with a stale snapshot.
        if (::core.isInitialized) {
            runCatching { ReelCore(FileCoreStore(filesDir.resolve("core.bin").toPath()), core.deviceKind) }
                .onSuccess { core = it; hostRevision++ }
                .onFailure { hostMessage = "Saved state changed but could not be reloaded. Nothing was reset." }
        }
    }

    private fun importVideo(uri: Uri) {
        require(uri.scheme == "content")
        contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        val metadata = MediaMetadataRetriever()
        try {
            metadata.setDataSource(this, uri)
            require(metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_VIDEO) == "yes")
            require((metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L) > 0L)
        } finally { metadata.release() }
        val title = contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        } ?: "Personal video"
        val id = MessageDigest.getInstance("SHA-256").digest(uri.toString().toByteArray()).joinToString("") { "%02x".format(it) }
        // Private mapping is never included in shared core/diagnostics. No arbitrary network URLs.
        check(getSharedPreferences("local-media", MODE_PRIVATE).edit().putString(id, uri.toString()).commit())
        core.putSource(SourceRecord(PERSONAL_SOURCE_ID, SourceKind.PERSONAL, SourceStatus.AVAILABLE))
        core.putMedia(MediaRecord(id, title.take(512), PERSONAL_SOURCE_ID, MediaAvailability.READY))
    }
}
