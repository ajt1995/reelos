package com.reelos.nativepreview

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.reelos.core.*
import com.reelos.presentation.ProviderMediaAccess
import com.reelos.presentation.PreparedProviderPlayback
import com.reelos.providers.*
import java.nio.file.Files

/** Owner-authorized real bytes through the production native player; never exports keys or media identities. */
internal object NativeProviderPlaybackChecks {
    /** Called in a fresh process after the runner stops every test player, including on timeout. */
    fun recover(host: Instrumentation) {
        val result = Bundle()
        try {
            val path = host.targetContext.filesDir.resolve("provider-playback-baseline.core").toPath()
            if (Files.exists(path)) {
                val baseline = FileCoreStore(path).load()
                val store = FileCoreStore(host.targetContext.filesDir.resolve("core.bin").toPath())
                store.save(baseline.copy(revision = Math.addExact(store.load().revision, 1L)))
                check(store.load().copy(revision = baseline.revision) == baseline)
                Files.delete(path)
            }
            result.putString("stream", "provider-baseline-recovery: passed\n")
            host.finish(Activity.RESULT_OK, result)
        } catch (_: Throwable) {
            result.putString("stream", "provider-baseline-recovery: FAILED; backup retained\n")
            host.finish(Activity.RESULT_CANCELED, result)
        }
    }

    fun run(host: Instrumentation) {
        val result = Bundle()
        var phase = "connection"
        var passed = 0
        var activity: Activity? = null
        var token: String? = null
        var baseline: CoreState? = null
        var problem: String? = null
        var restored = false
        val state = FileCoreStore(host.targetContext.filesDir.resolve("core.bin").toPath())
        val backupPath = host.targetContext.filesDir.resolve("provider-playback-baseline.core").toPath()
        val vault = ProtectedConnectionStore(host.targetContext.noBackupFilesDir.resolve("connection.bin").toPath(), AndroidCredentialProtector(host.targetContext))
        var credentialRevision: String? = null
        fun load() = ReelCore(state, DeviceKind.ANDROID_PHONE)
        fun report(name: String) {
            passed++; result.putString(name, "passed")
            host.sendStatus(0, Bundle().apply { putString("stream", "$name: passed\n") })
        }
        fun waitFor(condition: () -> Boolean) {
            val deadline = SystemClock.elapsedRealtime() + 35_000
            while (SystemClock.elapsedRealtime() < deadline) {
                if (condition()) return
                SystemClock.sleep(100)
            }
            error("Bounded verification timeout")
        }
        fun player(): ExoPlayer = PlaybackActivity::class.java.getDeclaredField("player").apply { isAccessible = true }.get(requireNotNull(activity)) as ExoPlayer
        fun position(): Long {
            var value = 0L
            host.runOnMainSync { value = player().currentPosition }
            return value
        }
        fun renderedFrames(): Int {
            var count = 0
            host.runOnMainSync {
                player().playerError?.let { error("PLAYER_CODE_${it.errorCode}") }
                count = player().videoDecoderCounters?.renderedOutputBufferCount ?: 0
            }
            return count
        }
        fun closePlayer() {
            val closing = activity ?: return
            host.runOnMainSync { closing.finish() }
            waitFor { closing.isDestroyed }
            activity = null
        }
        fun launch(prepared: PreparedProviderPlayback) {
            val id = PendingProviderPlayback.put(prepared)
            token = id
            val monitor = host.addMonitor(PlaybackActivity::class.java.name, null, false)
            try {
                host.targetContext.startActivity(Intent(host.targetContext, PlaybackActivity::class.java)
                    .putExtra("providerPlayback", id).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                activity = monitor.waitForActivityWithTimeout(15_000) ?: error("Player launch timeout")
                // This journey verifies video, not audio. Do not change the device's volume setting.
                host.runOnMainSync { player().volume = 0f }
            } finally { host.removeMonitor(monitor) }
        }
        try {
            vault.read()?.use { credentialRevision = it.revision; check(it.accountId != null) } ?: throw ConnectionChanged()
            val connection = ProviderConnectionController("Configured source", TorBoxProviderClient(JdkProviderTransport()), vault)
            phase = "collection"
            val video = connection.page().videos.firstOrNull { it.ready } ?: throw ProviderFailure(ProviderFailureCode.NOT_READY)
            phase = "state-isolation"
            // Refuse to overwrite a recovery journal left by an interrupted run.
            check(!Files.exists(backupPath))
            val before = state.load()
            val backup = FileCoreStore(backupPath)
            backup.save(before.copy(revision = 1L))
            check(backup.load().copy(revision = before.revision) == before)
            baseline = before
            val profile = "provider-validation-${System.currentTimeMillis()}"
            load().apply {
                createProfile(profile, "Playback validation")
                selectProfile(profile)
                setColor(profile, "#376FE4")
                acknowledgeCurator(profile)
                setTasteSeeds(profile, emptySet())
                confirmDefaultSources(profile)
                chooseHome(profile, null)
            }
            val access = ProviderMediaAccess(::load, connection)
            phase = "prepare"
            val prepared = access.prepare(video)
            val mediaId = prepared.mediaId
            phase = "decode"
            launch(prepared)
            waitFor { renderedFrames() >= 3 && position() >= 1_000 }
            val firstPosition = position()
            waitFor { position() >= firstPosition + 2_000 && renderedFrames() >= 10 }
            report("provider-native-frame-and-progress")

            phase = "seek"
            var duration = 0L
            host.runOnMainSync { duration = player().duration }
            check(duration > 20_000)
            val seekTarget = minOf(30_000L, duration / 2)
            val beforeFrames = renderedFrames()
            host.runOnMainSync { player().seekTo(seekTarget) }
            waitFor { position() >= seekTarget + 2_000 && renderedFrames() > beforeFrames + 3 }
            closePlayer()
            val saved = load().snapshot.profiles.getValue(profile).playbackPositionsMs.getValue(mediaId)
            check(saved >= seekTarget)
            report("provider-native-seek-and-persist")

            phase = "resume"
            // Resolve again through the shared Library path rather than reusing an expired session.
            launch(access.openMedia(mediaId))
            waitFor { renderedFrames() >= 3 && position() >= saved + 1_000 }
            check(position() < saved + 15_000)
            report("provider-native-resume")

            phase = "source-revocation"
            val sourceId = requireNotNull(load().snapshot.media.getValue(mediaId).sourceId)
            load().revokeSource(sourceId)
            waitFor {
                var released = false
                host.runOnMainSync {
                    val view = PlaybackActivity::class.java.getDeclaredField("playerView").apply { isAccessible = true }
                        .get(requireNotNull(activity)) as PlayerView
                    released = view.player == null && !view.keepScreenOn
                }
                released
            }
            report("provider-native-revocation-stops-player")
        } catch (failure: Throwable) {
            // Whitelist failure categories only; player/network exceptions can contain signed URLs.
            val code = when (failure) {
                is ProviderFailure -> failure.code.name
                is ConnectionChanged -> "CONNECTION_CHANGED"
                is ConnectionStorageFailure -> "PROTECTED_STORAGE"
                else -> "VERIFICATION_FAILED"
            }
            problem = "$phase ($code)"
        } finally {
            try {
                closePlayer()
                token?.let(PendingProviderPlayback::discard)
                baseline?.let { original ->
                    val current = state.load()
                    state.save(original.copy(revision = Math.addExact(current.revision, 1L)))
                    check(state.load().copy(revision = original.revision) == original)
                    check(vault.isCurrent(requireNotNull(credentialRevision)))
                    Files.delete(backupPath)
                    restored = true
                }
            } catch (_: Throwable) {
                problem = "state-recovery (BACKUP_RETAINED)"
            }
        }
        if (restored) report("provider-native-owner-state-preserved")
        result.putString("stream", if (problem == null)
            "Native provider playback: $passed passed; short muted video only, not full-film/audio/subtitle/analysis acceptance.\n"
        else "Native provider playback FAILED after $passed passed at $problem; no keys or media identities exported.\n")
        host.finish(if (problem == null) Activity.RESULT_OK else Activity.RESULT_CANCELED, result)
    }
}
