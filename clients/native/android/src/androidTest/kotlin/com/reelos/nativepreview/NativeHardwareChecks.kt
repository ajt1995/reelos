package com.reelos.nativepreview

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import com.reelos.core.*
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.common.Player
import androidx.media3.ui.PlayerView

/** Real-device integration checks; direct setup below is NOT onboarding/UI acceptance. */
class NativeHardwareChecks : Instrumentation() {
    override fun onCreate(arguments: Bundle?) { super.onCreate(arguments); start() }
    override fun onStart() {
        val results = Bundle()
        var passed = 0
        fun checkCase(name: String, block: () -> Unit) {
            sendStatus(0, Bundle().apply { putString("stream", "$name: started\n") })
            block()
            passed++
            results.putString(name, "passed")
            sendStatus(0, Bundle().apply { putString("stream", "$name: passed\n") })
        }
        fun load() = ReelCore(FileCoreStore(targetContext.filesDir.resolve("core.bin").toPath()), DeviceKind.ANDROID_PHONE)
        fun launch(intent: Intent): Activity {
            // startActivitySync waits for an idle queue, which a living Compose scene may never reach.
            val monitor = addMonitor(requireNotNull(intent.component).className, null, false)
            try {
                targetContext.startActivity(intent)
                return monitor.waitForActivityWithTimeout(15_000) ?: error("Activity did not start within 15 seconds")
            } finally { removeMonitor(monitor) }
        }
        var main: Activity? = null
        var playback: Activity? = null
        try {
            val previousProfile = load().snapshot.activeProfileId
            val profileId = "hardware-check-${System.currentTimeMillis()}"
            load().apply {
                createProfile(profileId, "Hardware validation")
                selectProfile(profileId)
                setColor(profileId, "#376FE4")
                acknowledgeCurator(profileId)
                setTasteSeeds(profileId, emptySet())
                confirmDefaultSources(profileId)
                chooseHome(profileId, null)
            }
            main = launch(Intent(targetContext, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            val import = MainActivity::class.java.getDeclaredMethod("importVideo", Uri::class.java).apply { isAccessible = true }
            var mediaId = ""
            checkCase("valid-local-import-and-decoder") {
                import.invoke(main, Uri.parse("content://com.reelos.nativepreview.test.fixture/valid"))
                val core = load()
                mediaId = core.snapshot.media.values.single { it.title == "Native-Validation-30s.mp4" }.id
                check(core.mediaAction(mediaId) == MediaAction.PLAY)
            }
            checkCase("invalid-video-rejected") {
                val before = load().snapshot.media.keys
                check(runCatching { import.invoke(main, Uri.parse("content://com.reelos.nativepreview.test.fixture/invalid")) }.isFailure)
                check(load().snapshot.media.keys == before)
            }
            checkCase("repeat-import-does-not-leak-private-copies") {
                val directory = targetContext.filesDir.resolve("media")
                val count = directory.listFiles()?.size ?: 0
                import.invoke(main, Uri.parse("content://com.reelos.nativepreview.test.fixture/valid"))
                check((directory.listFiles()?.size ?: 0) == count)
            }
            fun launchPlayer(id: String = mediaId): Activity = launch(Intent(targetContext, PlaybackActivity::class.java)
                .putExtra("mediaId", id).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            fun firstFrame(activity: Activity): Boolean {
                var rendered = false
                runOnMainSync {
                    rendered = PlaybackActivity::class.java.getDeclaredField("hasRenderedFrame").apply { isAccessible = true }.getBoolean(activity)
                }
                return rendered
            }
            fun waitFor(label: String, condition: () -> Boolean) {
                val deadline = SystemClock.elapsedRealtime() + 12_000
                while (SystemClock.elapsedRealtime() < deadline) {
                    if (condition()) return
                    SystemClock.sleep(100)
                }
                error("Timed out: $label")
            }
            fun player(activity: Activity) = PlaybackActivity::class.java.getDeclaredField("player")
                .apply { isAccessible = true }.get(activity) as ExoPlayer
            fun playerView(activity: Activity) = PlaybackActivity::class.java.getDeclaredField("playerView")
                .apply { isAccessible = true }.get(activity) as PlayerView
            playback = launchPlayer()
            checkCase("native-player-decodes-real-frame") { waitFor("first frame") { firstFrame(requireNotNull(playback)) } }
            checkCase("player-keeps-screen-on-only-while-playing") {
                waitFor("active playback keeps screen on") {
                    var active = false
                    runOnMainSync {
                        val activity = requireNotNull(playback)
                        active = player(activity).isPlaying && playerView(activity).keepScreenOn
                    }
                    active
                }
                runOnMainSync { player(requireNotNull(playback)).pause() }
                waitFor("paused playback permits screen timeout") {
                    var allowed = false
                    runOnMainSync { allowed = !playerView(requireNotNull(playback)).keepScreenOn }
                    allowed
                }
                runOnMainSync { player(requireNotNull(playback)).play() }
                waitFor("resumed playback keeps screen on") {
                    var active = false
                    runOnMainSync {
                        val activity = requireNotNull(playback)
                        active = player(activity).isPlaying && playerView(activity).keepScreenOn
                    }
                    active
                }
            }
            checkCase("seek-and-persist-position") {
                runOnMainSync { player(requireNotNull(playback)).seekTo(12_000) }
                waitFor("seek") {
                    var position = 0L
                    runOnMainSync { position = player(requireNotNull(playback)).currentPosition }
                    position >= 12_000
                }
                SystemClock.sleep(700)
                runOnMainSync { playback?.finish() }
                waitFor("saved position") { (load().snapshot.activeProfile?.playbackPositionsMs?.get(mediaId) ?: 0) >= 12_000 }
            }
            playback = launchPlayer()
            checkCase("resume-restores-position") {
                waitFor("resumed frame") { firstFrame(requireNotNull(playback)) }
                var position = 0L
                runOnMainSync { position = player(requireNotNull(playback)).currentPosition }
                check(position >= 12_000) { "Resume started at $position" }
                val completedActivity = requireNotNull(playback)
                runOnMainSync { completedActivity.finish() }
                waitFor("previous player destroyed") { completedActivity.isDestroyed }
            }
            playback = launchPlayer()
            checkCase("completed-playback-restarts-from-beginning") {
                waitFor("completion fixture first frame") { firstFrame(requireNotNull(playback)) }
                var duration = 0L
                runOnMainSync { duration = player(requireNotNull(playback)).duration }
                check(duration > 2_000) { "Fixture duration unavailable" }
                runOnMainSync { player(requireNotNull(playback)).seekTo(duration - 500) }
                waitFor("playback completion") {
                    var ended = false
                    runOnMainSync {
                        val activity = requireNotNull(playback)
                        ended = player(activity).playbackState == Player.STATE_ENDED && !playerView(activity).keepScreenOn
                    }
                    ended
                }
                waitFor("ended position persisted") { load().snapshot.activeProfile?.playbackPositionsMs?.get(mediaId) == 0L }
                val completedActivity = requireNotNull(playback)
                runOnMainSync { completedActivity.finish() }
                waitFor("completed player destroyed") { completedActivity.isDestroyed }
                check(load().snapshot.activeProfile?.playbackPositionsMs?.get(mediaId) == 0L) {
                    "Completed position was overwritten after closing the player"
                }
                playback = launchPlayer()
                waitFor("restart first frame") { firstFrame(requireNotNull(playback)) }
                var restarted = Long.MAX_VALUE
                runOnMainSync { restarted = player(requireNotNull(playback)).currentPosition }
                check(restarted < 5_000) { "Completed title reopened at $restarted" }
                val restartedActivity = requireNotNull(playback)
                runOnMainSync { restartedActivity.finish() }
                waitFor("restarted player destroyed") { restartedActivity.isDestroyed }
            }
            checkCase("mutable-provider-retained-bytes-validated") {
                // Reproduce a player write that lands after MainActivity's last reload.
                val staleMainCore = load()
                val preservedPosition = 4_321L
                load().setPlaybackPosition(profileId, mediaId, preservedPosition)
                val coreField = MainActivity::class.java.getDeclaredField("core").apply { isAccessible = true }
                runOnMainSync { coreField.set(main, staleMainCore) }
                val original = Uri.parse("content://com.reelos.nativepreview.test.fixture/mutable")
                import.invoke(main, original)
                check(load().snapshot.profiles.getValue(profileId).playbackPositionsMs[mediaId] == preservedPosition) {
                    "Import overwrote a newer profile playback position"
                }
                val mutable = load().snapshot.media.values.single { it.title == "Mutable-Validation.mp4" }
                check(load().mediaAction(mutable.id) == MediaAction.PLAY)
                val retained = Uri.parse(requireNotNull(targetContext.getSharedPreferences("local-media", 0).getString(mutable.id, null)))
                check(retained.scheme == "file") { "Mutable provider did not retain a private copy" }
                LocalVideo.verifyFirstFrame(targetContext, retained)
                check(runCatching { LocalVideo.verifyFirstFrame(targetContext, original) }.isFailure) {
                    "Mutable provider did not change after the retained copy was made"
                }
                playback = launchPlayer(mutable.id)
                waitFor("retained copy renders") { firstFrame(requireNotNull(playback)) }
                val mutableActivity = requireNotNull(playback)
                runOnMainSync { mutableActivity.finish() }
                waitFor("retained-copy player destroyed") { mutableActivity.isDestroyed }
            }
            checkCase("profile-isolation-and-revoked-source") {
                val core = load()
                val other = "$profileId-other"
                core.createProfile(other, "Other validation profile")
                check(core.snapshot.profiles.getValue(other).playbackPositionsMs.isEmpty())
                core.save(profileId, mediaId, true)
                core.revokeSource(PERSONAL_SOURCE_ID)
                check(core.mediaAction(mediaId) == MediaAction.UNAVAILABLE)
                core.save(profileId, mediaId, false)
                check(mediaId !in core.snapshot.profiles.getValue(profileId).savedMediaIds)
                // Restore only the validation application's source/profile, never household data.
                core.putSource(SourceRecord(PERSONAL_SOURCE_ID, SourceKind.PERSONAL, SourceStatus.AVAILABLE))
                if (previousProfile != null) core.selectProfile(previousProfile)
            }
            results.putInt("passed", passed)
            results.putString("stream", "Native hardware checks: $passed passed; no skips. UI journey acceptance remains separate.\n")
            finish(Activity.RESULT_OK, results)
        } catch (failure: Throwable) {
            results.putInt("passed", passed)
            val causes = generateSequence(failure) { it.cause }.take(6).joinToString(" -> ") { "${it.javaClass.simpleName}: ${it.message}" }
            results.putString("stream", "Native hardware checks FAILED: $causes\n")
            finish(Activity.RESULT_CANCELED, results)
        } finally {
            runOnMainSync { playback?.finish(); main?.finish() }
        }
    }
}
