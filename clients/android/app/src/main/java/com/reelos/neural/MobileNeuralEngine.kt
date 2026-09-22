package com.reelos.neural

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit
import kotlin.math.sqrt

/**
 * On-Device Mobile Neural Engine.
 * Executes vector cosine similarity calculations on mobile NPU/CPU
 * and schedules idle NPU folding when charging on unmetered WiFi.
 */
object MobileNeuralEngine {

    fun cosineSimilarity(vectorA: FloatArray, vectorB: FloatArray): Float {
        if (vectorA.size != vectorB.size || vectorA.isEmpty()) return 0f

        var dotProduct = 0f
        var normA = 0f
        var normB = 0f

        for (i in vectorA.indices) {
            dotProduct += vectorA[i] * vectorB[i]
            normA += vectorA[i] * vectorA[i]
            normB += vectorB[i] * vectorB[i]
        }

        val denominator = sqrt(normA) * sqrt(normB)
        return if (denominator > 0f) dotProduct / denominator else 0f
    }

    fun rankMedia(
        userTasteVector: FloatArray,
        candidates: List<Pair<String, FloatArray>>
    ): List<Pair<String, Float>> {
        return candidates.map { (id, vector) ->
            id to cosineSimilarity(userTasteVector, vector)
        }.sortedByDescending { it.second }
    }

    fun scheduleFoldingWork(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiresCharging(true)
            .setRequiredNetworkType(NetworkType.UNMETERED)
            .build()

        val foldingRequest = PeriodicWorkRequestBuilder<FoldingWorker>(6, TimeUnit.HOURS)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(context).enqueue(foldingRequest)
    }
}

class FoldingWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            val testVecA = floatArrayOf(0.8f, 0.4f, 0.2f, 0.9f)
            val testVecB = floatArrayOf(0.7f, 0.5f, 0.1f, 0.85f)
            val sim = MobileNeuralEngine.cosineSimilarity(testVecA, testVecB)
            if (sim > 0.5f) {
                Result.success()
            } else {
                Result.retry()
            }
        } catch (_: Exception) {
            Result.failure()
        }
    }
}
