package com.reelos.core.intelligence

import kotlin.math.sqrt
import kotlin.random.Random

/** An admission decision supplied by the platform resource governor before learning allocates or mutates. */
fun interface LearningGate { fun mayLearn(): Boolean }

data class FactorSnapshot(val user: List<Float>, val items: Map<String, List<Float>>)
data class BanditArmSnapshot(val covariance: List<List<Double>>, val reward: List<Double>)
data class ProfileLearningSnapshot(
    val schema: Int,
    val factorDimension: Int,
    val factors: FactorSnapshot,
    val arms: Map<String, BanditArmSnapshot>,
)

/**
 * Small on-device collaborative factors and independent five-value contextual bandit.
 * These factors are learned preference coordinates, not semantic media embeddings.
 * Calls are synchronized because a profile's matrices must be updated and snapshotted atomically.
 */
class LocalLearning(
    val factorDimension: Int = 32,
    private val maxProfiles: Int = 16,
    private val maxItemsPerProfile: Int = 512,
    armNames: List<String> = listOf("mind_benders", "fireside_comfort", "dinner_watches", "bleeding_edge"),
    seed: Int = 1,
    private val gate: LearningGate = LearningGate { true },
    private val learningRate: Double = 0.01,
    private val regularization: Double = 0.02,
    private val exploration: Double = 0.1,
) {
    companion object { const val CONTEXT_DIMENSION = 5; const val SNAPSHOT_SCHEMA = 1 }

    private class Arm {
        val a = Array(CONTEXT_DIMENSION) { i -> DoubleArray(CONTEXT_DIMENSION) { j -> if (i == j) 1.0 else 0.0 } }
        var inverse = Array(CONTEXT_DIMENSION) { i -> DoubleArray(CONTEXT_DIMENSION) { j -> if (i == j) 1.0 else 0.0 } }
        val b = DoubleArray(CONTEXT_DIMENSION)
        var updates = 0
    }

    private class Profile(val user: FloatArray, val arms: LinkedHashMap<String, Arm>) {
        val items = LinkedHashMap<String, FloatArray>(16, 0.75f, true)
    }

    private val random = Random(seed)
    private val profiles = LinkedHashMap<String, Profile>()
    private val armNames = armNames.toList()

    init {
        require(factorDimension in 2..128 && maxProfiles in 1..64 && maxItemsPerProfile in 1..4096)
        require(this.armNames.size in 1..16 && this.armNames.distinct().size == this.armNames.size)
        require(this.armNames.all { validId(it) })
        require(learningRate.isFinite() && learningRate > 0.0 && learningRate <= 1.0)
        require(regularization.isFinite() && regularization >= 0.0 && regularization <= 1.0)
        require(exploration.isFinite() && exploration >= 0.0 && exploration <= 10.0)
    }

    private fun validId(id: String) = id.isNotBlank() && id.length <= 128
    private fun freshFactors() = FloatArray(factorDimension) { ((random.nextDouble() - 0.5) * 0.1).toFloat() }
    private fun freshProfile() = Profile(freshFactors(), LinkedHashMap<String, Arm>().also { map ->
        armNames.forEach { map[it] = Arm() }
    })
    private fun profile(id: String): Profile {
        require(validId(id))
        return profiles[id] ?: run {
            require(profiles.size < maxProfiles) { "Profile capacity reached" }
            freshProfile().also { profiles[id] = it }
        }
    }

    /** Returns false when the resource/cancellation gate yields; no state changes then occur. */
    @Synchronized fun observe(profileId: String, itemId: String, reward: Double): Boolean {
        require(validId(profileId) && validId(itemId))
        require(reward.isFinite() && reward in -5.0..5.0)
        if (!gate.mayLearn()) return false
        val p = profile(profileId)
        val item = p.items[itemId] ?: run {
            if (p.items.size == maxItemsPerProfile) p.items.remove(p.items.keys.first())
            freshFactors().also { p.items[itemId] = it }
        }
        val predicted = p.user.indices.sumOf { p.user[it].toDouble() * item[it] }
        val error = (reward - predicted).coerceIn(-5.0, 5.0)
        for (i in p.user.indices) {
            val oldUser = p.user[i].toDouble()
            val oldItem = item[i].toDouble()
            p.user[i] = (oldUser + learningRate * (error * oldItem - regularization * oldUser)).coerceIn(-10.0, 10.0).toFloat()
            item[i] = (oldItem + learningRate * (error * oldUser - regularization * oldItem)).coerceIn(-10.0, 10.0).toFloat()
        }
        return true
    }

    @Synchronized fun predictedPreference(profileId: String, itemId: String): Double? {
        require(validId(profileId) && validId(itemId))
        val p = profiles[profileId] ?: return null
        val item = p.items[itemId] ?: return null
        return p.user.indices.sumOf { p.user[it].toDouble() * item[it] }
    }

    /** Input order: time sine, time cosine, weekend, session depth, system ease. */
    class Context(values: List<Double>) {
        val values: List<Double>
        init {
            require(values.size == CONTEXT_DIMENSION && values.all { it.isFinite() && it in -1.0..1.0 })
            val norm = sqrt(values.sumOf { it * it })
            require(norm > 1e-12) { "Zero context" }
            this.values = values.map { it / norm }
        }
    }

    /** Rank all configured arms by xᵀA⁻¹b + alpha sqrt(xᵀA⁻¹x). */
    @Synchronized fun rankArm(profileId: String, context: Context): String {
        require(validId(profileId))
        val p = profiles[profileId]
        return armNames.maxBy { name -> score(p?.arms?.get(name), context) }
    }

    @Synchronized fun armScore(profileId: String, armName: String, context: Context): Double {
        require(validId(profileId) && armName in armNames)
        return score(profiles[profileId]?.arms?.get(armName), context)
    }

    private fun score(arm: Arm?, context: Context): Double {
        val current = arm ?: Arm()
        val u = multiply(current.inverse, context.values)
        val mean = dot(u.asList(), current.b.asList())
        val variance = dot(context.values, u.asList()).coerceAtLeast(0.0)
        return mean + exploration * sqrt(variance)
    }

    /** Sherman–Morrison update of the inverse for A ← A + xxᵀ, b ← b + rx. */
    @Synchronized fun observeArm(profileId: String, armName: String, context: Context, reward: Double): Boolean {
        require(validId(profileId) && armName in armNames)
        require(reward.isFinite() && reward in -5.0..5.0)
        if (!gate.mayLearn()) return false
        val arm = profile(profileId).arms.getValue(armName)
        val x = context.values
        val u = multiply(arm.inverse, x)
        val denominator = 1.0 + dot(x, u.asList())
        require(denominator.isFinite() && denominator > 1e-12) { "Invalid covariance update" }
        for (i in 0 until CONTEXT_DIMENSION) {
            for (j in 0 until CONTEXT_DIMENSION) {
                arm.a[i][j] += x[i] * x[j]
                arm.inverse[i][j] -= u[i] * u[j] / denominator
            }
            arm.b[i] += reward * x[i]
        }
        arm.updates++
        if (arm.updates % 256 == 0) arm.inverse = invert(arm.a)
        return true
    }

    @Synchronized fun snapshot(profileId: String): ProfileLearningSnapshot? {
        require(validId(profileId))
        val p = profiles[profileId] ?: return null
        return ProfileLearningSnapshot(SNAPSHOT_SCHEMA, factorDimension,
            FactorSnapshot(p.user.toList(), p.items.mapValues { it.value.toList() }),
            p.arms.mapValues { (_, arm) -> BanditArmSnapshot(arm.a.map { it.toList() }, arm.b.toList()) })
    }

    /** Validate the complete typed payload before replacing exactly one profile. Inverses are rebuilt, never trusted. */
    @Synchronized fun restore(profileId: String, state: ProfileLearningSnapshot) {
        require(validId(profileId) && state.schema == SNAPSHOT_SCHEMA && state.factorDimension == factorDimension)
        require(state.factors.user.size == factorDimension && state.factors.user.all { it.isFinite() && it in -10f..10f })
        require(state.factors.items.size <= maxItemsPerProfile && state.factors.items.all { (id, v) ->
            validId(id) && v.size == factorDimension && v.all { it.isFinite() && it in -10f..10f }
        })
        require(state.arms.keys == armNames.toSet())
        val candidate = Profile(state.factors.user.toFloatArray(), LinkedHashMap())
        state.factors.items.forEach { (id, v) -> candidate.items[id] = v.toFloatArray() }
        armNames.forEach { name ->
            val source = state.arms.getValue(name)
            require(source.covariance.size == CONTEXT_DIMENSION && source.covariance.all { row ->
                row.size == CONTEXT_DIMENSION && row.all { it.isFinite() && it <= 1e9 && it >= -1e9 }
            })
            require(source.reward.size == CONTEXT_DIMENSION && source.reward.all { it.isFinite() && it in -1e9..1e9 })
            val arm = Arm()
            for (i in 0 until CONTEXT_DIMENSION) {
                for (j in 0 until CONTEXT_DIMENSION) {
                    require(kotlin.math.abs(source.covariance[i][j] - source.covariance[j][i]) < 1e-6)
                    arm.a[i][j] = source.covariance[i][j]
                }
                arm.b[i] = source.reward[i]
            }
            arm.inverse = invert(arm.a)
            candidate.arms[name] = arm
        }
        require(profileId in profiles || profiles.size < maxProfiles) { "Profile capacity reached" }
        profiles[profileId] = candidate
    }

    @Synchronized fun removeProfile(profileId: String) { require(validId(profileId)); profiles.remove(profileId) }

    private fun dot(a: List<Double>, b: List<Double>) = a.indices.sumOf { a[it] * b[it] }
    private fun multiply(matrix: Array<DoubleArray>, vector: List<Double>) =
        DoubleArray(CONTEXT_DIMENSION) { i -> (0 until CONTEXT_DIMENSION).sumOf { j -> matrix[i][j] * vector[j] } }

    private fun invert(matrix: Array<DoubleArray>): Array<DoubleArray> {
        val n = CONTEXT_DIMENSION
        // Imported matrices must be symmetric positive definite, as I + Σxxᵀ is.
        val lower = Array(n) { DoubleArray(n) }
        for (i in 0 until n) for (j in 0..i) {
            var value = matrix[i][j]
            for (k in 0 until j) value -= lower[i][k] * lower[j][k]
            if (i == j) {
                require(value.isFinite() && value > 1e-10) { "Invalid covariance" }
                lower[i][j] = sqrt(value)
            } else lower[i][j] = value / lower[j][j]
        }
        val work = Array(n) { i -> DoubleArray(n * 2) { j -> if (j < n) matrix[i][j] else if (j - n == i) 1.0 else 0.0 } }
        for (column in 0 until n) {
            val pivot = (column until n).maxBy { kotlin.math.abs(work[it][column]) }
            require(kotlin.math.abs(work[pivot][column]) > 1e-10) { "Singular covariance" }
            val swap = work[column]; work[column] = work[pivot]; work[pivot] = swap
            val scale = work[column][column]
            for (j in 0 until n * 2) work[column][j] /= scale
            for (row in 0 until n) if (row != column) {
                val factor = work[row][column]
                for (j in 0 until n * 2) work[row][j] -= factor * work[column][j]
            }
        }
        val result = Array(n) { i -> DoubleArray(n) { j -> work[i][j + n] } }
        require(result.all { row -> row.all { it.isFinite() } })
        return result
    }
}
