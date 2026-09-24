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
import android.view.View
import android.view.accessibility.AccessibilityNodeInfo
import androidx.media3.common.C

/** Real-device integration checks; direct setup below is NOT onboarding/UI acceptance. */
class NativeHardwareChecks : Instrumentation() {
    private var journey: String? = null
    override fun onCreate(arguments: Bundle?) {
        journey = arguments?.getString("journey")
        super.onCreate(arguments)
        start()
    }
    override fun onStart() {
        if (journey == "provider-recovery") { NativeProviderPlaybackChecks.recover(this); return }
        if (journey == "provider-playback") { NativeProviderPlaybackChecks.run(this); return }
        if (journey == "provider-live") { NativeLiveConnectionChecks.run(this); return }
        if (journey == "connection") { NativeConnectionChecks.run(this); return }
        if (journey == "personal-ui" || journey == "first-run") {
            NativePersonalUiChecks.run(this, fresh = journey == "first-run")
            return
        }
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
            checkCase("active-playback-stops-after-source-revocation") {
                load().selectProfile(profileId)
                playback = launchPlayer()
                val activity = requireNotNull(playback)
                waitFor("revocation fixture first frame") { firstFrame(activity) }
                try {
                    load().revokeSource(PERSONAL_SOURCE_ID)
                    // Restore before the next periodic observation: the old session must still die.
                    load().putSource(SourceRecord(PERSONAL_SOURCE_ID, SourceKind.PERSONAL, SourceStatus.AVAILABLE))
                    waitFor("revoked player released") {
                        var stopped = false
                        runOnMainSync { stopped = playerView(activity).player == null && !playerView(activity).keepScreenOn }
                        stopped
                    }
                    load().putSource(SourceRecord(PERSONAL_SOURCE_ID, SourceKind.PERSONAL, SourceStatus.AVAILABLE))
                    runOnMainSync { check(playerView(activity).player == null) { "Revoked session resumed after source restoration" } }
                } finally {
                    runOnMainSync { activity.finish() }
                    waitFor("revoked player destroyed") { activity.isDestroyed }
                    load().putSource(SourceRecord(PERSONAL_SOURCE_ID, SourceKind.PERSONAL, SourceStatus.AVAILABLE))
                }
            }
            checkCase("active-playback-stops-after-profile-switch") {
                val core = load()
                val other = "$profileId-switch"
                core.createProfile(other, "Switch validation profile")
                core.selectProfile(profileId)
                playback = launchPlayer()
                val activity = requireNotNull(playback)
                waitFor("profile-switch fixture first frame") { firstFrame(activity) }
                try {
                    load().selectProfile(other)
                    load().selectProfile(profileId)
                    waitFor("switched profile player released") {
                        var stopped = false
                        runOnMainSync { stopped = playerView(activity).player == null && !playerView(activity).keepScreenOn }
                        stopped
                    }
                    check(load().snapshot.profiles.getValue(other).playbackPositionsMs.isEmpty())
                } finally {
                    runOnMainSync { activity.finish() }
                    waitFor("profile-switch player destroyed") { activity.isDestroyed }
                    load().selectProfile(profileId)
                }
            }
            // Real embedded AAC/caption tracks in a synthetic test-only fixture. Not perceptual audio QA.
            val trackId = "native-track-validation-fixture"
            load().apply {
                selectProfile(profileId)
                setPlaybackPreferences(profileId, PlaybackPreferences("es", "en", SubtitleMode.ON))
                putMedia(MediaRecord(trackId, "Native track validation", PERSONAL_SOURCE_ID, MediaAvailability.READY))
            }
            check(targetContext.getSharedPreferences("local-media", 0).edit()
                .putString(trackId, "content://com.reelos.nativepreview.test.fixture/tracks").commit())
            playback = launchPlayer(trackId)
            fun tracksOf(type: Int) = player(requireNotNull(playback)).currentTracks.groups.filter { it.type == type }
            fun selectedLanguage(type: Int, language: String): Boolean {
                var selected = false
                runOnMainSync {
                    selected = tracksOf(type).any { group -> (0 until group.length).any {
                        group.isTrackSelected(it) && group.getTrackFormat(it).language?.startsWith(language) == true
                    } }
                }
                return selected
            }
            fun openControl(id: Int) {
                runOnMainSync {
                    val view = playerView(requireNotNull(playback))
                    view.showController()
                    val control = requireNotNull(view.findViewById<View>(id))
                    check(control.isShown && control.isEnabled && control.performClick())
                }
            }
            fun clickLabel(label: String) {
                sendStatus(0, Bundle().apply { putString("stream", "Native control: $label\n") })
                waitFor("native control '$label'") {
                    if (android.os.Build.VERSION.SDK_INT >= 34) uiAutomation.clearCache()
                    val root = uiAutomation.rootInActiveWindow ?: return@waitFor false
                    if (root.packageName?.toString() != targetContext.packageName) return@waitFor false
                    val queue = java.util.ArrayDeque<AccessibilityNodeInfo>()
                    queue.add(root)
                    var count = 0
                    while (queue.isNotEmpty() && count++ < 300) {
                        val node = queue.removeFirst()
                        val text = node.text?.toString().orEmpty()
                        if (node.isVisibleToUser && (text.equals(label, ignoreCase = true) || text.startsWith("$label,", ignoreCase = true))) {
                            var action: AccessibilityNodeInfo? = node
                            repeat(5) {
                                if (action?.isClickable == true && action?.isEnabled == true)
                                    return@waitFor action!!.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                                action = action?.parent
                            }
                        }
                        for (index in 0 until node.childCount) node.getChild(index)?.let(queue::add)
                    }
                    false
                }
            }
            checkCase("native-player-decodes-audio-tracks") {
                waitFor("audio buffers and video") {
                    var decoded = false
                    runOnMainSync {
                        val p = player(requireNotNull(playback))
                        decoded = (p.audioDecoderCounters?.renderedOutputBufferCount ?: 0) > 0 &&
                            tracksOf(C.TRACK_TYPE_AUDIO).sumOf { it.length } == 2 &&
                            tracksOf(C.TRACK_TYPE_TEXT).sumOf { it.length } == 2
                        p.volume = 0f
                    }
                    decoded && firstFrame(requireNotNull(playback))
                }
            }
            checkCase("native-audio-track-controls") {
                waitFor("saved audio language applied") { selectedLanguage(C.TRACK_TYPE_AUDIO, "es") }
                var caption = false
                waitFor("saved subtitle language applied") {
                    runOnMainSync { caption = player(requireNotNull(playback)).currentCues.cues.any { it.text?.contains("English") == true } }
                    caption && selectedLanguage(C.TRACK_TYPE_TEXT, "en")
                }
                openControl(androidx.media3.ui.R.id.exo_settings)
                clickLabel(getTargetContext().getString(androidx.media3.ui.R.string.exo_track_selection_title_audio))
                clickLabel("English")
                waitFor("selected English audio override") { selectedLanguage(C.TRACK_TYPE_AUDIO, "en") }
                openControl(androidx.media3.ui.R.id.exo_settings)
                clickLabel(getTargetContext().getString(androidx.media3.ui.R.string.exo_track_selection_title_audio))
                clickLabel("Spanish")
                waitFor("selected Spanish audio") { selectedLanguage(C.TRACK_TYPE_AUDIO, "es") }
            }
            checkCase("native-subtitle-controls-and-cues") {
                openControl(androidx.media3.ui.R.id.exo_subtitle)
                clickLabel("English")
                waitFor("English decoded caption") {
                    var shown = false
                    runOnMainSync { shown = player(requireNotNull(playback)).currentCues.cues.any { it.text?.contains("English") == true } }
                    shown && selectedLanguage(C.TRACK_TYPE_TEXT, "en")
                }
                openControl(androidx.media3.ui.R.id.exo_subtitle)
                clickLabel("Spanish")
                waitFor("Spanish decoded caption") {
                    var shown = false
                    runOnMainSync { shown = player(requireNotNull(playback)).currentCues.cues.any { it.text?.contains("Spanish") == true } }
                    shown && selectedLanguage(C.TRACK_TYPE_TEXT, "es")
                }
            }
            checkCase("native-subtitle-timing-controls") {
                runOnMainSync { playerView(requireNotNull(playback)).showController() }
                clickLabel("Caption timing · 0ms")
                clickLabel("Later · 1 second")
                clickLabel("Caption timing · 1000ms")
                clickLabel("Reset caption timing")
                runOnMainSync {
                    check(PlaybackActivity::class.java.getDeclaredMethod("getSubtitleDelayMs").apply { isAccessible = true }
                        .invoke(requireNotNull(playback)) == 0L)
                }
            }
            checkCase("native-subtitle-offset-cues-and-seek") {
                fun offsetAt(delay: Long, position: Long) {
                    runOnMainSync {
                        PlaybackActivity::class.java.getDeclaredMethod("changeSubtitleDelay", java.lang.Long.TYPE)
                            .apply { isAccessible = true }.invoke(requireNotNull(playback), delay)
                        player(requireNotNull(playback)).seekTo(position)
                        player(requireNotNull(playback)).play()
                    }
                }
                fun captionAt(from: Long, until: Long, present: Boolean): Boolean {
                    var matches = false
                    runOnMainSync {
                        val playing = player(requireNotNull(playback))
                        matches = playing.playbackState == Player.STATE_READY && playing.currentPosition in from..until &&
                            playing.currentCues.cues.any { it.text?.contains("Spanish") == true } == present
                    }
                    return matches
                }
                offsetAt(5_000, 1_000)
                waitFor("positive offset hides cue before delayed start") { captionAt(1_000, 4_000, false) }
                waitFor("delayed real cue appears") { captionAt(5_500, 11_000, true) }
                offsetAt(-5_000, 26_000)
                waitFor("negative offset ends cue earlier after seek") { captionAt(26_000, 28_500, false) }
                offsetAt(0, 1_000)
                waitFor("reset restores real cue after backward seek") { captionAt(1_000, 8_000, true) }
            }
            checkCase("native-caption-appearance-renders") {
                runOnMainSync {
                    player(requireNotNull(playback)).seekTo(8_000)
                    player(requireNotNull(playback)).pause()
                    playerView(requireNotNull(playback)).showController()
                }
                waitFor("caption ready for appearance") {
                    var ready = false
                    runOnMainSync { ready = player(requireNotNull(playback)).currentCues.cues.any { it.text?.contains("Spanish") == true } }
                    ready
                }
                fun choose(label: String) {
                    clickLabel("Caption appearance")
                    clickLabel(label)
                    waitForIdleSync()
                }
                fun pixels(): Pair<Int, Int> {
                    var white = 0
                    var yellow = 0
                    runOnMainSync {
                        val view = requireNotNull(playerView(requireNotNull(playback)).subtitleView)
                        check(view.width > 0 && view.height > 0)
                        val bitmap = android.graphics.Bitmap.createBitmap(view.width, view.height, android.graphics.Bitmap.Config.ARGB_8888)
                        try {
                            view.draw(android.graphics.Canvas(bitmap))
                            val colors = IntArray(view.width * view.height)
                            bitmap.getPixels(colors, 0, view.width, 0, 0, view.width, view.height)
                            colors.forEach { color ->
                                if (android.graphics.Color.alpha(color) > 200 && android.graphics.Color.red(color) > 180 && android.graphics.Color.green(color) > 180) {
                                    if (android.graphics.Color.blue(color) > 180) white++
                                    if (android.graphics.Color.blue(color) < 80) yellow++
                                }
                            }
                        } finally { bitmap.recycle() }
                    }
                    return white to yellow
                }
                choose("White with outline")
                choose("Small captions")
                val small = pixels().first
                check(small > 0) { "Native renderer produced no white caption pixels" }
                choose("Large captions")
                val large = pixels().first
                check(large > small * 1.3) { "Caption size did not change rendered glyph area: $small -> $large" }
                choose("Yellow on black")
                val yellow = pixels()
                check(yellow.second > 0 && yellow.first == 0) { "Selected caption color did not reach native rendered glyphs" }
                choose("Use device captions")
                runOnMainSync {
                    check(PlaybackActivity::class.java.getDeclaredMethod("getCaptionSize").apply { isAccessible = true }
                        .invoke(requireNotNull(playback)) == com.reelos.ui.CaptionSize.DEVICE)
                    check(PlaybackActivity::class.java.getDeclaredMethod("getCaptionStyle").apply { isAccessible = true }
                        .invoke(requireNotNull(playback)) == com.reelos.ui.CaptionStyle.DEVICE)
                    player(requireNotNull(playback)).play()
                }
            }
            checkCase("native-subtitles-off") {
                openControl(androidx.media3.ui.R.id.exo_subtitle)
                clickLabel(getTargetContext().getString(androidx.media3.ui.R.string.exo_track_selection_none))
                waitFor("subtitles disabled and cues cleared") {
                    var off = false
                    runOnMainSync { off = tracksOf(C.TRACK_TYPE_TEXT).none { it.isSelected } && player(requireNotNull(playback)).currentCues.cues.isEmpty() }
                    off
                }
            }
            fun sleepTimer() = PlaybackActivity::class.java.getDeclaredField("sleepTimer")
                .apply { isAccessible = true }.get(requireNotNull(playback)) as com.reelos.core.PlaybackSleepTimer
            checkCase("native-sleep-controls-and-cancel") {
                runOnMainSync { playerView(requireNotNull(playback)).showController() }
                clickLabel("Sleep · Off")
                clickLabel("15 minutes")
                runOnMainSync {
                    val remaining = requireNotNull(sleepTimer().state?.deadlineMs) - SystemClock.elapsedRealtime()
                    check(remaining in 850_000L..900_000L)
                }
                clickLabel("Sleep · 15 min")
                clickLabel("Off")
                runOnMainSync { check(sleepTimer().state == null) }
            }
            checkCase("native-sleep-pauses-and-saves") {
                runOnMainSync {
                    player(requireNotNull(playback)).seekTo(5_000)
                    player(requireNotNull(playback)).play()
                }
                waitFor("playing before sleep") {
                    var playing = false
                    runOnMainSync { playing = player(requireNotNull(playback)).isPlaying }
                    playing
                }
                // Accelerated deadline exercises the production loop, not a 15-minute wall-clock claim.
                runOnMainSync { sleepTimer().after(400) }
                waitFor("sleep pauses and releases screen wake") {
                    var asleep = false
                    runOnMainSync {
                        val current = requireNotNull(playback)
                        asleep = !player(current).playWhenReady && !playerView(current).keepScreenOn && sleepTimer().state == null
                    }
                    asleep
                }
                check((load().snapshot.activeProfile?.playbackPositionsMs?.get(trackId) ?: 0) >= 5_000)
                runOnMainSync { player(requireNotNull(playback)).play() }
                waitFor("manual resume after sleep") {
                    var playing = false
                    runOnMainSync { playing = player(requireNotNull(playback)).isPlaying }
                    playing
                }
            }
            val closing = requireNotNull(playback)
            runOnMainSync { closing.finish() }
            waitFor("track player destroyed") { closing.isDestroyed }
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
