package com.reelos.core

import com.reelos.core.intelligence.LearningGate
import com.reelos.core.intelligence.TasteRankingKind
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class NativeTasteIntegrationTest {
    @Test fun persistedNativeReactionsDriveHomeWithoutChangingCatalogOrOtherProfiles() {
        val directory = Files.createTempDirectory("native-taste-integration")
        val file = directory.resolve("core.bin")
        try {
            val core = ReelCore(FileCoreStore(file), DeviceKind.WINDOWS)
            core.createProfile("ada", "Ada")
            core.createProfile("bea", "Bea")
            core.putMedia(MediaRecord("a", "Alpha", null))
            core.putMedia(MediaRecord("z", "Zeta", null))
            core.setReaction("ada", "z", ReactionKind.LOVE)
            assertEquals(listOf("z", "a"), core.rankedHomeMedia("ada").map { it.id })
            assertEquals(TasteRankingKind.LEARNED, core.tasteRankingTrace("ada")?.kind)
            assertEquals(listOf("a", "z"), core.rankedHomeMedia("bea").map { it.id })
            val restarted = ReelCore(FileCoreStore(file), DeviceKind.ANDROID_TV)
            assertEquals(listOf("z", "a"), restarted.rankedHomeMedia("ada").map { it.id })
            restarted.setReaction("ada", "z", ReactionKind.DISMISS)
            assertEquals(listOf("a", "z"), restarted.rankedHomeMedia("ada").map { it.id })
            restarted.setReaction("ada", "z", ReactionKind.LESS)
            assertEquals(listOf("a"), restarted.rankedHomeMedia("ada").map { it.id })
            assertTrue("z" in restarted.snapshot.media) // Search/Library still have the title.
            restarted.setReaction("ada", "z", null)
            assertEquals(listOf("a", "z"), restarted.rankedHomeMedia("ada").map { it.id })
            assertEquals(MediaAction.FIND, restarted.mediaAction("z")) // Learning cannot grant bytes.
        } finally {
            Files.deleteIfExists(file)
            Files.deleteIfExists(directory.resolve("core.bin.lock"))
            Files.deleteIfExists(directory)
        }
    }

    @Test fun nativeLearningYieldDoesNotBreakNavigationOrPersistence() {
        val core = ReelCore(MemoryCoreStore(), DeviceKind.ANDROID_PHONE, LearningGate { false })
        core.createProfile("ada", "Ada")
        core.putMedia(MediaRecord("z", "Zeta", null))
        core.setReaction("ada", "z", ReactionKind.LOVE)
        assertEquals(listOf("z"), core.rankedHomeMedia("ada").map { it.id })
        assertEquals(TasteRankingKind.PRESSURE, core.tasteRankingTrace("ada")?.kind)
        assertEquals(ReactionKind.LOVE, core.reactionFor("ada", "z"))
        assertFalse(core.navigation().isEmpty())
    }

    @Test fun nativeHomeBoundsRankingWithoutLosingTheFullLibrary() {
        val media = (0..2050).associate { "$it" to MediaRecord("$it", "Title $it", null) }
        val state = CoreState(profiles = mapOf("ada" to ProfileState("ada", "Ada")), activeProfileId = "ada", media = media)
        val core = ReelCore(MemoryCoreStore(state), DeviceKind.LINUX)
        assertEquals(2048, core.rankedHomeMedia("ada").size)
        assertEquals(2051, core.snapshot.media.size)
    }
}
