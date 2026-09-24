package com.reelos.core

import java.io.DataOutputStream
import java.nio.file.Files
import java.util.ConcurrentModificationException
import kotlin.test.*

class PlaybackPreferencesTest {
    @Test fun preferencesAreProfilePrivateAndPersistAcrossHosts() {
        val directory = Files.createTempDirectory("reelos-language-test-")
        val path = directory.resolve("core.bin")
        try {
            val core = ReelCore(FileCoreStore(path), DeviceKind.WINDOWS)
            core.createProfile("a", "A"); core.createProfile("b", "B")
            val stale = ReelCore(FileCoreStore(path), DeviceKind.LINUX)
            core.setPlaybackPreferences("a", PlaybackPreferences("spa", "eng", SubtitleMode.ON,
                CaptionSizePreference.LARGE, CaptionStylePreference.YELLOW))
            val reopened = ReelCore(FileCoreStore(path), DeviceKind.ANDROID_TV)
            assertEquals(PlaybackPreferences("es", "en", SubtitleMode.ON,
                CaptionSizePreference.LARGE, CaptionStylePreference.YELLOW), reopened.snapshot.profiles.getValue("a").playbackPreferences)
            assertEquals(PlaybackPreferences(), reopened.snapshot.profiles.getValue("b").playbackPreferences)
            assertFailsWith<ConcurrentModificationException> { stale.setPlaybackPreferences("a", PlaybackPreferences()) }
            assertEquals(PlaybackPreferences(), stale.snapshot.profiles.getValue("a").playbackPreferences)
            reopened.setPlaybackPreferences("a", PlaybackPreferences(subtitleMode = SubtitleMode.OFF))
            assertEquals(SubtitleMode.OFF, FileCoreStore(path).load().profiles.getValue("a").playbackPreferences.subtitleMode)
        } finally {
            Files.deleteIfExists(path); Files.deleteIfExists(directory.resolve("core.bin.lock")); Files.delete(directory)
        }
    }

    @Test fun versionFiveMigratesDefaultsWithoutChangingAccessGenerations() {
        val directory = Files.createTempDirectory("reelos-language-migration-")
        val path = directory.resolve("core.bin")
        try {
            DataOutputStream(Files.newOutputStream(path)).use { out ->
                out.writeInt(0x52454F53); out.writeInt(5); out.writeLong(7)
                out.writeInt(1); out.writeUTF("a"); out.writeUTF("A"); out.writeUTF("#7357A6")
                out.writeUTF("COMPLETE"); out.writeUTF("BALANCED"); repeat(7) { out.writeInt(0) }
                out.writeUTF("STILL"); out.writeUTF("COMPACT"); out.writeBoolean(false)
                out.writeBoolean(true); out.writeUTF("a"); out.writeBoolean(false)
                out.writeInt(0); out.writeInt(0); out.writeBoolean(false)
                out.writeInt(1); out.writeUTF("source:personal"); out.writeLong(4)
            }
            val state = FileCoreStore(path).load()
            assertEquals(CORE_SCHEMA_VERSION, state.schemaVersion)
            assertEquals(PlaybackPreferences(), state.activeProfile!!.playbackPreferences)
            assertEquals(MotionMode.STILL, state.activeProfile!!.motionMode)
            assertEquals(4L, state.playbackEpochs["source:personal"])
            assertEquals(7L, state.revision)
        } finally { Files.deleteIfExists(path); Files.delete(directory) }
    }

    @Test fun invalidLanguageCannotPublishAndRegionalTagsNormalize() {
        val core = ReelCore(MemoryCoreStore(), DeviceKind.WINDOWS)
        core.createProfile("a", "A")
        val before = core.snapshot
        listOf("", "und", "en\n:bad", "https://bad", "en-US-extra_thing").forEach { invalid ->
            assertFailsWith<IllegalArgumentException> { core.setPlaybackPreferences("a", PlaybackPreferences(invalid)) }
        }
        assertEquals(before, core.snapshot)
        core.setPlaybackPreferences("a", PlaybackPreferences("EN-us"))
        assertEquals("en-US", core.snapshot.activeProfile!!.playbackPreferences.audioLanguage)
        assertTrue(playbackLanguageMatches("en-US", "eng"))
        assertFalse(playbackLanguageMatches("en", "spa"))
        assertFalse(playbackLanguageMatches(null, "eng"))
    }

    @Test fun versionSixKeepsLanguageAndIntroducesDeviceCaptionDefaults() {
        val directory = Files.createTempDirectory("reelos-caption-migration-")
        val path = directory.resolve("core.bin")
        try {
            DataOutputStream(Files.newOutputStream(path)).use { out ->
                out.writeInt(0x52454F53); out.writeInt(6); out.writeLong(12)
                out.writeInt(1); out.writeUTF("a"); out.writeUTF("A"); out.writeUTF("#7357A6")
                out.writeUTF("COMPLETE"); out.writeUTF("BALANCED"); repeat(7) { out.writeInt(0) }
                out.writeUTF("SUBTLE"); out.writeUTF("COMFORTABLE"); out.writeBoolean(true)
                out.writeBoolean(true); out.writeUTF("es"); out.writeBoolean(true); out.writeUTF("en"); out.writeUTF("OFF")
                out.writeBoolean(true); out.writeUTF("a"); out.writeBoolean(false)
                out.writeInt(0); out.writeInt(0); out.writeBoolean(false); out.writeInt(0)
            }
            val core = ReelCore(FileCoreStore(path), DeviceKind.LINUX)
            assertEquals(12L, core.snapshot.revision)
            assertEquals(PlaybackPreferences("es", "en", SubtitleMode.OFF), core.snapshot.activeProfile!!.playbackPreferences)
            core.setPlaybackPreferences("a", core.snapshot.activeProfile!!.playbackPreferences.copy(captionStyle = CaptionStylePreference.BOXED))
            val reread = FileCoreStore(path).load()
            assertEquals(7, reread.schemaVersion)
            assertEquals(PlaybackPreferences("es", "en", SubtitleMode.OFF, captionStyle = CaptionStylePreference.BOXED), reread.activeProfile!!.playbackPreferences)
        } finally { Files.deleteIfExists(path); Files.deleteIfExists(directory.resolve("core.bin.lock")); Files.delete(directory) }
    }

    @Test fun captionEditsPreserveLanguageAndRejectDepartedPlaybackProfile() {
        val initial = CoreState(
            profiles = mapOf("a" to ProfileState("a", "A", onboardingStep = OnboardingStep.COMPLETE,
                playbackPreferences = PlaybackPreferences("es", "en", SubtitleMode.ON)),
                "b" to ProfileState("b", "B", onboardingStep = OnboardingStep.COMPLETE)),
            activeProfileId = "a",
            sources = mapOf("local" to SourceRecord("local", SourceKind.OPTIONAL_ADAPTER, SourceStatus.AVAILABLE)),
            media = mapOf("film" to MediaRecord("film", "Film", "local", MediaAvailability.READY)))
        val core = ReelCore(MemoryCoreStore(initial), DeviceKind.WINDOWS)
        val session = LocalPlaybackSession.open(core.snapshot, "film")
        core.setCaptionAppearance(session, CaptionSizePreference.LARGE, CaptionStylePreference.YELLOW)
        assertTrue(session.isAllowed(core.snapshot))
        assertEquals(PlaybackPreferences("es", "en", SubtitleMode.ON, CaptionSizePreference.LARGE, CaptionStylePreference.YELLOW), core.snapshot.activeProfile!!.playbackPreferences)
        core.setCaptionAppearance(session, CaptionSizePreference.DEVICE, CaptionStylePreference.DEVICE)
        assertEquals(initial.activeProfile!!.playbackPreferences, core.snapshot.activeProfile!!.playbackPreferences)
        core.selectProfile("b")
        val before = core.snapshot
        assertFailsWith<IllegalStateException> { core.setCaptionAppearance(session, CaptionSizePreference.SMALL, CaptionStylePreference.BOXED) }
        assertEquals(before, core.snapshot)
        assertEquals(PlaybackPreferences(), core.snapshot.activeProfile!!.playbackPreferences)
        core.selectProfile("a")
        assertFailsWith<IllegalStateException> { core.setCaptionAppearance(session, CaptionSizePreference.SMALL, CaptionStylePreference.BOXED) }
    }
}
