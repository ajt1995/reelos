package com.reelos.core.intelligence

import com.reelos.core.DeviceKind
import com.reelos.core.FileCoreStore
import com.reelos.core.MediaRecord
import com.reelos.core.MemoryCoreStore
import com.reelos.core.ProfileState
import com.reelos.core.ReactionKind
import com.reelos.core.ReelCore
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class NativeTasteCoordinatorTest {
    private val media = listOf(
        MediaRecord("alpha", "Alpha", null),
        MediaRecord("zeta", "Zeta", null),
        MediaRecord("beta", "Beta", null),
    )

    @Test fun persistedCoreReactionReplaysExactlyAfterRestart() {
        val directory = Files.createTempDirectory("reelos-taste-")
        val path = directory.resolve("core.bin")
        try {
            val core = ReelCore(FileCoreStore(path), DeviceKind.WINDOWS)
            core.createProfile("ada", "Ada")
            media.forEach(core::putMedia)
            core.setReaction("ada", "zeta", ReactionKind.LIKE)
            core.setReaction("ada", "beta", ReactionKind.LIKE)
            val first = NativeTasteCoordinator()
            val before = first.rank(core.snapshot.profiles.getValue("ada"), core.snapshot.media.values.toList())
            assertEquals(TasteRankingKind.LEARNED, first.lastTrace("ada")?.kind)
            val reopened = ReelCore(FileCoreStore(path), DeviceKind.LINUX)
            val second = NativeTasteCoordinator()
            val after = second.rank(reopened.snapshot.profiles.getValue("ada"), reopened.snapshot.media.values.toList())
            assertEquals(before, after)
            assertEquals(first.lastTrace("ada")?.trainedReactions, second.lastTrace("ada")?.trainedReactions)
        } finally {
            Files.deleteIfExists(path)
            Files.deleteIfExists(directory.resolve("core.bin.lock"))
            Files.deleteIfExists(directory)
        }
    }

    @Test fun profileOrderDoesNotChangePrivateReplay() {
        val a = ProfileState("ada", positiveReactions = mapOf("zeta" to ReactionKind.LOVE))
        val b = ProfileState("bea", positiveReactions = mapOf("beta" to ReactionKind.LIKE))
        val forward = NativeTasteCoordinator()
        val aForward = forward.rank(a, media)
        val bForward = forward.rank(b, media)
        val reverse = NativeTasteCoordinator()
        val bReverse = reverse.rank(b, media)
        val aReverse = reverse.rank(a, media)
        assertEquals(aForward, aReverse)
        assertEquals(bForward, bReverse)
        assertEquals("zeta", aForward.first().id)
        assertEquals("beta", bForward.first().id)
    }

    @Test fun clearingAndDismissingRemoveOldLearnedInfluence() {
        val core = ReelCore(MemoryCoreStore(), DeviceKind.WINDOWS)
        core.createProfile("ada", "Ada")
        val coordinator = NativeTasteCoordinator()
        core.setReaction("ada", "zeta", ReactionKind.LOVE)
        assertEquals("zeta", coordinator.rank(core.snapshot.profiles.getValue("ada"), media).first().id)
        core.setReaction("ada", "zeta", null)
        assertEquals(listOf("alpha", "beta", "zeta"), coordinator.rank(core.snapshot.profiles.getValue("ada"), media).map { it.id })
        assertEquals(TasteRankingKind.FALLBACK, coordinator.lastTrace("ada")?.kind)
        core.setReaction("ada", "zeta", ReactionKind.DISMISS)
        assertEquals(listOf("alpha", "beta", "zeta"), coordinator.rank(core.snapshot.profiles.getValue("ada"), media).map { it.id })
        core.save("ada", "zeta", true)
        assertTrue("zeta" in core.snapshot.profiles.getValue("ada").savedMediaIds)
        assertTrue(media.any { it.id == "zeta" })
        core.setReaction("ada", "zeta", ReactionKind.LESS)
        assertFalse(coordinator.rank(core.snapshot.profiles.getValue("ada"), media).any { it.id == "zeta" })
        core.setReaction("ada", "zeta", null)
        assertEquals(listOf("alpha", "beta", "zeta"), coordinator.rank(core.snapshot.profiles.getValue("ada"), media).map { it.id })
    }

    @Test fun unrelatedDismissDoesNotSpendBudgetOrYieldCachedTaste() {
        var allowed = true
        val coordinator = NativeTasteCoordinator(maxReactions = 1, gate = LearningGate { allowed })
        val initial = ProfileState("ada", positiveReactions = mapOf("zeta" to ReactionKind.LOVE))
        assertEquals("zeta", coordinator.rank(initial, media).first().id)
        allowed = false
        val dismissed = initial.copy(dismissedIds = setOf("beta", "alpha"))
        assertEquals("zeta", coordinator.rank(dismissed, media).first().id)
        assertEquals(TasteRankingKind.LEARNED, coordinator.lastTrace("ada")?.kind)
        assertTrue(coordinator.lastTrace("ada")!!.cacheHit)
        assertEquals(1, coordinator.lastTrace("ada")?.replayNumber)
    }

    @Test fun exactInitialTasteSeedTrainsUnlessLatestReactionOverridesIt() {
        val coordinator = NativeTasteCoordinator()
        val seeded = ProfileState("ada", tasteSeeds = setOf("Zeta"))
        assertEquals("zeta", coordinator.rank(seeded, media).first().id)
        assertEquals(TasteRankingKind.LEARNED, coordinator.lastTrace("ada")?.kind)
        assertEquals(1, coordinator.lastTrace("ada")?.trainedReactions)
        val dismissed = seeded.copy(dismissedIds = setOf("zeta"))
        assertEquals(listOf("alpha", "beta", "zeta"), coordinator.rank(dismissed, media).map { it.id })
        assertEquals(TasteRankingKind.FALLBACK, coordinator.lastTrace("ada")?.kind)
        assertEquals("zeta", coordinator.rank(seeded, media).first().id)
        val less = seeded.copy(lessLikeIds = setOf("zeta"))
        assertFalse(coordinator.rank(less, media).any { it.id == "zeta" })
        val explicit = seeded.copy(positiveReactions = mapOf("zeta" to ReactionKind.LOVE))
        assertEquals(1, coordinator.also { it.rank(explicit, media) }.lastTrace("ada")?.trainedReactions)
    }

    @Test fun interruptedRebuildCannotPublishStaleOrPartialModel() {
        var calls = 0
        var failAt: Int? = null
        val coordinator = NativeTasteCoordinator(gate = LearningGate { ++calls != failAt })
        val first = ProfileState("ada", positiveReactions = mapOf("zeta" to ReactionKind.LOVE))
        assertEquals("zeta", coordinator.rank(first, media).first().id)
        val changed = first.copy(positiveReactions = mapOf("beta" to ReactionKind.LOVE))
        failAt = calls + 3 // admission, first update, then a denied update
        assertEquals(listOf("alpha", "beta", "zeta"), coordinator.rank(changed, media).map { it.id })
        assertEquals(TasteRankingKind.PRESSURE, coordinator.lastTrace("ada")?.kind)
        assertEquals(1, coordinator.cachedProfileCount())
        failAt = null
        val recovered = coordinator.rank(changed, media)
        assertEquals(NativeTasteCoordinator().rank(changed, media), recovered)
        assertEquals("beta", recovered.first().id)
        assertEquals(TasteRankingKind.LEARNED, coordinator.lastTrace("ada")?.kind)
    }

    @Test fun yieldedReplayPublishesNoPartialModel() {
        var calls = 0
        val coordinator = NativeTasteCoordinator(gate = LearningGate { ++calls != 3 })
        val p = ProfileState("ada", positiveReactions = mapOf("zeta" to ReactionKind.LOVE))
        assertEquals(listOf("alpha", "beta", "zeta"), coordinator.rank(p, media).map { it.id })
        assertEquals(TasteRankingKind.PRESSURE, coordinator.lastTrace("ada")?.kind)
        assertEquals(0, coordinator.cachedProfileCount())
        assertEquals("zeta", coordinator.rank(p, media).first().id)
        assertEquals(TasteRankingKind.LEARNED, coordinator.lastTrace("ada")?.kind)
        assertEquals(1, coordinator.cachedProfileCount())
    }

    @Test fun playbackProgressDoesNotReplayButReactionAndSeedsDo() {
        val coordinator = NativeTasteCoordinator()
        val p = ProfileState("ada", positiveReactions = mapOf("zeta" to ReactionKind.COZY))
        coordinator.rank(p, media)
        assertEquals(1, coordinator.lastTrace("ada")?.replayNumber)
        coordinator.rank(p.copy(playbackPositionsMs = mapOf("zeta" to 90_000)), media)
        assertEquals(1, coordinator.lastTrace("ada")?.replayNumber)
        assertTrue(coordinator.lastTrace("ada")!!.cacheHit)
        coordinator.rank(p.copy(positiveReactions = mapOf("zeta" to ReactionKind.LOVE)), media)
        assertEquals(2, coordinator.lastTrace("ada")?.replayNumber)
        coordinator.rank(p.copy(tasteSeeds = setOf("Alpha")), media)
        assertEquals(3, coordinator.lastTrace("ada")?.replayNumber)
    }

    @Test fun cacheAndRankingPagesStayBounded() {
        val coordinator = NativeTasteCoordinator(maxCachedProfiles = 2, maxCandidates = 3)
        listOf("ada", "bea", "cy").forEach { coordinator.rank(ProfileState(it), media) }
        assertEquals(2, coordinator.cachedProfileCount())
        assertNotNull(coordinator.lastTrace("cy"))
        assertEquals(null, coordinator.lastTrace("ada"))
        kotlin.test.assertFailsWith<IllegalArgumentException> {
            coordinator.rank(ProfileState("ada"), media + MediaRecord("four", "Four", null))
        }
        val overBudget = NativeTasteCoordinator(maxReactions = 1)
        val p = ProfileState("ada", positiveReactions = mapOf("alpha" to ReactionKind.LOVE, "zeta" to ReactionKind.LIKE))
        assertEquals(TasteRankingKind.FALLBACK, overBudget.also { it.rank(p, media) }.lastTrace("ada")?.kind)
        assertEquals(0, overBudget.cachedProfileCount())
    }
}
