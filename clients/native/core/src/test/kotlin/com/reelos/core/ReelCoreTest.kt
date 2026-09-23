package com.reelos.core

import java.nio.file.Files
import java.io.DataOutputStream
import java.util.ConcurrentModificationException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ReelCoreTest {
    @Test
    fun onboardingResumesWithInputAndAllowsStandaloneHome() = withFileStore { path ->
        val core = ReelCore(FileCoreStore(path), DeviceKind.LINUX)
        core.createProfile("ada")
        assertFalse(core.canEnterHome("ada"))
        core.setName("ada", "Ada")
        core.setColor("ada", "#123abc")
        core.acknowledgeCurator("ada", GuidanceLevel.INDEPENDENT)
        core.setTasteSeeds("ada", setOf("Quiet mysteries"))
        core.back("ada")

        val resumed = ReelCore(FileCoreStore(path), DeviceKind.LINUX)
        assertEquals(OnboardingStep.TASTE, resumed.snapshot.activeProfile?.onboardingStep)
        assertEquals("Ada", resumed.snapshot.activeProfile?.name)
        assertEquals("#123ABC", resumed.snapshot.activeProfile?.color)
        assertEquals(setOf("Quiet mysteries"), resumed.snapshot.activeProfile?.tasteSeeds)
        assertEquals(GuidanceLevel.INDEPENDENT, resumed.snapshot.activeProfile?.guidance)
        assertFalse(resumed.canEnterHome("ada"))

        resumed.setTasteSeeds("ada", setOf("Quiet mysteries"))
        resumed.confirmDefaultSources("ada")
        resumed.chooseHome("ada", null)
        assertTrue(ReelCore(FileCoreStore(path), DeviceKind.LINUX).canEnterHome("ada"))
        assertNull(resumed.snapshot.requestedHomeId)
    }

    @Test
    fun profilesKeepReactionsSavesAndProgressSeparateAcrossReload() = withFileStore { path ->
        val core = ReelCore(FileCoreStore(path), DeviceKind.WINDOWS)
        core.createProfile("ada")
        core.createProfile("bea")
        core.setReaction("ada", "film", ReactionKind.LOVE)
        core.setReaction("bea", "film", ReactionKind.DISMISS)
        core.save("ada", "film", true)
        core.setPlaybackPosition("ada", "film", 45_000)
        core.setReadingPosition("bea", "book", "chapter:2")

        val resumed = ReelCore(FileCoreStore(path), DeviceKind.ANDROID_PHONE)
        assertEquals(ReactionKind.LOVE, resumed.reactionFor("ada", "film"))
        assertEquals(ReactionKind.DISMISS, resumed.reactionFor("bea", "film"))
        assertEquals(45_000, resumed.snapshot.profiles.getValue("ada").playbackPositionsMs["film"])
        assertTrue("film" in resumed.snapshot.profiles.getValue("ada").savedMediaIds)
        assertFalse("film" in resumed.snapshot.profiles.getValue("bea").savedMediaIds)
        assertEquals("chapter:2", resumed.snapshot.profiles.getValue("bea").readingPositions["book"])
        assertNull(resumed.snapshot.profiles.getValue("bea").playbackPositionsMs["film"])
    }

    @Test
    fun reactionKindsAreDistinctAndReversible() {
        val core = ReelCore(MemoryCoreStore(), DeviceKind.ANDROID_TABLET)
        core.createProfile("ada")
        for (kind in ReactionKind.entries) {
            core.setReaction("ada", "film", kind)
            assertEquals(kind, core.reactionFor("ada", "film"))
            val p = core.snapshot.profiles.getValue("ada")
            assertEquals(kind == ReactionKind.DISMISS, "film" in p.dismissedIds)
            assertEquals(kind == ReactionKind.LESS, "film" in p.lessLikeIds)
            assertEquals(kind in setOf(ReactionKind.LIKE, ReactionKind.LOVE, ReactionKind.COZY), "film" in p.positiveReactions)
            core.setReaction("ada", "film", null)
            assertNull(core.reactionFor("ada", "film"))
        }
    }

    @Test
    fun metadataAndRevokedSourceCannotPlay() {
        val core = ReelCore(MemoryCoreStore(), DeviceKind.WINDOWS)
        core.putSource(SourceRecord("personal", SourceKind.PERSONAL, SourceStatus.AVAILABLE))
        core.putMedia(MediaRecord("film", "Film", "personal"))
        assertEquals(MediaAction.FIND, core.mediaAction("film"))
        core.putMedia(MediaRecord("film", "Film", "personal", MediaAvailability.READY))
        assertEquals(MediaAction.PLAY, core.mediaAction("film"))
        core.revokeSource("personal")
        assertEquals(MediaAction.UNAVAILABLE, core.mediaAction("film"))
        core.putMedia(MediaRecord("preparing", "Preparing", "personal", MediaAvailability.PREPARING))
        assertEquals(MediaAction.UNAVAILABLE, core.mediaAction("preparing"))
        core.putMedia(MediaRecord("other", "Other", null, MediaAvailability.READY))
        assertEquals(MediaAction.UNAVAILABLE, core.mediaAction("other"))
    }

    @Test
    fun optionalProviderBetaIsInstallWideAndNeverRestoresAccessByItself() = withFileStore { path ->
        val core = ReelCore(FileCoreStore(path), DeviceKind.WINDOWS)
        assertFalse(core.snapshot.optionalProviderBetaEnabled)
        assertFailsWith<IllegalArgumentException> {
            core.putOptionalSource("optional", SourceStatus.AVAILABLE)
        }
        core.putSource(SourceRecord("personal", SourceKind.PERSONAL, SourceStatus.AVAILABLE))
        core.putMedia(MediaRecord("own", "Own film", "personal", MediaAvailability.READY))
        core.createProfile("ada", "Ada")
        core.save("ada", "optional-film", true)
        core.setOptionalProviderBetaEnabled(true)
        core.putOptionalSource("optional", SourceStatus.AVAILABLE)
        core.putMedia(MediaRecord("optional-film", "Optional film", "optional", MediaAvailability.READY))
        assertEquals(MediaAction.PLAY, core.mediaAction("optional-film"))

        core.setOptionalProviderBetaEnabled(false)
        assertEquals(MediaAction.UNAVAILABLE, core.mediaAction("optional-film"))
        assertEquals(SourceStatus.UNAVAILABLE, core.snapshot.sources.getValue("optional").status)
        assertEquals(MediaAction.PLAY, core.mediaAction("own"))
        assertTrue("optional-film" in core.snapshot.activeProfile!!.savedMediaIds)
        assertTrue("optional-film" in core.snapshot.media)

        val restarted = ReelCore(FileCoreStore(path), DeviceKind.ANDROID_TV)
        assertFalse(restarted.snapshot.optionalProviderBetaEnabled)
        restarted.setOptionalProviderBetaEnabled(true)
        assertEquals(MediaAction.UNAVAILABLE, restarted.mediaAction("optional-film"))
        restarted.putOptionalSource("optional", SourceStatus.AVAILABLE)
        assertEquals(MediaAction.PLAY, restarted.mediaAction("optional-film"))
        assertTrue(ReelCore(FileCoreStore(path), DeviceKind.LINUX).snapshot.optionalProviderBetaEnabled)
    }

    @Test
    fun betaToggleRebasesAcrossPlaybackWriterWithoutLosingProgress() = withFileStore { path ->
        val settings = ReelCore(FileCoreStore(path), DeviceKind.WINDOWS)
        settings.createProfile("ada", "Ada")
        val playback = ReelCore(FileCoreStore(path), DeviceKind.WINDOWS)
        playback.setPlaybackPosition("ada", "film", 12_345)
        settings.setOptionalProviderBetaEnabled(true)
        assertTrue(settings.snapshot.optionalProviderBetaEnabled)
        assertEquals(12_345, settings.snapshot.activeProfile?.playbackPositionsMs?.get("film"))

        val laterPlayback = ReelCore(FileCoreStore(path), DeviceKind.WINDOWS)
        laterPlayback.setPlaybackPosition("ada", "film", 67_890)
        settings.setOptionalProviderBetaEnabled(false)
        assertFalse(settings.snapshot.optionalProviderBetaEnabled)
        assertEquals(67_890, settings.snapshot.activeProfile?.playbackPositionsMs?.get("film"))
        val reopened = ReelCore(FileCoreStore(path), DeviceKind.LINUX)
        assertFalse(reopened.snapshot.optionalProviderBetaEnabled)
        assertEquals(67_890, reopened.snapshot.activeProfile?.playbackPositionsMs?.get("film"))
    }

    @Test
    fun betaToggleStopsAfterBoundedConflicts() {
        var saves = 0
        val store = object : CoreStore {
            override fun load() = CoreState()
            override fun save(state: CoreState) {
                saves++
                throw ConcurrentModificationException("Stale core revision")
            }
        }
        val core = ReelCore(store, DeviceKind.WINDOWS)
        assertFailsWith<ConcurrentModificationException> { core.setOptionalProviderBetaEnabled(true) }
        assertEquals(3, saves)
        assertFalse(core.snapshot.optionalProviderBetaEnabled)
    }

    @Test
    fun optionalSourceCannotCollideWithBuiltInIdentityOrChangeKind() {
        val core = ReelCore(MemoryCoreStore(), DeviceKind.WINDOWS)
        assertFailsWith<IllegalArgumentException> {
            core.putSource(SourceRecord("other", SourceKind.PERSONAL, SourceStatus.AVAILABLE))
        }
        assertFailsWith<IllegalArgumentException> {
            core.putSource(SourceRecord(PERSONAL_SOURCE_ID, SourceKind.PUBLIC_DOMAIN, SourceStatus.AVAILABLE))
        }
        assertFailsWith<IllegalArgumentException> { core.putOptionalSource(PERSONAL_SOURCE_ID, SourceStatus.UNAVAILABLE) }
        assertFailsWith<IllegalArgumentException> { core.putOptionalSource(PUBLIC_DOMAIN_SOURCE_ID, SourceStatus.UNAVAILABLE) }
        assertFailsWith<IllegalArgumentException> {
            core.putSource(SourceRecord("addon", SourceKind.OPTIONAL_ADAPTER, SourceStatus.UNAVAILABLE))
        }
        core.setOptionalProviderBetaEnabled(true)
        core.putOptionalSource("addon", SourceStatus.AVAILABLE)
        assertEquals(SourceKind.OPTIONAL_ADAPTER, core.snapshot.sources.getValue("addon").kind)
        assertFailsWith<IllegalArgumentException> {
            core.putSource(SourceRecord("addon", SourceKind.PERSONAL, SourceStatus.AVAILABLE))
        }
        assertFailsWith<IllegalArgumentException> {
            MemoryCoreStore(CoreState(sources = mapOf(PERSONAL_SOURCE_ID to SourceRecord(PERSONAL_SOURCE_ID, SourceKind.OPTIONAL_ADAPTER, SourceStatus.UNAVAILABLE))))
        }
    }

    @Test
    fun versionOneSnapshotMigratesWithoutRevivingOptionalAccess() = withFileStore { path ->
        DataOutputStream(Files.newOutputStream(path)).use { output ->
            output.writeInt(0x52454F53)
            output.writeInt(1)
            output.writeLong(0)
            output.writeInt(1)
            output.writeUTF("ada")
            output.writeUTF("Ada")
            output.writeUTF("#7357A6")
            output.writeUTF(OnboardingStep.COMPLETE.name)
            output.writeUTF(GuidanceLevel.BALANCED.name)
            repeat(3) { output.writeInt(0) } // taste, positive, dismissed
            output.writeInt(0) // less
            output.writeInt(0) // saved
            output.writeInt(0) // playback positions
            output.writeInt(0) // reading positions
            output.writeBoolean(true)
            output.writeUTF("ada")
            output.writeBoolean(false) // standalone
            output.writeInt(1)
            output.writeUTF("optional")
            output.writeUTF(SourceKind.OPTIONAL_ADAPTER.name)
            output.writeUTF(SourceStatus.AVAILABLE.name)
            output.writeInt(1)
            output.writeUTF("film")
            output.writeUTF("Old title")
            output.writeBoolean(true)
            output.writeUTF("optional")
            output.writeUTF(MediaAvailability.READY.name)
        }
        val core = ReelCore(FileCoreStore(path), DeviceKind.WINDOWS)
        assertEquals(CORE_SCHEMA_VERSION, core.snapshot.schemaVersion)
        assertEquals("Ada", core.snapshot.activeProfile?.name)
        assertEquals("Old title", core.snapshot.media.getValue("film").title)
        assertFalse(core.snapshot.optionalProviderBetaEnabled)
        assertEquals(SourceStatus.UNAVAILABLE, core.snapshot.sources.getValue("optional").status)
        core.setOptionalProviderBetaEnabled(true)
        assertEquals(MediaAction.UNAVAILABLE, core.mediaAction("film"))
        assertEquals(1L, ReelCore(FileCoreStore(path), DeviceKind.WINDOWS).snapshot.revision)
    }

    @Test
    fun emptyTasteSelectionCanContinue() {
        val core = ReelCore(MemoryCoreStore(), DeviceKind.ANDROID_PHONE)
        core.createProfile("ada", "Ada")
        core.setColor("ada", "#123ABC")
        core.acknowledgeCurator("ada")
        core.setTasteSeeds("ada", emptySet())
        assertEquals(OnboardingStep.SOURCES, core.snapshot.activeProfile?.onboardingStep)
    }

    @Test
    fun tvNavigationOmitsBooks() {
        assertFalse(Destination.BOOKS in ReelCore(MemoryCoreStore(), DeviceKind.ANDROID_TV).navigation())
        assertTrue(Destination.BOOKS in ReelCore(MemoryCoreStore(), DeviceKind.LINUX).navigation())
    }

    @Test
    fun unsupportedVersionAndInvalidStateFailBeforePublication() = withFileStore { path ->
        val store = FileCoreStore(path)
        val core = ReelCore(store, DeviceKind.WINDOWS)
        core.createProfile("ada")
        val original = Files.readAllBytes(path)
        assertFailsWith<IllegalArgumentException> { store.save(CoreState(schemaVersion = CORE_SCHEMA_VERSION + 1)) }
        assertTrue(original.contentEquals(Files.readAllBytes(path)))
        assertFailsWith<IllegalArgumentException> {
            MemoryCoreStore(CoreState(profiles = mapOf("ada" to ProfileState("wrong"))))
        }
        assertFailsWith<IllegalArgumentException> {
            MemoryCoreStore(CoreState(profiles = mapOf("ada" to ProfileState("ada", positiveReactions = mapOf("film" to ReactionKind.LESS)))))
        }
        DataOutputStream(Files.newOutputStream(path)).use {
            it.writeInt(0x52454F53)
            it.writeInt(CORE_SCHEMA_VERSION + 1)
        }
        assertFailsWith<IllegalArgumentException> { store.load() }
        assertFailsWith<IllegalArgumentException> { ReelCore(store, DeviceKind.WINDOWS) }
    }

    @Test
    fun callerCollectionsAndPublishedSnapshotCannotMutateCoreState() {
        val seeds = mutableSetOf("Mystery")
        val reactions = mutableMapOf("film" to ReactionKind.LIKE)
        val profiles = mutableMapOf("ada" to ProfileState("ada", "Ada", tasteSeeds = seeds, positiveReactions = reactions))
        val initial = CoreState(profiles = profiles, activeProfileId = "ada")
        val core = ReelCore(MemoryCoreStore(initial), DeviceKind.WINDOWS)
        seeds += "Injected"
        reactions["film"] = ReactionKind.LESS
        profiles.clear()
        assertEquals(setOf("Mystery"), core.snapshot.activeProfile?.tasteSeeds)
        assertEquals(ReactionKind.LIKE, core.reactionFor("ada", "film"))
        assertFailsWith<UnsupportedOperationException> {
            (core.snapshot.profiles as MutableMap)["other"] = ProfileState("other")
        }
        assertFailsWith<UnsupportedOperationException> {
            (core.snapshot.activeProfile!!.tasteSeeds as MutableSet) += "Injected"
        }
        assertFailsWith<UnsupportedOperationException> {
            (core.snapshot.activeProfile!!.positiveReactions as MutableMap)["film"] = ReactionKind.LOVE
        }
    }

    @Test
    fun staleFileWriterCannotReplaceNewerSnapshot() = withFileStore { path ->
        val first = ReelCore(FileCoreStore(path), DeviceKind.WINDOWS)
        val stale = ReelCore(FileCoreStore(path), DeviceKind.LINUX)
        first.createProfile("ada")
        assertFailsWith<ConcurrentModificationException> { stale.createProfile("bea") }
        assertTrue(stale.snapshot.profiles.isEmpty())
        assertEquals(setOf("ada"), ReelCore(FileCoreStore(path), DeviceKind.WINDOWS).snapshot.profiles.keys)
    }

    private inline fun withFileStore(block: (java.nio.file.Path) -> Unit) {
        val directory = Files.createTempDirectory("reelos-core-test-")
        val path = directory.resolve("state.bin")
        try {
            block(path)
        } finally {
            Files.deleteIfExists(path)
            Files.deleteIfExists(path.resolveSibling(path.fileName.toString() + ".lock"))
            Files.deleteIfExists(directory)
        }
    }
}
