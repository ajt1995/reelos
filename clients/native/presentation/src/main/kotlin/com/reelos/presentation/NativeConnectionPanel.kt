package com.reelos.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import com.reelos.providers.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.atomic.AtomicBoolean

/** A transient password field, never saveable state or part of the profile/learning snapshot. */
@Composable
internal fun NativeConnectionPanel(connection: ProviderConnectionController?, onPlay: ((ProviderVideo) -> Unit)? = null,
    onConnectionChanged: () -> Unit = {}) {
    if (connection == null) {
        Text("Protected connections are unavailable on this device. Your personal media still works.")
        return
    }
    var draft by remember(connection) { mutableStateOf("") }
    var saved by remember(connection) { mutableStateOf(false) }
    var statusKnown by remember(connection) { mutableStateOf(false) }
    var busy by remember(connection) { mutableStateOf(false) }
    var message by remember(connection) { mutableStateOf<String?>(null) }
    var titles by remember(connection) { mutableStateOf<List<ProviderVideo>>(emptyList()) }
    var collectionOffset by remember(connection) { mutableStateOf(0) }
    var nextOffset by remember(connection) { mutableStateOf<Int?>(null) }
    var fileOffset by remember(connection) { mutableStateOf(0) }
    var expanded by remember(connection) { mutableStateOf(false) }
    val present = remember(connection) { AtomicBoolean(true) }
    val scope = rememberCoroutineScope()
    DisposableEffect(connection) { present.set(true); onDispose { present.set(false); connection.cancelPending() } }
    suspend fun reloadStatus(): Boolean? = try {
        withContext(Dispatchers.IO) { connection.hasSavedConnection() }.also { saved = it; statusKnown = true }
    } catch (_: Exception) { statusKnown = false; null }
    LaunchedEffect(connection) {
        if (reloadStatus() == null) message = "Your protected connection could not be opened. You can remove it and connect again."
    }
    fun runAction(action: () -> Unit, success: String, expectsSaved: Boolean, cleanup: () -> Unit = {}) {
        if (busy) return
        busy = true
        message = null
        scope.launch {
            try {
                withContext(Dispatchers.IO) { action() }
                message = if (reloadStatus() == expectsSaved) success else "The saved connection could not be confirmed. Check its current state before continuing."
            } catch (_: ConnectionChanged) {
                titles = emptyList()
                message = "The connection changed. Connect again to continue."
            } catch (failure: ProviderFailure) {
                titles = emptyList()
                message = connectionMessage(failure)
            } catch (_: Exception) {
                titles = emptyList()
                message = "The connection could not be completed. Check your network and protected storage, then retry."
            } finally { reloadStatus(); onConnectionChanged(); busy = false }
        }.invokeOnCompletion { cleanup() }
    }
    fun loadPage(offset: Int) {
        if (busy) return
        busy = true; message = null
        scope.launch {
            try {
                val page = withContext(Dispatchers.IO) { connection.page(offset) }
                titles = page.videos; collectionOffset = offset; nextOffset = page.nextOffset; fileOffset = 0
                message = if (titles.isEmpty() && nextOffset != null) "No video files in this part of the collection. Continue to the next page."
                    else if (titles.isEmpty()) "No video files were returned in this part of the collection."
                    else "Choose a file to check and play."
            } catch (failure: ProviderFailure) { message = connectionMessage(failure) }
              catch (_: Exception) { message = "Couldn’t refresh this collection. Check the connection and retry." }
            finally { busy = false }
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Button(modifier = Modifier.heightIn(min = 48.dp), onClick = { expanded = !expanded; draft = "" }) {
            Text(if (expanded) "Close connection settings" else if (saved) "Manage media connection" else "Connect media service")
        }
        if (!expanded) return@Column
        Text(connection.displayName)
        Text(if (!statusKnown) "Saved connection status could not be confirmed." else if (saved) "Connection saved on this device." else "Optional. Your personal collection works without a connection.")
        OutlinedTextField(value = draft, onValueChange = { if (it.length <= 4096) draft = it },
            label = { Text(if (saved) "Replacement key" else "Connection key") },
            singleLine = true, enabled = !busy, visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth())
        Button(enabled = !busy && draft.isNotBlank(), modifier = Modifier.heightIn(min = 48.dp), onClick = {
            val secret = draft.trim().toCharArray()
            draft = ""; titles = emptyList(); nextOffset = null; collectionOffset = 0; fileOffset = 0
            runAction({ connection.connect(secret) { present.get() } }, "Connection checked and saved securely.", true, { secret.fill('\u0000') })
        }) { Text(if (busy) "Checking…" else "Validate and save") }
        if (saved) Button(enabled = !busy, modifier = Modifier.heightIn(min = 48.dp), onClick = { loadPage(0) }) { Text("Check connected collection") }
        Button(enabled = !busy, modifier = Modifier.heightIn(min = 48.dp), onClick = {
            draft = ""; titles = emptyList(); nextOffset = null; collectionOffset = 0; fileOffset = 0
            runAction({ connection.disconnect() }, "Connection removed. Personal files were not changed.", false)
        }) { Text("Remove connection") }
        message?.let { Text(it) }
        titles.drop(fileOffset).take(40).forEach { video ->
            Text(video.name + if (video.ready) " · Available at source" else " · Still preparing")
            if (video.ready && onPlay != null) Button(enabled = !busy, modifier = Modifier.heightIn(min = 48.dp), onClick = { onPlay(video) }) { Text("Check and play") }
        }
        if (fileOffset > 0 || collectionOffset > 0) Button(enabled = !busy, modifier = Modifier.heightIn(min = 48.dp),
            onClick = { if (fileOffset > 0) fileOffset = (fileOffset - 40).coerceAtLeast(0) else loadPage((collectionOffset - 25).coerceAtLeast(0)) }) { Text("Previous files") }
        if (fileOffset + 40 < titles.size || nextOffset != null) Button(enabled = !busy, modifier = Modifier.heightIn(min = 48.dp),
            onClick = { if (fileOffset + 40 < titles.size) fileOffset += 40 else nextOffset?.let(::loadPage) }) { Text("Next files") }
    }
}

private fun connectionMessage(failure: ProviderFailure): String = when (failure.code) {
    ProviderFailureCode.INVALID_CREDENTIAL -> "The connection key wasn’t accepted. Check the key and try again."
    ProviderFailureCode.CONNECTIVITY -> "Couldn’t reach the service. Check your network and retry."
    ProviderFailureCode.TIMEOUT -> "The service took too long to reply. Your key may still be valid; please retry."
    ProviderFailureCode.RATE_LIMITED -> "The service asked us to slow down. Wait a little before retrying."
    ProviderFailureCode.UNAVAILABLE -> "The service is temporarily unavailable. Please try again later."
    ProviderFailureCode.NOT_READY -> "This file is still being prepared by the service."
    ProviderFailureCode.INVALID_RESPONSE -> "The service returned an unexpected response. Nothing was marked ready."
}
