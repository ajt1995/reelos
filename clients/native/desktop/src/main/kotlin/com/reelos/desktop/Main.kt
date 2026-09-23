package com.reelos.desktop

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import com.reelos.core.*
import com.reelos.presentation.NativeExperience
import java.awt.FileDialog
import java.nio.file.Path
import java.security.MessageDigest

fun main() = application {
    val kind = if (System.getProperty("os.name").startsWith("Windows")) DeviceKind.WINDOWS else DeviceKind.LINUX
    // Explicit isolated data path; no legacy or household state is imported or overwritten.
    val dataDirectory = System.getenv("REELOS_NATIVE_DATA")?.let(Path::of)
        ?: Path.of(System.getProperty("user.home"), ".reelos-native-validation")
    val loaded = remember { runCatching { ReelCore(FileCoreStore(dataDirectory.resolve("core.bin")), kind) } }
    var message by remember { mutableStateOf<String?>(null) }
    var revision by remember { mutableStateOf(0) }
    Window(onCloseRequest = ::exitApplication, title = "ReelOS — Native Validation") {
        MaterialTheme(colorScheme = darkColorScheme()) {
            if (loaded.isFailure) {
                Text("Your saved state could not be opened. Nothing was reset. Close ReelOS and use recovery before continuing.", Modifier.padding(32.dp))
            } else Column {
                Text("Native validation · not a household release", Modifier.padding(12.dp), style = MaterialTheme.typography.labelSmall)
                message?.let { Text(it, Modifier.padding(12.dp)) }
                val core = loaded.getOrThrow()
                NativeExperience(core, onImport = {
                    val chooser = FileDialog(window, "Choose personal media", FileDialog.LOAD)
                    try {
                        chooser.isVisible = true
                        chooser.file?.let {
                            // No native desktop probe/player yet: never label this file playable.
                            val file = Path.of(chooser.directory, it)
                            val id = MessageDigest.getInstance("SHA-256").digest(file.toUri().toString().toByteArray()).joinToString("") { byte -> "%02x".format(byte) }
                            core.putMedia(MediaRecord(id, it.take(512), null, MediaAvailability.UNAVAILABLE))
                            message = "File selected. Native desktop media verification and playback are not connected in this slice."
                            revision++
                        }
                    } catch (_: Exception) { message = "Couldn’t record this file. Your previous library is unchanged." }
                    finally { chooser.dispose() }
                }, onPlay = { message = "Native desktop playback is not connected in this validation build." }, hostRevision = revision,
                    // Desktop OS accessibility adapter is not certified yet: fail to still motion.
                    motionAllowed = false)
            }
        }
    }
}
