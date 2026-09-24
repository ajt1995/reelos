package com.reelos.core

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.test.assertFails
import kotlin.test.assertEquals
import java.nio.file.Files

class LocalPlaybackSessionTest {
    private fun state() = CoreState(
        profiles = mapOf("a" to ProfileState("a", "A", onboardingStep = OnboardingStep.COMPLETE),
            "b" to ProfileState("b", "B", onboardingStep = OnboardingStep.COMPLETE)),
        activeProfileId = "a",
        sources = mapOf("local" to SourceRecord("local", SourceKind.OPTIONAL_ADAPTER, SourceStatus.AVAILABLE)),
        media = mapOf("film" to MediaRecord("film", "Personal film", "local", MediaAvailability.READY)),
    )

    @Test fun acceptsCurrentReadySourceButNotMetadataOrSetup() {
        val initial = state()
        assertTrue(LocalPlaybackSession.open(initial, "film").isAllowed(initial))
        assertFails { LocalPlaybackSession.open(initial.copy(activeProfileId = null), "film") }
        assertFails { LocalPlaybackSession.open(initial.copy(media = emptyMap()), "film") }
        assertFails { LocalPlaybackSession.open(initial.copy(profiles = mapOf("a" to ProfileState("a"))), "film") }
        assertFails { LocalPlaybackSession.open(initial.copy(media = mapOf("film" to initial.media.getValue("film").copy(availability = MediaAvailability.METADATA_ONLY))), "film") }
    }

    @Test fun revocationDeletionAndSourceReplacementInvalidateOpenSession() {
        val initial = state()
        val session = LocalPlaybackSession.open(initial, "film")
        for (status in listOf(SourceStatus.REVOKED, SourceStatus.UNAVAILABLE)) {
            assertFalse(session.isAllowed(initial.copy(sources = mapOf("local" to initial.sources.getValue("local").copy(status = status)))))
        }
        assertFalse(session.isAllowed(initial.copy(sources = emptyMap())))
        assertFalse(session.isAllowed(initial.copy(media = emptyMap())))
        assertFalse(session.isAllowed(initial.copy(sources = mapOf("local" to initial.sources.getValue("local").copy(kind = SourceKind.PERSONAL)))))
        assertFalse(session.isAllowed(initial.copy(media = mapOf("film" to initial.media.getValue("film").copy(sourceId = "other")))))
    }

    @Test fun profileChangesInvalidateButHarmlessPreferenceWritesDoNot() {
        val initial = state()
        val session = LocalPlaybackSession.open(initial, "film")
        assertFalse(session.isAllowed(initial.copy(activeProfileId = "b")))
        assertFalse(session.isAllowed(initial.copy(profiles = initial.profiles - "a")))
        assertTrue(session.isAllowed(initial.copy(revision = 42, profiles = initial.profiles +
            ("a" to initial.profiles.getValue("a").copy(color = "#ABCDEF", playbackPositionsMs = mapOf("film" to 4000))))))
    }

    @Test fun briefRevocationAndProfileRoundTripsNeverReviveOldSessions() {
        val core = ReelCore(MemoryCoreStore(state()), DeviceKind.WINDOWS)
        val beforeRevocation = LocalPlaybackSession.open(core.snapshot, "film")
        core.revokeSource("local")
        core.putOptionalSource("local", SourceStatus.AVAILABLE)
        assertFalse(beforeRevocation.isAllowed(core.snapshot))
        val beforeSwitch = LocalPlaybackSession.open(core.snapshot, "film")
        core.selectProfile("b")
        core.selectProfile("a")
        assertFalse(beforeSwitch.isAllowed(core.snapshot))
        val beforeMediaChange = LocalPlaybackSession.open(core.snapshot, "film")
        core.putMedia(state().media.getValue("film").copy(availability = MediaAvailability.UNAVAILABLE))
        core.putMedia(state().media.getValue("film"))
        assertFalse(beforeMediaChange.isAllowed(core.snapshot))
    }

    @Test fun unrelatedSourcesAndPreferencesDoNotRevokeCurrentMedia() {
        val core = ReelCore(MemoryCoreStore(state()), DeviceKind.WINDOWS)
        val session = LocalPlaybackSession.open(core.snapshot, "film")
        core.putOptionalSource("another", SourceStatus.AVAILABLE)
        core.putMedia(MediaRecord("another-film", "Another film", "another", MediaAvailability.READY))
        core.setAppearance("a", motionMode = MotionMode.STILL)
        core.setPlaybackPosition("a", "film", 1000)
        core.putMedia(state().media.getValue("film").copy(title = "Corrected title"))
        assertTrue(session.isAllowed(core.snapshot))
    }

    @Test fun accessGenerationsSurviveRestartAndRejectMalformedValues() {
        val directory = Files.createTempDirectory("reelos-access-generation-")
        val path = directory.resolve("core.bin")
        try {
            val store = FileCoreStore(path)
            store.save(state().copy(revision = 1))
            val core = ReelCore(store, DeviceKind.WINDOWS)
            val session = LocalPlaybackSession.open(core.snapshot, "film")
            core.revokeSource("local")
            core.putOptionalSource("local", SourceStatus.AVAILABLE)
            val reopened = ReelCore(FileCoreStore(path), DeviceKind.LINUX)
            assertEquals(core.snapshot.playbackEpochs, reopened.snapshot.playbackEpochs)
            assertFalse(session.isAllowed(reopened.snapshot))
            assertFails { MemoryCoreStore(state().copy(playbackEpochs = mapOf("source:local" to -1L))) }
        } finally {
            Files.deleteIfExists(path)
            Files.deleteIfExists(path.resolveSibling("core.bin.lock"))
            Files.deleteIfExists(directory)
        }
    }
}
