package com.reelos.desktop

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.awt.SwingPanel
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.DialogWindow
import androidx.compose.ui.window.rememberDialogState
import androidx.compose.ui.window.application
import com.reelos.core.DeviceKind
import com.reelos.core.CoreState
import com.reelos.core.FileCoreStore
import com.reelos.core.LocalPlaybackSession
import com.reelos.core.ReelCore
import com.reelos.presentation.NativeExperience
import com.reelos.presentation.PreparedProviderPlayback
import com.reelos.presentation.ProviderMediaAccess
import com.reelos.providers.ProtectedConnectionStore
import com.reelos.providers.ProviderConnectionController
import com.reelos.providers.ProviderVideo
import com.reelos.providers.TorBoxProviderClient
import java.awt.BorderLayout
import java.awt.Canvas
import java.awt.Color
import java.awt.FileDialog
import java.awt.event.HierarchyEvent
import java.awt.event.HierarchyListener
import java.awt.event.ComponentAdapter
import java.awt.event.ComponentEvent
import java.nio.file.Files
import java.nio.file.Path
import javax.swing.JPanel
import javax.swing.SwingUtilities
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private class ActivePlayback(
    val id: String, val profileId: String, val title: String, val player: VlcPlayback,
    val session: LocalPlaybackSession, val remote: PreparedProviderPlayback? = null,
    val appearance: DesktopCaptionAppearance = DesktopCaptionAppearance(),
    val ownedDecoder: NativeVlc? = null,
    val sleepTimer: com.reelos.core.PlaybackSleepTimer = com.reelos.core.PlaybackSleepTimer { System.nanoTime() / 1_000_000 },
    var fallback: ActivePlayback? = null,
) {
    fun isAllowed(state: CoreState): Boolean = session.isAllowed(state) && (remote?.isAuthorized() ?: true)
    fun releaseFallback() { val previous = fallback; fallback = null; previous?.close() }
    fun close() { try { player.close() } finally { try { remote?.close() } finally { try { ownedDecoder?.close() } finally { releaseFallback() } } } }
}
internal data class FileLaunch(val path: Path? = null, val error: String? = null)

/** Closing an idle window must not depend on a composition-owned coroutine. */
internal fun finishAfterImport(pendingImport: Job?, onMain: (() -> Unit) -> Unit, finish: () -> Unit) {
    if (pendingImport?.isActive == true) pendingImport.invokeOnCompletion { onMain(finish) }
    else finish()
}

/** A user Open With intent must identify exactly one existing local file. */
internal fun parseFileLaunch(args: Array<String>): FileLaunch {
    if (args.isEmpty()) return FileLaunch()
    if (args.size != 1) return FileLaunch(error = "Open one local file at a time.")
    val raw = args.single()
    if (raw.isBlank() || Regex("^[A-Za-z][A-Za-z0-9+.-]*:").containsMatchIn(raw) && !Regex("^[A-Za-z]:[\\\\/]").containsMatchIn(raw) ||
        raw.startsWith("\\\\") || raw.startsWith("//")) {
        return FileLaunch(error = "Open With accepts a local file path, not a remote address.")
    }
    return runCatching {
        val supplied = Path.of(raw)
        check(supplied.isAbsolute) { "Open With needs an absolute local file path." }
        val real = supplied.toRealPath()
        check(!real.toString().startsWith("\\\\") && !real.toString().startsWith("//")) { "Remote file paths are unavailable." }
        check(Files.isRegularFile(real) && Files.isReadable(real)) { "That local file is missing or unreadable." }
        FileLaunch(path = real)
    }.getOrElse { FileLaunch(error = it.message?.take(180) ?: "The local file could not be opened.") }
}

fun main(args: Array<String>) = application {
    val kind = if (System.getProperty("os.name").startsWith("Windows")) DeviceKind.WINDOWS else DeviceKind.LINUX
    // Isolated data path; no existing household state is imported or overwritten.
    val dataDirectory = System.getenv("REELOS_NATIVE_DATA")?.let(Path::of)
        ?: Path.of(System.getProperty("user.home"), ".reelos-native-validation")
    val corePath = remember(dataDirectory) { dataDirectory.resolve("core.bin") }
    fun freshCore() = ReelCore(FileCoreStore(corePath), kind)
    var loaded by remember { mutableStateOf(runCatching(::freshCore)) }
    val launch = remember { parseFileLaunch(args) }
    val eligibleLaunch = remember(launch, loaded) {
        launch.path?.takeIf {
            val core = loaded.getOrNull()
            core?.snapshot?.activeProfileId?.let(core::canEnterHome) == true
        }
    }
    val nativeVlc = remember { NativeVlc.open() }
    val vlc = nativeVlc.getOrNull()
    val library = remember(loaded, vlc) { loaded.getOrNull()?.let { DesktopMediaLibrary(dataDirectory, it, vlc) } }
    var message by remember {
        mutableStateOf(launch.error ?: if (launch.path != null && eligibleLaunch == null && loaded.isSuccess)
            "Finish setup, then open this file again." else null)
    }
    var pendingLaunch by remember { mutableStateOf(eligibleLaunch) }
    var revision by remember { mutableIntStateOf(0) }
    var active by remember { mutableStateOf<ActivePlayback?>(null) }
    var importJob by remember { mutableStateOf<Job?>(null) }
    var providerJob by remember { mutableStateOf<Job?>(null) }
    var connectionEpoch by remember { mutableIntStateOf(0) }
    var closing by remember { mutableStateOf(false) }
    var deviceMotionAllowed by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val connection = remember(dataDirectory, kind) {
        if (kind == DeviceKind.WINDOWS) ProviderConnectionController("External media connection",
            TorBoxProviderClient(), ProtectedConnectionStore(dataDirectory.resolve("connection.bin"), WindowsCredentialProtector()))
        else null // No plaintext fallback on a host without an OS-protected adapter.
    }
    val providerAccess = remember(connection) { connection?.let { ProviderMediaAccess(::freshCore, it) } }
    fun reloadCore() { loaded = runCatching(::freshCore); revision++ }
    LaunchedEffect(Unit) { deviceMotionAllowed = withContext(Dispatchers.IO) { DesktopMotionPolicy.readAllowed() } }

    fun queueImport(selected: Path) {
        if (closing) return
        if (providerJob?.isActive == true) { message = "Finish checking connected media before importing a file."; return }
        if (importJob?.isActive == true) {
            message = "A local file is already being checked."
            return
        }
        message = "Checking local media…"
        importJob = scope.launch {
            try {
                val record = withContext(Dispatchers.IO) { requireNotNull(library).importFile(selected) }
                message = if (vlc == null) "${record.title} was added to your collection. Playback is unavailable because the local decoder is missing."
                    else "${record.title} was added to your collection."
                revision++
            } catch (failure: Exception) {
                message = "Couldn’t import this file: ${failure.message?.take(180) ?: "the previous library is unchanged"}"
            } finally { importJob = null }
        }
    }

    fun closeActive() {
        val playback = active ?: return
        try {
            val state = playback.player.poll()
            val current = freshCore()
            if (!state.restoring && (state.ended || state.positionMs > 0) && playback.isAllowed(current.snapshot)) {
                current.setPlaybackPosition(playback.profileId, playback.id, if (state.ended) 0 else state.positionMs)
            }
        } catch (failure: Exception) {
            message = if (playback.remote != null) "Connected-media resume could not be saved."
                else "Resume could not be saved: ${failure.message?.take(180) ?: "storage failed"}"
        } finally {
            runCatching { playback.close() }.onFailure { failure ->
                message = if (playback.remote != null) "Connected playback could not close cleanly."
                    else "Playback could not close cleanly: ${failure.message?.take(180) ?: "native player failed"}"
            }
            active = null
            reloadCore()
        }
    }

    fun stopRemoteForConnectionChange() {
        val playback = active?.takeIf { it.remote != null } ?: return
        runCatching { playback.close() }
        active = null
        message = "Connected playback stopped because the connection changed."
        revision++
    }

    fun connectionChanged() {
        connectionEpoch++
        stopRemoteForConnectionChange()
        scope.launch {
            try { withContext(Dispatchers.IO) { providerAccess?.reconcile() } }
            catch (_: Exception) { message = "Connected media could not be refreshed. Access remains unavailable until it can be checked." }
            finally { reloadCore() }
        }
    }

    fun playProvider(id: String? = null, video: ProviderVideo? = null) {
        if (closing || providerJob?.isActive == true || importJob?.isActive == true) {
            message = "Finish the current media check before starting another."
            return
        }
        if (vlc == null) { message = "Connected playback requires the local LibVLC decoder."; return }
        closeActive() // Save/close the old session before reading the new profile's resume position.
        val ticket = connectionEpoch
        message = "Checking connected media…"
        providerJob = scope.launch {
            var prepared: PreparedProviderPlayback? = null
            try {
                val access = requireNotNull(providerAccess) { "Protected connections are unavailable" }
                val result = withContext(Dispatchers.IO) {
                    if (video != null) access.prepare(video) else access.openMedia(requireNotNull(id))
                }
                prepared = result
                check(!closing && ticket == connectionEpoch && result.isAuthorized()) { "Connection changed" }
                val current = freshCore()
                check(result.guard.isAllowed(current.snapshot)) { "Playback access changed" }
                val resumeMs = current.snapshot.profiles[result.profileId]?.playbackPositionsMs?.get(result.mediaId) ?: 0L
                val player = requireNotNull(vlc) { "In-process LibVLC is unavailable on this computer" }
                    .player(result.bytes, resumeMs, current.snapshot.profiles.getValue(result.profileId).playbackPreferences)
                try {
                    check(!closing && ticket == connectionEpoch && result.isAuthorized()) { "Connection changed" }
                    loaded = Result.success(current)
                    active = ActivePlayback(result.mediaId, result.profileId, result.title, player, result.guard, result)
                    prepared = null // ActivePlayback now owns cancellation and cleanup.
                    message = null
                    revision++
                } catch (failure: Exception) { player.close(); throw failure }
            } catch (_: Exception) {
                message = "Connected media could not be opened. Check the connection and file, then try again."
                reloadCore()
            } finally {
                prepared?.close()
                providerJob = null
            }
        }
    }

    fun changeCaptionAppearance(appearance: DesktopCaptionAppearance) {
        val original = active ?: return
        if (closing || providerJob?.isActive == true || importJob?.isActive == true || original.appearance == appearance) return
        if (!runCatching { original.isAllowed(freshCore().snapshot) }.getOrDefault(false)) {
            runCatching { original.close() }; active = null
            message = "Playback access changed. Return to your library to try again."
            return
        }
        if (runCatching { original.player.poll().restoring }.getOrDefault(true)) return
        val saved = runCatching {
            val current = freshCore()
            check(original.isAllowed(current.snapshot)) { "Playback access changed" }
            original.player.pauseForReplacement().also {
                current.setPlaybackPosition(original.profileId, original.id, it.positionMs)
            }
        }.getOrElse { message = "Wait until this video is ready before changing captions."; return }
        val sleepState = original.sleepTimer.state
        val ticket = connectionEpoch
        message = null
        providerJob = scope.launch {
            var decoder: NativeVlc? = null
            var remote: PreparedProviderPlayback? = null
            var next: VlcPlayback? = null
            try {
                withContext(Dispatchers.IO) { decoder = NativeVlc.open(appearance).getOrThrow() }
                val runtime = requireNotNull(decoder)
                if (original.remote != null) {
                    withContext(Dispatchers.IO) { remote = requireNotNull(providerAccess).openMedia(original.id) }
                }
                val current = freshCore()
                check(!closing && active === original && ticket == connectionEpoch && original.isAllowed(current.snapshot)) { "Playback access changed" }
                val prepared = remote
                if (prepared != null) {
                    check(prepared.mediaId == original.id && prepared.profileId == original.profileId && prepared.isAuthorized())
                    next = runtime.player(prepared.bytes, saved.positionMs, current.snapshot.profiles.getValue(original.profileId).playbackPreferences)
                } else withContext(Dispatchers.IO) { next = DesktopMediaLibrary(dataDirectory, current, runtime).open(original.id, original.profileId) }
                val candidate = requireNotNull(next)
                // A timer that elapsed while preparation ran must not be undone by restoring play intent.
                val expired = com.reelos.core.PlaybackSleepTimer { System.nanoTime() / 1_000_000 }
                    .apply { restore(sleepState) }.shouldPause(false)
                if (expired) original.sleepTimer.cancel()
                candidate.restoreBeforeAttach(saved.copy(playing = saved.playing && !expired)) {
                    check(original.session.isAllowed(freshCore().snapshot) && prepared?.isAuthorized() != false) { "Playback access changed" }
                    val sleepExpired = com.reelos.core.PlaybackSleepTimer { System.nanoTime() / 1_000_000 }
                        .apply { restore(sleepState) }.shouldPause(false)
                    if (sleepExpired) original.sleepTimer.cancel()
                    !sleepExpired
                }
                check(!closing && active === original && ticket == connectionEpoch && original.isAllowed(freshCore().snapshot) && prepared?.isAuthorized() != false)
                val replacement = ActivePlayback(original.id, original.profileId, original.title, candidate,
                    original.session, prepared, appearance, runtime, original.sleepTimer, original)
                original.player.releaseDrawableForReplacement()
                active = replacement
                decoder = null; remote = null; next = null // The active session owns all new resources.
                message = null
            } catch (_: Exception) {
                val allowed = runCatching { original.isAllowed(freshCore().snapshot) }.getOrDefault(false)
                if (!allowed && active === original) { runCatching { original.close() }; active = null }
                message = if (active === original && allowed)
                    "Caption appearance could not be changed. Your previous video remains paused; retry or return to your library."
                    else "Playback access changed while updating captions. Return to your library to try again."
            } finally {
                runCatching { next?.close() }
                runCatching { remote?.close() }
                runCatching { decoder?.close() }
                providerJob = null
            }
        }
    }

    fun captionReplacementFailed(candidate: ActivePlayback) {
        if (active !== candidate) return
        val previous = candidate.fallback ?: return
        candidate.fallback = null
        runCatching { candidate.close() }
        if (!closing && runCatching { previous.isAllowed(freshCore().snapshot) }.getOrDefault(false)) {
            active = previous
            message = "Caption update failed. Restoring your previous video; it will stay paused."
        } else {
            runCatching { previous.close() }; active = null
            message = "Playback access changed. Return to your library to try again."
        }
    }

    LaunchedEffect(active) {
        val playback = active ?: return@LaunchedEffect
        while (active === playback) {
            val allowed = withContext(Dispatchers.IO) {
                runCatching { playback.isAllowed(freshCore().snapshot) }.getOrDefault(false)
            }
            if (active !== playback) return@LaunchedEffect
            if (!allowed) {
                runCatching { playback.close() }
                active = null
                message = "Playback stopped because your profile or source changed, or access could not be checked. Return to your library to try again."
                revision++
                return@LaunchedEffect
            }
            delay(1_000)
        }
    }

    LaunchedEffect(Unit) {
        library?.let {
            runCatching { withContext(Dispatchers.IO) { it.reconcile() } }.onFailure { failure ->
                message = "Could not recheck local media: ${failure.message ?: "saved state is unchanged"}"
            }
            revision++
        }
    }
    DisposableEffect(vlc) { onDispose { active?.close(); connection?.cancelPending(); vlc?.close() } }

    Window(onCloseRequest = {
        if (!closing) {
            closing = true
            finishAfterImport(importJob, { finish -> SwingUtilities.invokeLater(finish) }) {
                finishAfterImport(providerJob, { finish -> SwingUtilities.invokeLater(finish) }) {
                    closeActive()
                    exitApplication()
                }
            }
        }
    }, title = "ReelOS — Native Validation") {
        DisposableEffect(window) {
            val listener = object : java.awt.event.WindowAdapter() {
                override fun windowActivated(event: java.awt.event.WindowEvent) {
                    scope.launch { deviceMotionAllowed = withContext(Dispatchers.IO) { DesktopMotionPolicy.readAllowed() } }
                }
            }
            window.addWindowListener(listener)
            onDispose { window.removeWindowListener(listener) }
        }
        MaterialTheme(colorScheme = darkColorScheme()) {
            Surface(Modifier.fillMaxSize()) { if (loaded.isFailure) {
                Text("Your saved state could not be opened. Nothing was reset. Close ReelOS and use recovery before continuing.", Modifier.padding(32.dp))
            } else Column {
                Text("Native validation · not a household release", Modifier.padding(12.dp), style = MaterialTheme.typography.labelSmall)
                if (closing) Text("Finishing the local media check before closing…", Modifier.padding(12.dp))
                if (vlc == null) Text("Desktop playback unavailable: ${nativeVlc.exceptionOrNull()?.message?.take(220) ?: "LibVLC is missing"}", Modifier.padding(12.dp))
                message?.let { Text(it, Modifier.padding(12.dp)) }
                val core = loaded.getOrThrow()
                NativeExperience(core, onImport = importAction@ {
                    if (closing) return@importAction
                    val chooser = FileDialog(window, "Choose personal media", FileDialog.LOAD)
                    try {
                        chooser.isVisible = true
                        chooser.file?.let { name ->
                            queueImport(Path.of(chooser.directory, name))
                        }
                    } catch (failure: Exception) {
                        message = "Couldn’t import this file: ${failure.message?.take(180) ?: "the previous library is unchanged"}"
                    } finally { chooser.dispose() }
                }, onPlay = playAction@ { id ->
                    try {
                        check(!closing) { "ReelOS is closing" }
                        val record = requireNotNull(freshCore().snapshot.media[id])
                        if (record.sourceId?.startsWith("external-provider-") == true) {
                            playProvider(id = id)
                            return@playAction
                        }
                        message = null
                        closeActive()
                        val current = freshCore()
                        val profileId = requireNotNull(current.snapshot.activeProfileId)
                        val session = LocalPlaybackSession.open(current.snapshot, id)
                        check(session.profileId == profileId) { "The active profile changed" }
                        val player = DesktopMediaLibrary(dataDirectory, current, vlc).open(id, profileId)
                        try {
                            check(session.isAllowed(freshCore().snapshot)) { "Playback access changed" }
                            loaded = Result.success(current)
                            active = ActivePlayback(id, profileId, record.title, player, session)
                        } catch (failure: Exception) { player.close(); throw failure }
                    } catch (failure: Exception) {
                        message = "Playback unavailable: ${failure.message?.take(180) ?: "the media could not be opened"}"
                        reloadCore()
                    }
                }, hostRevision = revision, motionAllowed = deviceMotionAllowed, connection = connection,
                    onProviderPlay = { video -> playProvider(video = video) }, onConnectionChanged = ::connectionChanged)
            } }
            pendingLaunch?.let { path ->
                AlertDialog(
                    onDismissRequest = { pendingLaunch = null },
                    title = { Text("Add local media?") },
                    text = { Text("Add this file to your collection?\n$path") },
                    confirmButton = { TextButton(onClick = { pendingLaunch = null; queueImport(path) }) { Text("Add file") } },
                    dismissButton = { TextButton(onClick = { pendingLaunch = null }) { Text("Cancel") } },
                )
            }
        }
    }

    active?.let { playback ->
        Window(onCloseRequest = ::closeActive, title = "ReelOS — ${playback.title}") {
            MaterialTheme(colorScheme = darkColorScheme()) {
                Surface(Modifier.fillMaxSize()) {
                PlaybackView(playback, changingCaptions = providerJob?.isActive == true, notice = message,
                    onReady = { if (active === playback) runCatching { playback.releaseFallback() } },
                    onFailure = { captionReplacementFailed(playback) },
                    onAppearance = ::changeCaptionAppearance, onPosition = { position ->
                    try {
                        val current = freshCore()
                        check(playback.isAllowed(current.snapshot)) { "Playback access changed" }
                        current.setPlaybackPosition(playback.profileId, playback.id, position)
                        loaded = Result.success(current)
                        revision++
                    }
                    catch (failure: Exception) {
                        message = if (playback.remote != null) "Connected-media resume could not be saved."
                            else "Resume could not be saved: ${failure.message?.take(180) ?: "storage failed"}"
                    }
                }, onClose = ::closeActive)
                }
            }
        }
    }
}

@Composable
private fun PlaybackView(playback: ActivePlayback, changingCaptions: Boolean, notice: String?,
    onReady: () -> Unit, onFailure: () -> Unit, onAppearance: (DesktopCaptionAppearance) -> Unit, onPosition: (Long) -> Unit, onClose: () -> Unit) {
    val sleepTimer = playback.sleepTimer
    var sleepLabel by remember(playback) { mutableStateOf(sleepTimer.label()) }
    var status by remember(playback) { mutableStateOf(playback.player.poll()) }
    var tracks by remember(playback) { mutableStateOf<VlcTracks?>(null) }
    var subtitleDelayMs by remember(playback) { mutableStateOf(0L) }
    var problem by remember(playback) { mutableStateOf<String?>(null) }
    var dragged by remember(playback) { mutableStateOf<Float?>(null) }
    var appearanceOpen by remember(playback) { mutableStateOf(false) }
    // Reserve the existing control area during replacement instead of expanding the video.
    var controlsHeightPx by remember { mutableIntStateOf(0) }
    val controlsMinHeight = with(LocalDensity.current) { controlsHeightPx.toDp() }
    val canvas = remember(playback) { Canvas().apply { background = Color.BLACK } }
    val panel = remember(playback) { JPanel(BorderLayout()).apply { background = Color.BLACK; add(canvas, BorderLayout.CENTER) } }
    DisposableEffect(playback, canvas) {
        fun attachWhenLaidOut() {
            if (canvas.isDisplayable && canvas.width > 0 && canvas.height > 0) {
                runCatching { playback.player.attach(canvas) }.onFailure { problem = it.message ?: "Native video could not start"; onFailure() }
            }
        }
        val listener = HierarchyListener { event ->
            if (event.changeFlags and HierarchyEvent.DISPLAYABILITY_CHANGED.toLong() != 0L) attachWhenLaidOut()
        }
        val sizeListener = object : ComponentAdapter() {
            override fun componentResized(event: ComponentEvent) = attachWhenLaidOut()
        }
        canvas.addHierarchyListener(listener)
        canvas.addComponentListener(sizeListener)
        attachWhenLaidOut()
        onDispose { canvas.removeHierarchyListener(listener); canvas.removeComponentListener(sizeListener) }
    }
    LaunchedEffect(playback, changingCaptions) {
        var lastSaved = 0L
        var completionSaved = false
        while (true) {
            delay(500)
            val result = runCatching { playback.player.poll() }
            if (result.isFailure) {
                problem = result.exceptionOrNull()?.message ?: "Native playback failed"
                onFailure()
                break
            }
            val current = result.getOrThrow()
            status = current
            if (current.error) { problem = "Playback could not continue."; onFailure(); break }
            if (!current.restoring && current.durationMs > 0) onReady()
            if (sleepTimer.shouldPause(current.ended)) {
                runCatching {
                    playback.player.pause()
                    if (!changingCaptions && !current.restoring) onPosition(if (current.ended) 0 else current.positionMs)
                }.onFailure { problem = "Sleep pause failed. Please pause playback manually." }
            }
            sleepLabel = sleepTimer.label()
            // Demux may discover tracks after playback starts (especially remote media).
            runCatching { playback.player.tracks() }.onSuccess { tracks = it }
            runCatching { playback.player.subtitleDelayMs() }.onSuccess { subtitleDelayMs = it }
            if (current.error) problem = "LibVLC reported a decoding or media error."
            if (!changingCaptions && !current.restoring && current.ended && !completionSaved) {
                onPosition(0)
                completionSaved = true
            } else if (!changingCaptions && !current.restoring && !current.ended) {
                if (completionSaved) {
                    completionSaved = false
                    lastSaved = 0
                } else if (current.positionMs + 1_000 < lastSaved) {
                    lastSaved = current.positionMs
                }
                if (current.positionMs > 0 && current.positionMs - lastSaved >= 5_000) {
                    onPosition(current.positionMs)
                    lastSaved = current.positionMs
                }
            }
        }
    }
    Column(Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(playback.title, style = MaterialTheme.typography.titleLarge)
        Box(Modifier.fillMaxWidth().weight(1f)) {
            // SwingPanel retains its factory result; a replacement player must receive its own drawable.
            key(playback.player) { SwingPanel(factory = { panel }, modifier = Modifier.fillMaxSize()) }
        }
        problem?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        notice?.let { Text(it) }
        Box(Modifier.fillMaxWidth().heightIn(min = controlsMinHeight)) {
        if (changingCaptions || status.restoring) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Updating captions… Your place is saved.")
            Button(onClick = onClose) { Text("Close") }
            }
        } else {
        Column(Modifier.fillMaxWidth().onSizeChanged { controlsHeightPx = it.height },
            verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Slider(
            value = dragged ?: if (status.durationMs > 0) (status.positionMs.toFloat() / status.durationMs).coerceIn(0f, 1f) else 0f,
            onValueChange = { dragged = it },
            onValueChangeFinished = {
                val fraction = dragged
                dragged = null
                if (fraction != null) runCatching {
                    val position = (fraction * status.durationMs).toLong()
                    playback.player.seek(position)
                    onPosition(position)
                }.onFailure { problem = it.message ?: "Seeking failed" }
            },
            enabled = status.seekable && status.durationMs > 0,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(onClick = { runCatching { playback.player.togglePause() }.onFailure { problem = it.message ?: "Pause failed" } }) {
                Text(if (status.ended) "Replay" else if (status.playing) "Pause" else "Play")
            }
            Text("${formatTime(status.positionMs)} / ${formatTime(status.durationMs)}", Modifier.padding(top = 12.dp))
            Button(onClick = onClose) { Text("Close") }
            com.reelos.ui.SleepTimerControl(sleepLabel,
                onMinutes = { sleepTimer.after(it * 60_000L); sleepLabel = sleepTimer.label() },
                onEnd = { sleepTimer.atEnd(); sleepLabel = sleepTimer.label() },
                onCancel = { sleepTimer.cancel(); sleepLabel = sleepTimer.label() })
        }
        tracks?.let { available ->
            if (available.subtitles.isNotEmpty()) Button(onClick = { appearanceOpen = true }) { Text("Caption appearance") }
            if (available.subtitles.isNotEmpty()) com.reelos.ui.SubtitleTimingControl(subtitleDelayMs,
                onAdjust = { delta -> runCatching {
                    playback.player.setSubtitleDelayMs(com.reelos.core.SubtitleTiming.adjust(subtitleDelayMs, delta))
                    subtitleDelayMs = playback.player.subtitleDelayMs()
                }.onFailure { problem = "Caption timing could not be changed." } },
                onReset = { runCatching { playback.player.setSubtitleDelayMs(0); subtitleDelayMs = playback.player.subtitleDelayMs() }
                    .onFailure { problem = "Caption timing could not be reset." } })
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (available.audio.isNotEmpty()) TrackMenu(
                    label = "Audio",
                    selected = available.audio.firstOrNull { it.id == available.audioId }?.name ?: "Select track",
                    choices = available.audio,
                    onSelect = { id -> playback.player.selectAudioTrack(id) },
                    onError = { problem = it },
                )
                if (available.subtitles.isNotEmpty()) TrackMenu(
                    label = "Subtitles",
                    selected = if (available.subtitleId == -1) "Off"
                        else available.subtitles.firstOrNull { it.id == available.subtitleId }?.name ?: "Select track",
                    choices = listOf(VlcTrack(-1, "Off")) + available.subtitles,
                    onSelect = { id -> playback.player.selectSubtitleTrack(id) },
                    onError = { problem = it },
                )
            }
        }
        }
        }
        }
    }
    if (appearanceOpen) DialogWindow(onCloseRequest = { appearanceOpen = false }, title = "Caption appearance",
        state = rememberDialogState(width = 340.dp, height = 540.dp)) {
        MaterialTheme(colorScheme = darkColorScheme()) {
            Surface(Modifier.fillMaxSize()) {
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)) {
                    com.reelos.ui.CaptionAppearanceChoices(playback.appearance.size, playback.appearance.style,
                        onSize = { appearanceOpen = false; onAppearance(playback.appearance.copy(size = it)) },
                        onStyle = { appearanceOpen = false; onAppearance(playback.appearance.copy(style = it)) },
                        onReset = { appearanceOpen = false; onAppearance(DesktopCaptionAppearance()) })
                    TextButton(onClick = { appearanceOpen = false }) { Text("Close") }
                }
            }
        }
    }
}

@Composable
private fun TrackMenu(
    label: String, selected: String, choices: List<VlcTrack>,
    onSelect: (Int) -> Unit, onError: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        Button(onClick = { expanded = true }) { Text("$label: $selected") }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            choices.forEach { choice ->
                DropdownMenuItem(text = { Text(choice.name) }, onClick = {
                    expanded = false
                    runCatching { onSelect(choice.id) }.onFailure {
                        onError(it.message ?: "Track selection failed")
                    }
                })
            }
        }
    }
}

private fun formatTime(ms: Long): String {
    val total = ms.coerceAtLeast(0) / 1_000
    return "%02d:%02d:%02d".format(total / 3_600, total / 60 % 60, total % 60)
}
