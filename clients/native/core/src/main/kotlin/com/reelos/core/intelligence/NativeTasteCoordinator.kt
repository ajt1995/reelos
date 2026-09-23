package com.reelos.core.intelligence

import com.reelos.core.MediaRecord
import com.reelos.core.ProfileState
import com.reelos.core.ReactionKind

enum class TasteRankingKind { LEARNED, FALLBACK, PRESSURE }

data class TasteRankingTrace(
    val kind: TasteRankingKind,
    val reason: String,
    val trainedReactions: Int,
    val learnedCandidates: Int,
    val cacheHit: Boolean,
    val replayNumber: Long,
)

/**
 * Replays the durable reaction snapshot into a small profile-private learner.
 * The learned factors only compare already rated catalog IDs; unseen titles retain stable
 * title order. Less is a deterministic recommendation exclusion; Dismiss is a neutral
 * calibration skip and remains visible here. Neither is a learned prediction.
 * Callers keep Library/saved collections on the unfiltered catalog.
 */
class NativeTasteCoordinator(
    private val gate: LearningGate = LearningGate { true },
    private val maxCachedProfiles: Int = 8,
    private val maxReactions: Int = 512,
    private val maxCandidates: Int = 2048,
    private val epochs: Int = 4,
) {
    private data class Reactions(
        val positive: Map<String, ReactionKind>,
        val less: Set<String>,
        val seededIds: Set<String>,
    )
    private data class Cached(val reactions: Reactions, val learner: LocalLearning?, val trained: Int, val replayNumber: Long)
    private val cache = LinkedHashMap<String, Cached>(16, 0.75f, true)
    private val traces = LinkedHashMap<String, TasteRankingTrace>(16, 0.75f, true)
    private val replayNumbers = LinkedHashMap<String, Long>(16, 0.75f, true)

    init {
        require(maxCachedProfiles in 1..32 && maxReactions in 1..512 && maxCandidates in 1..4096 && epochs in 1..8)
    }

    @Synchronized fun lastTrace(profileId: String): TasteRankingTrace? = traces[profileId]
    @Synchronized fun cachedProfileCount(): Int = cache.size

    @Synchronized fun rank(profile: ProfileState, media: List<MediaRecord>): List<MediaRecord> {
        require(profile.id.isNotBlank() && profile.id.length <= 128)
        require(media.size <= maxCandidates) { "Rank a bounded catalog page" }
        val visible = media.filter { it.id !in profile.lessLikeIds }
        val titleOrder = compareBy<MediaRecord>({ it.title.lowercase() }, { it.id })
        // Seeds may be titles or catalog IDs selected during onboarding. Only exact
        // matches are evidence for an item; no keyword/hash projection is invented.
        val seededIds = media.asSequence().filter { item ->
            item.id !in profile.positiveReactions &&
                item.id !in profile.lessLikeIds &&
                item.id !in profile.dismissedIds &&
                (item.id in profile.tasteSeeds || item.title in profile.tasteSeeds)
        }.map { it.id }.toSet()
        val inputCount = profile.positiveReactions.size + profile.lessLikeIds.size + seededIds.size
        if (inputCount > maxReactions) {
            record(profile.id, TasteRankingTrace(TasteRankingKind.FALLBACK, "learning-input-budget", 0, 0, false, replayNumbers[profile.id] ?: 0))
            return visible.sortedWith(titleOrder)
        }

        val durable = Reactions(
            profile.positiveReactions.toMap(),
            profile.lessLikeIds.toSet(),
            seededIds,
        )
        val prior = cache[profile.id]
        val hit = prior?.reactions == durable
        val current = if (hit) prior!! else replay(profile.id, durable)
        if (current == null) {
            // A yielded build is never published. A previously cached model for another
            // snapshot cannot be used for the changed durable reactions.
            record(profile.id, TasteRankingTrace(TasteRankingKind.PRESSURE, "learning-gate-yielded", 0, 0, false, replayNumbers[profile.id] ?: 0))
            return visible.sortedWith(titleOrder)
        }
        if (!hit) putBounded(cache, profile.id, current)
        val model = current.learner
        val scores = HashMap<String, Double>()
        if (model != null) for (item in visible) {
            if (item.id in durable.positive || item.id in durable.seededIds) {
                model.predictedPreference(profile.id, item.id)?.let { scores[item.id] = it }
            }
        }
        val ordered = if (scores.isEmpty()) visible.sortedWith(titleOrder) else visible.sortedWith(
            compareByDescending<MediaRecord> { reactionWeight(durable.positive[it.id]) + if (it.id in durable.seededIds) 0.7 else 0.0 }
                .thenByDescending { scores[it.id] ?: Double.NEGATIVE_INFINITY }
                .then(titleOrder)
        )
        val kind = if (scores.isEmpty()) TasteRankingKind.FALLBACK else TasteRankingKind.LEARNED
        val reason = when {
            current.trained == 0 -> "no-trainable-reactions"
            scores.isEmpty() -> "no-trained-candidates"
            else -> "rated-item-factors"
        }
        record(profile.id, TasteRankingTrace(kind, reason, current.trained, scores.size, hit, current.replayNumber))
        return ordered
    }

    private fun replay(profileId: String, reactions: Reactions): Cached? {
        val observations = buildList {
            reactions.positive.entries.sortedBy { it.key }.forEach { (id, kind) ->
                require(kind in setOf(ReactionKind.LOVE, ReactionKind.LIKE, ReactionKind.COZY))
                add(id to reactionWeight(kind))
            }
            reactions.less.sorted().forEach { add(it to -0.8) }
            reactions.seededIds.sorted().forEach { add(it to 0.7) }
        }
        val number = (replayNumbers[profileId] ?: 0) + 1
        if (observations.isEmpty()) {
            replayNumbers[profileId] = number
            return Cached(reactions, null, 0, number)
        }
        if (!gate.mayLearn()) return null
        val candidate = LocalLearning(
            factorDimension = 16,
            maxProfiles = 1,
            maxItemsPerProfile = maxReactions,
            seed = stableSeed(profileId),
            gate = gate,
        )
        repeat(epochs) {
            for ((id, reward) in observations) if (!candidate.observe(profileId, id, reward)) return null
        }
        replayNumbers[profileId] = number
        return Cached(reactions, candidate, observations.size, number)
    }

    private fun reactionWeight(kind: ReactionKind?): Double = when (kind) {
        ReactionKind.LOVE -> 1.0
        ReactionKind.LIKE -> 0.7
        ReactionKind.COZY -> 0.55
        else -> 0.0
    }

    private fun stableSeed(profileId: String): Int {
        var hash = -2128831035
        profileId.forEach { hash = (hash xor it.code) * 16777619 }
        return hash
    }

    private fun record(profileId: String, trace: TasteRankingTrace) = putBounded(traces, profileId, trace)

    private fun <T> putBounded(map: LinkedHashMap<String, T>, key: String, value: T) {
        if (key !in map && map.size >= maxCachedProfiles) map.remove(map.keys.first())
        map[key] = value
        if (map === cache && replayNumbers.size > maxCachedProfiles) {
            // Keep only counters for resident profiles. A reloaded profile still replays
            // deterministically from its durable reactions.
            replayNumbers.keys.retainAll(cache.keys)
        }
    }
}
