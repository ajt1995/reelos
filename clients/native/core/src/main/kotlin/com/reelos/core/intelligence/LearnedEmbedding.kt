package com.reelos.core.intelligence

import kotlin.math.sqrt

/** Externally supplied learned semantic representation. This class does not generate a model vector. */
class LearnedEmbedding(
    val modelId: String,
    val modelVersion: String,
    val provenance: String,
    values: FloatArray,
) {
    private val vector: FloatArray
    val values: FloatArray get() = vector.copyOf()

    init {
        require(modelId.isNotBlank() && modelId.length <= 128)
        require(modelVersion.isNotBlank() && modelVersion.length <= 128)
        require(provenance.isNotBlank() && provenance.length <= 512)
        require(values.size == DIMENSION && values.all { it.isFinite() })
        require(values.any { it != 0f })
        vector = values.copyOf()
    }

    /** Null means incompatible model spaces or invalid geometry; callers must not rank it as a match. */
    fun cosineWith(other: LearnedEmbedding): Double? {
        if (modelId != other.modelId || modelVersion != other.modelVersion) return null
        var dot = 0.0; var left = 0.0; var right = 0.0
        for (i in vector.indices) {
            val a = vector[i].toDouble(); val b = other.vector[i].toDouble()
            dot += a * b; left += a * a; right += b * b
        }
        if (left <= 0.0 || right <= 0.0 || !dot.isFinite()) return null
        return (dot / sqrt(left * right)).takeIf { it.isFinite() }?.coerceIn(-1.0, 1.0)
    }

    companion object { const val DIMENSION = 512 }
}
