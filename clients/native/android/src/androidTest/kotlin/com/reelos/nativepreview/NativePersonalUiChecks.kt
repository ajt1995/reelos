package com.reelos.nativepreview

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.net.Uri
import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Bundle
import android.os.SystemClock
import android.view.KeyEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.reelos.core.BrowsingDensity
import com.reelos.core.CoreState
import com.reelos.core.DeviceKind
import com.reelos.core.FileCoreStore
import com.reelos.core.MotionMode
import com.reelos.core.OnboardingStep
import com.reelos.core.ReactionKind
import com.reelos.core.ReelCore
import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.util.ArrayDeque

/** Accessibility-driven checks in the isolated validation package; setup profiles are seeded via core. */
internal object NativePersonalUiChecks {
    private const val TARGET_PACKAGE = "com.reelos.nativepreview"

    fun run(host: Instrumentation, fresh: Boolean = false) {
        val results = Bundle()
        var passed = 0
        var main: Activity? = null
        var playback: Activity? = null
        var importedId: String? = null
        var authorized = false
        var failure: Throwable? = null
        val statePath = host.targetContext.filesDir.resolve("core.bin").toPath()
        val backupPath = host.targetContext.filesDir.resolve("personal-ui-baseline.core").toPath()
        val stateStore = FileCoreStore(statePath)
        val backupStore = FileCoreStore(backupPath)
        val importJournal = host.targetContext.filesDir.resolve("first-run-import.id")
        fun load() = ReelCore(stateStore, DeviceKind.ANDROID_PHONE)
        fun samePayload(left: CoreState, right: CoreState) =
            left.copy(revision = right.revision) == right
        fun restorePendingBaseline() {
            if (!Files.exists(backupPath)) return
            val baseline = backupStore.load()
            val current = stateStore.load()
            stateStore.save(baseline.copy(revision = Math.addExact(current.revision, 1L)))
            check(samePayload(stateStore.load(), baseline)) { "Baseline restore did not verify; backup retained" }
            Files.delete(backupPath)
        }
        fun cleanupPendingImport() {
            if (!importJournal.exists()) return
            val id = importJournal.readText()
            check(Regex("[0-9a-f]{64}").matches(id)) { "Invalid fixture cleanup journal; retained for recovery" }
            check(id !in stateStore.load().media) { "Fixture still referenced; restore baseline before cleanup" }
            val mappings = host.targetContext.getSharedPreferences("local-media", android.content.Context.MODE_PRIVATE)
            mappings.getString(id, null)?.let { uri ->
                LocalVideo.discardPrivateCopy(host.targetContext, Uri.parse(uri))
                check(mappings.edit().remove(id).commit())
            }
            check(importJournal.delete()) { "Fixture cleanup journal could not be removed" }
        }
        fun installIsolatedFixture() {
            check(!Files.exists(backupPath)) { "Previous baseline recovery is incomplete" }
            val baseline = stateStore.load()
            backupStore.save(baseline.copy(revision = 1L))
            check(samePayload(backupStore.load(), baseline)) { "Baseline backup did not verify" }
            // Only the validation package's profile view is narrowed. Source/media policy is retained.
            stateStore.save(
                baseline.copy(
                    revision = Math.addExact(baseline.revision, 1L),
                    profiles = emptyMap(),
                    activeProfileId = null,
                    sources = if (fresh) emptyMap() else baseline.sources,
                    media = if (fresh) emptyMap() else baseline.media,
                    requestedHomeId = if (fresh) null else baseline.requestedHomeId,
                ),
            )
            check(stateStore.load().profiles.isEmpty()) { "Fixture isolation did not verify" }
        }
        fun checkCase(name: String, block: () -> Unit) {
            host.sendStatus(0, Bundle().apply { putString("stream", "$name: started\n") })
            block()
            passed++
            results.putString(name, "passed")
            host.sendStatus(0, Bundle().apply { putString("stream", "$name: passed\n") })
        }
        fun waitFor(label: String, ready: () -> Boolean) {
            val deadline = SystemClock.elapsedRealtime() + 8_000
            while (SystemClock.elapsedRealtime() < deadline) {
                if (ready()) return
                SystemClock.sleep(100)
            }
            error("Timed out waiting for $label")
        }
        data class Page(
            val matches: List<AccessibilityNodeInfo>,
            val scrollables: List<AccessibilityNodeInfo>,
            val labels: List<String>,
            val navigation: List<String>,
        )
        var lastLabels: List<String> = emptyList()
        var lastNavigation = "No navigation attempted"
        fun page(label: String): Page {
            // Compose can advance visually while UiAutomation retains a previous window subtree.
            // API 34 exposes an explicit cache refresh; earlier devices refresh individual nodes.
            if (android.os.Build.VERSION.SDK_INT >= 34) host.uiAutomation.clearCache()
            val root = host.uiAutomation.rootInActiveWindow
                ?: return Page(emptyList(), emptyList(), emptyList(), listOf("No active window root"))
            val windowPackage = root.packageName?.toString()
            check(windowPackage == TARGET_PACKAGE) {
                "Refused active window package $windowPackage; expected $TARGET_PACKAGE"
            }
            val queue = ArrayDeque<AccessibilityNodeInfo>()
            queue.add(root)
            val matches = ArrayList<AccessibilityNodeInfo>()
            val scrollables = ArrayList<AccessibilityNodeInfo>()
            val labels = LinkedHashSet<String>()
            val navigation = ArrayList<String>()
            val scrollActions = setOf(
                AccessibilityNodeInfo.ACTION_SCROLL_FORWARD,
                AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD,
                AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_DOWN.id,
                AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_UP.id,
                AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_LEFT.id,
                AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_RIGHT.id,
            )
            var inspected = 0
            while (queue.isNotEmpty() && inspected++ < 700) {
                val node = queue.removeFirst()
                if (android.os.Build.VERSION.SDK_INT < 34 && !node.refresh()) continue
                val text = node.text?.toString() ?: node.contentDescription?.toString() ?: node.paneTitle?.toString().orEmpty()
                val actions = node.actionList.map { it.id }
                val bounds = Rect().also(node::getBoundsInScreen)
                if (node.isVisibleToUser) {
                    // Native dialog themes may capitalize button labels; match the whole label, never substrings.
                    if (text.equals(label, ignoreCase = true) || (label == "__editable__" && node.isEditable)) matches += node
                    if (text.isNotBlank() && labels.size < 24) labels += text.replace('\n', ' ').take(80)
                }
                // Compose can report the LazyColumn ancestor as not visible while its children are.
                if (!bounds.isEmpty() && (node.isScrollable || actions.any(scrollActions::contains))) {
                    scrollables += node
                    if (navigation.size < 16) {
                        navigation += "class=${node.className} bounds=$bounds visible=${node.isVisibleToUser} " +
                            "scrollable=${node.isScrollable} actions=${actions.joinToString(",")}"
                    }
                }
                for (index in 0 until node.childCount) node.getChild(index)?.let(queue::add)
            }
            lastLabels = labels.toList()
            if (navigation.isEmpty()) navigation += "No scroll node or scroll action among $inspected nodes"
            return Page(matches, scrollables, lastLabels, navigation)
        }
        fun clickable(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
            var current: AccessibilityNodeInfo? = node
            repeat(12) {
                if (current?.isClickable == true && current?.isEnabled == true) return current
                current = current?.parent
            }
            return null
        }
        fun seek(label: String, needsClick: Boolean, deadline: Long): AccessibilityNodeInfo? {
            var forward = true
            var scrollSteps = 0
            var dpadSteps = 0
            var accepted = 0
            var rejected = 0
            fun scroll(current: Page): Boolean {
                val vertical = if (forward) AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_DOWN.id
                    else AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_UP.id
                val generic = if (forward) AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
                    else AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
                val horizontal = setOf(
                    AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_LEFT.id,
                    AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_RIGHT.id,
                )
                val ordered = current.scrollables.sortedByDescending { node ->
                    Rect().also(node::getBoundsInScreen).let { it.width().toLong() * it.height() }
                }
                for (node in ordered) {
                    val actions = node.actionList.map { it.id }.toSet()
                    val action = when {
                        vertical in actions -> vertical
                        generic in actions && actions.none(horizontal::contains) -> generic
                        actions.isEmpty() && node.isScrollable -> generic
                        else -> continue
                    }
                    if (node.performAction(action)) { accepted++; return true }
                    rejected++
                }
                return false
            }
            while (SystemClock.elapsedRealtime() < deadline) {
                val current = page(label)
                // A language query can equal its result label; activate the result, not the editable field.
                val target = if (needsClick) current.matches.filterNot { it.isEditable }.firstNotNullOfOrNull { clickable(it) }
                    else current.matches.firstOrNull()
                if (target != null) return target
                val moved = scrollSteps < 12 && scroll(current)
                if (moved) {
                    scrollSteps++
                } else if (dpadSteps < 18) {
                    host.sendKeyDownUpSync(if (forward) KeyEvent.KEYCODE_DPAD_DOWN else KeyEvent.KEYCODE_DPAD_UP)
                    dpadSteps++
                } else if (forward) {
                    forward = false
                    scrollSteps = 0
                    dpadSteps = 0
                } else break
                lastNavigation = "direction=${if (forward) "down" else "up"} " +
                    "scrollAccepted=$accepted scrollRejected=$rejected scrollSteps=$scrollSteps dpadSteps=$dpadSteps"
                SystemClock.sleep(if (moved) 140 else 100)
            }
            return null
        }
        fun click(label: String) {
            host.sendStatus(0, Bundle().apply { putString("stream", "UI action: $label\n") })
            val deadline = SystemClock.elapsedRealtime() + 8_000
            while (SystemClock.elapsedRealtime() < deadline) {
                val target = seek(label, true, deadline) ?: break
                target.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SHOW_ON_SCREEN.id)
                if (target.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                    // Living artwork need not make the main queue idle. Never wait without a deadline.
                    runCatching { host.uiAutomation.waitForIdle(150, 2_000) }
                    return
                }
                SystemClock.sleep(100)
            }
            error("Timed out finding exact clickable '$label'; $lastNavigation; visible: ${lastLabels.joinToString(" | ").take(500)}")
        }
        fun visible(label: String) {
            if (seek(label, false, SystemClock.elapsedRealtime() + 8_000) == null) {
                error("Timed out finding exact visible '$label'; $lastNavigation; visible: ${lastLabels.joinToString(" | ").take(500)}")
            }
        }
        fun launch(): Activity {
            val intent = Intent(host.targetContext, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            val monitor = host.addMonitor(MainActivity::class.java.name, null, false)
            try {
                host.targetContext.startActivity(intent)
                val activity = monitor.waitForActivityWithTimeout(15_000) ?: error("Main activity did not start")
                main = activity // Cleanup owns the activity even if its foreground wait fails.
                // onCreate can precede the foreground window, particularly after a TV restart.
                // Observe without sending input until the native target actually owns that window.
                waitFor("native foreground window") {
                    host.uiAutomation.rootInActiveWindow?.packageName?.toString() == TARGET_PACKAGE
                }
                return activity
            } finally { host.removeMonitor(monitor) }
        }
        fun restart() {
            val closing = requireNotNull(main)
            host.runOnMainSync { closing.finish() }
            waitFor("activity destroyed") { closing.isDestroyed }
            main = launch()
        }
        fun runFreshJourney() {
            val name = "First Run ${System.currentTimeMillis().toString(36)}"
            main = launch()
            checkCase("fresh-identity-and-back") {
                visible("What should we call you?")
                check(load().snapshot.profiles.isEmpty())
                val field = requireNotNull(seek("__editable__", false, SystemClock.elapsedRealtime() + 8_000))
                check(field.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply {
                    putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, name)
                })) { "Native name field did not accept text" }
                // ACTION_SET_TEXT acknowledges dispatch, not Compose state publication.
                waitFor("name visible before submission") {
                    page("__editable__").matches.any { it.text?.toString() == name }
                }
                click("Continue")
                visible("Make it yours, $name.")
                click("Back")
                visible("What should we call you?")
                visible(name)
                check(load().snapshot.activeProfile?.onboardingStep == OnboardingStep.IDENTITY)
                restart()
                visible(name)
                click("Continue")
                visible("Make it yours, $name.")
            }
            checkCase("fresh-color-and-guidance") {
                click("Blue")
                visible("Blue · selected")
                click("Continue")
                visible("Your way to discover.")
                click("I'll find my way")
                click("Continue")
                visible("What pulls you in?")
                check(load().snapshot.activeProfile?.let {
                    it.color == "#376FE4" && it.guidance == com.reelos.core.GuidanceLevel.INDEPENDENT
                } == true)
            }
            checkCase("fresh-taste-and-restart") {
                click("Dune: Part Two")
                click("Dune: Part Two")
                waitFor("Love persisted") {
                    load().snapshot.activeProfile?.positiveReactions?.get("tmdb-movie-693134") == ReactionKind.LOVE
                }
                restart()
                visible("What pulls you in?")
                check(load().snapshot.activeProfile?.onboardingStep == OnboardingStep.TASTE)
                click("Continue")
                visible("Bring your collection.")
            }
            checkCase("fresh-standalone-and-empty-home") {
                click("Continue")
                visible("Your own space.")
                click("Continue on this device")
                visible("Welcome back, $name.")
                visible("No titles yet. Add personal media to begin.")
                val state = load().snapshot
                check(state.activeProfile?.onboardingStep == OnboardingStep.COMPLETE)
                check(state.requestedHomeId == null && state.media.isEmpty())
            }
            checkCase("fresh-completed-restart") {
                restart()
                visible("Welcome back, $name.")
                check(load().snapshot.profiles.size == 1)
                check(load().snapshot.activeProfile?.positiveReactions?.get("tmdb-movie-693134") == ReactionKind.LOVE)
            }
            // Unique URI prevents replacement/deletion of an earlier validation import's retained bytes.
            val uri = Uri.parse("content://com.reelos.nativepreview.test.fixture/valid?run=${System.nanoTime()}")
            importedId = java.security.MessageDigest.getInstance("SHA-256").digest(uri.toString().toByteArray())
                .joinToString("") { "%02x".format(it) }
            check(!importJournal.exists())
            check(importedId !in load().snapshot.media)
            check(!host.targetContext.getSharedPreferences("local-media", android.content.Context.MODE_PRIVATE).contains(importedId))
            FileOutputStream(importJournal).use {
                it.write(requireNotNull(importedId).toByteArray(Charsets.UTF_8))
                it.fd.sync()
            }
            fun offerVideo() {
                host.targetContext.startActivity(Intent(host.targetContext, MainActivity::class.java)
                    .setAction(Intent.ACTION_VIEW).setData(uri)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP))
                visible("Add this video?")
            }
            checkCase("fresh-import-requires-confirmation") {
                offerVideo()
                check(load().snapshot.media.isEmpty())
                click("Cancel")
                check(load().snapshot.media.isEmpty())
            }
            checkCase("fresh-confirmed-import-and-save") {
                offerVideo()
                click("Add video")
                waitFor("verified import") { load().snapshot.media.containsKey(importedId) }
                visible("Native-Validation-30s.mp4")
                click("Save")
                waitFor("saved title") { load().snapshot.activeProfile?.savedMediaIds?.contains(importedId) == true }
                click("Library")
                visible("Native-Validation-30s.mp4")
            }
            checkCase("fresh-ui-playback-and-return") {
                val monitor = host.addMonitor(PlaybackActivity::class.java.name, null, false)
                try {
                    click("Play")
                    playback = monitor.waitForActivityWithTimeout(15_000) ?: error("Play did not open native player")
                } finally { host.removeMonitor(monitor) }
                waitFor("decoded video frame") {
                    var rendered = false
                    host.runOnMainSync {
                        rendered = PlaybackActivity::class.java.getDeclaredField("hasRenderedFrame")
                            .apply { isAccessible = true }.getBoolean(playback)
                    }
                    rendered
                }
                SystemClock.sleep(1_800)
                host.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK)
                waitFor("player closed") { requireNotNull(playback).isDestroyed }
                waitFor("private progress saved") {
                    (load().snapshot.activeProfile?.playbackPositionsMs?.get(importedId) ?: 0) > 0
                }
                visible("Native-Validation-30s.mp4")
            }
            checkCase("fresh-ui-resume") {
                val saved = requireNotNull(load().snapshot.activeProfile?.playbackPositionsMs?.get(importedId))
                check(saved > 0)
                val monitor = host.addMonitor(PlaybackActivity::class.java.name, null, false)
                try {
                    click("Resume")
                    playback = monitor.waitForActivityWithTimeout(15_000) ?: error("Resume did not open native player")
                } finally { host.removeMonitor(monitor) }
                waitFor("resumed position and frame") {
                    var resumed = false
                    host.runOnMainSync {
                        val rendered = PlaybackActivity::class.java.getDeclaredField("hasRenderedFrame")
                            .apply { isAccessible = true }.getBoolean(playback)
                        val player = PlaybackActivity::class.java.getDeclaredField("player")
                            .apply { isAccessible = true }.get(playback) as? androidx.media3.exoplayer.ExoPlayer
                        resumed = rendered && player != null && player.currentPosition >= saved
                    }
                    resumed
                }
            }
        }
        try {
            check(host.targetContext.packageName == TARGET_PACKAGE &&
                MainActivity::class.java.name == "$TARGET_PACKAGE.MainActivity") {
                "Personal UI fixture refused non-validation package"
            }
            if (Files.exists(backupPath)) {
                val interrupted = stateStore.load()
                val retained = statePath.resolveSibling("personal-ui-interrupted-${System.currentTimeMillis()}.core")
                val retainedStore = FileCoreStore(retained)
                retainedStore.save(interrupted.copy(revision = 1L))
                check(samePayload(retainedStore.load(), interrupted)) { "Interrupted state recovery copy failed" }
                host.sendStatus(0, Bundle().apply { putString("stream", "Retained interrupted validation state at ${retained.fileName}\n") })
            }
            authorized = true // Never restore over intervening state unless its recovery copy verified.
            restorePendingBaseline()
            cleanupPendingImport()
            installIsolatedFixture()
            if (fresh) {
                runFreshJourney()
            } else {
            val nonce = System.currentTimeMillis().toString(36)
            val prefix = "personal-ui-$nonce"
            val aName = "Personal A $nonce"
            val bName = "Personal B $nonce"
            val setupName = "Personal setup $nonce"
            val a = "$prefix-a"
            val b = "$prefix-b"
            val setup = "$prefix-setup"
            val core = load()
            fun complete(id: String, name: String) {
                core.createProfile(id, name)
                core.setColor(id, "#376FE4")
                core.acknowledgeCurator(id)
                core.finishTaste(id)
                core.confirmDefaultSources(id)
                core.chooseHome(id, null)
            }
            complete(a, aName)
            complete(b, bName)
            core.createProfile(setup, setupName)
            core.setColor(setup, "#376FE4")
            core.acknowledgeCurator(setup)
            core.selectProfile(a)
            main = launch()

            checkCase("personal-appearance-controls") {
                click(aName)
                visible("Tune your taste")
                click("Appearance · you")
                click("Still")
                waitFor("Still persisted") { load().snapshot.profiles[a]?.motionMode == MotionMode.STILL }
                click("Expressive")
                click("Compact")
                click("Transparency · on")
                waitFor("appearance persisted") {
                    load().snapshot.profiles[a]?.let {
                        it.motionMode == MotionMode.EXPRESSIVE &&
                            it.browsingDensity == BrowsingDensity.COMPACT && !it.transparencyEnabled
                    } == true
                }
            }
            checkCase("personal-playback-preferences") {
                click("Close appearance")
                click("Playback · you")
                click("Audio · Automatic")
                val edit = requireNotNull(seek("__editable__", false, SystemClock.elapsedRealtime() + 8_000)) {
                    "Language search did not become accessible"
                }
                check(edit.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, Bundle().apply {
                    putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "Spanish")
                }))
                click("Spanish")
                waitFor("Spanish audio default persisted") {
                    load().snapshot.profiles[a]?.playbackPreferences?.audioLanguage == "es"
                }
                click("Subtitles · Automatic")
                click("Off")
                waitFor("private playback defaults persisted") {
                    load().snapshot.profiles[a]?.playbackPreferences == com.reelos.core.PlaybackPreferences("es", null, com.reelos.core.SubtitleMode.OFF)
                }
                click("Close playback preferences")
            }
            checkCase("personal-taste-like-love") {
                click("Tune your taste")
                visible("What pulls you in?")
                click("Dune: Part Two")
                waitFor("Like persisted") { load().reactionFor(a, "tmdb-movie-693134") == ReactionKind.LIKE }
                click("Dune: Part Two")
                waitFor("Love persisted") { load().reactionFor(a, "tmdb-movie-693134") == ReactionKind.LOVE }
            }
            checkCase("personal-taste-cozy-reset-dismiss") {
                click("Cozy")
                waitFor("Cozy persisted") { load().reactionFor(a, "tmdb-movie-693134") == ReactionKind.COZY }
                click("Reset")
                waitFor("Reset persisted") { load().reactionFor(a, "tmdb-movie-693134") == null }
                click("Dune: Part Two")
                waitFor("Like before dismiss") { load().reactionFor(a, "tmdb-movie-693134") == ReactionKind.LIKE }
                click("Dismiss")
                waitFor("neutral Dismiss persisted") { load().reactionFor(a, "tmdb-movie-693134") == ReactionKind.DISMISS }
                click("Blade Runner 2049")
                click("Cozy")
                waitFor("second subject Cozy persisted") { load().reactionFor(a, "tmdb-movie-335984") == ReactionKind.COZY }
            }
            checkCase("personal-taste-finish-and-reentry") {
                click("Done")
                visible("Tune your taste")
                visible("1 cozy")
                click("Tune your taste")
                visible("What pulls you in?")
                click("Done")
                check(load().reactionFor(a, "tmdb-movie-335984") == ReactionKind.COZY)
            }
            checkCase("personal-second-profile-isolation") {
                click("Switch person")
                waitFor("profile picker") { page("Choose a person").matches.isNotEmpty() }
                click(bName)
                waitFor("second profile selected") { load().snapshot.activeProfileId == b }
                visible("Welcome back, $bName.")
                click(bName)
                waitFor("second personal view") { page("Your profile").matches.isNotEmpty() }
                visible("0 cozy")
                check(load().snapshot.profiles[b]?.let {
                    it.motionMode == MotionMode.SUBTLE &&
                        it.browsingDensity == BrowsingDensity.COMFORTABLE &&
                        it.transparencyEnabled && it.positiveReactions.isEmpty() && it.playbackPreferences == com.reelos.core.PlaybackPreferences()
                } == true)
                click("Switch person")
                waitFor("return profile picker") { page("Choose a person").matches.isNotEmpty() }
                click(aName)
                waitFor("first profile selected") { load().snapshot.activeProfileId == a }
                visible("Welcome back, $aName.")
                click(aName)
                visible("1 cozy")
            }
            checkCase("personal-restart-persistence") {
                val closing = requireNotNull(main)
                host.runOnMainSync { closing.finish() }
                waitFor("activity destroyed") { closing.isDestroyed }
                main = launch()
                click(aName)
                click("Appearance · you")
                visible("Transparency · off")
                check(load().snapshot.profiles[a]?.let {
                    it.motionMode == MotionMode.EXPRESSIVE &&
                        it.browsingDensity == BrowsingDensity.COMPACT &&
                        !it.transparencyEnabled &&
                        it.dismissedIds.contains("tmdb-movie-693134") &&
                        it.positiveReactions["tmdb-movie-335984"] == ReactionKind.COZY &&
                        it.playbackPreferences == com.reelos.core.PlaybackPreferences("es", null, com.reelos.core.SubtitleMode.OFF)
                } == true)
                runCatching {
                    val screenshot = host.uiAutomation.takeScreenshot() ?: error("No screenshot")
                    val directory = host.targetContext.getExternalFilesDir(null) ?: host.targetContext.filesDir
                    val file = File(directory, "personal-ui.png")
                    FileOutputStream(file).use { check(screenshot.compress(Bitmap.CompressFormat.PNG, 100, it)) }
                    screenshot.recycle()
                    results.putString("screenshot", file.absolutePath)
                }
            }
            checkCase("personal-setup-finish") {
                click("Switch person")
                click(setupName)
                visible("What pulls you in?")
                click("Continue")
                waitFor("taste completion persisted") {
                    load().snapshot.profiles[setup]?.onboardingStep == OnboardingStep.SOURCES
                }
                visible("Bring your collection.")
            }
            }
        } catch (caught: Throwable) {
            failure = caught
            val directory = host.targetContext.getExternalFilesDir(null) ?: host.targetContext.filesDir
            runCatching {
                val labels = page("").labels.joinToString(" | ").take(700)
                val diagnostic = File(directory, "personal-ui-failure.txt")
                val navigation = page("").navigation.joinToString("\n")
                diagnostic.writeText(
                    "${caught.javaClass.simpleName}: ${caught.message}\nVisible: $labels\n" +
                        "Traversal: $lastNavigation\nScroll nodes:\n$navigation\n"
                )
                results.putString("failureDiagnostics", diagnostic.absolutePath)
                results.putString("visibleLabels", labels)
                results.putString("navigation", lastNavigation)
            }
            runCatching {
                val screenshot = host.uiAutomation.takeScreenshot() ?: error("No failure screenshot")
                val file = File(directory, "personal-ui-failure.png")
                FileOutputStream(file).use { check(screenshot.compress(Bitmap.CompressFormat.PNG, 100, it)) }
                screenshot.recycle()
                results.putString("failureScreenshot", file.absolutePath)
            }
        } finally {
            if (authorized) {
                runCatching {
                    playback?.let { closing ->
                        if (!closing.isDestroyed) host.runOnMainSync { closing.finish() }
                        waitFor("player destroyed before baseline restore") { closing.isDestroyed }
                    }
                    main?.let { closing ->
                        waitFor("import idle before baseline restore") {
                            var running = false
                            host.runOnMainSync {
                                running = MainActivity::class.java.getDeclaredField("importRunning")
                                    .apply { isAccessible = true }.getBoolean(closing)
                            }
                            !running
                        }
                        if (!closing.isDestroyed) host.runOnMainSync { closing.finish() }
                        waitFor("activity destroyed before baseline restore") { closing.isDestroyed }
                    }
                    restorePendingBaseline()
                    cleanupPendingImport()
                }.onFailure { cleanup ->
                    if (failure == null) failure = cleanup else failure?.addSuppressed(cleanup)
                }
            }
        }
        results.putInt("passed", passed)
        if (failure == null) {
            val scope = if (fresh) "Empty-profile native first run and confirmed local fixture playback; not full Family/provider/audio/artwork acceptance."
                else "Seeded validation-profile journey, not fresh onboarding or whole-product acceptance."
            results.putString("stream", "Native UI checks: $passed passed; no skips. $scope\n")
            host.finish(Activity.RESULT_OK, results)
        } else {
            val causes = generateSequence(failure) { it.cause }.take(6)
                .joinToString(" -> ") { "${it.javaClass.simpleName}: ${it.message}" }
            val nodes = runCatching { page("").navigation.joinToString(" | ").take(1_200) }
                .getOrDefault("Accessibility snapshot unavailable")
            results.putString(
                "stream",
                "Native personal UI checks FAILED after $passed passed: $causes\n" +
                    "Navigation: $lastNavigation\nScroll nodes: $nodes\n",
            )
            host.finish(Activity.RESULT_CANCELED, results)
        }
    }
}
