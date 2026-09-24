package com.reelos.core

import java.io.DataOutputStream
import java.nio.file.Files
import java.nio.file.Path
import java.util.ConcurrentModificationException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AppearanceCoreTest {
    @Test fun versionFourMigratesAccessGenerationsWithoutResettingPreferences() = withFileStore { path ->
        writeLegacyProfile(path, 4, motion = "EXPRESSIVE", density = "COMPACT")
        val core = ReelCore(FileCoreStore(path), DeviceKind.WINDOWS)
        assertEquals(CORE_SCHEMA_VERSION, core.snapshot.schemaVersion)
        assertTrue(core.snapshot.playbackEpochs.isEmpty())
        assertEquals(MotionMode.EXPRESSIVE, core.snapshot.activeProfile?.motionMode)
        assertEquals(BrowsingDensity.COMPACT, core.snapshot.activeProfile?.browsingDensity)
        core.revokeSource("optional")
        val reopened = ReelCore(FileCoreStore(path), DeviceKind.LINUX)
        assertEquals(1L, reopened.snapshot.playbackEpochs["source:optional"])
        assertEquals(MotionMode.EXPRESSIVE, reopened.snapshot.activeProfile?.motionMode)
    }

    @Test fun versionThreeMigratesAppearanceWithoutChangingSourceOrHandoffPolicy() = withFileStore { path ->
        writeLegacyProfile(path, 3)
        val core = ReelCore(FileCoreStore(path), DeviceKind.WINDOWS)
        val p = core.snapshot.activeProfile!!
        assertEquals(CORE_SCHEMA_VERSION, core.snapshot.schemaVersion)
        assertEquals(MotionMode.SUBTLE, p.motionMode)
        assertEquals(BrowsingDensity.COMFORTABLE, p.browsingDensity)
        assertTrue(p.transparencyEnabled)
        assertTrue(core.snapshot.experimentalHandoffsEnabled)
        assertEquals(SourceStatus.AVAILABLE, core.snapshot.sources.getValue("optional").status)
        core.setAppearance("ada", MotionMode.STILL, BrowsingDensity.COMPACT, false)
        val reopened = ReelCore(FileCoreStore(path), DeviceKind.LINUX)
        assertEquals(MotionMode.STILL, reopened.snapshot.activeProfile?.motionMode)
        assertEquals(BrowsingDensity.COMPACT, reopened.snapshot.activeProfile?.browsingDensity)
        assertFalse(reopened.snapshot.activeProfile!!.transparencyEnabled)
        assertTrue(reopened.snapshot.experimentalHandoffsEnabled)
        assertEquals(SourceStatus.AVAILABLE, reopened.snapshot.sources.getValue("optional").status)
    }

    @Test fun appearanceIsPrivateAndPersistsWithoutAdvancingOnboarding() = withFileStore { path ->
        val core = ReelCore(FileCoreStore(path), DeviceKind.WINDOWS)
        core.createProfile("ada", "Ada")
        core.createProfile("bea", "Bea")
        val beforeStep = core.snapshot.profiles.getValue("ada").onboardingStep
        core.setAppearance("ada", MotionMode.EXPRESSIVE, BrowsingDensity.COMPACT, false)
        assertEquals(beforeStep, core.snapshot.profiles.getValue("ada").onboardingStep)
        val reopened = ReelCore(FileCoreStore(path), DeviceKind.ANDROID_PHONE)
        val ada = reopened.snapshot.profiles.getValue("ada")
        val bea = reopened.snapshot.profiles.getValue("bea")
        assertEquals(MotionMode.EXPRESSIVE, ada.motionMode)
        assertEquals(BrowsingDensity.COMPACT, ada.browsingDensity)
        assertFalse(ada.transparencyEnabled)
        assertEquals(MotionMode.SUBTLE, bea.motionMode)
        assertEquals(BrowsingDensity.COMFORTABLE, bea.browsingDensity)
        assertTrue(bea.transparencyEnabled)
    }

    @Test fun osMotionAndExplicitStillWinOverSetupExpression() {
        val profile = ProfileState("ada", "Ada")
        assertEquals(MotionMode.EXPRESSIVE, effectiveMotionMode(profile, osMotionAllowed = true, setup = true))
        assertEquals(MotionMode.SUBTLE, effectiveMotionMode(profile, osMotionAllowed = true, setup = false))
        assertEquals(MotionMode.STILL, effectiveMotionMode(profile, osMotionAllowed = false, setup = true))
        assertEquals(MotionMode.STILL, effectiveMotionMode(profile.copy(motionMode = MotionMode.STILL), true, true))
        assertEquals(MotionMode.EXPRESSIVE, effectiveMotionMode(profile.copy(motionMode = MotionMode.EXPRESSIVE), true, false))
    }

    @Test fun finishTasteRetainsCollectedTasteAndCompletedColorEditsStayComplete() {
        val p = ProfileState(
            "ada", "Ada", onboardingStep = OnboardingStep.TASTE,
            tasteSeeds = setOf("Zeta"), positiveReactions = mapOf("film" to ReactionKind.LOVE),
        )
        val core = ReelCore(MemoryCoreStore(CoreState(profiles = mapOf("ada" to p), activeProfileId = "ada")), DeviceKind.WINDOWS)
        core.finishTaste("ada")
        val after = core.snapshot.activeProfile!!
        assertEquals(OnboardingStep.SOURCES, after.onboardingStep)
        assertEquals(p.tasteSeeds, after.tasteSeeds)
        assertEquals(p.positiveReactions, after.positiveReactions)
        assertFailsWith<IllegalArgumentException> { core.finishTaste("ada") }
        assertEquals(OnboardingStep.SOURCES, core.snapshot.activeProfile?.onboardingStep)
        val completed = ReelCore(MemoryCoreStore(CoreState(
            profiles = mapOf("bea" to ProfileState("bea", "Bea", onboardingStep = OnboardingStep.COMPLETE)),
            activeProfileId = "bea",
        )), DeviceKind.WINDOWS)
        completed.setColor("bea", "#abcdef")
        assertEquals("#ABCDEF", completed.snapshot.activeProfile?.color)
        assertEquals(OnboardingStep.COMPLETE, completed.snapshot.activeProfile?.onboardingStep)
    }

    @Test fun staleAppearanceWriteAndFailedStoreNeverPublish() = withFileStore { path ->
        val first = ReelCore(FileCoreStore(path), DeviceKind.WINDOWS)
        first.createProfile("ada", "Ada")
        val stale = ReelCore(FileCoreStore(path), DeviceKind.LINUX)
        first.setAppearance("ada", MotionMode.STILL, BrowsingDensity.COMPACT, false)
        assertFailsWith<ConcurrentModificationException> {
            stale.setAppearance("ada", MotionMode.EXPRESSIVE, BrowsingDensity.COMFORTABLE, true)
        }
        assertEquals(MotionMode.SUBTLE, stale.snapshot.activeProfile?.motionMode)
        assertEquals(MotionMode.STILL, ReelCore(FileCoreStore(path), DeviceKind.WINDOWS).snapshot.activeProfile?.motionMode)

        val initial = CoreState(profiles = mapOf("ada" to ProfileState("ada", "Ada")), activeProfileId = "ada")
        val rejecting = object : CoreStore {
            override fun load() = initial
            override fun save(state: CoreState): Unit = throw IllegalStateException("storage unavailable")
        }
        val core = ReelCore(rejecting, DeviceKind.WINDOWS)
        assertFailsWith<IllegalStateException> {
            core.setAppearance("ada", MotionMode.STILL, BrowsingDensity.COMPACT, false)
        }
        assertEquals(initial, core.snapshot)
    }

    @Test fun malformedVersionFourAppearanceEnumFailsClosed() = withFileStore { path ->
        writeLegacyProfile(path, 4, motion = "UNKNOWN")
        assertFailsWith<IllegalArgumentException> { FileCoreStore(path).load() }
        assertFailsWith<IllegalArgumentException> { ReelCore(FileCoreStore(path), DeviceKind.WINDOWS) }
        writeLegacyProfile(path, 4, density = "UNKNOWN")
        assertFailsWith<IllegalArgumentException> { FileCoreStore(path).load() }
    }

    @Test fun independentAppearanceCommandsMergeWithLatestProfile() {
        val core = ReelCore(MemoryCoreStore(), DeviceKind.WINDOWS)
        core.createProfile("ada", "Ada")
        core.setAppearance("ada", motionMode = MotionMode.EXPRESSIVE)
        core.setAppearance("ada", browsingDensity = BrowsingDensity.COMPACT)
        core.setAppearance("ada", toggleTransparency = true)
        assertEquals(MotionMode.EXPRESSIVE, core.snapshot.activeProfile?.motionMode)
        assertEquals(BrowsingDensity.COMPACT, core.snapshot.activeProfile?.browsingDensity)
        assertEquals(false, core.snapshot.activeProfile?.transparencyEnabled)
        core.setAppearance("ada", toggleTransparency = true)
        assertEquals(true, core.snapshot.activeProfile?.transparencyEnabled)
    }

    private fun writeLegacyProfile(
        path: Path,
        version: Int,
        motion: String = MotionMode.SUBTLE.name,
        density: String = BrowsingDensity.COMFORTABLE.name,
    ) {
        DataOutputStream(Files.newOutputStream(path)).use { out ->
            out.writeInt(0x52454F53)
            out.writeInt(version)
            out.writeLong(7)
            out.writeInt(1)
            out.writeUTF("ada")
            out.writeUTF("Ada")
            out.writeUTF("#7357A6")
            out.writeUTF(OnboardingStep.COMPLETE.name)
            out.writeUTF(GuidanceLevel.BALANCED.name)
            repeat(7) { out.writeInt(0) } // seeds, reactions, dismiss, less, saved, playback, reading
            if (version >= 4) {
                out.writeUTF(motion)
                out.writeUTF(density)
                out.writeBoolean(true)
            }
            out.writeBoolean(true)
            out.writeUTF("ada")
            out.writeBoolean(false)
            out.writeInt(1)
            out.writeUTF("optional")
            out.writeUTF(SourceKind.OPTIONAL_ADAPTER.name)
            out.writeUTF(SourceStatus.AVAILABLE.name)
            out.writeInt(0)
            out.writeBoolean(true)
        }
    }

    private inline fun withFileStore(block: (Path) -> Unit) {
        val directory = Files.createTempDirectory("reelos-appearance-test-")
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
