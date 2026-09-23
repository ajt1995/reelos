package com.reelos.core.intelligence

import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class LocalLearningTest {
    @Test fun sgdLearnsAndSeedIsRepeatable() {
        val a = LocalLearning(factorDimension = 8, seed = 42)
        val b = LocalLearning(factorDimension = 8, seed = 42)
        a.observe("ada", "film", 1.0)
        b.observe("ada", "film", 1.0)
        assertEquals(a.snapshot("ada"), b.snapshot("ada"))
        val initial = a.predictedPreference("ada", "film")!!
        repeat(40) { a.observe("ada", "film", 1.0) }
        assertTrue(a.predictedPreference("ada", "film")!! > initial)
    }

    @Test fun profilesAndSnapshotRoundtripAreIsolated() {
        val learning = LocalLearning(factorDimension = 8, seed = 7)
        learning.observe("ada", "film", 1.0)
        learning.observe("bea", "film", 0.0)
        val bea = learning.snapshot("bea")!!
        val ada = learning.snapshot("ada")!!
        learning.observe("ada", "film", -1.0)
        assertEquals(bea, learning.snapshot("bea"))
        val resumed = LocalLearning(factorDimension = 8, seed = 999)
        resumed.restore("ada", ada)
        assertEquals(ada, resumed.snapshot("ada"))
        resumed.removeProfile("ada")
        assertNull(resumed.snapshot("ada"))
    }

    @Test fun banditMatchesDirectInverseOverLongNearCollinearRun() {
        val learning = LocalLearning(factorDimension = 8)
        val contexts = listOf(
            LocalLearning.Context(listOf(1.0, 0.0, 0.0, 0.0, 0.0)),
            LocalLearning.Context(listOf(0.99, 0.01, 0.0, 0.0, 0.0)),
            LocalLearning.Context(listOf(0.0, 0.0, 1.0, 0.5, 0.1)),
            LocalLearning.Context(listOf(0.0, 1.0, 0.0, 0.0, 0.2)),
            LocalLearning.Context(listOf(0.0, 0.0, 0.0, 1.0, 0.0)),
            LocalLearning.Context(listOf(0.0, 0.0, 0.0, 0.0, 1.0)),
        )
        repeat(1024) { i ->
            learning.observeArm("ada", "mind_benders", contexts[i % contexts.size], (i % 3).toDouble() / 2)
            if (i in setOf(254, 256, 1022, 1023)) {
                val current = learning.snapshot("ada")!!.arms.getValue("mind_benders")
                val inverse = directInverse(current.covariance)
                val x = contexts[2]
                val directMean = (0 until 5).sumOf { row -> x.values[row] * (0 until 5).sumOf { col -> inverse[row][col] * current.reward[col] } }
                val directVariance = (0 until 5).sumOf { row -> x.values[row] * (0 until 5).sumOf { col -> inverse[row][col] * x.values[col] } }
                val directScore = directMean + 0.1 * kotlin.math.sqrt(directVariance)
                assertTrue(abs(directScore - learning.armScore("ada", "mind_benders", x)) < 1e-7)
            }
        }
        val state = learning.snapshot("ada")!!
        val arm = state.arms.getValue("mind_benders")
        val inverse = directInverse(arm.covariance)
        for (i in 0 until 5) for (j in 0 until 5) {
            val entry = (0 until 5).sumOf { k -> arm.covariance[i][k] * inverse[k][j] }
            assertTrue(abs(entry - if (i == j) 1.0 else 0.0) < 1e-7)
        }
        val restored = LocalLearning(factorDimension = 8)
        restored.restore("ada", state)
        assertEquals(state, restored.snapshot("ada"))
        // Predict a trained arm against an independent direct solve.
        val x = contexts[0].values
        val directMean = (0 until 5).sumOf { i -> x[i] * (0 until 5).sumOf { j -> inverse[i][j] * arm.reward[j] } }
        val directVariance = (0 until 5).sumOf { i -> x[i] * (0 until 5).sumOf { j -> inverse[i][j] * x[j] } }
        val directScore = directMean + 0.1 * kotlin.math.sqrt(directVariance)
        assertTrue(abs(directScore - learning.armScore("ada", "mind_benders", contexts[0])) < 1e-7)
        assertEquals("mind_benders", restored.rankArm("ada", contexts[0]))
    }

    @Test fun invalidInputsAndPressureYieldFailClosed() {
        var allowed = false
        val learning = LocalLearning(factorDimension = 8, gate = LearningGate { allowed })
        assertFalse(learning.observe("ada", "film", 1.0))
        assertNull(learning.snapshot("ada"))
        allowed = true
        learning.observe("ada", "film", 1.0)
        val before = learning.snapshot("ada")!!
        allowed = false
        assertFalse(learning.observeArm("ada", "mind_benders", LocalLearning.Context(listOf(1.0, 0.0, 0.0, 0.0, 0.0)), 1.0))
        assertEquals(before, learning.snapshot("ada"))
        assertFailsWith<IllegalArgumentException> { learning.observe("ada", "film", Double.NaN) }
        assertFailsWith<IllegalArgumentException> { LocalLearning.Context(List(5) { 0.0 }) }
        assertFailsWith<IllegalArgumentException> { LocalLearning.Context(List(4) { 1.0 }) }
        assertFailsWith<IllegalArgumentException> { LocalLearning(factorDimension = 512) }
        assertFailsWith<IllegalArgumentException> { learning.restore("ada", before.copy(factorDimension = 16)) }
        val invalidArm = before.arms.getValue("mind_benders").copy(covariance = List(5) { List(5) { 0.0 } })
        assertFailsWith<IllegalArgumentException> { learning.restore("ada", before.copy(arms = before.arms + ("mind_benders" to invalidArm))) }
        val tiny = before.arms.getValue("mind_benders").copy(covariance = List(5) { i ->
            List(5) { j -> if (i == j) 1e-8 else if (i == 0 && j == 1) 5e-7 else 0.0 }
        })
        assertFailsWith<IllegalArgumentException> { learning.restore("ada", before.copy(arms = before.arms + ("mind_benders" to tiny))) }
        assertEquals(before, learning.snapshot("ada"))
        val bounded = LocalLearning(factorDimension = 8, maxProfiles = 1, maxItemsPerProfile = 1)
        bounded.observe("ada", "one", 1.0)
        bounded.observe("ada", "two", 1.0)
        assertNull(bounded.predictedPreference("ada", "one"))
        assertFailsWith<IllegalArgumentException> { bounded.observe("bea", "film", 1.0) }
    }

    @Test fun contextAndSnapshotCopiesCannotMutateLiveLearning() {
        val source = mutableListOf(1.0, 0.0, 0.0, 0.0, 0.0)
        val context = LocalLearning.Context(source)
        source[0] = Double.NaN
        (context.values as MutableList<Double>)[0] = Double.NaN
        assertTrue(context.values.all { it.isFinite() })
        val learning = LocalLearning(factorDimension = 8)
        learning.observe("ada", "film", 1.0)
        learning.observeArm("ada", "mind_benders", context, 1.0)
        val snapshot = learning.snapshot("ada")!!
        val original = learning.snapshot("ada")!!
        (snapshot.factors.user as MutableList<Float>)[0] = Float.NaN
        (snapshot.factors.items.getValue("film") as MutableList<Float>)[0] = Float.NaN
        (snapshot.arms.getValue("mind_benders").covariance[0] as MutableList<Double>)[0] = Double.NaN
        (snapshot.arms.getValue("mind_benders").reward as MutableList<Double>)[0] = Double.NaN
        assertEquals(original, learning.snapshot("ada"))
        assertTrue(learning.armScore("ada", "mind_benders", context).isFinite())
    }

    @Test fun semanticEmbeddingsRequireActualCompatibleFiniteVectors() {
        val x = FloatArray(512) { if (it == 0) 1f else 0f }
        val a = LearnedEmbedding("encoder", "v1", "local model output", x)
        val b = LearnedEmbedding("encoder", "v1", "local model output", x)
        x[0] = 0f
        assertEquals(1.0, a.cosineWith(b))
        assertNull(a.cosineWith(LearnedEmbedding("encoder", "v2", "local model output", b.values)))
        assertFailsWith<IllegalArgumentException> { LearnedEmbedding("encoder", "v1", "source", FloatArray(512)) }
        assertFailsWith<IllegalArgumentException> { LearnedEmbedding("encoder", "v1", "source", FloatArray(512) { Float.NaN }) }
        assertFailsWith<IllegalArgumentException> { LearnedEmbedding("encoder", "v1", "source", FloatArray(5) { 1f }) }
    }

    private fun directInverse(a: List<List<Double>>): List<List<Double>> {
        val augmented = Array(5) { i -> DoubleArray(10) { j -> if (j < 5) a[i][j] else if (j - 5 == i) 1.0 else 0.0 } }
        for (c in 0 until 5) {
            val pivot = (c until 5).maxBy { abs(augmented[it][c]) }
            val swap = augmented[c]; augmented[c] = augmented[pivot]; augmented[pivot] = swap
            val scale = augmented[c][c]
            for (j in 0 until 10) augmented[c][j] /= scale
            for (r in 0 until 5) if (r != c) {
                val multiple = augmented[r][c]
                for (j in 0 until 10) augmented[r][j] -= multiple * augmented[c][j]
            }
        }
        return List(5) { i -> List(5) { j -> augmented[i][j + 5] } }
    }
}
